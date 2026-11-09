import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/*
 * GET /api/push/cron against a Supabase stand-in that answers the way
 * PostgREST does: at most 1000 rows a response (max_rows) with no error,
 * and a failed count as { count: null, error } rather than a throw.
 */
type Sub = {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  reminder_hour: number | null;
  tz_offset: number;
  tz?: string | null;
  quiet_from: number;
  quiet_to: number;
  last_sent_on: string | null;
};
let subs: Sub[] = [];
let countError: { message: string } | null = null;
let repsToday = 0;
/** The newest takes, newest first, as the body's read gets them. */
let recent: { filler_count: number; duration_s: number }[] = [];
/** A push service error's statusCode for the next sends, or null. */
let sendFails: number | null = null;
const stamped: string[] = [];
const sent: string[] = [];
const payloads: { title: string; body: string; url: string }[] = [];

/* An update's filters, as PostgREST applies them: eq, and the claim's
   `or(last_sent_on.is.null,last_sent_on.neq.<day>)`. */
type Filter = (r: Sub) => boolean;
function orFilter(expr: string): Filter {
  const parts = expr.split(",").map((p) => {
    const [col, op, ...rest] = p.split(".");
    const v = rest.join(".");
    return (r: Sub) => {
      const x = r[col as keyof Sub];
      if (op === "is" && v === "null") return x === null;
      if (op === "neq") return x !== null && String(x) !== v;
      if (op === "eq") return String(x) === v;
      throw new Error(`no ${op}`);
    };
  });
  return (r) => parts.some((f) => f(r));
}

function updateQuery(patch: Partial<Sub>) {
  const filters: Filter[] = [];
  let returning = false;
  const u = {
    eq: (col: keyof Sub, v: unknown) => {
      filters.push((r) => r[col] === v);
      return u;
    },
    or: (expr: string) => {
      filters.push(orFilter(expr));
      return u;
    },
    select: () => {
      returning = true;
      return u;
    },
    then: (ok: (v: unknown) => unknown) => {
      // One statement: the filter and the write together, as a row lock makes them.
      const hit = subs.filter((r) => filters.every((f) => f(r)));
      for (const r of hit) {
        Object.assign(r, patch);
        stamped.push(`${r.endpoint}:${patch.last_sent_on}`);
      }
      return Promise.resolve({ data: returning ? hit.map((r) => ({ endpoint: r.endpoint })) : null, error: null }).then(ok);
    },
  };
  return u;
}

function subsQuery() {
  // A read hands back copies, as PostgREST does: a later write to the
  // table does not change a row the loop already holds.
  let rows = subs.map((r) => ({ ...r }));
  let cap = 1000;
  const q = {
    select: () => q,
    not: (col: keyof Sub) => {
      rows = rows.filter((r) => r[col] !== null);
      return q;
    },
    order: (col: keyof Sub, { ascending }: { ascending: boolean }) => {
      rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (ascending ? 1 : -1));
      return q;
    },
    gt: (col: keyof Sub, v: string) => {
      rows = rows.filter((r) => String(r[col]) > v);
      return q;
    },
    limit: (n: number) => {
      cap = Math.min(n, 1000);
      return q;
    },
    then: (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows.slice(0, Math.min(cap, 1000)), error: null }).then(ok),
    update: updateQuery,
    delete: () => ({
      eq: async (col: keyof Sub, v: unknown) => {
        subs = subs.filter((r) => r[col] !== v);
        return { error: null };
      },
    }),
  };
  return q;
}

function repsQuery() {
  let head = false;
  const q = {
    select: (_c: string, opts?: { head?: boolean }) => {
      head = !!opts?.head;
      return q;
    },
    eq: () => q,
    gte: () => q,
    order: () => q,
    limit: () => Promise.resolve({ data: recent, error: null }),
    then: (ok: (v: unknown) => unknown) =>
      Promise.resolve(
        head ? (countError ? { count: null, error: countError } : { count: repsToday, error: null }) : { data: [], error: null }
      ).then(ok),
  };
  return q;
}

vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => ({
    from: (t: string) => (t === "push_subscriptions" ? subsQuery() : repsQuery()),
  }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (s: { endpoint: string }, body: string) => {
      // A real send takes a moment: two ticks at once interleave here.
      await Promise.resolve();
      if (sendFails !== null) throw Object.assign(new Error("push service"), { statusCode: sendFails });
      sent.push(s.endpoint);
      payloads.push(JSON.parse(body));
    },
  },
}));

process.env.CRON_SECRET = "s";
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const { GET } = await import("@/app/api/push/cron/route");

function tick(secret = "s") {
  const req = new Request("http://test.local/api/push/cron", { headers: { authorization: `Bearer ${secret}` } });
  return GET(req as unknown as NextRequest);
}

/** A subscriber whose chosen hour is the current UTC hour (offset 0). */
function due(i: number): Sub {
  return {
    endpoint: `https://push.test/${String(i).padStart(5, "0")}`,
    user_id: `u${i}`,
    p256dh: "k",
    auth: "a",
    reminder_hour: new Date().getUTCHours(),
    tz_offset: 0,
    quiet_from: 7,
    quiet_to: 7,
    last_sent_on: null,
  };
}

