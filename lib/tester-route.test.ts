import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { CODE_COPY, CONSENT_VERSION, JOINED_COPY } from "@/content/tester";
import { fakeDb, type FakeDb } from "./billing-fakes";

/**
 * POST /api/tester (migration 0020), against the in-memory Supabase of
 * lib/billing-fakes.ts. The session and the limiter are swapped;
 * everything else is the route as the browser meets it. Account
 * deletion runs here too, because "deleting your account deletes it
 * too" is a sentence on the consent screen.
 */

const USER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const ANON = "0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d";

const h = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
  limited: new Set<string>(),
  /** The limiter as Postgres runs it (0006, 0017): slots per subject, under a cap when one is set. */
  cap: 0,
  slots: new Map<string, number>(),
}));

vi.mock("@/lib/stripe", () => ({
  stripeClient: () => null,
  webhookSecret: () => null,
  billingConfigured: () => false,
  stripeLivemode: () => false,
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
    getUserFromAuthHeader: vi.fn(async (header: string | null) => {
      const r = await resolve(header);
      return r.kind === "user" ? r.user : null;
    }),
  };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async (subject: string) => {
    const used = h.slots.get(subject) ?? 0;
    if (h.limited.has(subject) || (h.cap > 0 && used >= h.cap)) {
      return { allowed: false, window: "hour", retryAfterS: 1200 };
    }
    h.slots.set(subject, used + 1);
    return { allowed: true, window: null, retryAfterS: 0 };
  }),
  refundRateLimit: vi.fn(async (subject: string) => {
    h.slots.set(subject, Math.max(0, (h.slots.get(subject) ?? 0) - 1));
  }),
}));

import { POST as tester } from "@/app/api/tester/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { consumeRateLimit, LIMITS, refundRateLimit } from "./rate-limit";

let db: FakeDb;

