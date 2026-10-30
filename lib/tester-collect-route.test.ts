import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, type FakeDb } from "./billing-fakes";
import { EVENT_CAPS } from "./tester-events";

/**
 * POST /api/tester/collect (consent version 3, migration 0022), against
 * the in-memory Supabase of lib/billing-fakes.ts. The one writer of
 * public.tester_events: it must store nothing for anyone who is not a
 * tester on version 3, and clean every field for one who is.
 */

const TESTER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const OLDER = "0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d";
const STRANGER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const h = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
  limited: new Set<string>(),
  consumed: [] as string[],
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const resolve = async (header: string | null) => {
    if (!header?.startsWith("Bearer ")) return { kind: "none" as const };
    const user = h.sessions.get(header.slice(7));
    return user ? { kind: "user" as const, user } : { kind: "rejected" as const };
  };
  return {
    ...(await importOriginal<typeof import("@/lib/db")>()),
    supabaseAdmin: () => h.db,
    resolveAuthHeader: vi.fn(resolve),
  };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async (subject: string) => {
    h.consumed.push(subject);
    return h.limited.has(subject)
      ? { allowed: false, window: "hour", retryAfterS: 600 }
      : { allowed: true, window: null, retryAfterS: 0 };
  }),
}));

import { POST as collect } from "@/app/api/tester/collect/route";
import { resetRoomForTests } from "./tester-room";

let db: FakeDb;

