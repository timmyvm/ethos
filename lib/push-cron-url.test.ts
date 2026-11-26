import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { RepRow } from "./client-data";
import { substance } from "./metrics";
import { substanceColumns } from "./rep-substance";

/*
 * The reminder opens Today's own practice, ready to record (#431). It
 * used to send bare /rep, the demoted road's rotation: every reminder
 * opened a different topic from Today's and filed the take against it.
 */

const words = (distinct: number) =>
  Array.from({ length: 150 }, (_, i) => `word${i % distinct}`).join(" ");

let nextId = 0;
/** A stored recording, as the cron's read returns it (newest first): 0037's columns filled from its words. */
const stored = (at: Date): Partial<RepRow> => ({
  id: `r${++nextId}`,
  ...substanceColumns(substance(words(90)))!,
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
/** The table has 0037's columns; false answers a select naming one with 42703, as production before it. */
let has0037 = true;
/** Every select the practice read made, in order. */
let practiceSelects: string[] = [];
/** The ids a transcript read asked for. */
let transcriptReads: string[][] = [];
const payloads: { url: string; body: string }[] = [];

function subsQuery() {
  const now = new Date();
  const row = {
    endpoint: "https://web.push.apple.com/1",
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

/** Only the columns asked for, as PostgREST answers. */
const pick = (r: Partial<RepRow>, cols: string) =>
  Object.fromEntries(
    cols
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c in r)
      .map((c) => [c, (r as Record<string, unknown>)[c]])
  );

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
    /* The practice read (#431): it names the dimensions; the last take's read does not. */
    limit: () => {
      if (!cols.includes("dimensions")) return Promise.resolve({ data: history.map((r) => ({ created_at: r.created_at })), error: null });
      practiceSelects.push(cols);
      if (!has0037 && /\b(scorable|word_count|distinct_words)\b/.test(cols)) {
        return Promise.resolve({ data: null, error: { code: "42703", message: "column reps.scorable does not exist" } });
      }
      if (historyError) return Promise.resolve({ data: null, error: historyError });
      return Promise.resolve({ data: [...history].reverse().map((r) => pick(r, cols)), error: null });
    },
    /* A row 0037 has not filled: its transcript, read on its own. */
    in: (_c: string, ids: string[]) => {
      transcriptReads.push(ids);
      return Promise.resolve({ data: history.filter((r) => ids.includes(r.id!)).map((r) => pick(r, cols)), error: null });
    },
    then: (ok: (v: unknown) => unknown) =>
      Promise.resolve(head ? { count: 0, error: null } : { data: [], error: null }).then(ok),
  };
  return q;
}

/* The account's introduction row (#489): what the reminder reads the pool from. */
let answers: { data: { age_band: string | null; context: string | null } | null; error: { message: string } | null } = {
  data: { age_band: "18_24", context: null },
  error: null,
};
function onboardingQuery() {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => answers,
  };
  return q;
}

/* The account's carried cue (0034): none here; the body is lib/push-cron.test.ts's subject. */
function noCueQuery() {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) };
  return q;
}

vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => ({
    from: (t: string) =>
      t === "push_subscriptions"
        ? subsQuery()
        : t === "onboarding"
          ? onboardingQuery()
          : t === "profiles"
            ? noCueQuery()
            : repsQuery(),
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

/* A secret of the length the sender takes (32 or more, lib/cron-auth.ts). */
const SECRET = "s".repeat(40);
process.env.CRON_SECRET = SECRET;
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const { GET } = await import("@/app/api/push/cron/route");
const { todayHrefOn } = await import("@/lib/home");

function tick() {
  const req = new Request("http://test.local/api/push/cron", { headers: { authorization: `Bearer ${SECRET}` } });
  return GET(req as unknown as NextRequest);
}

const { todayHref } = await import("@/lib/home");
const { poolFor } = await import("@/lib/pool");
const { EMPTY_ANSWERS } = await import("@/lib/answers");

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  history = [];
  historyError = null;
  has0037 = true;
  practiceSelects = [];
  transcriptReads = [];
  payloads.length = 0;
  answers = { data: { age_band: "18_24", context: null }, error: null };
});

/*
 * The reminder in the person's pool (#489). It chose in the "all" pool for
 * everyone, so on the few days a walk held a prompt about a job it sent an
 * under-18 to one. The tick below lands on such a day: the newest takes
 * are three days before it, and the day is the first from 20 Nov 2026
 * whose "all" practice is a job prompt.
 */
