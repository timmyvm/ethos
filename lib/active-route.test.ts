import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/*
 * GET /api/active (#431): the founder's page, and only theirs. The gate
 * runs before any table is read; nobody else learns the route exists;
 * and the reads ask for who and when, never a transcript, a file or a
 * score.
 */

type User = { id: string; email?: string; is_anonymous?: boolean; email_confirmed_at?: string | null };
let user: User | null = null;
const reads: { table: string; columns: string }[] = [];
const T1 = "0b5e7a21-6c3d-4f8e-8a1b-2d9c4e6f7a10";
const ME = "c0a013e2-0000-4000-8000-000000000000";

const TABLES: Record<string, unknown[]> = {
  testers: [
    { user_id: ME, created_at: "2026-10-29T03:00:00Z", stopped_at: null, carried_from: [] },
    { user_id: T1, created_at: "2026-10-30T03:00:00Z", stopped_at: null, carried_from: [] },
  ],
  reps: [{ user_id: T1, created_at: new Date(Date.now() - 86_400_000).toISOString() }],
  tester_events: [{ user_id: T1, at: new Date().toISOString() }],
  push_subscriptions: [{ user_id: T1, reminder_hour: 18, tz: "Australia/Melbourne", created_at: "2026-11-01T00:00:00Z" }],
  streak_freezes: [],
  // The reminder clock's notes (#430 review): when, which secret, who called.
  rate_limits: [{ subject: "push-tick:PUSH_TICK_SECRET:database", at: new Date(Date.now() - 10 * 60_000).toISOString() }],
};

function query(table: string) {
  const q = {
    select: (columns: string) => {
      reads.push({ table, columns });
      return q;
    },
    in: () => q,
    like: () => q,
    gte: () => q,
    or: () => q,
    order: () => q,
    range: () => Promise.resolve({ data: TABLES[table] ?? [], error: null }),
  };
  return q;
}

vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => ({
    auth: {
      getUser: async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: { status: 401 } }),
    },
    from: (t: string) => query(t),
  }),
}));

const { GET } = await import("@/app/api/active/route");

function get(token: string | null = "t") {
  const req = new Request("http://test.local/api/active", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return GET(req as unknown as NextRequest);
}

beforeEach(() => {
  user = null;
  reads.length = 0;
  process.env.ADMIN_EMAILS = "timothy@example.com";
});

describe("GET /api/active", () => {
  it("asks for a session, and reads nothing without one", async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get("bad")).status).toBe(401);
    expect(reads).toEqual([]);
  });

  it("answers anyone but the founder as if there were no such route, and reads nothing", async () => {
    user = { id: T1, email: "friend@example.com", email_confirmed_at: "2026-10-30T00:00:00Z" };
    expect((await get()).status).toBe(404);
    user = { id: ME, email: "timothy@example.com", email_confirmed_at: null };
    expect((await get()).status).toBe(404);
    user = { id: ME, is_anonymous: true, email_confirmed_at: null };
    expect((await get()).status).toBe(404);
    expect(reads).toEqual([]);
  });

  it("lets nobody in while ADMIN_EMAILS is unset", async () => {
    delete process.env.ADMIN_EMAILS;
    user = { id: ME, email: "timothy@example.com", email_confirmed_at: "2026-10-01T00:00:00Z" };
    expect((await get()).status).toBe(404);
    expect(reads).toEqual([]);
  });

  it("gives the founder the aggregate, uncached", async () => {
    user = { id: ME, email: "Timothy@Example.com", email_confirmed_at: "2026-10-01T00:00:00Z" };
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { view } = (await res.json()) as {
      view: { rows: { label: string; reminder: number | null; days: string[] }[]; totals: unknown[] };
    };
    expect(view.rows.map((r) => r.label)).toEqual(["Tester 1", "You"]);
    expect(view.rows[0].reminder).toBe(18);
    expect(view.rows[0].days[13]).toBe("opened");
    expect(view.totals).toHaveLength(14);
  });

  it("shows whether the reminder clock is ticking, and which secret it carries", async () => {
    user = { id: ME, email: "timothy@example.com", email_confirmed_at: "2026-10-01T00:00:00Z" };
    const { clock } = (await (await get()).json()) as {
      clock: { alive: boolean; sources: { secret: string; caller: string; hours: number }[] };
    };
    expect(clock.alive).toBe(true);
    expect(clock.sources).toEqual([expect.objectContaining({ secret: "PUSH_TICK_SECRET", caller: "database", hours: 1 })]);
  });

  it("reads who and when, never a transcript, a file, a score, a name or an address", async () => {
    user = { id: ME, email: "timothy@example.com", email_confirmed_at: "2026-10-01T00:00:00Z" };
    await get();
    expect(reads.map((r) => r.table).sort()).toEqual(
      ["push_subscriptions", "rate_limits", "reps", "streak_freezes", "tester_events", "testers"].sort()
    );
    for (const r of reads) {
      expect(r.columns, r.table).not.toMatch(
        /\*|transcript|audio|ethos_index|stars|dimensions|score|display_name|email|endpoint|p256dh|auth|ip|data|label|screen/
      );
    }
  });
});

/* #430 review: the shell anyone gets says nothing about the page. */
describe("/active's shell", () => {
  it("carries the app's own title, and stays out of search", async () => {
    const { metadata } = await import("@/app/active/layout");
    expect(metadata.title).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
