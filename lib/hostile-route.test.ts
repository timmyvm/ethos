import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const week = vi.hoisted(() => ({ since: null as string | null, count: 0, latest: null as string | null }));
/* The verdict's one write: what was set, under which filters, and what the database answers. */
const store = vi.hoisted(() => ({
  writes: [] as { set: Record<string, unknown>; filters: Record<string, unknown> }[],
  answer: { data: [{ id: "rep-1" }], error: null } as { data: unknown[] | null; error: { message: string } | null },
}));

vi.mock("@/lib/transcribe", () => ({ transcribe: vi.fn() }));
vi.mock("@/lib/hostile-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hostile-server")>()),
  hostileQuestion: vi.fn(async () => ({ quoted: "teams", question: "Which teams?" })),
  hostileVerdict: vi.fn(async () => ({ overall: 60 })),
}));
vi.mock("@/lib/db", () => {
  // The free week's count: reps of the hostile take since the week began.
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: (_col: string, since: string) => {
      week.since = since;
      // The count, awaited; or the week's latest take, ordered (#464).
      return Object.assign(Promise.resolve({ count: week.count }), {
        order: () => ({
          limit: async () => ({ data: week.latest ? [{ created_at: week.latest }] : [] }),
        }),
      });
    },
    update: (set: Record<string, unknown>) => {
      const filters: Record<string, unknown> = {};
      const write = {
        eq: (col: string, v: unknown) => ((filters[col] = v), write),
        is: (col: string, v: unknown) => ((filters[`${col} is`] = v), write),
        select: async () => {
          store.writes.push({ set, filters });
          return store.answer;
        },
      };
      return write;
    },
  };
  return {
    getUserFromAuthHeader: vi.fn(async (): Promise<unknown> => null),
    isPremium: vi.fn(async () => false),
    supabaseAdmin: vi.fn(() => ({ from: () => chain })),
  };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async () => ({ allowed: true, window: null, retryAfterS: 0 })),
  refundRateLimit: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/hostile/route";
import { getUserFromAuthHeader } from "@/lib/db";
import { hostileVerdict } from "@/lib/hostile-server";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { transcribe } from "@/lib/transcribe";

const SAID =
  "Remote work makes teams worse because people stop talking to each other and the small questions never get asked";
const HEARD = {
  text: SAID,
  durationS: 30,
  words: SAID.split(" ").map((word, i) => ({ word: ` ${word}`, start: i * 0.5, end: i * 0.5 + 0.4 })),
  segments: [],
  raw: {},
};

function post(fields: Record<string, string>, audio = true): Promise<Response> {
  const form = new FormData();
  form.append("promptId", "remote-work");
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (audio) form.append("audio", new Blob(["fake-opus"], { type: "audio/webm" }), "hostile.webm");
  const req = new Request("http://test.local/api/hostile", { method: "POST", body: form });
  return POST(req as unknown as NextRequest);
}

const take = (extra: Record<string, string> = {}) => post({ phase: "question", ...extra });
const answer = () =>
  post({ phase: "question", context: JSON.stringify({ take: SAID, rounds: [], pendingQuestion: "Which teams?" }) });
const judge = () =>
  post(
    {
      phase: "verdict",
      context: JSON.stringify({ take: SAID, rounds: [{ question: "Which teams?", answer: SAID }] }),
    },
    false
  );

