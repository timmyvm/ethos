import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/transcribe", () => ({ transcribe: vi.fn() }));
vi.mock("@/lib/coach", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/coach")>()),
  coachRep: vi.fn(),
}));
vi.mock("@/lib/db", () => {
  const getUserFromAuthHeader = vi.fn(async (_h: string | null): Promise<unknown> => null);
  return {
  saveRep: vi.fn(async () => null),
  findRepByClientId: vi.fn(async () => null),
  getUserFromAuthHeader,
  // The route reads the four-way answer; tests that set a user through
  // getUserFromAuthHeader get it as "user" here.
  resolveAuthHeader: vi.fn(async (h: string | null) => {
    const user = await getUserFromAuthHeader(h);
    return user ? { kind: "user", user } : { kind: "none" };
  }),
  previousEthosIndex: vi.fn(async () => null),
  bossIndexBetween: vi.fn(async (_u: string, _from: Date, _to: Date): Promise<number | null> => null),
  gameRoundsBetween: vi.fn(async (_u: string, _g: string, _from: Date, _to: Date): Promise<number> => 0),
  previousPresence: vi.fn(async () => null),
  isPremium: vi.fn(async () => false),
  readMeterState: vi.fn(async () => ({
    balance: 1,
    accruedOn: null,
    usedAt: null,
  })),
  writeMeterState: vi.fn(async () => {}),
  };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    window: null,
    retryAfterS: 0,
  })),
  refundRateLimit: vi.fn(async () => {}),
}));
vi.mock("@/lib/accuracy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accuracy")>()),
  judgeAccuracy: vi.fn(async () => null),
}));

import { POST } from "@/app/api/analyze/route";
import { judgeAccuracy } from "@/lib/accuracy";
import { coachRep } from "@/lib/coach";
import {
  bossIndexBetween,
  findRepByClientId,
  gameRoundsBetween,
  getUserFromAuthHeader,
  resolveAuthHeader,
  isPremium,
  previousEthosIndex,
  readMeterState,
  saveRep,
  writeMeterState,
} from "@/lib/db";
import { bossWeekField } from "@/lib/boss";
import { gameOfTheDay } from "@/lib/games";
import { dateKey } from "@/lib/metering";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { transcribe } from "@/lib/transcribe";
import { ENVELOPE_RATE, serializeEnvelope, type Envelope } from "@/lib/envelope";
import { ethosIndex, pauseScore, type Tier1Scores } from "@/lib/index-score";
import { computeMetrics } from "@/lib/metrics";
import { reportJudged, type JudgedPause } from "@/lib/pause-quality";

function post(form: FormData | null): Promise<Response> {
  const req = new Request("http://test.local/api/analyze", {
    method: "POST",
    body: form ?? "not-a-form",
  });
  return POST(req as unknown as NextRequest);
}

function audioForm(): FormData {
  const form = new FormData();
  form.append(
    "audio",
    new Blob(["fake-opus-bytes"], { type: "audio/webm" }),
    "rep.webm"
  );
  return form;
}

const WORDS =
  "So um my name is Tim and I am building a speech coach called Ethos " +
  "which measures the fillers pauses and pace in every rep you record";

// A realistic rep: enough varied speech to clear the substance gate, so
// the coach layer actually runs. A six-word fixture is (correctly) not
// scorable any more.
const FIXTURE = {
  text: WORDS,
  durationS: 60,
  words: WORDS.split(" ").map((word, i) => ({
    word: i === 0 ? word : ` ${word}`,
    start: i * 0.3,
    end: i === WORDS.split(" ").length - 1 ? 59.5 : i * 0.3 + 0.28,
  })),
  segments: [],
  raw: {},
};

/** Nothing said: zero fillers, clean pace, and no rep to score. */
const EMPTY_FIXTURE = {
  text: "I don't know. I don't know. I don't know. I don't know.",
  durationS: 60,
  words: "I don't know I don't know I don't know I don't know"
    .split(" ")
    .map((word, i) => ({
      word: i === 0 ? word : ` ${word}`,
      start: i * 0.5,
      end: i * 0.5 + 0.4,
    })),
  segments: [],
  raw: {},
};

beforeEach(() => {
  vi.mocked(transcribe).mockReset();
  vi.mocked(coachRep).mockReset();
  vi.mocked(judgeAccuracy).mockReset();
  vi.mocked(judgeAccuracy).mockResolvedValue(null);
  vi.mocked(saveRep).mockClear();
  vi.mocked(saveRep).mockResolvedValue(null);
  vi.mocked(findRepByClientId).mockReset();
  vi.mocked(findRepByClientId).mockResolvedValue(null);
  vi.mocked(writeMeterState).mockClear();
  vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    window: null,
    retryAfterS: 0,
  });
  vi.mocked(isPremium).mockResolvedValue(false);
  vi.mocked(readMeterState).mockResolvedValue({
    balance: 1,
    accruedOn: null,
    usedAt: null,
  });
  vi.mocked(previousEthosIndex).mockResolvedValue(null);
  vi.mocked(bossIndexBetween).mockResolvedValue(null);
  vi.mocked(gameRoundsBetween).mockReset();
  vi.mocked(gameRoundsBetween).mockResolvedValue(0);
});

/** A rep good enough to be judged, with the coach layer stubbed out. */
function coachedFixture() {
  const dim = {
    score: 60,
    citedMoment: '"my name is Tim"',
    improve: "Open with the claim.",
  };
  vi.mocked(transcribe).mockResolvedValue(FIXTURE);
  vi.mocked(coachRep).mockResolvedValue({
    focus: "Kill 'um' — 1 filler.",
    strength: "Held 1 pause.",
    supply: { original: "um", upgrade: "(pause)", note: "Silence reads as thought." },
    coachLine: "1 filler in 60 seconds.",
    dimensions: {
      structure: dim,
      credibility: dim,
      engagement: dim,
      confidence: dim,
    },
  });
}