beforeEach(() => {
  db = fakeDb([USER, ANON]);
  h.db = db.asClient();
  h.sessions.clear();
  h.sessions.set("tok_user", { id: USER, anonymous: false, email: "tim@example.com" });
  h.sessions.set("tok_anon", { id: ANON, anonymous: true, email: null });
  h.limited.clear();
  h.cap = 0;
  h.slots.clear();
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(refundRateLimit).mockClear();
  vi.stubEnv("TESTER_CODE", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function call(
  body: unknown,
  opts: { token?: string | null; ip?: string; method?: string; handler?: (r: NextRequest) => Promise<Response> } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": opts.ip ?? "203.0.113.9",
  };
  const token = opts.token === undefined ? "tok_user" : opts.token;
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request("https://preview.speakethos.test/api/tester", {
    method: opts.method ?? "POST",
    headers,
    body: opts.method === "DELETE" ? undefined : JSON.stringify(body),
  });
  const res = await (opts.handler ?? tester)(req as unknown as NextRequest);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const written = () => db.state.log.filter((l) => l.op !== "select");

describe("POST /api/tester, the code", () => {
  it("is 1234 when TESTER_CODE is unset, and checking it stores nothing", async () => {
    expect(await call({ code: "1234" })).toEqual({
      status: 200,
      body: { ok: true, consentVersion: CONSENT_VERSION },
    });
    expect(written()).toEqual([]);
    expect(db.row("testers", USER)).toBeUndefined();
  });

  it("is TESTER_CODE when set, and 1234 stops working", async () => {
    vi.stubEnv("TESTER_CODE", " 4821 ");
    expect((await call({ code: "1234" })).status).toBe(403);
    expect((await call({ code: "4821" })).status).toBe(200);
  });

  it("refuses a wrong code, a near miss, a longer one and no code, in the screen's words", async () => {
    for (const code of ["1235", "123", "12345", "", 1234, null]) {
      const res = await call({ code });
      expect(res, String(code)).toEqual({ status: 403, body: { error: CODE_COPY.wrong } });
    }
    expect((await call(null)).status).toBe(403);
    expect(written()).toEqual([]);
  });

  it("checks without a session, and then nothing is minted or stored", async () => {
    expect((await call({ code: "1234" }, { token: null })).status).toBe(200);
    expect(written()).toEqual([]);
  });

  it("tells a lapsed session from no session", async () => {
    expect((await call({ code: "1234" }, { token: "tok_gone" })).status).toBe(401);
  });

  it("limits guesses by address, so fresh anonymous ids buy no more tries", async () => {
    h.limited.add("tester:ip:203.0.113.9");
    const res = await call({ code: "1234" }, { token: "tok_anon" });
    expect(res).toEqual({ status: 429, body: { error: CODE_COPY.tooMany } });
    expect(consumeRateLimit).toHaveBeenCalledWith("tester:ip:203.0.113.9", "user");
    // Refused before the code is looked at: a limited guesser learns nothing.
    expect(written()).toEqual([]);
  });

  it("limits guesses by account too, from any address", async () => {
    h.limited.add(`tester:u:${ANON}`);
    const res = await call({ code: "1234" }, { token: "tok_anon", ip: "198.51.100.7" });
    expect(res.status).toBe(429);
    expect(consumeRateLimit).toHaveBeenCalledWith(`tester:u:${ANON}`, "user");
  });

  /*
   * Friends join together, on one school's or one house's Wi-Fi. Only a
   * wrong guess may spend the address's allowance: the right code gives
   * its slot back once it has been checked (checked first, so a limited
   * address still learns nothing).
   */
  it("lets a room of friends on one address all join, and still stops a guesser", async () => {
    h.cap = LIMITS.user.hour;
    for (let i = 0; i < 12; i++) {
      const token = `tok_friend_${i}`;
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      db.state.users.add(id);
      h.sessions.set(token, { id, anonymous: true, email: null });
      expect((await call({ code: "1234" }, { token: null, ip: "203.0.113.7" })).status, `friend ${i} check`).toBe(200);
      expect((await call({ code: "1234", agree: CONSENT_VERSION }, { token, ip: "203.0.113.7" })).status, `friend ${i} agree`).toBe(200);
    }
    expect(db.state.tables.testers).toHaveLength(12);

    const guesses: number[] = [];
    for (let i = 0; i < LIMITS.user.hour + 2; i++) {
      guesses.push((await call({ code: String(1000 + i) }, { token: null, ip: "203.0.113.7" })).status);
    }
    expect(guesses).toEqual([...Array(LIMITS.user.hour).fill(403), 429, 429]);
    // Over the limit, the right code is refused too: nothing to learn.
    expect((await call({ code: "1234" }, { token: null, ip: "203.0.113.7" })).status).toBe(429);
  });
});

describe("POST /api/tester, the consent", () => {
  it("writes the version and the time in the one row that makes a tester", async () => {
    const before = Date.now();
    const res = await call({ code: "1234", agree: CONSENT_VERSION });
    expect(res.status).toBe(200);
    const row = db.row("testers", USER)!;
    expect(row).toMatchObject({ user_id: USER, consent_version: CONSENT_VERSION });
    expect(Date.parse(row.consented_at as string)).toBeGreaterThanOrEqual(before);
    expect(res.body).toEqual({
      ok: true,
      tester: { consent_version: CONSENT_VERSION, consented_at: row.consented_at },
    });
    expect(written()).toEqual([{ table: "testers", op: "upsert" }]);
  });

  it("works for an anonymous-first account", async () => {
    expect((await call({ code: "1234", agree: CONSENT_VERSION }, { token: "tok_anon" })).status).toBe(200);
    expect(db.row("testers", ANON)).toMatchObject({ consent_version: CONSENT_VERSION });
  });

  it("grants no Premium: the profile is never touched", async () => {
    await call({ code: "1234", agree: CONSENT_VERSION });
    expect(db.row("profiles", USER)).toBeUndefined();
    expect(db.state.log.some((l) => l.table === "profiles")).toBe(false);
  });

  it("needs the code again, so consent alone makes nobody a tester", async () => {
    expect((await call({ code: "9999", agree: CONSENT_VERSION })).status).toBe(403);
    expect((await call({ agree: CONSENT_VERSION })).status).toBe(403);
    expect(db.row("testers", USER)).toBeUndefined();
  });

  it("refuses a consent the screen no longer shows", async () => {
    const res = await call({ code: "1234", agree: CONSENT_VERSION + 1 });
    expect(res).toEqual({
      status: 409,
      body: { error: JOINED_COPY.changed, consentVersion: CONSENT_VERSION },
    });
    expect((await call({ code: "1234", agree: "1" })).status).toBe(409);
    expect(db.row("testers", USER)).toBeUndefined();
  });

  it("needs a session to agree", async () => {
    expect((await call({ code: "1234", agree: CONSENT_VERSION }, { token: null })).status).toBe(401);
    expect(written()).toEqual([]);
  });

  it("says so when the write fails, and a retry lands it", async () => {
    db.state.fail.push({ table: "testers", op: "upsert", error: { code: "XX000", message: "boom" } });
    expect(await call({ code: "1234", agree: CONSENT_VERSION })).toEqual({
      status: 502,
      body: { error: JOINED_COPY.saveFailed },
    });
    expect(db.row("testers", USER)).toBeUndefined();
    expect((await call({ code: "1234", agree: CONSENT_VERSION })).status).toBe(200);
  });

  it("agreeing twice keeps one row, and the first time it was agreed", async () => {
    const first = await call({ code: "1234", agree: CONSENT_VERSION });
    const at = db.row("testers", USER)!.consented_at;
    await new Promise((r) => setTimeout(r, 5));
    const again = await call({ code: "1234", agree: CONSENT_VERSION });
    expect(db.state.tables.testers).toHaveLength(1);
    expect(db.row("testers", USER)!.consented_at).toBe(at);
    expect(again).toEqual(first);
  });

  /*
   * Consent version 3 names everything kept (30 Oct). A tester on 1 or
   * 2 reads it once on their next open and agrees again, with no code
   * to type: their row is the proof, and the slot comes back.
   */
  it("lets a tester on an older consent agree to the new one without the code", async () => {
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION - 1, consented_at: "2026-10-29T09:00:00.000Z" });
    h.cap = LIMITS.user.hour;
    const res = await call({ agree: CONSENT_VERSION });
    expect(res.status).toBe(200);
    expect(db.row("testers", USER)).toMatchObject({ consent_version: CONSENT_VERSION });
    expect(res.body).toMatchObject({ ok: true, tester: { consent_version: CONSENT_VERSION } });
    expect(h.slots.get(`tester:u:${USER}`)).toBe(0);
  });

  it("without the code, still refuses an account that is not a tester, and counts it as a guess", async () => {
    const res = await call({ agree: CONSENT_VERSION });
    expect(res).toEqual({ status: 403, body: { error: CODE_COPY.wrong } });
    expect(h.slots.get(`tester:u:${USER}`)).toBe(1);
    expect((await call({ agree: CONSENT_VERSION }, { token: null })).status).toBe(403);
    expect(db.row("testers", USER)).toBeUndefined();
  });

  it("without the code, refuses a consent the screen no longer shows", async () => {
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION - 1, consented_at: "2026-10-29T09:00:00.000Z" });
    expect((await call({ agree: CONSENT_VERSION + 1 })).status).toBe(409);
    expect(db.row("testers", USER)).toMatchObject({ consent_version: CONSENT_VERSION - 1 });
  });

  it("an older consent is replaced by the new one, with the new time", async () => {
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION - 1, consented_at: "2026-10-29T09:00:00.000Z" });
    const res = await call({ code: "1234", agree: CONSENT_VERSION });
    expect(res.status).toBe(200);
    expect(db.row("testers", USER)).toMatchObject({ consent_version: CONSENT_VERSION });
    expect(db.row("testers", USER)!.consented_at).not.toBe("2026-10-29T09:00:00.000Z");
  });
});

