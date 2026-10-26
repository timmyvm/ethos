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
const stamped: string[] = [];
const sent: string[] = [];

function subsQuery() {
  let rows = [...subs];
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
    update: (patch: { last_sent_on: string }) => ({
      eq: async (_c: string, endpoint: string) => {
        stamped.push(`${endpoint}:${patch.last_sent_on}`);
        return { error: null };
      },
    }),
    delete: () => ({ eq: async () => ({ error: null }) }),
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
    limit: () => Promise.resolve({ data: [], error: null }),
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
    sendNotification: async (s: { endpoint: string }) => {
      sent.push(s.endpoint);
    },
  },
}));

process.env.CRON_SECRET = "s";
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const { GET } = await import("@/app/api/push/cron/route");

function tick() {
  const req = new Request("http://test.local/api/push/cron", { headers: { authorization: "Bearer s" } });
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
  stamped.length = 0;
  sent.length = 0;
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