describe("POST /api/analyze", () => {
  it("rejects a request without an audio field", async () => {
    const res = await post(new FormData());
    expect(res.status).toBe(400);
  });

  it("returns 503 when transcription is unconfigured", async () => {
    vi.mocked(transcribe).mockRejectedValue(
      new Error("OPENAI_API_KEY is not set — transcription unavailable.")
    );
    const res = await post(audioForm());
    expect(res.status).toBe(503);
  });

  it("returns 502 on upstream transcription failure", async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 500: boom"));
    const res = await post(audioForm());
    expect(res.status).toBe(502);
  });

  it("answers 422 when Whisper cannot read the file, which no resend will fix", async () => {
    for (const code of [400, 413, 415]) {
      vi.mocked(transcribe).mockRejectedValue(
        new Error(`Whisper API ${code}: Invalid file format`)
      );
      expect((await post(audioForm())).status).toBe(422);
    }
  });

  it("keeps 502 for a Whisper refusal that is ours, not the file's, and gives the slot back", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-1", anonymous: false });
    for (const code of [401, 403, 404, 408, 429]) {
      vi.mocked(refundRateLimit).mockClear();
      vi.mocked(transcribe).mockRejectedValue(new Error(`Whisper API ${code}: nope`));
      expect((await post(audioForm())).status, String(code)).toBe(502);
      // The phone sends a 502 again up to four times: a kept slot each time
      // locked every tester out for the hour of a key or model fault.
      expect(refundRateLimit, String(code)).toHaveBeenCalledWith("u:u-1");
    }
  });

  it("returns metrics, tier-1 scores, and the /1000 index with coach output", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    const dim = {
      score: 60,
      citedMoment: '"my name is Tim"',
      improve: "Open with the claim.",
    };
    vi.mocked(coachRep).mockResolvedValue({
      focus: "Kill 'um' — 1 filler.",
      strength: "Held 1 pause.",
      supply: { original: "um", upgrade: "(pause)", note: "Silence reads as thought." },
      coachLine: "1 filler in 60 seconds.",
      dimensions: {
        structure: dim,
        credibility: dim,
        engagement: dim,
        confidence: dim,
      },
    });
    const res = await post(audioForm());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.fillerCount).toBe(1);
    expect(body.metrics.wpm).toBe(27);
    expect(body.coach.coachLine).toBe("1 filler in 60 seconds.");
    expect(body.tier1.fillers).toBeGreaterThan(0);
    expect(body.anchors).toEqual({ hedgeCount: 0, restartCount: 0 });
    // All four judged dims at 60 → tier-2 half contributes 300 exactly.
    expect(body.ethosIndex).toBeGreaterThan(300);
    expect(body.ethosIndex).toBeLessThanOrEqual(1000);
  });

  /* #429: the coach may say none, or its upgrade may be dropped. The take
     keeps its coach and the judged half of its Index all the same. */
  it("scores a take whose coach has no upgrade exactly as one that has", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    const dim = { score: 60, citedMoment: '"my name is Tim"', improve: "Open with the claim." };
    const coach = {
      focus: "Kill 'um', 1 filler.",
      strength: "Held 1 pause.",
      supply: { original: "my name is Tim", upgrade: "I'm Tim", note: "It says the same in fewer words." },
      coachLine: "1 filler in 60 seconds.",
      dimensions: { structure: dim, credibility: dim, engagement: dim, confidence: dim },
    };
    vi.mocked(coachRep).mockResolvedValue(coach);
    const withIt = await (await post(audioForm())).json();
    vi.mocked(coachRep).mockResolvedValue({ ...coach, supply: null });
    const res = await post(audioForm());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coach.supply).toBeNull();
    expect(body.coach.strength).toBe("Held 1 pause.");
    expect(body.ethosIndex).toBe(withIt.ethosIndex);
    expect(body.ethosIndex).toBeGreaterThan(300);
    expect(vi.mocked(saveRep).mock.lastCall?.[0].coach?.supply).toBeNull();
  });

  it("still returns the numbers when the coach layer fails — no partial index", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockRejectedValue(new Error("api down"));
    const res = await post(audioForm());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.fillerCount).toBe(1);
    expect(body.coach).toBeNull();
    expect(body.ethosIndex).toBeNull();
    expect(body.tier1.pause).toBeGreaterThan(0);
  });

  /* A function killed at 60 seconds stores nothing and keeps the slot. */
  it("gives the coach a deadline well inside the function's minute", async () => {
    coachedFixture();
    const before = Date.now();
    await post(audioForm());
    const deadline = vi.mocked(coachRep).mock.calls[0][4];
    expect(deadline).toBeGreaterThanOrEqual(before + 40_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 45_000);
  });

  it("recomputes the XP multiplier server-side and ignores the client's", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    const form = audioForm();
    // A forged form: premium mods this anonymous rep isn't entitled to,
    // plus a multiplier the client made up.
    form.append("mods", "tight,crowd,interrupt");
    form.append("xpMultiplier", "9");
    const body = await (await post(form)).json();
    expect(body.mods).toEqual([]);
    expect(body.xpMultiplier).toBe(1);
    expect(body.mode).toBe("daily");
  });

  it("fact-checks a boss rep and pays the boss multiplier", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(judgeAccuracy).mockResolvedValue({
      claims: [],
      covered: [0],
      score: 25,
      coverage: 0.25,
      confidentlyWrong: 0,
      missed: [],
    });
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    const body = await (await post(form)).json();
    expect(body.mode).toBe("boss");
    expect(body.xpMultiplier).toBe(1.5);
    expect(body.accuracy.score).toBe(25);
    expect(vi.mocked(judgeAccuracy).mock.calls[0][1].id).toBe("crispr");
  });

  /* The games plan, item 16: the boss is the week's benchmark. */
  it("runs the boss with no mods, whatever the form says it ran", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(isPremium).mockResolvedValue(true);
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    form.append("mods", "tight,crowd,interrupt");
    const body = await (await post(form)).json();
    expect(body.mode).toBe("boss");
    expect(body.mods).toEqual([]);
    expect(body.xpMultiplier).toBe(1.5);
  });

  /* Map 4: four empty boss takes each paid 15 XP. An unscored boss pays
     what an unscored daily take pays, ×1, stored and answered alike. */
  it("pays an unscored boss take ×1, as an unscored take anywhere", async () => {
    vi.mocked(transcribe).mockResolvedValue(EMPTY_FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-boss", anonymous: false });
    vi.mocked(saveRep).mockResolvedValue({ id: "rep-boss", audioPath: null });
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    const body = await (await post(form)).json();
    expect(body.scorable).toBe(false);
    expect(body.mode).toBe("boss");
    expect(body.xpMultiplier).toBe(1);
    const saved = vi.mocked(saveRep).mock.calls[0][0];
    expect(saved.mode).toBe("boss");
    expect(saved.xpMultiplier).toBe(1);
    expect(saved.mods).toEqual([]);
    // And a daily take with nothing in it pays the same.
    vi.mocked(saveRep).mockClear();
    const daily = await (await post(audioForm())).json();
    expect(daily.xpMultiplier).toBe(1);
    expect(vi.mocked(saveRep).mock.calls[0][0].xpMultiplier).toBe(1);
  });

  it("compares a boss with last week's boss, in the speaker's own week", async () => {
    /* The clock is the recording's morning: the route keeps a phone's
       recordedAt only within 72 hours of now (lib/spoken-at.ts), so on
       9 Nov this take read as spoken on the 6th's last allowed instant
       and the week moved on with the calendar. */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T00:30:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-boss", anonymous: false });
    vi.mocked(previousEthosIndex).mockClear();
    vi.mocked(previousEthosIndex).mockResolvedValue(700);
    vi.mocked(bossIndexBetween).mockClear();
    vi.mocked(bossIndexBetween).mockResolvedValue(648);
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    // Spoken Friday 6 Nov, 10:00 in Melbourne (the clock is pinned above).
    form.append("recordedAt", "2026-11-05T23:00:00.000Z");
    form.append("tzOffset", "-660");
    const body = await (await post(form)).json();
    expect(body.previousIndex).toBe(648);
    expect(previousEthosIndex).not.toHaveBeenCalled();
    const [user, from, to] = vi.mocked(bossIndexBetween).mock.calls[0];
    expect(user).toBe("u-boss");
    // Monday 26 Oct to Monday 2 Nov, midnight in Melbourne.
    expect(from.toISOString()).toBe("2026-10-25T13:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });

  it("reads last week from the phone's own Mondays, and from the offset without them", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-boss", anonymous: false });
    const spoken = Date.now() - 60_000;
    const week = bossWeekField(new Date(spoken));
    const [from, to] = week.split("/");
    vi.mocked(bossIndexBetween).mockClear();
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    form.append("recordedAt", String(spoken));
    form.append("tzOffset", String(new Date(spoken).getTimezoneOffset()));
    form.append("bossWeek", week);
    await post(form);
    const [, a, b] = vi.mocked(bossIndexBetween).mock.calls[0];
    expect([a.toISOString(), b.toISOString()]).toEqual([from, to]);

    // A week that is not the one before the take: the offset's week.
    vi.mocked(bossIndexBetween).mockClear();
    const forged = audioForm();
    forged.append("bossTopicId", "crispr");
    forged.append("recordedAt", String(spoken));
    forged.append("tzOffset", "0");
    forged.append("bossWeek", "2020-01-06T00:00:00.000Z/2020-01-13T00:00:00.000Z");
    await post(forged);
    const [, c] = vi.mocked(bossIndexBetween).mock.calls[0];
    expect(c.getTime()).toBeGreaterThan(Date.parse("2026-01-01"));
  });

  it("gives a first boss no delta, and a daily take its latest Index as before", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "u-boss", anonymous: false });
    vi.mocked(previousEthosIndex).mockClear();
    vi.mocked(previousEthosIndex).mockResolvedValue(700);
    vi.mocked(bossIndexBetween).mockClear();
    vi.mocked(bossIndexBetween).mockResolvedValue(null);
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    const first = await (await post(form)).json();
    expect(first.previousIndex).toBeNull();
    expect(previousEthosIndex).not.toHaveBeenCalled();

    const daily = await (await post(audioForm())).json();
    expect(daily.previousIndex).toBe(700);
    expect(vi.mocked(bossIndexBetween)).toHaveBeenCalledTimes(1);
  });

  it("refuses to score a rep with nothing in it", async () => {
    // The reported bug: "I don't know" on repeat has zero fillers and a
    // clean pace, and used to come back three stars and a mid-500s Index.
    vi.mocked(transcribe).mockResolvedValue(EMPTY_FIXTURE);
    const body = await (await post(audioForm())).json();
    expect(body.scorable).toBe(false);
    expect(body.ethosIndex).toBeNull();
    expect(body.metrics.stars).toBe(1);
    expect(body.metrics.fillerCount).toBe(0); // still true, just not a win
    // No point burning an LLM call on it either.
    expect(coachRep).not.toHaveBeenCalled();
  });

  it("does not fact-check a daily rep", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    const body = await (await post(audioForm())).json();
    expect(judgeAccuracy).not.toHaveBeenCalled();
    expect(body.accuracy).toBeNull();
  });

  it("survives a fact-check failure without losing the rep", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(judgeAccuracy).mockRejectedValue(new Error("api down"));
    const form = audioForm();
    form.append("bossTopicId", "crispr");
    const res = await post(form);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accuracy).toBeNull();
    expect(body.metrics.fillerCount).toBe(1);
  });
});