beforeEach(() => {
  subs = [];
  countError = null;
  repsToday = 0;
  recent = [];
  sendFails = null;
  stamped.length = 0;
  sent.length = 0;
  payloads.length = 0;
  delete process.env.PUSH_TICK_SECRET;
});

describe("the reminder cron", () => {
  it("sends to a subscriber whose day is still open", async () => {
    subs = [due(1)];
    const body = await (await tick()).json();
    expect(body.sent).toBe(1);
  });

  it("does not ring when the done-today check fails (#143)", async () => {
    subs = [due(1)];
    countError = { message: "statement timeout" };
    const body = await (await tick()).json();
    expect(body.sent).toBe(0);
    expect(sent).toEqual([]);
    expect(stamped).toEqual([]);
  });

  it("reaches every subscriber, past the 1000 rows one read returns", async () => {
    subs = Array.from({ length: 1500 }, (_, i) => due(i));
    const body = await (await tick()).json();
    expect(body.sent).toBe(1500);
  });

  it("rings at the chosen hour after a daylight-saving change, from the stored zone", async () => {
    vi.useFakeTimers();
    try {
      // Armed in New York in October (EDT, offset 240), hour 18, and not
      // opened since. On 2 Nov (EST) 22:00 UTC is 17:00 there, 23:00 is 18:00.
      subs = [{ ...due(1), reminder_hour: 18, tz_offset: 240, tz: "America/New_York" }];
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 2, 22, 5)));
      expect((await (await tick()).json()).sent).toBe(0);
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 2, 23, 5)));
      expect((await (await tick()).json()).sent).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the stored offset for a row that never sent its zone", async () => {
    vi.useFakeTimers();
    try {
      subs = [{ ...due(1), reminder_hour: 18, tz_offset: 240, tz: null }];
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 2, 22, 5)));
      expect((await (await tick()).json()).sent).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the reminder cron, #430", () => {
  it("claims the day before sending, so two ticks at once ring once", async () => {
    subs = [due(1), due(2)];
    const [a, b] = await Promise.all([tick(), tick()]);
    const [ja, jb] = [await a.json(), await b.json()];
    expect(ja.sent + jb.sent).toBe(2);
    expect(ja.taken + jb.taken).toBe(2);
    expect([...sent].sort()).toEqual([due(1).endpoint, due(2).endpoint]);
  });

  it("does not ring again later the same day once a tick sent", async () => {
    subs = [due(1)];
    expect((await (await tick()).json()).sent).toBe(1);
    const again = await (await tick()).json();
    expect(again.sent).toBe(0);
    expect(again.due).toBe(0);
  });

  it("hands the day back when the push service fails, so a later tick retries", async () => {
    subs = [due(1)];
    sendFails = 500;
    const first = await (await tick()).json();
    expect(first).toMatchObject({ due: 1, sent: 0, failed: 1 });
    expect(subs[0].last_sent_on).toBeNull();
    sendFails = null;
    expect((await (await tick()).json()).sent).toBe(1);
  });

  it("drops a revoked endpoint instead of retrying it", async () => {
    subs = [due(1)];
    sendFails = 410;
    const body = await (await tick()).json();
    expect(body).toMatchObject({ sent: 0, dropped: 1 });
    expect(subs).toEqual([]);
  });

  it("says why nothing went: due, already practised, check failed", async () => {
    subs = [due(1), { ...due(2), reminder_hour: (new Date().getUTCHours() + 1) % 24 }];
    repsToday = 1;
    const done = await (await tick()).json();
    expect(done).toMatchObject({ ok: true, subs: 2, due: 1, done: 1, sent: 0 });
    repsToday = 0;
    countError = { message: "statement timeout" };
    const unsure = await (await tick()).json();
    expect(unsure).toMatchObject({ due: 1, unsure: 1, sent: 0 });
  });

  it("accepts the database's own secret beside GitHub's, and nothing else", async () => {
    subs = [due(1)];
    expect((await tick("t0k")).status).toBe(401);
    process.env.PUSH_TICK_SECRET = "t0k";
    expect((await tick("t0k")).status).toBe(200);
    expect((await tick("s")).status).toBe(200);
    expect((await tick("wrong")).status).toBe(401);
  });

  it("names the hour they chose and one number from their last take", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // 18:01 in Melbourne on 9 Nov (AEDT, UTC+11).
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 9, 7, 1)));
      subs = [{ ...due(1), reminder_hour: 18, tz: "Australia/Melbourne", quiet_from: 22, quiet_to: 7 }];
      recent = [
        { filler_count: 1, duration_s: 8 },
        { filler_count: 4, duration_s: 61.6 },
      ];
      expect((await (await tick()).json()).sent).toBe(1);
      expect(payloads[0]).toEqual({ title: "Your 6 pm practice", body: "Last time: 4 fillers in 62 seconds.", url: "/rep" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a late send does not name an hour that has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // 21:16 in Melbourne on 8 Nov, the tick after 13:27, for a 12 pm pick.
      vi.setSystemTime(new Date("2026-11-08T10:16:26Z"));
      subs = [{ ...due(1), reminder_hour: 12, tz: "Australia/Melbourne", quiet_from: 22, quiet_to: 7 }];
      expect((await (await tick()).json()).sent).toBe(1);
      expect(payloads[0]).toEqual({ title: "Today's practice", body: "It takes about a minute.", url: "/rep" });
    } finally {
      vi.useRealTimers();
    }
  });
});
