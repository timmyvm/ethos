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
  isPremium: vi.fn(async () => false),
}));
vi.mock("@/lib/accuracy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accuracy")>()),
  judgeAccuracy: vi.fn(async () => null),
}));

import { POST } from "@/app/api/analyze/route";
import { judgeAccuracy } from "@/lib/accuracy";
import { coachRep } from "@/lib/coach";
import { saveRep } from "@/lib/db";
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

const FIXTURE = {
  text: "So um my name is Tim",
  durationS: 60,
  words: [
    { word: "So", start: 0, end: 0.2 },
    { word: " um", start: 0.3, end: 0.5 },
    { word: " my", start: 0.6, end: 0.7 },
    { word: " name", start: 0.8, end: 1.0 },
    { word: " is", start: 1.1, end: 1.2 },
    { word: " Tim", start: 1.3, end: 59.5 },
  ],
  segments: [],
  raw: {},
};

beforeEach(() => {
  vi.mocked(transcribe).mockReset();
  vi.mocked(coachRep).mockReset();
  vi.mocked(judgeAccuracy).mockReset();
  vi.mocked(judgeAccuracy).mockResolvedValue(null);
  vi.mocked(saveRep).mockClear();
});

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
    expect(body.metrics.wpm).toBe(6);
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
