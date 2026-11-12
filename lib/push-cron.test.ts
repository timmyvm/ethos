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
/** When set, the done-today count is these rows at or after the route's own gte, as PostgREST counts them. */
let repRows: { user_id: string; created_at: string }[] | null = null;
/** Each send's options (TTL, urgency, topic). */
const sendOptions: unknown[] = [];
/** The tick notes the route wrote to rate_limits. */
let notes: { subject: string; at: string }[] = [];
/** The newest takes, newest first, as the body's read gets them. */
let recent: { filler_count: number; duration_s: number }[] = [];
/** A push service error's statusCode for the next sends, or null. */
let sendFails: number | null = null;
const stamped: string[] = [];
const sent: string[] = [];
const payloads: { title: string; body: string; url: string }[] = [];
/** The token the database's Vault holds (0028), or null for none; and each token it was asked about. */
let vaultToken: string | null = null;
let rpcError: { message: string } | null = null;
const asked: string[] = [];

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
  let cols = "";
  let user = "";
  let from = "";
  const q = {
    select: (c: string, opts?: { head?: boolean }) => {
      head = !!opts?.head;
      cols = c;
      return q;
    },
    eq: (_c: string, v: string) => {
      user = v;
      return q;
    },
    gte: (_c: string, v: string) => {
      from = v;
      return q;
    },
    order: () => q,
    // The address's read (#431, the one with the transcript) finds no
    // measured recording here, so the reminder opens Today; the address
    // itself is lib/push-cron-url.test.ts's subject.
    limit: () => Promise.resolve({ data: cols.includes("transcript") ? [] : recent, error: null }),
    then: (ok: (v: unknown) => unknown) =>
      Promise.resolve(
        head
          ? countError
            ? { count: null, error: countError }
            : {
                count: repRows
                  ? repRows.filter((r) => r.user_id === user && Date.parse(r.created_at) >= Date.parse(from)).length
                  : repsToday,
                error: null,
              }
          : { data: [], error: null }
      ).then(ok),
  };
  return q;
}

/* rate_limits, where each tick is noted (#430 review). */
function notesQuery() {
  return {
    insert: async (row: { subject: string; at: string }) => {
      notes.push(row);
      return { error: null };
    },
    delete: () => {
      const d = {
        like: () => d,
        lt: (_c: string, v: string) => {
          notes = notes.filter((n) => n.at >= v);
          return Promise.resolve({ error: null });
        },
      };
      return d;
    },
  };
}

vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => ({
    from: (t: string) => (t === "push_subscriptions" ? subsQuery() : t === "rate_limits" ? notesQuery() : repsQuery()),
    rpc: async (fn: string, args: { token: string }) => {
      if (fn !== "push_tick_ok") return { data: null, error: { message: "no such function" } };
      asked.push(args.token);
      if (rpcError) return { data: null, error: rpcError };
      return { data: vaultToken !== null && args.token === vaultToken, error: null };
    },
  }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (s: { endpoint: string }, body: string, options?: unknown) => {
      // A real send takes a moment: two ticks at once interleave here.
      await Promise.resolve();
      sendOptions.push(options);
      if (sendFails !== null) throw Object.assign(new Error("push service"), { statusCode: sendFails });
      sent.push(s.endpoint);
      payloads.push(JSON.parse(body));
    },
  },
}));

/* Secrets of the length the sender takes (32 or more, lib/cron-auth.ts). */
const GH = "s".repeat(40);
const DB = "t0k".repeat(12);
process.env.CRON_SECRET = GH;
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const { GET } = await import("@/app/api/push/cron/route");

function tick(secret = GH, userAgent = "github-actions push-cron") {
  const req = new Request("http://test.local/api/push/cron", {
    headers: { authorization: `Bearer ${secret}`, "user-agent": userAgent },
  });
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
  repRows = null;
  sendOptions.length = 0;
  notes = [];
  recent = [];
  sendFails = null;
  stamped.length = 0;
  sent.length = 0;
  payloads.length = 0;
  delete process.env.PUSH_TICK_SECRET;
  vaultToken = null;
  rpcError = null;
  asked.length = 0;
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
    expect((await tick(DB)).status).toBe(401);
    process.env.PUSH_TICK_SECRET = DB;
    expect((await tick(DB)).status).toBe(200);
    expect((await tick(GH)).status).toBe(200);
    expect((await tick("wrong")).status).toBe(401);
  });

  it("takes the secret the database holds, with no hosting setting (0028)", async () => {
    subs = [due(1)];
    vaultToken = DB;
    const res = await tick(DB, "pg_net push-tick");
    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe(1);
    expect(notes.map((n) => n.subject)).toEqual(["push-tick:PUSH_TICK_SECRET:database"]);
    // GitHub's secret matches on the server and never reaches the database.
    asked.length = 0;
    expect((await tick(GH)).status).toBe(200);
    expect(asked).toEqual([]);
  });

  it("refuses what the database refuses, and refuses when the database cannot answer", async () => {
    subs = [due(1)];
    vaultToken = DB;
    expect((await tick("x".repeat(40))).status).toBe(401);
    rpcError = { message: "function public.push_tick_ok does not exist" };
    expect((await tick(DB)).status).toBe(401);
    // A token too short to be the secret is never sent to the database.
    rpcError = null;
    asked.length = 0;
    expect((await tick("short")).status).toBe(401);
    expect(asked).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("refuses a secret under 32 characters, so a weak one fails closed", async () => {
    subs = [due(1)];
    process.env.PUSH_TICK_SECRET = "short-but-set";
    expect((await tick("short-but-set")).status).toBe(401);
    expect(sent).toEqual([]);
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
      expect(payloads[0]).toEqual({ title: "Your 6 pm practice", body: "Last time: 4 fillers in 62 seconds.", url: "/" });
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
      expect(payloads[0]).toEqual({ title: "Today's practice", body: "It takes about a minute.", url: "/" });
    } finally {
      vi.useRealTimers();
    }
  });
});

