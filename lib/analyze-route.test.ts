import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/transcribe", () => ({ transcribe: vi.fn() }));
vi.mock("@/lib/coach", () => ({ coachRep: vi.fn() }));
vi.mock("@/lib/db", () => ({ saveRep: vi.fn(async () => null) }));

import { POST } from "@/app/api/analyze/route";
import { coachRep } from "@/lib/coach";
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

  it("returns deterministic metrics with coach output", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockResolvedValue({
      focus: "Kill 'um' — 1 filler.",
      supply: { original: "um", upgrade: "(pause)", note: "Silence reads as thought." },
      coachLine: "1 filler in 60 seconds.",
    });
    const res = await post(audioForm());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.fillerCount).toBe(1);
    expect(body.metrics.wpm).toBe(6);
    expect(body.coach.coachLine).toBe("1 filler in 60 seconds.");
  });

  it("still returns the numbers when the coach layer fails", async () => {
    vi.mocked(transcribe).mockResolvedValue(FIXTURE);
    vi.mocked(coachRep).mockRejectedValue(new Error("api down"));
    const res = await post(audioForm());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.fillerCount).toBe(1);
    expect(body.coach).toBeNull();
  });
});
