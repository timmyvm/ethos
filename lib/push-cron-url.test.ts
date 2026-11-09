import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { RepRow } from "./client-data";

/*
 * The reminder opens Today's own practice, ready to record (#431). It
 * used to send bare /rep, the demoted road's rotation: every reminder
 * opened a different topic from Today's and filed the take against it.
 */

const words = (distinct: number) =>
  Array.from({ length: 150 }, (_, i) => `word${i % distinct}`).join(" ");

/** A stored recording, as the cron's read returns it (newest first). */
const stored = (at: Date): Partial<RepRow> => ({
  created_at: at.toISOString(),
  duration_s: 60,
  transcript: words(90),
  wpm: 145,
  filler_count: 2,
  fillers: [
    { word: "um", t: 3 },
    { word: "like", t: 9 },
  ],
  pauses: [{ t: 2, len: 1.2, kind: "pre" }],
  dimensions: { tier1: { repairs: 80 }, anchors: {}, tier2: null } as unknown as RepRow["dimensions"],
});

let history: Partial<RepRow>[] = [];
let historyError: { message: string } | null = null;
const payloads: { url: string; body: string }[] = [];

function subsQuery() {
  const now = new Date();
  const row = {
    endpoint: "https://push.test/1",
    user_id: "u1",
    p256dh: "k",
    auth: "a",
    reminder_hour: now.getUTCHours(),
    tz_offset: 0,
    quiet_from: 7,
    quiet_to: 7,
    last_sent_on: null,
  };
  const q = {
    select: () => q,
    not: () => q,
    order: () => q,
    gt: () => q,
    limit: () => q,
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(ok),
    // The day's claim (#430): update, eq, or, select, answered with the row.
    update: () => {
      const u = {
        eq: () => u,
        or: () => u,
        select: () => u,
        then: (ok: (v: unknown) => unknown) =>
          Promise.resolve({ data: [{ endpoint: row.endpoint }], error: null }).then(ok),
      };
      return u;
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
  };
  return q;
}

function repsQuery() {
  let head = false;
  let cols = "";
  const q = {
    select: (c: string, opts?: { head?: boolean }) => {
      head = !!opts?.head;
      cols = c;
      return q;
    },
    eq: () => q,
    gte: () => q,
    order: () => q,
    limit: () =>
      Promise.resolve(
        cols.includes("transcript")
          ? historyError
            ? { data: null, error: historyError }
            : { data: [...history].reverse(), error: null }
          : { data: history.map((r) => ({ created_at: r.created_at })), error: null }
      ),
    then: (ok: (v: unknown) => unknown) =>
      Promise.resolve(head ? { count: 0, error: null } : { data: [], error: null }).then(ok),
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
    sendNotification: async (_s: unknown, body: string) => {
      const p = JSON.parse(body) as { url: string };
      payloads.push({ url: p.url, body });
    },
  },
}));

process.env.CRON_SECRET = "s";
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const { GET } = await import("@/app/api/push/cron/route");
const { todayHrefOn } = await import("@/lib/home");

function tick() {
  const req = new Request("http://test.local/api/push/cron", { headers: { authorization: "Bearer s" } });
  return GET(req as unknown as NextRequest);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  history = [];
  historyError = null;
  payloads.length = 0;
});

describe("the reminder's address", () => {
  it("is Today's practice, ready to record, never bare /rep", async () => {
    history = [stored(daysAgo(3)), stored(daysAgo(2)), stored(daysAgo(1))];
    await tick();
    expect(payloads).toHaveLength(1);
    const url = new URL(payloads[0].url, "http://ethos.local");
    expect(url.pathname).toBe("/rep");
    expect(url.searchParams.get("topic")).toBeTruthy();
    expect(url.searchParams.get("item")).toBeTruthy();
    expect(url.searchParams.get("ready")).toBe("1");
    // The same function Today's Start reads, on the subscriber's calendar.
    expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(), 0));
  });

  it("opens Today for someone with no recording yet, and when the read fails", async () => {
    await tick();
    expect(payloads[0].url).toBe("/");
    payloads.length = 0;
    history = [stored(daysAgo(1))];
    historyError = { message: "boom" };
    await tick();
    expect(payloads[0].url).toBe("/");
  });

  it("still rings, opening Today, when the address cannot be worked out", async () => {
    // The day is claimed before the address is read (#430): a row the
    // selector cannot read must not cost the person their reminder.
    history = [{ ...stored(daysAgo(1)), created_at: "not a date" }];
    const res = await (await tick()).json();
    expect(res).toMatchObject({ sent: 1, failed: 0 });
    expect(payloads[0].url).toBe("/");
    expect(JSON.parse(payloads[0].body)).toMatchObject({ title: expect.any(String), body: expect.any(String) });
  });
});