/*
 * Review P4: the code is the first anyone guesses, so the number of
 * testers has a ceiling (TESTER_LIMIT, 60), and a stranger with the
 * code cannot mint testers without end. A tester already on the list
 * is never refused.
 */
describe("POST /api/tester, a full test", () => {
  const fill = (n: number) => {
    for (let i = 0; i < n; i++) {
      db.put("testers", { user_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, consent_version: CONSENT_VERSION, consented_at: "2026-10-30T09:00:00.000Z" });
    }
  };

  it("refuses a new tester once sixty have joined, at the code and at the agree", async () => {
    fill(60);
    expect(await call({ code: "1234" })).toEqual({ status: 423, body: { error: CODE_COPY.full } });
    expect(await call({ code: "1234", agree: CONSENT_VERSION })).toEqual({ status: 423, body: { error: CODE_COPY.full } });
    expect(db.row("testers", USER)).toBeUndefined();
  });

  it("is TESTER_LIMIT when set", async () => {
    vi.stubEnv("TESTER_LIMIT", "2");
    fill(1);
    expect((await call({ code: "1234", agree: CONSENT_VERSION })).status).toBe(200);
    expect((await call({ code: "1234", agree: CONSENT_VERSION }, { token: "tok_anon" })).status).toBe(423);
  });

  it("never refuses a tester already on the list, agreeing again included", async () => {
    fill(60);
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION - 1, consented_at: "2026-10-29T09:00:00.000Z" });
    expect((await call({ agree: CONSENT_VERSION })).status).toBe(200);
    expect((await call({ code: "1234" })).status).toBe(200);
    expect(db.row("testers", USER)).toMatchObject({ consent_version: CONSENT_VERSION });
  });
});