/**
 * §3 — meter the judged tier, never the rep. The tests that matter here
 * are the two guardrails: the cap must never break a streak, and it must
 * never quietly bill someone for an analysis they didn't receive.
 */
describe("judged-analysis metering", () => {
  it("returns the measured tier and no coach once the cap is hit", async () => {
    coachedFixture();
    // accruedOn must be the route's own "today": a hardcoded date lets
    // the meter accrue a fresh grant once the real clock passes it, and
    // the cap silently stops being hit.
    vi.mocked(readMeterState).mockResolvedValue({
      balance: 0,
      accruedOn: dateKey(new Date()),
      usedAt: "2026-08-11T09:00:00.000Z",
    });
    const body = await (await post(audioForm())).json();

    expect(coachRep).not.toHaveBeenCalled();
    expect(body.judged).toMatchObject({ ran: false, capped: true });
    // Every rep returns something. Fillers, WPM, pauses and the
    // transcript are free forever.
    expect(body.metrics.fillerCount).toBe(1);
    expect(body.transcript).toBeTruthy();
    expect(body.tier1.pause).toBeGreaterThan(0);
    // No judged half means no Index — a partial /1000 would be a lie.
    expect(body.ethosIndex).toBeNull();
  });

  it("still stores the rep when the analysis is capped, so the streak stands", async () => {
    coachedFixture();
    vi.mocked(readMeterState).mockResolvedValue({
      balance: 0,
      accruedOn: dateKey(new Date()),
      usedAt: null,
    });
    await post(audioForm());
    expect(saveRep).toHaveBeenCalledTimes(1);
  });

  it("spends one and reports what is left", async () => {
    coachedFixture();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    vi.mocked(readMeterState).mockResolvedValue({
      balance: 2,
      accruedOn: dateKey(new Date()),
      usedAt: null,
    });
    const body = await (await post(audioForm())).json();
    expect(body.judged).toMatchObject({ ran: true, remaining: 1 });
    expect(writeMeterState).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ balance: 1 })
    );
  });

  it("never charges for an analysis the coach layer failed to deliver", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockRejectedValue(new Error("api down"));
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    const body = await (await post(audioForm())).json();
    expect(body.coach).toBeNull();
    expect(writeMeterState).not.toHaveBeenCalled();
  });

  it("never spends one on a rep with nothing in it", async () => {
    vi.mocked(transcribe).mockResolvedValue(EMPTY_FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    await post(audioForm());
    expect(writeMeterState).not.toHaveBeenCalled();
  });

  it("does not meter premium at all", async () => {
    coachedFixture();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    vi.mocked(isPremium).mockResolvedValue(true);
    vi.mocked(readMeterState).mockResolvedValue({
      balance: 0,
      accruedOn: "2026-08-11",
      usedAt: null,
    });
    const body = await (await post(audioForm())).json();
    expect(body.judged).toMatchObject({ ran: true, unlimited: true });
    expect(writeMeterState).not.toHaveBeenCalled();
  });
});

