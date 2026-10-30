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
  consumeRateLimit: vi.fn(async (subject: string) =>
    h.limited.has(subject)
      ? { allowed: false, window: "hour", retryAfterS: 1200 }
      : { allowed: true, window: null, retryAfterS: 0 }
  ),
}));

import { POST as tester } from "@/app/api/tester/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { consumeRateLimit } from "./rate-limit";

let db: FakeDb;

beforeEach(() => {
  db = fakeDb([USER, ANON]);
  h.db = db.asClient();
  h.sessions.clear();
  h.sessions.set("tok_user", { id: USER, anonymous: false, email: "tim@example.com" });
  h.sessions.set("tok_anon", { id: ANON, anonymous: true, email: null });
  h.limited.clear();
  vi.mocked(consumeRateLimit).mockClear();
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

  it("agreeing twice keeps one row", async () => {
    await call({ code: "1234", agree: CONSENT_VERSION });
    await call({ code: "1234", agree: CONSENT_VERSION });
    expect(db.state.tables.testers).toHaveLength(1);
  });
});

describe("deleting the account", () => {
  it("takes the tester row, the answers and the code's rate-limit rows with it", async () => {
    await call({ code: "1234", agree: CONSENT_VERSION });
    db.put("tester_feedback", { user_id: USER, client_id: "k1", answer: "no", note: "Felt faster" });
    db.put("rate_limits", { subject: `tester:u:${USER}` });
    // On Postgres the cascade on each user_id does this (0020); the fake
    // models the same references, and scripts/check-testers-sql.mjs
    // watches the real one.
    expect((await call(undefined, { method: "DELETE", handler: deleteAccount })).status).toBe(200);
    expect(db.row("testers", USER)).toBeUndefined();
    expect(db.row("tester_feedback", USER)).toBeUndefined();
    expect(db.state.tables.rate_limits).toEqual([]);
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