/*
 * A friend who joins on the introduction and then signs in to the
 * account they already had: signing in swaps the anonymous session for
 * the account, and the testing they agreed to on this phone goes with
 * them, consent version and time as they gave them.
 */
describe("POST /api/tester, carrying testing to the account signed in to", () => {
  const AT = "2026-10-30T09:00:00.000Z";

  it("moves the anonymous tester's consent to the account", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    const res = await call({ carry: "tok_anon" });
    expect(res).toEqual({ status: 200, body: { ok: true, tester: { consent_version: CONSENT_VERSION, consented_at: AT } } });
    expect(db.row("testers", USER)).toMatchObject({ consent_version: CONSENT_VERSION, consented_at: AT });
    expect(db.row("testers", ANON)).toBeUndefined();
  });

  it("moves what the phone sent as the anonymous session with them (0022)", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    db.put("tester_events", { user_id: ANON, kind: "device", name: "open" });
    db.put("tester_events", { user_id: ANON, kind: "usage", name: "tap", label: "Start" });
    expect((await call({ carry: "tok_anon" })).status).toBe(200);
    expect(db.state.tables.tester_events.map((e) => e.user_id)).toEqual([USER, USER]);
  });

  it("keeps the account's own consent when it is as new", async () => {
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION, consented_at: "2026-10-01T09:00:00.000Z" });
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    const res = await call({ carry: "tok_anon" });
    expect(res.status).toBe(200);
    expect(db.row("testers", USER)!.consented_at).toBe("2026-10-01T09:00:00.000Z");
  });

  it("moves nothing from an account that is not a tester, or from a real account", async () => {
    expect((await call({ carry: "tok_anon" })).status).toBe(404);
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION, consented_at: AT });
    h.sessions.set("tok_other", { id: ANON, anonymous: false, email: "other@example.com" });
    expect((await call({ carry: "tok_other" })).status).toBe(403);
    expect(db.row("testers", ANON)).toBeUndefined();
  });

  it("needs both sessions to be real ones", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    expect((await call({ carry: "tok_gone" })).status).toBe(403);
    expect((await call({ carry: "tok_anon" }, { token: null })).status).toBe(401);
    expect((await call({ carry: 42 })).status).toBe(403);
    expect(db.row("testers", USER)).toBeUndefined();
    expect(db.row("testers", ANON)).toMatchObject({ consented_at: AT });
  });

  it("never needs the code, and gives back the slot it used", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    h.cap = LIMITS.user.hour;
    expect((await call({ carry: "tok_anon" })).status).toBe(200);
    expect(h.slots.get("tester:ip:203.0.113.9")).toBe(0);
  });

  /*
   * Review P1 and F2: the answers and typed notes given on the anonymous
   * session stayed under its id, so the report listed them under a
   * tester number the friend never sent, and a deletion by their number
   * missed them. The recordings themselves stay where every signed-in
   * phone leaves them (lib/auth.ts), so the account remembers the
   * session it came from and its removal reaches them.
   */
  it("moves the anonymous session's answers and notes with them", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    db.put("tester_feedback", { user_id: ANON, client_id: "k-anon", felt: "okay", answer: "too_low", note: "my private note", updated_at: AT });
    expect((await call({ carry: "tok_anon" })).status).toBe(200);
    expect(db.state.tables.tester_feedback).toEqual([
      expect.objectContaining({ user_id: USER, client_id: "k-anon", felt: "okay", answer: "too_low", note: "my private note" }),
    ]);
  });

  it("keeps the newer of two answers about one recording", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    db.put("tester_feedback", { user_id: USER, client_id: "k-1", felt: "rough", answer: null, updated_at: "2026-10-30T08:00:00.000Z" });
    db.put("tester_feedback", { user_id: ANON, client_id: "k-1", felt: null, answer: "about_right", updated_at: "2026-10-30T08:05:00.000Z" });
    db.put("tester_feedback", { user_id: USER, client_id: "k-2", answer: "too_high", updated_at: "2026-10-30T08:09:00.000Z" });
    db.put("tester_feedback", { user_id: ANON, client_id: "k-2", answer: "too_low", updated_at: "2026-10-30T08:01:00.000Z" });
    expect((await call({ carry: "tok_anon" })).status).toBe(200);
    const rows = db.state.tables.tester_feedback;
    expect(rows.every((r) => r.user_id === USER)).toBe(true);
    expect(rows.find((r) => r.client_id === "k-1")).toMatchObject({ answer: "about_right", felt: "rough" });
    expect(rows.find((r) => r.client_id === "k-2")).toMatchObject({ answer: "too_high" });
    expect(rows).toHaveLength(2);
  });

  it("remembers the session it came from, and keeps the day they first joined", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT, created_at: "2026-10-30T08:00:00.000Z", carried_from: [] });
    expect((await call({ carry: "tok_anon" })).status).toBe(200);
    expect(db.row("testers", USER)).toMatchObject({ carried_from: [ANON], created_at: "2026-10-30T08:00:00.000Z" });
  });

  it("still carries the consent while the column that remembers is not there yet (0022 after the deploy)", async () => {
    db.put("testers", { user_id: ANON, consent_version: CONSENT_VERSION, consented_at: AT });
    db.state.fail.push({ table: "testers", op: "update", error: { code: "42703", message: 'column "carried_from" does not exist' } });
    expect((await call({ carry: "tok_anon" })).status).toBe(200);
    expect(db.row("testers", USER)).toMatchObject({ consent_version: CONSENT_VERSION });
  });
});