describe("delivery metrics", () => {
  it("defaults to voice and stores no delivery numbers", async () => {
    coachedFixture();
    const body = await (await post(audioForm())).json();
    expect(body.captureMode).toBe("voice");
    expect(body.delivery).toBeNull();
  });

  it("accepts the five derived numbers and clamps them", async () => {
    coachedFixture();
    const form = audioForm();
    form.append("captureMode", "voice_video");
    form.append(
      "delivery",
      JSON.stringify({
        metrics: {
          gestureRate: 14,
          postureDrift: 0.04,
          headStability: 0.02,
          eyeLinePct: 250,
          presenceScore: 4000,
        },
        moments: [{ t: 47, seconds: 6, kind: "eyes-down", note: "0:47 — …" }],
      })
    );
    const body = await (await post(form)).json();
    expect(body.captureMode).toBe("voice_video");
    expect(body.delivery.eyeLinePct).toBe(100);
    expect(body.delivery.presenceScore).toBe(1000);
    expect(body.deliveryMoments).toHaveLength(1);
  });

  it("drops a malformed delivery payload rather than storing half of it", async () => {
    coachedFixture();
    const form = audioForm();
    form.append("captureMode", "voice_video");
    form.append("delivery", "{not json");
    const body = await (await post(form)).json();
    expect(body.delivery).toBeNull();
    expect(body.deliveryMoments).toEqual([]);
  });

  /**
   * Presence is a SECOND score. If it ever leaks into the Index the
   * trendline stops being comparable across modes, which is the whole
   * reason there are two numbers.
   */
  it("keeps Presence out of the Ethos Index", async () => {
    coachedFixture();
    const voice = await (await post(audioForm())).json();

    const form = audioForm();
    form.append("captureMode", "voice_video");
    form.append(
      "delivery",
      JSON.stringify({
        metrics: {
          gestureRate: 14,
          postureDrift: 0.04,
          headStability: 0.02,
          eyeLinePct: 95,
          presenceScore: 910,
        },
        moments: [],
      })
    );
    const video = await (await post(form)).json();

    expect(video.ethosIndex).toBe(voice.ethosIndex);
    expect(video.delivery.presenceScore).toBe(910);
  });
});

describe("rate limiting", () => {
  it("returns 429 with the friendly body before any Whisper call", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      window: "hour",
      retryAfterS: 1200,
    });
    const res = await post(audioForm());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimited).toBe(true);
    expect(body.retryAfterS).toBe(1200);
    expect(body.error).toContain("reopens in about 20 minutes");
    expect(res.headers.get("Retry-After")).toBe("1200");
    // The whole point: the spend never happens.
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("keys every session, guest or account, to the user tier and visitors to the anon tier (#409)", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({
      id: "user-1",
      anonymous: false,
    });
    await post(audioForm());
    expect(consumeRateLimit).toHaveBeenLastCalledWith("u:user-1", "user");

    vi.mocked(getUserFromAuthHeader).mockResolvedValue({
      id: "anon-1",
      anonymous: true,
    });
    vi.mocked(consumeRateLimit).mockClear();
    await post(audioForm());
    expect(consumeRateLimit).toHaveBeenCalledWith("u:anon-1", "user");

    vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
    await post(audioForm());
    expect(vi.mocked(consumeRateLimit).mock.lastCall?.[0]).toMatch(/^ip:/);
    expect(vi.mocked(consumeRateLimit).mock.lastCall?.[1]).toBe("anon");
  });
});

describe("guests on one address share a ceiling (#416)", () => {
  it("counts a guest against its address too, and an account never", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
    await post(audioForm());
    const guestCalls = vi.mocked(consumeRateLimit).mock.calls.filter((c) => c[1] === "guestip");
    expect(guestCalls).toHaveLength(1);
    expect(guestCalls[0][0]).toMatch(/^guest:ip:/);

    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    await post(audioForm());
    expect(vi.mocked(consumeRateLimit).mock.calls.some((c) => c[1] === "guestip")).toBe(false);
  });

  it("turns a guest away when its address is full, and gives its own slot back", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-2", anonymous: true });
    vi.mocked(consumeRateLimit).mockImplementation(async (subject: string) =>
      subject.startsWith("guest:ip:")
        ? { allowed: false, window: "hour", retryAfterS: 600 }
        : { allowed: true, window: null, retryAfterS: 0 }
    );
    vi.mocked(refundRateLimit).mockClear();
    vi.mocked(transcribe).mockClear();
    const res = await post(audioForm());
    expect(res.status).toBe(429);
    expect(transcribe).not.toHaveBeenCalled();
    expect(refundRateLimit).toHaveBeenCalledWith("u:anon-2");
  });
});

/*
 * A recording the outbox sends later belongs to the day it was spoken
 * (streak, freezes, coins and the Log all bucket by reps.created_at), and
 * so does the judged read it spends. The client says when; the server
 * clamps it, so a forged time can move a take back three days at most.
 */
