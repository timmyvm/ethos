import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/transcribe", () => ({ transcribe: vi.fn() }));
vi.mock("@/lib/coach", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/coach")>()),
  coachRep: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  saveRep: vi.fn(async () => null),
  getUserFromAuthHeader: vi.fn(async () => null),
  previousEthosIndex: vi.fn(async () => null),
  previousPresence: vi.fn(async () => null),
  isPremium: vi.fn(async () => false),
  readMeterState: vi.fn(async () => ({
    balance: 1,
    accruedOn: null,
    usedAt: null,
  })),
  writeMeterState: vi.fn(async () => {}),
}));
vi.mock("@/lib/accuracy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accuracy")>()),
  judgeAccuracy: vi.fn(async () => null),
}));

import { POST } from "@/app/api/analyze/route";
import { judgeAccuracy } from "@/lib/accuracy";
import { coachRep } from "@/lib/coach";
import {
  getUserFromAuthHeader,
  isPremium,
  readMeterState,
  saveRep,
  writeMeterState,
} from "@/lib/db";
import { dateKey } from "@/lib/metering";
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
  vi.mocked(writeMeterState).mockClear();
  vi.mocked(getUserFromAuthHeader).mockResolvedValue(null);
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
    vi.mocked(getUserFromAuthHeader).mockResolvedValue("user-1");
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
    vi.mocked(getUserFromAuthHeader).mockResolvedValue("user-1");
    const body = await (await post(audioForm())).json();
    expect(body.coach).toBeNull();
    expect(writeMeterState).not.toHaveBeenCalled();
  });

  it("never spends one on a rep with nothing in it", async () => {
    vi.mocked(transcribe).mockResolvedValue(EMPTY_FIXTURE);
    vi.mocked(getUserFromAuthHeader).mockResolvedValue("user-1");
    await post(audioForm());
    expect(writeMeterState).not.toHaveBeenCalled();
  });

  it("does not meter premium at all", async () => {
    coachedFixture();
    vi.mocked(getUserFromAuthHeader).mockResolvedValue("user-1");
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