beforeEach(() => {
  db = fakeDb([TESTER, OLDER, STRANGER]);
  h.db = db.asClient();
  db.put("testers", { user_id: TESTER, consent_version: 3, consented_at: "2026-10-30T09:00:00.000Z" });
  db.put("testers", { user_id: OLDER, consent_version: 2, consented_at: "2026-10-29T09:00:00.000Z" });
  h.sessions.clear();
  h.sessions.set("tok_tester", { id: TESTER, anonymous: true, email: null });
  h.sessions.set("tok_older", { id: OLDER, anonymous: false, email: "o@example.com" });
  h.sessions.set("tok_stranger", { id: STRANGER, anonymous: true, email: null });
  h.limited.clear();
  h.consumed.length = 0;
  resetRoomForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const NOW = Date.now();
const BATCH = [
  {
    kind: "device",
    name: "open",
    at: NOW - 1000,
    open: "o1",
    screen: "/",
    data: { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", screen_w: 390, screen_h: 844, home_screen: true, email: "x@y.z" },
  },
  { kind: "usage", name: "tap", at: NOW - 500, open: "o1", screen: "/tester?code=1234", label: "Continue", data: { value: "1234" } },
  { kind: "usage", name: "screen", at: NOW - 400, open: "o1", screen: "/", ms: 4200 },
];

async function call(
  body: unknown,
  opts: { token?: string | null; ip?: string; raw?: string } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "content-type": "text/plain;charset=UTF-8",
    "x-forwarded-for": opts.ip ?? "203.0.113.9, 10.0.0.1",
  };
  const token = opts.token === undefined ? "tok_tester" : opts.token;
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request("https://preview.speakethos.test/api/tester/collect", {
    method: "POST",
    headers,
    body: opts.raw ?? JSON.stringify(body),
  });
  const res = await collect(req as unknown as NextRequest);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const events = () => db.state.tables.tester_events ?? [];

describe("POST /api/tester/collect, who it takes from", () => {
  it("takes nothing from an account that is not a tester, and spends nothing for it", async () => {
    const res = await call({ events: BATCH }, { token: "tok_stranger" });
    expect(res).toEqual({ status: 403, body: { error: "Not testing.", stop: true } });
    expect(events()).toEqual([]);
    expect(h.consumed).toEqual([]);
    expect(db.state.log.filter((l) => l.op !== "select")).toEqual([]);
  });

  it("takes nothing from a tester on an older consent until they agree to version 3", async () => {
    expect((await call({ events: BATCH }, { token: "tok_older" })).body).toMatchObject({ stop: true });
    expect(events()).toEqual([]);
  });

  it("takes nothing without a session, or with a lapsed one", async () => {
    expect((await call({ events: BATCH }, { token: null })).status).toBe(401);
    expect((await call({ events: BATCH }, { token: "tok_gone" })).status).toBe(401);
    expect(events()).toEqual([]);
  });

  it("reads the token from the body when the page is hiding (a beacon carries no headers)", async () => {
    const res = await call({ events: BATCH, token: "tok_tester" }, { token: null });
    expect(res).toEqual({ status: 200, body: { ok: true, kept: 3 } });
    // A stranger's token in the body is a stranger.
    expect((await call({ events: BATCH, token: "tok_stranger" }, { token: null })).status).toBe(403);
  });
});

describe("POST /api/tester/collect, what it keeps", () => {
  it("writes each event cleaned, owned by the tester, the address on the device row only", async () => {
    const res = await call({ events: BATCH });
    expect(res).toEqual({ status: 200, body: { ok: true, kept: 3 } });
    const [device, tap, screen] = events();
    expect(device).toMatchObject({ user_id: TESTER, kind: "device", name: "open", open_id: "o1", screen: "/", ip: "203.0.113.9" });
    expect(device.data).toMatchObject({ os: "iOS 18.1", model: "iPhone", screen_w: 390, home_screen: true });
    expect(device.data).not.toHaveProperty("email");
    // The code page's query never lands, and a tap keeps its name, never a value.
    expect(tap).toMatchObject({ kind: "usage", name: "tap", screen: "/tester", label: "Continue", ip: null });
    expect(tap.data).toEqual({});
    expect(JSON.stringify(events())).not.toContain("1234");
    expect(screen).toMatchObject({ name: "screen", ms: 4200, ip: null });
    expect(h.consumed).toEqual([`tester-collect:u:${TESTER}`]);
  });

  it("keeps no address that is not one", async () => {
    await call({ events: BATCH }, { ip: "unknown" });
    expect(events()[0].ip).toBeNull();
  });

  it("is done with a batch that holds nothing Ethos sends", async () => {
    expect(await call({ events: [{ kind: "keys", name: "press" }] })).toEqual({ status: 200, body: { ok: true, kept: 0 } });
    expect(await call({ nothing: true })).toEqual({ status: 200, body: { ok: true, kept: 0 } });
    expect(events()).toEqual([]);
  });

  it("refuses a body past its size, or one that is not JSON, before the session is asked", async () => {
    const big = JSON.stringify({ events: [{ kind: "usage", name: "tap", label: "x".repeat(EVENT_CAPS.body) }] });
    expect((await call(null, { raw: big })).status).toBe(413);
    expect((await call(null, { raw: "not json" })).status).toBe(400);
    expect(events()).toEqual([]);
  });

  it("refuses a tester over the limit, and writes nothing", async () => {
    h.limited.add(`tester-collect:u:${TESTER}`);
    expect((await call({ events: BATCH })).status).toBe(429);
    expect(events()).toEqual([]);
  });

  it("keeps at most its cap per account, and is done with the rest", async () => {
    for (let i = 0; i < EVENT_CAPS.perAccount - 1; i++) db.put("tester_events", { user_id: TESTER, kind: "usage", name: "tap" });
    expect(await call({ events: BATCH })).toEqual({ status: 200, body: { ok: true, kept: 1 } });
    expect(await call({ events: BATCH })).toEqual({ status: 200, body: { ok: true, kept: 0, full: true } });
    expect(events()).toHaveLength(EVENT_CAPS.perAccount);
  });

  /*
   * Review P4: the code is the first anyone guesses, so a stranger can
   * mint testers; each one's rows must stay small, and the table as a
   * whole has a ceiling, so it can never fill the database.
   */
  it("keeps at most twenty errors from one open, counting the ones it already holds", async () => {
    for (let i = 0; i < 15; i++) db.put("tester_events", { user_id: TESTER, kind: "error", name: "window", open_id: "o1" });
    const errors = Array.from({ length: 12 }, (_, i) => ({ kind: "error", name: "window", at: NOW, open: "o1", data: { message: `E${i}` } }));
    const other = Array.from({ length: 3 }, (_, i) => ({ kind: "error", name: "window", at: NOW, open: "o2", data: { message: `F${i}` } }));
    expect(await call({ events: [...errors, ...other, BATCH[2]] })).toEqual({ status: 200, body: { ok: true, kept: 5 + 3 + 1 } });
    const kept = events().filter((e) => e.kind === "error");
    expect(kept.filter((e) => e.open_id === "o1")).toHaveLength(EVENT_CAPS.errorsPerOpen);
    expect(kept.filter((e) => e.open_id === "o2")).toHaveLength(3);
  });

  it("takes nothing more once the events table has used its room, and the phone stops resending", async () => {
    db.state.rpc.tester_events_bytes = 151 * 1024 * 1024;
    expect(await call({ events: BATCH })).toEqual({ status: 200, body: { ok: true, kept: 0, full: true } });
    expect(events()).toEqual([]);
  });

  it("writes as before while the table has room, or while its size cannot be read", async () => {
    db.state.rpc.tester_events_bytes = 2 * 1024 * 1024;
    expect((await call({ events: BATCH })).body).toEqual({ ok: true, kept: 3 });
    resetRoomForTests();
    delete db.state.rpc.tester_events_bytes;
    expect((await call({ events: BATCH })).body).toEqual({ ok: true, kept: 3 });
  });

  it("keeps no error that is all another site's, read against the page's own host", async () => {
    const extension = { kind: "error", name: "rejection", at: NOW, open: "o1", data: { message: "MetaMask", stack: "E\n at chrome-extension://x/inpage.js:1:1" } };
    const google = { kind: "error", name: "rejection", at: NOW, open: "o1", data: { message: "x", stack: "x\n at a (https://accounts.google.com/gsi/client:1:2)" } };
    const ours = { kind: "error", name: "window", at: NOW, open: "o1", data: { message: "y", stack: "y\n at f (https://preview.speakethos.test/_next/static/chunks/a.js?dpl=d1:1:2)\n at a (https://accounts.google.com/gsi/client:1:2)" } };
    expect((await call({ events: [extension, google, ours] })).body).toEqual({ ok: true, kept: 1 });
    expect(events()[0].data).toMatchObject({ stack: "y\n at f (/_next/static/chunks/a.js:1:2)" });
  });

  it("lets a row the table refuses go, and keeps the rest of the batch", async () => {
    db.state.fail.push({ table: "tester_events", op: "insert", error: { code: "23514", message: "check" } });
    db.state.fail.push({ table: "tester_events", op: "insert", error: { code: "23514", message: "check" } });
    expect(await call({ events: BATCH })).toEqual({ status: 200, body: { ok: true, kept: 2 } });
  });

  it("asks for the batch again when the write fails on the server's side", async () => {
    db.state.fail.push({ table: "tester_events", op: "insert", error: { code: "XX000", message: "down" } });
    expect((await call({ events: BATCH })).status).toBe(502);
    expect(events()).toEqual([]);
  });
});