describe("the day a recording was spoken", () => {
  function sentLater(at: number): FormData {
    const form = audioForm();
    form.append("recordedAt", String(at));
    return form;
  }
  const savedAt = () =>
    (vi.mocked(saveRep).mock.calls.at(-1)?.[0] as { createdAt?: string })
      .createdAt;

  it("stores the recording at the time it was spoken, not when it uploaded", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    const spoken = Date.now() - 9 * 3_600_000;
    await post(sentLater(spoken));
    expect(savedAt()).toBe(new Date(spoken).toISOString());
  });

  it("never dates a recording in the future, or more than three days back", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    const before = Date.now();
    await post(sentLater(before + 3_600_000));
    const future = new Date(savedAt()!).getTime();
    expect(future).toBeGreaterThanOrEqual(before);
    expect(future).toBeLessThanOrEqual(Date.now());

    const start = Date.now();
    await post(sentLater(start - 10 * 86_400_000));
    const back = new Date(savedAt()!).getTime();
    expect(back).toBeGreaterThanOrEqual(start - 72 * 3_600_000);
    expect(back).toBeLessThanOrEqual(Date.now() - 72 * 3_600_000 + 1_000);
  });

  it("leaves the time to the database when the form does not say", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    await post(audioForm());
    expect(savedAt()).toBeUndefined();
  });

  it("spends the judged read of the day the recording was spoken", async () => {
    coachedFixture();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    const yesterday = Date.now() - 24 * 3_600_000;
    // Yesterday's read is already spent; today's has not been granted yet.
    vi.mocked(readMeterState).mockResolvedValue({
      balance: 0,
      accruedOn: dateKey(new Date(yesterday)),
      usedAt: new Date(yesterday).toISOString(),
    });
    const body = await (await post(sentLater(yesterday))).json();
    expect(coachRep).not.toHaveBeenCalled();
    expect(body.judged).toMatchObject({ ran: false, capped: true });
  });
});

/*
 * A lost response (the phone switched networks while the server wrote
 * the row) or a second tab resends the same recording. The outbox id
 * travels as clientId, and a resend gets the stored recording back
 * instead of a second row, double XP and a spent judged read.
 */
describe("a recording sent twice", () => {
  function keyed(id = "1792-f1-abcd1234"): FormData {
    const form = audioForm();
    form.append("clientId", id);
    return form;
  }

  it("answers a resend with the recording already stored, before the limiter and Whisper", async () => {
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    vi.mocked(findRepByClientId).mockResolvedValue("rep-1");
    vi.mocked(consumeRateLimit).mockClear();
    const res = await post(keyed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ repId: "rep-1", duplicate: true });
    expect(findRepByClientId).toHaveBeenCalledWith("user-1", "1792-f1-abcd1234");
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
    expect(saveRep).not.toHaveBeenCalled();
  });

  it("stores the key with a first send", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    await post(keyed());
    expect(vi.mocked(saveRep).mock.calls[0][0]).toMatchObject({ clientId: "1792-f1-abcd1234" });
  });

  it("answers the stored recording when two sends race past the lookup", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    vi.mocked(saveRep).mockResolvedValue({ id: "rep-1", audioPath: null, duplicate: true });
    expect(await (await post(keyed())).json()).toEqual({ repId: "rep-1", duplicate: true });
  });

  it("ignores a key that is not an outbox id", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
    await post(keyed("x".repeat(300)));
    expect(findRepByClientId).not.toHaveBeenCalled();
    expect(vi.mocked(saveRep).mock.calls[0][0]).toMatchObject({ clientId: null });
  });
});

/*
 * A brand-new visitor has three uploads an hour. Each retry of one
 * recording that Whisper never answered used to spend one of them, so a
 * single take during a Whisper hiccup ended at "the floor reopens in
 * about 60 minutes". A slot spent on our outage is given back.
 */
describe("the rate-limit slot of a failed transcription", () => {
  beforeEach(() => {
    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(refundRateLimit).mockClear();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "anon-1", anonymous: true });
  });

  it("is given back when Whisper is down, busy or unreachable", async () => {
    for (const message of [
      "Whisper API 500: boom",
      "Whisper API 503: overloaded",
      "Whisper API 429: rate limited",
      "fetch failed",
      "OPENAI_API_KEY is not set",
    ]) {
      vi.mocked(refundRateLimit).mockClear();
      vi.mocked(transcribe).mockRejectedValue(new Error(message));
      await post(audioForm());
      expect(refundRateLimit, message).toHaveBeenCalledWith("u:anon-1");
    }
    expect(vi.mocked(consumeRateLimit).mock.calls[0][0]).toBe("u:anon-1");
  });

  it("is kept when the file itself is refused, so junk cannot loop for free", async () => {
    for (const code of [400, 413, 415]) {
      vi.mocked(refundRateLimit).mockClear();
      vi.mocked(transcribe).mockRejectedValue(new Error(`Whisper API ${code}: Invalid file format`));
      await post(audioForm());
      expect(refundRateLimit, String(code)).not.toHaveBeenCalled();
    }
  });

  it("is given back when Whisper refuses our key, our access or our model", async () => {
    for (const code of [401, 403, 404, 408]) {
      vi.mocked(refundRateLimit).mockClear();
      vi.mocked(transcribe).mockRejectedValue(new Error(`Whisper API ${code}: nope`));
      await post(audioForm());
      expect(refundRateLimit, String(code)).toHaveBeenCalledWith("u:anon-1");
    }
  });

  it("is kept when the recording is saved", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(saveRep).mockResolvedValue({ id: "rep-1" } as never);
    await post(audioForm());
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  /* Only a saved recording keeps its slot (#409). */
  /* #457: once a take is heard, Whisper and the coach are paid for, so
     the slot stays spent. It came back on a failed save, and a save can
     be failed on purpose, which made every request free. */
  it("stays spent once the take was heard, even when the save fails", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(saveRep).mockResolvedValue(null);
    await post(audioForm());
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("stays spent when a second send of the same take raced the first", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(saveRep).mockResolvedValue({ id: "rep-1", duplicate: true } as never);
    await post(audioForm());
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("drops a lesson id the app never writes, so it cannot fail the save", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(saveRep).mockClear();
    const form = audioForm();
    form.set("lessonId", "a\u0000b");
    await post(form);
    expect(vi.mocked(saveRep).mock.calls[0]?.[0]).toMatchObject({ lessonId: undefined });
  });

  it("keeps only real delivery moments, rebuilt from their own fields", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(saveRep).mockClear();
    const form = audioForm();
    form.set(
      "delivery",
      JSON.stringify({
        metrics: { presenceScore: 600 },
        moments: [
          { t: 3, seconds: 2, kind: "slouch", note: "Shoulders\u0000 dropped", extra: "x".repeat(10000) },
          { t: 4, seconds: 1, kind: "anything", note: "no" },
          "junk",
        ],
      })
    );
    await post(form);
    const saved = vi.mocked(saveRep).mock.calls[0]?.[0] as { deliveryMoments?: unknown };
    expect(saved.deliveryMoments).toEqual([{ t: 3, seconds: 2, kind: "slouch", note: "Shoulders dropped" }]);
  });

  it("never sends the provider's error text to the phone", async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 401: Incorrect API key provided: sk-proj-abc. org-123"));
    const res = await post(audioForm());
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/sk-|org-|Whisper API/);
  });
});

