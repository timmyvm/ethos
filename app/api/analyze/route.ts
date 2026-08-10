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
import { judgeAccuracy, type AccuracyResult } from "@/lib/accuracy";
import { coachRep, tier2Scores, type CoachOutput } from "@/lib/coach";
import { COLD_TOPICS } from "@/lib/cold-topics";
import {
  getUserFromAuthHeader,
  isPremium,
  previousEthosIndex,
  saveRep,
} from "@/lib/db";
import {
  ethosIndex,
  tier1Scores,
  tier2Anchors,
  type Tier1Scores,
  type Tier2Anchors,
} from "@/lib/index-score";
import { computeMetrics, isScorable, type RepMetrics } from "@/lib/metrics";
import { BOSS_XP_BASE } from "@/lib/rep-config";
import { modIds, parseMods, xpMultiplier } from "@/lib/stress-mods";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby cap

export interface AnalyzeResponse {
  transcript: string;
  metrics: RepMetrics;
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  coach: CoachOutput | null;
  ethosIndex: number | null;
  previousIndex: number | null;
  repId: string | null;
  /** False when there wasn't enough real speech to score. */
  scorable: boolean;
  accuracy: AccuracyResult | null;
  mode: "daily" | "boss";
  mods: string[];
  xpMultiplier: number;
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

  // The client sends what it *ran*; the multiplier is recomputed here
  // from the mods this account is actually entitled to. A hand-edited
  // URL or a forged form field can change the difficulty of your rep,
  // never the XP it pays.
  const premium = await isPremium(userId).catch(() => false);
  const mods = parseMods(form.get("mods") as string | null, { premium });
  const bossTopic =
    COLD_TOPICS.find((t) => t.id === (form.get("bossTopicId") as string)) ??
    null;
  const mode: "daily" | "boss" = bossTopic ? "boss" : "daily";
  const multiplier = xpMultiplier(mods, bossTopic ? BOSS_XP_BASE : 1);

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

  // Coach layer is best-effort — never blocks the numbers. A near-silent
  // rep has nothing to coach or judge; skip the call instead of burning it.
  // Boss reps additionally get fact-checked; the two calls are
  // independent so a failed check still returns full coaching.
  // A rep with nothing in it gets no Index and no coaching. Saying "I
  // don't know" eight times has zero fillers and a clean pace, and used
  // to come back three stars and a mid-500s Index — every number true in
  // isolation and the whole screen a lie. If there is no speech to
  // measure we say so instead of scoring the silence around it.
  const scorable = isScorable(metrics.substance);

  let coach: CoachOutput | null = null;
  let accuracy: AccuracyResult | null = null;
  if (scorable) {
    const [coachResult, accuracyResult] = await Promise.allSettled([
      coachRep(transcription.text, metrics, tier1, anchors),
      bossTopic
        ? judgeAccuracy(transcription.text, bossTopic)
        : Promise.resolve(null),
    ]);
    coach = coachResult.status === "fulfilled" ? coachResult.value : null;
    accuracy =
      accuracyResult.status === "fulfilled" ? accuracyResult.value : null;
  }

  // No substance, no Index — not a partial score, no score.
  const index = scorable
    ? ethosIndex(tier1, coach ? tier2Scores(coach) : null)
    : null;

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
      mode,
      mods: modIds(mods),
      xpMultiplier: multiplier,
      bossTopicId: bossTopic?.id ?? null,
      accuracy,
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
    scorable,
    accuracy,
    mode,
    mods: modIds(mods),
    xpMultiplier: multiplier,
  };
  return NextResponse.json(body);
}