/*
 * The #430 review. The done-today check's midnight on the days the clocks
 * change, through the real route with a reps table that honours the
 * route's own gte(created_at, dayStart); the push's lifetime at the push
 * service; and the note each tick leaves for /active.
 */
describe("the reminder cron, #430 review", () => {
  async function at(iso: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
    try {
      return await (await tick()).json();
    } finally {
      vi.useRealTimers();
    }
  }
  const six = (tz: string): Sub => ({ ...due(1), user_id: "u1", reminder_hour: 18, tz, quiet_from: 22, quiet_to: 7 });

  it("an ordinary Melbourne day: practised at 00:30, the 6 pm reminder stays silent", async () => {
    subs = [six("Australia/Melbourne")];
    repRows = [{ user_id: "u1", created_at: "2026-11-08T13:30:00.000Z" }]; // 9 Nov 00:30 AEDT
    expect(await at("2026-11-09T07:01:00Z")).toMatchObject({ due: 1, done: 1, sent: 0 });
  });

  it("Melbourne, Sun 5 Apr 2026: practised at 00:30 AEDT, no ring at 18:01 AEST", async () => {
    subs = [six("Australia/Melbourne")];
    repRows = [{ user_id: "u1", created_at: "2026-04-04T13:30:00.000Z" }];
    expect(await at("2026-04-05T08:01:00Z")).toMatchObject({ due: 1, done: 1, sent: 0 });
  });

  it("New York, Sun 1 Nov 2026: practised at 00:30 EDT, no ring at 18:01 EST", async () => {
    subs = [six("America/New_York")];
    repRows = [{ user_id: "u1", created_at: "2026-11-01T04:30:00.000Z" }];
    expect(await at("2026-11-01T23:01:00Z")).toMatchObject({ due: 1, done: 1, sent: 0 });
  });

  it("Melbourne, Sun 4 Oct 2026: last practised 23:30 AEST the night before, it rings at 18:01 AEDT", async () => {
    subs = [six("Australia/Melbourne")];
    repRows = [{ user_id: "u1", created_at: "2026-10-03T13:30:00.000Z" }];
    expect(await at("2026-10-04T07:01:00Z")).toMatchObject({ due: 1, done: 0, sent: 1 });
  });

  it("a push lives until quiet hours begin, at normal urgency, under one topic", async () => {
    subs = [six("Australia/Melbourne")];
    expect((await at("2026-11-09T07:01:00Z")).sent).toBe(1); // 18:01 AEDT
    // And a push service that never answers is let go after ten seconds (#457).
    expect(sendOptions).toEqual([{ TTL: (22 * 60 - (18 * 60 + 1)) * 60, urgency: "normal", topic: "ethos-daily", timeout: 10000 }]);
  });

  it("a late push lives at least a minute", async () => {
    subs = [six("Australia/Melbourne")];
    expect((await at("2026-11-09T10:59:30Z")).sent).toBe(1); // 21:59:30 AEDT
    expect(sendOptions).toEqual([expect.objectContaining({ TTL: 60 })]);
  });

  it("notes each tick it lets in, with the secret and the caller, and nothing it refuses", async () => {
    process.env.PUSH_TICK_SECRET = DB;
    await tick(DB, "pg_net push-tick");
    await tick(GH, "github-actions push-cron");
    await tick("wrong", "github-actions push-cron");
    expect(notes.map((n) => n.subject)).toEqual(["push-tick:PUSH_TICK_SECRET:database", "push-tick:CRON_SECRET:github"]);
  });

  it("sweeps notes older than two days", async () => {
    notes = [{ subject: "push-tick:CRON_SECRET:github", at: new Date(Date.now() - 49 * 3_600_000).toISOString() }];
    await tick();
    expect(notes).toHaveLength(1);
    expect(Date.now() - Date.parse(notes[0].at)).toBeLessThan(60_000);
  });
});
