/**
 * POST /api/analyze — the engine.
 * multipart/form-data: `audio` (webm/opus blob), optional `lessonId`.
 * Optional `Authorization: Bearer <supabase access token>` ties the rep
 * to the (anonymous-first) user; without it the rep still scores.
 *
 * Pipeline: Whisper (word timestamps) → deterministic metrics + Tier-1
 * Index scores + anchors → one Claude call (coaching copy + Tier-2
 * judged dimensions, citation-required) → Ethos Index /1000 → persist.
 * The numbers never depend on the LLM; if the coach layer fails, the
 * rep still returns real metrics and Tier-1 scores.
 */

import { NextRequest, NextResponse } from "next/server";
import { coachRep, tier2Scores, type CoachOutput } from "@/lib/coach";
import { getUserFromAuthHeader, previousEthosIndex, saveRep } from "@/lib/db";
import {
  ethosIndex,
  tier1Scores,
  tier2Anchors,
  type Tier1Scores,
  type Tier2Anchors,
} from "@/lib/index-score";
import { computeMetrics, type RepMetrics } from "@/lib/metrics";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 120;

export interface AnalyzeResponse {
  transcript: string;
  metrics: RepMetrics;
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  coach: CoachOutput | null;
  ethosIndex: number | null;
  previousIndex: number | null;
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

  // Anonymous-first: a valid token attributes the rep; absence never blocks.
  const userId = await getUserFromAuthHeader(
    req.headers.get("authorization")
  ).catch(() => null);

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
  const tier1 = tier1Scores(metrics, transcription.words, transcription.segments);
  const anchors = tier2Anchors(transcription.words, transcription.text);

  // Coach layer is best-effort — never blocks the numbers.
  let coach: CoachOutput | null = null;
  try {
    coach = await coachRep(transcription.text, metrics, tier1, anchors);
  } catch {
    coach = null;
  }

  const index = ethosIndex(tier1, coach ? tier2Scores(coach) : null);

  const previousIndex = userId
    ? await previousEthosIndex(userId).catch(() => null)
    : null;

  let repId: string | null = null;
  try {
    const saved = await saveRep({
      audio,
      filename,
      transcript: transcription.text,
      metrics,
      tier1,
      anchors,
      coach,
      ethosIndex: index,
      whisperRaw: transcription.raw,
      userId: userId ?? undefined,
      lessonId: (form.get("lessonId") as string) || undefined,
    });
    repId = saved?.id ?? null;
  } catch {
    repId = null;
  }

  const body: AnalyzeResponse = {
    transcript: transcription.text,
    metrics,
    tier1,
    anchors,
    coach,
    ethosIndex: index,
    previousIndex,
    repId,
  };
  return NextResponse.json(body);
}
