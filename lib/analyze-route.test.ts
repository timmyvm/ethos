import { beforeEach, describe, expect, it, vi } from "vitest";
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
  findRepByClientId,
  getUserFromAuthHeader,
  resolveAuthHeader,
  isPremium,
  readMeterState,
  saveRep,
  writeMeterState,
} from "@/lib/db";
import { dateKey } from "@/lib/metering";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { transcribe } from "@/lib/transcribe";

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
  "So um my name is Tim and I am building a speech gym called Ethos " +
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

  it("keeps 502 for a Whisper refusal that is ours, not the file's", async () => {
    for (const code of [401, 429]) {
      vi.mocked(transcribe).mockRejectedValue(new Error(`Whisper API ${code}: nope`));
      expect((await post(audioForm())).status).toBe(502);
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

  it("keys real accounts to the user tier and visitors to the anon tier", async () => {
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
    await post(audioForm());
    expect(consumeRateLimit).toHaveBeenLastCalledWith("u:anon-1", "anon");

    vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
    await post(audioForm());
    expect(vi.mocked(consumeRateLimit).mock.lastCall?.[0]).toMatch(/^ip:/);
    expect(vi.mocked(consumeRateLimit).mock.lastCall?.[1]).toBe("anon");
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
    vi.mocked(transcribe).mockRejectedValue(new Error("Whisper API 400: Invalid file format"));
    await post(audioForm());
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("is kept when the recording scores", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    await post(audioForm());
    expect(refundRateLimit).not.toHaveBeenCalled();
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