describe("the reminder's pool", () => {
  const JOB = ["t10", "t11", "t18"];
  const DAY = 86_400_000;
  const topicOf = (url: string) => new URL(url, "http://ethos.local").searchParams.get("topic");
  const takesBefore = (at: number) => [stored(new Date(at - 3 * DAY)), stored(new Date(at - 2 * DAY)), stored(new Date(at - DAY))];
  let jobDay = 0;
  for (let d = 0; d < 400 && jobDay === 0; d++) {
    const at = Date.UTC(2026, 10, 20 + d, 12);
    if (JOB.includes(topicOf(todayHrefOn(takesBefore(at) as RepRow[], new Date(at), 0, "all"))!)) jobDay = at;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(jobDay);
    history = takesBefore(jobDay);
  });
  afterEach(() => vi.useRealTimers());

  it("finds a day whose practice was a job prompt", () => {
    expect(jobDay).toBeGreaterThan(0);
  });

  it("never sends an under-18 to a job prompt, and opens the topic their card shows", async () => {
    answers = { data: { age_band: "u18", context: null }, error: null };
    await tick();
    const url = payloads[0].url;
    expect(JOB).not.toContain(topicOf(url));
    expect(new URL(url, "http://ethos.local").searchParams.get("item")).toMatch(/-school$/);
    expect(url).toBe(todayHrefOn(history as RepRow[], new Date(jobDay), 0, "school"));
    // Today's card on their phone, reading the same answers through the same rule.
    const phone = todayHref(history as RepRow[], new Date(jobDay), poolFor({ ...EMPTY_ANSWERS, ageBand: "u18" }));
    expect(url).toBe(phone);
  });

  it("reads Class as school too", async () => {
    answers = { data: { age_band: "25_34", context: "class" }, error: null };
    await tick();
    expect(JOB).not.toContain(topicOf(payloads[0].url));
  });

  it("sends a grown-up what it always sent", async () => {
    await tick();
    expect(JOB).toContain(topicOf(payloads[0].url));
    expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(jobDay), 0, "all"));
  });

  it("treats no answers, and a read that failed, as an age never given: school", async () => {
    for (const a of [
      { data: null, error: null },
      { data: { age_band: null, context: null }, error: null },
      { data: null, error: { message: "boom" } },
    ]) {
      payloads.length = 0;
      answers = a;
      await tick();
      expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(jobDay), 0, "school"));
      // The phone with no answers agrees.
      expect(payloads[0].url).toBe(todayHref(history as RepRow[], new Date(jobDay), poolFor(EMPTY_ANSWERS)));
    }
  });
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
    expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(), 0, "all"));
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

/*
 * #511: the address reads 0037's columns, not thirty transcripts, and
 * opens the same practice from either. Before 0037 it reads what it
 * always read; a row 0037 has not filled has its transcript read alone.
 */
describe("the reminder's address and migration 0037", () => {
  const three = () => [stored(daysAgo(3)), stored(daysAgo(2)), stored(daysAgo(1))];

  it("names the three columns and never the transcript", async () => {
    history = three();
    await tick();
    expect(practiceSelects).toHaveLength(1);
    expect(practiceSelects[0]).toMatch(/\bscorable, word_count, distinct_words\b/);
    expect(practiceSelects[0]).not.toMatch(/\btranscript\b/);
    expect(transcriptReads).toEqual([]);
    expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(), 0, "all"));
  });

  it("before 0037, goes back to the read it always made, and opens the same practice", async () => {
    history = three();
    has0037 = false;
    await tick();
    expect(practiceSelects).toHaveLength(2);
    expect(practiceSelects[1]).toMatch(/\btranscript\b/);
    expect(practiceSelects[1]).not.toMatch(/\bscorable\b/);
    expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(), 0, "all"));
    expect(new URL(payloads[0].url, "http://ethos.local").searchParams.get("ready")).toBe("1");
  });

  it("reads the transcript of a row 0037 has not filled, and only that row's", async () => {
    history = three();
    history[1] = { ...history[1], scorable: null, word_count: null, distinct_words: null };
    await tick();
    expect(transcriptReads).toEqual([[history[1].id]]);
    expect(payloads[0].url).toBe(todayHrefOn(history as RepRow[], new Date(), 0, "all"));
  });
});