beforeEach(() => {
  vi.mocked(transcribe).mockReset();
  vi.mocked(transcribe).mockResolvedValue(HEARD);
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(refundRateLimit).mockClear();
  vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-1", anonymous: false });
  week.since = null;
  week.count = 0;
  week.latest = null;
  store.writes = [];
  store.answer = { data: [{ id: "rep-1" }], error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(console.error).mockRestore();
});

/*
 * A session is four calls: the take, two answers and the verdict, with
 * the take also banked through /api/analyze. On the recording subject
 * an account with six recordings that hour lost the verdict after both
 * answers, a guest was cut off at the second answer, and every session
 * took four recordings out of the day's room.
 */
describe("Hostile's allowance", () => {
  it("is its own, never the recording allowance", async () => {
    await take();
    expect(consumeRateLimit).toHaveBeenLastCalledWith("hostile:u:u-1", "user");
  });

  it("gives a guest the account's room, as recording does, and a visitor the visitor's", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
    await answer();
    expect(consumeRateLimit).toHaveBeenCalledWith("hostile:u:anon-1", "user");
    // And every guest on the address shares one room (#416).
    expect(vi.mocked(consumeRateLimit).mock.calls.some(([s, t]) => /^guest:ip:/.test(s) && t === "guestip")).toBe(true);

    vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
    vi.mocked(consumeRateLimit).mockClear();
    await answer();
    const visitor = vi.mocked(consumeRateLimit).mock.calls.find(([s]) => /^hostile:ip:/.test(s));
    expect(visitor?.[1]).toBe("anon");
  });

  /* Security audit, 11 Nov: one ceiling for every guest and visitor, the
     count a script with many addresses cannot get round. */
  it("counts a guest and a visitor against the ceiling they all share, and never an account", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
    await answer();
    expect(consumeRateLimit).toHaveBeenCalledWith("guest:all", "guestall");

    vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
    vi.mocked(consumeRateLimit).mockClear();
    await answer();
    expect(consumeRateLimit).toHaveBeenCalledWith("guest:all", "guestall");

    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-1", anonymous: false });
    vi.mocked(consumeRateLimit).mockClear();
    await answer();
    expect(vi.mocked(consumeRateLimit).mock.calls.some(([s]) => s === "guest:all")).toBe(false);
  });

  it("turns a guest away at the ceiling before anything paid runs, and gives every slot back", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
    vi.mocked(consumeRateLimit).mockImplementation(async (subject: string) =>
      subject === "guest:all"
        ? { allowed: false, window: "hour", retryAfterS: 900 }
        : { allowed: true, window: null, retryAfterS: 0 }
    );
    vi.mocked(transcribe).mockClear();
    const res = await answer();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.guestFull).toBe(true);
    expect(body.error).toBe("Recording without an account is full for now. Create an account to keep going.");
    expect(transcribe).not.toHaveBeenCalled();
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:anon-1");
    expect(vi.mocked(refundRateLimit).mock.calls.some(([s]) => /^guest:ip:/.test(s))).toBe(true);
    // The ceiling's own slot was never taken, so it is not given back.
    expect(vi.mocked(refundRateLimit).mock.calls.some(([s]) => s === "guest:all")).toBe(false);
    vi.mocked(consumeRateLimit).mockImplementation(async () => ({ allowed: true, window: null, retryAfterS: 0 }));
  });

  it("keeps the ceiling's slot once Whisper has run, and gives it back when Whisper was down", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
    expect((await answer()).status).toBe(200);
    expect(refundRateLimit).not.toHaveBeenCalled();

    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 500: boom"));
    expect((await answer()).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledWith("guest:all");
  });

  it("keeps the slot of a question asked and a verdict given", async () => {
    expect((await take()).status).toBe(200);
    expect((await answer()).status).toBe(200);
    expect((await judge()).status).toBe(200);
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("gives the slot back when Whisper is down, so the retry costs nothing", async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 500: boom"));
    expect((await answer()).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:u-1");
  });

  it("keeps the slot of a file Whisper refuses, so junk cannot loop for free", async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 400: Invalid file format"));
    await answer();
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  /* #416: once Whisper has run, the slot is spent. Giving it back for a
     short answer made every such call free, and a script could loop
     transcriptions without end. */
  it("keeps the slot for an answer too short to read, since Whisper ran", async () => {
    vi.mocked(transcribe).mockResolvedValue({ ...HEARD, text: "I", words: [{ word: "I", start: 0, end: 0.2 }] });
    const body = await (await answer()).json();
    expect(body.tooShort).toBe(true);
    expect(refundRateLimit).not.toHaveBeenCalledWith("hostile:u:u-1");
  });

  it("keeps the slot when the verdict model was called and failed (#416)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.mocked(hostileVerdict).mockRejectedValueOnce(new Error("api down"));
    expect((await judge()).status).toBe(502);
    expect(refundRateLimit).not.toHaveBeenCalledWith("hostile:u:u-1");
    vi.unstubAllEnvs();
  });

  it("gives the slot back when there is no key to call the verdict with", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.mocked(hostileVerdict).mockRejectedValueOnce(new Error("no key"));
    expect((await judge()).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:u-1");
    vi.unstubAllEnvs();
  });

  it("gives the slot back for a week already used", async () => {
    week.count = 1;
    expect((await take()).status).toBe(403);
    expect(refundRateLimit).toHaveBeenCalledWith("hostile:u:u-1");
    expect(transcribe).not.toHaveBeenCalled();
  });
});