describe("deleting the account", () => {
  it("takes the tester row, the answers and the code's rate-limit rows with it", async () => {
    await call({ code: "1234", agree: CONSENT_VERSION });
    db.put("tester_feedback", { user_id: USER, client_id: "k1", answer: "too_low", note: "Felt faster", felt: "rough" });
    db.put("tester_events", { user_id: USER, kind: "device", name: "open" });
    db.put("rate_limits", { subject: `tester:u:${USER}` });
    // On Postgres the cascade on each user_id does this (0020); the fake
    // models the same references, and scripts/check-testers-sql.mjs
    // watches the real one.
    expect((await call(undefined, { method: "DELETE", handler: deleteAccount })).status).toBe(200);
    expect(db.row("testers", USER)).toBeUndefined();
    expect(db.row("tester_feedback", USER)).toBeUndefined();
    expect(db.row("tester_events", USER)).toBeUndefined();
    expect(db.state.tables.rate_limits).toEqual([]);
  });

  /* "Deleting your account in Settings deletes it too": the anonymous
     session a tester signed in from goes with the account. */
  it("takes the anonymous session a tester carried from, its audio included", async () => {
    db.state.anonymous.add(ANON);
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION, consented_at: "2026-10-30T09:00:00.000Z", carried_from: [ANON] });
    db.put("reps", { user_id: ANON, audio_path: "reps/1-anon.webm" });
    db.put("rate_limits", { subject: `u:${ANON}` });
    expect((await call(undefined, { method: "DELETE", handler: deleteAccount })).status).toBe(200);
    expect(db.state.deletedUsers).toEqual([ANON, USER]);
    expect(db.state.removedAudio).toContain("reps/1-anon.webm");
    expect(db.row("reps", ANON)).toBeUndefined();
    expect(db.state.tables.rate_limits).toEqual([]);
  });

  it("never removes a carried id that is a real account", async () => {
    db.put("testers", { user_id: USER, consent_version: CONSENT_VERSION, consented_at: "2026-10-30T09:00:00.000Z", carried_from: [ANON] });
    db.put("reps", { user_id: ANON, audio_path: "reps/1-other.webm" });
    expect((await call(undefined, { method: "DELETE", handler: deleteAccount })).status).toBe(200);
    expect(db.state.deletedUsers).toEqual([USER]);
    expect(db.row("reps", ANON)).toBeDefined();
  });
});

/**
 * The code is the server's: no file the browser loads may hold it. The
 * route is the one place it is written down, and content/tester.ts (the
 * screens' words) must never learn it.
 */
describe("where the code lives", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
    });

  it("is written only in the route", () => {
    const holders = ["app", "components", "lib", "content"]
      .flatMap(sources)
      .filter((f) => /["'`]1234["'`]/.test(readFileSync(f, "utf8")));
    expect(holders).toEqual(["app/api/tester/route.ts"]);
  });

  it("is read from the server's own environment, never a NEXT_PUBLIC one", () => {
    const route = readFileSync("app/api/tester/route.ts", "utf8");
    expect(route).toMatch(/process\.env\.TESTER_CODE/);
    for (const f of ["app", "components", "lib", "content"].flatMap(sources)) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/NEXT_PUBLIC_TESTER/);
    }
  });
});
