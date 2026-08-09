/**
 * POST /api/analyze — the engine (BUILD-PLAN step 1).
 * multipart/form-data: `audio` (webm/opus blob), optional `lessonId`.
 *
 * Pipeline: Whisper (word timestamps) → deterministic metrics →
 * one Claude call (focus / supply / coachLine) → persist if configured.
 * The numbers never depend on the LLM; if the coach layer fails,
 * the rep still returns real metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { coachRep, type CoachOutput } from "@/lib/coach";
import { saveRep } from "@/lib/db";
import { computeMetrics, type RepMetrics } from "@/lib/metrics";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 120;

export interface AnalyzeResponse {
  transcript: string;
  metrics: RepMetrics;
  coach: CoachOutput | null;
  repId: string | null;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an `audio` field." },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "Missing or empty `audio` field." },
      { status: 400 }
    );
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Audio exceeds 25MB limit." },
      { status: 413 }
    );
  }

  const filename =
    audio instanceof File && audio.name ? audio.name : "rep.webm";

  let transcription;
  try {
    transcription = await transcribe(audio, filename);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed.";
    const unconfigured = message.includes("OPENAI_API_KEY");
    return NextResponse.json(
      { error: message },
      { status: unconfigured ? 503 : 502 }
    );
  }

  const metrics = computeMetrics(
    transcription.words,
    transcription.durationS,
    transcription.segments
  );

  // Coach layer is best-effort — never blocks the numbers.
  let coach: CoachOutput | null = null;
  try {
    coach = await coachRep(transcription.text, metrics);
  } catch {
    coach = null;
  }

  let repId: string | null = null;
  try {
    const saved = await saveRep({
      audio,
      filename,
      transcript: transcription.text,
      metrics,
      coach,
      whisperRaw: transcription.raw,
      lessonId: (form.get("lessonId") as string) || undefined,
    });
    repId = saved?.id ?? null;
  } catch {
    repId = null;
  }

  const body: AnalyzeResponse = {
    transcript: transcription.text,
    metrics,
    coach,
    repId,
  };
  return NextResponse.json(body);
}