/*
 * The screen counts the free week from Monday 00:00 on the phone; the
 * server's clock is UTC. Monday 08:00 in Melbourne is Sunday 21:00 UTC,
 * so the server's week still held last Saturday's session and locked
 * the free one the screen offered, after the 60-second take.
 */
describe("the free week", () => {
  it("is counted on the person's own calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T21:00:00.000Z")); // Mon 9 Nov, 08:00 in Melbourne
    await take({ tzOffset: "-660" });
    expect(week.since).toBe("2026-11-08T13:00:00.000Z"); // Mon 9 Nov, 00:00 in Melbourne
  });

  it("is counted west of Greenwich too", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T03:00:00.000Z")); // Sun 8 Nov, 19:00 in Los Angeles
    await take({ tzOffset: "480" });
    expect(week.since).toBe("2026-11-02T08:00:00.000Z"); // Mon 2 Nov, 00:00 in Los Angeles
  });

  it("is UTC's week when the phone does not say", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T21:00:00.000Z"));
    await take();
    expect(week.since).toBe("2026-11-02T00:00:00.000Z");
  });
});

/*
 * The verdict is kept (the games plan, item 15): the route files the
 * verdict it judged itself on the caller's own banked take, once, and
 * never a number the phone sent.
 */
describe("the verdict, stored", () => {
  const VERDICT = {
    held: { score: 68, citedMoment: `You said "${SAID.slice(0, 30)}".`, improve: "Name one team." },
    answered: { score: 54, citedMoment: `You said "${SAID.slice(0, 30)}".`, improve: "Answer first." },
    composed: { score: 72, citedMoment: `You said "${SAID.slice(0, 30)}".`, improve: "Keep that pause." },
    coachLine: "You held the claim.",
  };
  const judgeWith = (extra: Record<string, unknown>) =>
    post(
      {
        phase: "verdict",
        context: JSON.stringify({
          take: SAID,
          rounds: [{ question: "Which teams?", answer: SAID, quoted: "teams worse" }],
          ...extra,
        }),
      },
      false
    );

  it("is filed on the caller's own take, once, as Hostile's", async () => {
    vi.mocked(hostileVerdict).mockResolvedValueOnce(VERDICT);
    const res = await judgeWith({ repId: "rep-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verdict: VERDICT, stored: true });
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].filters).toEqual({
      id: "rep-1",
      user_id: "u-1",
      lesson_id: "hostile-take",
      "round is": null,
    });
    expect(store.writes[0].set).toEqual({
      round: {
        v: 1,
        game: "hostile",
        claimId: "remote-work",
        verdict: VERDICT,
        questions: [{ question: "Which teams?", quoted: "teams worse" }],
      },
    });
  });

  it("stores the server's verdict, never the phone's numbers", async () => {
    vi.mocked(hostileVerdict).mockResolvedValueOnce(VERDICT);
    await judgeWith({ repId: "rep-1", verdict: { held: { score: 100 } }, held: 100 });
    const set = store.writes[0].set.round as { verdict: typeof VERDICT };
    expect(set.verdict.held.score).toBe(68);
  });

  it("writes nothing without a take to file it on, or for a visitor with no account", async () => {
    vi.mocked(hostileVerdict).mockResolvedValue(VERDICT);
    expect(await (await judgeWith({})).json()).toMatchObject({ stored: false });
    expect(await (await judgeWith({ repId: "1,user_id.neq.x" })).json()).toMatchObject({ stored: false });
    vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
    expect(await (await judgeWith({ repId: "rep-1" })).json()).toMatchObject({ stored: false });
    expect(store.writes).toHaveLength(0);
    vi.mocked(hostileVerdict).mockReset();
    vi.mocked(hostileVerdict).mockImplementation(async () => ({ overall: 60 }) as never);
  });

  it("still gives the verdict when it cannot be stored (no 0026, no such take)", async () => {
    vi.mocked(hostileVerdict).mockResolvedValueOnce(VERDICT);
    store.answer = { data: null, error: { message: 'column "round" does not exist' } };
    const res = await judgeWith({ repId: "rep-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verdict: VERDICT, stored: false });

    vi.mocked(hostileVerdict).mockResolvedValueOnce(VERDICT);
    store.answer = { data: [], error: null };
    expect(await (await judgeWith({ repId: "rep-2" })).json()).toMatchObject({ stored: false });
  });
});

/* Security audit, 11 Nov: the context is the phone's copy of the session
   and goes into the verdict's prompt, so its size is the server's to set. */
describe("POST /api/hostile and the context's size", () => {
  it("cuts a take, the answers and the round count to what speech can hold", async () => {
    vi.mocked(hostileVerdict).mockClear();
    await post(
      {
        phase: "verdict",
        context: JSON.stringify({
          take: "word ".repeat(900),
          rounds: Array.from({ length: 3 }, () => ({ question: "q".repeat(500), answer: "a".repeat(3100) })),
          roundNumbers: Array.from({ length: 5 }, () => ({ fillersPerMin: "many", midSentencePauses: 1e12 })),
        }),
      },
      false
    );
    const [ctx, numbers] = vi.mocked(hostileVerdict).mock.calls[0];
    expect(ctx.take.length).toBeLessThanOrEqual(4000);
    expect(ctx.rounds.length).toBeLessThanOrEqual(2);
    for (const r of ctx.rounds) {
      expect(r.question.length).toBeLessThanOrEqual(400);
      expect(r.answer.length).toBeLessThanOrEqual(3000);
    }
    expect(numbers.length).toBeLessThanOrEqual(2);
    expect(numbers[0]).toEqual({ fillersPerMin: 0, midSentencePauses: 1000 });
  });

  it("reads a context too long to be a session as no context", async () => {
    vi.mocked(hostileVerdict).mockClear();
    await post({ phase: "verdict", context: JSON.stringify({ take: "x".repeat(60_000), rounds: [] }) }, false);
    const ctx = vi.mocked(hostileVerdict).mock.calls[0]?.[0];
    expect(ctx?.take ?? "").toBe("");
  });
});

/*
 * The free week, held on every call (#464). Whether a call was the take
 * was the phone's word (a `take` in its context), and only the take was
 * checked, so a free account could skip the lock by saying it had one.
 */
describe("the free week, on every call", () => {
  it("lets the session's own rounds and verdict through while its take is under an hour old", async () => {
    week.count = 1;
    week.latest = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect((await answer()).status).toBe(200);
    expect((await judge()).status).toBe(200);
  });

  it("lets a round through while the take is still being banked", async () => {
    week.count = 0;
    expect((await answer()).status).toBe(200);
  });

  it("refuses a round or a verdict hours after the week's take", async () => {
    week.count = 1;
    week.latest = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect((await answer()).status).toBe(403);
    expect((await judge()).status).toBe(403);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("refuses a round once the week holds more than one take", async () => {
    week.count = 2;
    expect((await answer()).status).toBe(403);
  });
});