describe("a token that does not resolve", () => {
  function withToken(): Promise<Response> {
    const req = new Request("http://test.local/api/analyze", {
      method: "POST",
      body: audioForm(),
      headers: { Authorization: "Bearer stale" },
    });
    return POST(req as unknown as NextRequest);
  }

  beforeEach(() => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(consumeRateLimit).mockClear();
  });

  it("answers 401 for a lapsed sign-in and stores nothing without its owner", async () => {
    vi.mocked(resolveAuthHeader).mockResolvedValueOnce({ kind: "rejected" });
    const res = await withToken();
    expect(res.status).toBe(401);
    expect((await res.json()).authExpired).toBe(true);
    expect(saveRep).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("answers 503 when sign-in can't be checked, so the upload is retried", async () => {
    vi.mocked(resolveAuthHeader).mockResolvedValueOnce({ kind: "unavailable" });
    const res = await withToken();
    expect(res.status).toBe(503);
    expect(saveRep).not.toHaveBeenCalled();
  });

  it("still scores a sessionless upload, as anonymous-first promises", async () => {
    vi.mocked(resolveAuthHeader).mockResolvedValueOnce({ kind: "none" });
    expect((await post(audioForm())).status).toBe(200);
    expect(saveRep).toHaveBeenCalledTimes(1);
  });
});

/*
 * The games plan, items 3 and 10: a game round is measured on the server
 * and stored, and the XP shown is the XP paid, on any plan. A game's
 * staged mods come as entitled (#194); Interruption only when Demos
 * actually cut in; the level multiplies it, capped at 3.
 */
describe("a game round", () => {
  /* Forty different words to 0:19.9, Demos at 0:20, 1.1s held, forty more to 0:39.08. */
  const said = (from: number, n: number, tag: string) =>
    Array.from({ length: n }, (_, i) => ({
      word: ` ${tag}${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
      start: Math.round((from + i * 0.45) * 100) / 100,
      end: Math.round((from + i * 0.45 + 0.43) * 100) / 100,
    }));
  const QA_WORDS = [...said(1.92, 40, "x"), ...said(21.1, 40, "y")];
  const QA_FIXTURE = {
    text: QA_WORDS.map((w) => w.word).join(""),
    durationS: 40,
    words: QA_WORDS,
    segments: [],
    raw: {},
  };

  function gameForm(lessonId: string, round?: unknown, mods?: string): FormData {
    const form = audioForm();
    form.append("lessonId", lessonId);
    if (round !== undefined) form.append("round", JSON.stringify(round));
    if (mods) form.append("mods", mods);
    return form;
  }

  beforeEach(() => {
    vi.mocked(transcribe).mockResolvedValue(QA_FIXTURE);
    vi.mocked(coachRep).mockResolvedValue(null);
    vi.mocked(isPremium).mockResolvedValue(false);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue({ id: "user-1", anonymous: false });
  });

  it("pays a free account ×2 for Q&A when Demos cut in, and stores the round", async () => {
    const body = await (
      await post(gameForm("game:qa:qa3", { game: "qa", level: 1, cutIns: [{ at: 20, line: "Says who?" }], stoppedBy: "you" }))
    ).json();
    expect(body.mods).toEqual(["interrupt"]);
    expect(body.xpMultiplier).toBe(2);
    expect(body.round).toMatchObject({
      game: "qa",
      level: 1,
      stoppedBy: "you",
      cutIns: [{ at: 20, line: "Says who?", verdict: "held", gap: 1.1 }],
      counted: true,
    });
    const saved = vi.mocked(saveRep).mock.calls[0][0];
    expect(saved).toMatchObject({ mods: ["interrupt"], xpMultiplier: 2, lessonId: "game:qa:qa3" });
    expect(saved.round).toEqual(body.round);
  });

  it("pays ×1 when he never cut in, and stores the round as missed", async () => {
    const body = await (
      await post(gameForm("game:qa:qa3", { game: "qa", level: 1, cutIns: [], stoppedBy: "you" }))
    ).json();
    expect(body.mods).toEqual([]);
    expect(body.xpMultiplier).toBe(1);
    expect(body.round.cutIns[0].verdict).toBe("missed");
    expect(body.round.counted).toBe(false);
    expect(vi.mocked(saveRep).mock.calls[0][0]).toMatchObject({ mods: [], xpMultiplier: 1 });
  });

  it("pays ×1 and measures nothing when the phone sent no round", async () => {
    const body = await (await post(gameForm("game:qa:qa3"))).json();
    expect(body.xpMultiplier).toBe(1);
    expect(body.mods).toEqual([]);
    expect(body.round).toBeNull();
    expect(vi.mocked(saveRep).mock.calls[0][0].round).toBeNull();
  });

  it("pays no Interruption for a cut-in the take could not have heard", async () => {
    for (const at of [0.5, 39.6, 90]) {
      vi.mocked(saveRep).mockClear();
      const body = await (
        await post(gameForm("game:qa:qa3", { level: 1, cutIns: [{ at, line: "So what?" }] }))
      ).json();
      expect(body.xpMultiplier, String(at)).toBe(1);
    }
  });

  it("multiplies by the level, and files a forged level where its cut-in says", async () => {
    const level2 = await (
      await post(gameForm("game:qa:qa3", { level: 2, cutIns: [{ at: 8, line: "So what?" }] }))
    ).json();
    expect(level2.round.level).toBe(2);
    expect(level2.xpMultiplier).toBe(2.5);

    const forged = await (
      await post(gameForm("game:qa:qa3", { level: 3, cutIns: [{ at: 25, line: "So what?" }] }))
    ).json();
    expect(forged.round.level).toBe(1);
    expect(forged.xpMultiplier).toBe(2);
  });

  /** A moment in the last day or two (UTC) when `game` is the free one. */
  const freeDayOf = (game: string): number => {
    const now = Date.now() - 60_000;
    return gameOfTheDay(new Date(now).toISOString().slice(0, 10)) === game ? now : now - 86_400_000;
  };
  const onDay = (form: FormData, at: number) => {
    form.append("recordedAt", String(at));
    form.append("tzOffset", "0");
    return form;
  };
  const rushRound = { game: "rush", level: 1, cutIns: [], stoppedBy: "you" };

  it("pays Speed rush's tight clock to a free account on its free day, at its level", async () => {
    const body = await (await post(onDay(gameForm("game:rush:ru2", rushRound), freeDayOf("rush")))).json();
    expect(body.mods).toEqual(["tight"]);
    expect(body.xpMultiplier).toBe(1.5);
    expect(body.round).toMatchObject({ game: "rush", level: 1, cap: 45, lastWord: 39.08, landed: true });
    // Counted on the speaker's own day, for this game.
    const [user, game, from, to] = vi.mocked(gameRoundsBetween).mock.calls[0];
    expect([user, game]).toEqual(["user-1", "rush"]);
    expect(to.getTime() - from.getTime()).toBe(86_400_000);
  });

  it("measures and pays no Premium round a free account was not given (games review, finding 3)", async () => {
    // Speed rush on Interview's free day, forged at level 3.
    const notToday = freeDayOf("interview");
    const forged = await (
      await post(onDay(gameForm("game:rush:ru1", { ...rushRound, level: 3 }), notToday))
    ).json();
    expect(forged.round).toBeNull();
    expect(forged.mods).toEqual([]);
    expect(forged.xpMultiplier).toBe(1);
    expect(vi.mocked(saveRep).mock.calls[0][0]).toMatchObject({ round: null, mods: [], xpMultiplier: 1 });

    // A second round on its free day: the first is already stored.
    vi.mocked(saveRep).mockClear();
    vi.mocked(gameRoundsBetween).mockResolvedValue(1);
    const second = await (await post(onDay(gameForm("game:rush:ru2", rushRound), freeDayOf("rush")))).json();
    expect(second.round).toBeNull();
    expect(second.xpMultiplier).toBe(1);
  });

  it("opens every Premium round on Premium, and on a plan read that failed", async () => {
    const notToday = freeDayOf("interview");
    vi.mocked(isPremium).mockResolvedValue(true);
    const paid = await (await post(onDay(gameForm("game:rush:ru1", rushRound), notToday))).json();
    expect(paid.round).toMatchObject({ game: "rush", level: 1 });
    expect(paid.xpMultiplier).toBe(1.5);
    expect(gameRoundsBetween).not.toHaveBeenCalled();

    vi.mocked(isPremium).mockRejectedValue(new Error("down"));
    const unknown = await (await post(onDay(gameForm("game:rush:ru1", rushRound), notToday))).json();
    expect(unknown.round).toMatchObject({ game: "rush" });
  });

  it("keeps the player's extras on their plan", async () => {
    const round = { level: 1, cutIns: [{ at: 20, line: "So what?" }] };
    const free = await (await post(gameForm("game:qa:qa3", round, "crowd"))).json();
    expect(free.mods).toEqual(["interrupt"]);
    expect(free.xpMultiplier).toBe(2);

    vi.mocked(isPremium).mockResolvedValue(true);
    const paid = await (await post(gameForm("game:qa:qa3", round, "crowd"))).json();
    expect(paid.mods).toEqual(["interrupt", "crowd"]);
    expect(paid.xpMultiplier).toBe(3);
  });

  it("measures no round on a take that is not a game", async () => {
    const body = await (
      await post(gameForm("topic:t1", { game: "qa", level: 1, cutIns: [{ at: 20, line: "So what?" }] }))
    ).json();
    expect(body.round).toBeNull();
    expect(body.mods).toEqual([]);
    expect(body.xpMultiplier).toBe(1);
  });
});

/*
 * The pause score and the envelope (DECISIONS #422, #121). The take
 * judges its pauses once, with the envelope, and stores, shows and
 * scores those verdicts: a gap the stored pause list says had a sound in
 * it never scores as a landing, and a gap the phone did not hear keeps
 * the verdict its words give.
 */
describe("the Index scores the pauses the take stores", () => {
  const SENTENCES = [
    "The first thing I learned about speaking is that silence works.",
    "Most people rush because they think a gap means they have lost.",
    "When I slow down the room actually leans in toward me.",
    "My manager noticed it during the quarterly review last month.",
    "She said the update finally sounded like a decision.",
    "That changed how I prepare for every single meeting now.",
  ];
  /** Six sentences, a 1.3s held pause after each of the first five. */
  const TAKE = (() => {
    const words: { word: string; start: number; end: number }[] = [];
    const gaps: [number, number][] = [];
    let t = 0.5;
    SENTENCES.forEach((s, k) => {
      for (const raw of s.split(" ")) {
        words.push({ word: words.length === 0 ? raw : ` ${raw}`, start: +t.toFixed(2), end: +(t + 0.3).toFixed(2) });
        t += 0.42;
      }
      if (k < SENTENCES.length - 1) {
        gaps.push([t - 0.12, t - 0.12 + 1.3]);
        t += 1.3;
      }
    });
    const durationS = Math.ceil(t + 0.5);
    return { text: SENTENCES.join(" "), durationS, words, segments: [], raw: {}, gaps };
  })();

  /** What the mic heard at t: speech, room tone in a gap, a swallowed "um" mid-gap in a voiced one. */
  function heard(t: number, voiced: number[]): number {
    for (const [k, [a, b]] of TAKE.gaps.entries()) {
      if (t >= a && t < b) return voiced.includes(k) && Math.abs(t - (a + b) / 2) < 0.3 ? 0.3 : 0.03;
    }
    return 0.5;
  }
  /** The phone's envelope, on the take's clock, with these gaps voiced and these never heard. */
  function clockEnvelope(voiced: number[], unheard: number[] = []): Envelope {
    const levels: number[] = [];
    for (let i = 0; i < TAKE.durationS * ENVELOPE_RATE; i++) {
      const t = i / ENVELOPE_RATE;
      const gap = TAKE.gaps.findIndex(([a, b]) => t >= a && t < b);
      levels.push(unheard.includes(gap) ? NaN : heard(t, voiced));
    }
    return { levels, rate: ENVELOPE_RATE, clock: true };
  }

  const dim = { score: 60, citedMoment: '"the first thing"', improve: "Open with the claim." };
  const TIER2 = { structure: dim, credibility: dim, engagement: dim, confidence: dim };

  async function send(envelope: Envelope | null) {
    vi.mocked(saveRep).mockClear();
    vi.mocked(transcribe).mockResolvedValue(TAKE);
    vi.mocked(coachRep).mockResolvedValue({
      focus: "Hold the gap.",
      strength: "Five held pauses.",
      supply: { original: "um", upgrade: "(pause)", note: "Silence reads as thought." },
      coachLine: "Five pauses held.",
      dimensions: TIER2,
    });
    const form = audioForm();
    if (envelope) form.append("envelope", serializeEnvelope(envelope));
    const body = await (await post(form)).json();
    const saved = vi.mocked(saveRep).mock.calls[0][0] as unknown as {
      metrics: { pauses: JudgedPause[]; durationS: number; stars: number };
      tier1: Tier1Scores;
      ethosIndex: number | null;
    };
    return { body, saved };
  }

  /** Every stored number agrees with the stored pause list. */
  function consistent({ body, saved }: Awaited<ReturnType<typeof send>>) {
    const report = reportJudged(saved.metrics.pauses, saved.metrics.durationS);
    expect(saved.tier1.pause).toBe(report.score);
    expect(saved.ethosIndex).toBe(
      ethosIndex(saved.tier1, { structure: 60, credibility: 60, engagement: 60, confidence: 60 })
    );
    expect(body.tier1).toEqual(saved.tier1);
    expect(body.ethosIndex).toBe(saved.ethosIndex);
    expect(body.metrics.pauses).toEqual(saved.metrics.pauses);
    expect(body.pauseHeadline).toBe(report.headline);
    return report;
  }

  /** The take scored from its words alone, as before #422 and without an envelope. */
  const WORDS_ONLY = (() => {
    const m = computeMetrics(TAKE.words, TAKE.durationS, []);
    return pauseScore(m.pauses, m.durationS, TAKE.words, m.fillers);
  })();

  it("stores an Index that scores the two pauses it calls filled as filled", async () => {
    const sent = await send(clockEnvelope([1, 3]));
    const report = consistent(sent);
    expect(report.filled).toBe(2);
    expect(sent.saved.metrics.pauses.filter((p) => p.verdict === "filled").map((p) => p.note)).toEqual([
      expect.stringContaining("with a sound in it"),
      expect.stringContaining("with a sound in it"),
    ]);
    expect(sent.body.pauseHeadline).toMatch(/^2 of your "pauses" had a sound in them/);
    // Below the words' own score, which read both gaps as landings.
    expect(sent.saved.tier1.pause).toBeLessThan(WORDS_ONLY);
  });

  it("scores a take with no voiced gap exactly as before", async () => {
    const clean = await send(clockEnvelope([]));
    consistent(clean);
    const none = await send(null);
    consistent(none);
    expect(none.saved.tier1.pause).toBe(WORDS_ONLY);
    expect(clean.saved.tier1).toEqual(none.saved.tier1);
    expect(clean.saved.ethosIndex).toBe(none.saved.ethosIndex);
    expect(clean.saved.metrics.pauses).toEqual(none.saved.metrics.pauses);
  });

  it("gives a gap the phone never heard the verdict its words give", async () => {
    // Gaps 1 and 3 had a sound in them, but the page had no frames then.
    const unheard = await send(clockEnvelope([1, 3], [1, 3]));
    const report = consistent(unheard);
    expect(report.filled).toBe(0);
    expect(unheard.saved.tier1.pause).toBe(WORDS_ONLY);
  });

  it("judges no pause on a refitted envelope, an outbox replay from before the review", async () => {
    // About 17 samples a second under a label of 20, no clock mark.
    const truth = clockEnvelope([1, 3]);
    const levels: number[] = [];
    for (let t = 0; t < TAKE.durationS; t += 1 / 17) levels.push(heard(t, [1, 3]));
    expect(levels.length).toBeLessThan(truth.levels.length * 0.95);
    const replay = await send({ levels, rate: ENVELOPE_RATE });
    const report = consistent(replay);
    expect(report.filled).toBe(0);
    expect(replay.saved.tier1.pause).toBe(WORDS_ONLY);
  });

  it("judges no pause on an unmarked envelope inside the 5% tolerance, so it scores as no envelope", async () => {
    // 19.2 samples a second under a label of 20, no clock mark: what an
    // older phone's frame-gated sampler sends, and not refitted. Read as
    // sent, the late gaps are judged on the next sentence's speech.
    const levels: number[] = [];
    for (let t = 0; t < TAKE.durationS; t += 1 / 19.2) levels.push(heard(t, []));
    expect(levels.length).toBeGreaterThanOrEqual(TAKE.durationS * ENVELOPE_RATE * 0.95);
    const unmarked = await send({ levels, rate: ENVELOPE_RATE });
    const report = consistent(unmarked);
    expect(report.filled).toBe(0);
    const none = await send(null);
    expect(unmarked.saved.tier1.pause).toBe(none.saved.tier1.pause);
    expect(unmarked.saved.tier1.pause).toBe(WORDS_ONLY);
    expect(unmarked.saved.ethosIndex).toBe(none.saved.ethosIndex);
    expect(unmarked.saved.metrics.pauses).toEqual(none.saved.metrics.pauses);
  });

  it("moves no star and no other dimension", async () => {
    const none = await send(null);
    const filled = await send(clockEnvelope([0, 1, 3]));
    expect(filled.saved.metrics.stars).toBe(none.saved.metrics.stars);
    expect({ ...filled.saved.tier1, pause: 0 }).toEqual({ ...none.saved.tier1, pause: 0 });
  });
});
