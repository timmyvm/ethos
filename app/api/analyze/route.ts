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
  previousPresence,
  readMeterState,
  saveRep,
  writeMeterState,
} from "@/lib/db";
import { localDate, meter } from "@/lib/metering";
import type { DeliveryMetrics, DeliveryMoment } from "@/lib/presence";
import type { CaptureMode } from "@/lib/prefs";
import {
  ethosIndex,
  tier1Scores,
  tier2Anchors,
  type Tier1Scores,
  type Tier2Anchors,
} from "@/lib/index-score";
import { computeMetrics, isScorable, type RepMetrics } from "@/lib/metrics";
import { parseEnvelope } from "@/lib/envelope";
import { pauseReport } from "@/lib/pause-quality";
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
  /** One line on what the silences actually did. */
  pauseHeadline: string | null;
  accuracy: AccuracyResult | null;
  mode: "daily" | "boss";
  mods: string[];
  xpMultiplier: number;
  captureMode: CaptureMode;
  /** Null for Voice reps, and for a Voice + Video rep with no body in it. */
  delivery: DeliveryMetrics | null;
  deliveryMoments: DeliveryMoment[];
  previousPresence: number | null;
  /** What the judged tier did, and what's left of it (§3). */
  judged: {
    ran: boolean;
    unlimited: boolean;
    remaining: number;
    /** True when the rep was measured but not judged, because of the cap. */
    capped: boolean;
  };
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

  const captureMode: CaptureMode =
    form.get("captureMode") === "voice_video" ? "voice_video" : "voice";
  // Presence is computed on the device from landmarks that never leave
  // it, so unlike the mods (DECISIONS #41) the server cannot recompute
  // it and does not try. That is safe precisely because Presence feeds
  // nothing else: not the Ethos Index, not stars, not XP, not the
  // league. A forged Presence lies only to the person who forged it.
  const { delivery, deliveryMoments } = parseDelivery(
    form.get("delivery") as string | null
  );

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

  // Judge every silence by where it landed, and keep the verdicts on the
  // pause list itself — `JudgedPause` is a `Pause` with a verdict and a
  // note, so the stored column, the pause bar and the results screen all
  // read the same rows.
  // The mic's own account of the gaps. Independent of Whisper, which
  // deletes non-lexical fillers — so a gap the transcript shows as empty
  // can still have had a sound in it.
  const envelope = parseEnvelope(form.get("envelope") as string | null);
  const pauses = pauseReport({
    pauses: metrics.pauses,
    words: transcription.words,
    fillers: metrics.fillers,
    durationS: metrics.durationS,
    segments: transcription.segments,
    envelope,
  });
  metrics.pauses = pauses.pauses;
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

  /*
   * Judged-tier metering (§3). The measured tier above has already run
   * and is free forever; what's rationed is the Claude call below.
   *
   * Two things this deliberately does NOT do: it does not block the rep
   * (the rep is stored either way, so the streak is untouched — streaks
   * count reps, not analyses), and it does not spend an analysis on a
   * rep with nothing in it. A near-silent rep has nothing to judge, so
   * burning the day's one analysis on it would be theft.
   */
  const meterState = await readMeterState(userId).catch(() => null);
  const decision =
    scorable && meterState
      ? meter({
          state: meterState,
          now: localDate(new Date(), numberOrNull(form.get("tzOffset"))),
          premium,
        })
      : null;
  const judgedAllowed = decision?.allowed ?? scorable;

  let coach: CoachOutput | null = null;
  let accuracy: AccuracyResult | null = null;
  if (scorable && judgedAllowed) {
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

  // Only commit the spend once the call has actually happened. An
  // analysis the user never received must not cost them one.
  if (userId && decision && !decision.unlimited && coach) {
    await writeMeterState(userId, decision.state).catch(() => {});
  }

  // No substance, no Index — not a partial score, no score.
  const index = scorable
    ? ethosIndex(tier1, coach ? tier2Scores(coach) : null)
    : null;

  const [previousIndex, prevPresence] = userId
    ? await Promise.all([
        previousEthosIndex(userId).catch(() => null),
        previousPresence(userId).catch(() => null),
      ])
    : [null, null];

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
      captureMode,
      delivery,
      deliveryMoments,
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
    pauseHeadline: pauses.headline,
    accuracy,
    mode,
    mods: modIds(mods),
    xpMultiplier: multiplier,
    captureMode,
    delivery,
    deliveryMoments,
    previousPresence: prevPresence,
    judged: {
      ran: coach !== null,
      unlimited: decision?.unlimited ?? false,
      remaining: decision && !decision.unlimited ? decision.remaining : 0,
      capped: scorable && decision !== null && !decision.allowed,
    },
  };
  return NextResponse.json(body);
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return typeof v === "string" && v !== "" && Number.isFinite(n) ? n : null;
}

/**
 * The client sends five numbers and a list of timestamped moments —
 * never frames, never pixels. Anything malformed is dropped rather than
 * stored half-parsed.
 */
function parseDelivery(raw: string | null): {
  delivery: DeliveryMetrics | null;
  deliveryMoments: DeliveryMoment[];
} {
  if (!raw) return { delivery: null, deliveryMoments: [] };
  try {
    const parsed = JSON.parse(raw) as {
      metrics?: Partial<DeliveryMetrics>;
      moments?: DeliveryMoment[];
    };
    const m = parsed.metrics;
    if (!m || typeof m.presenceScore !== "number") {
      return { delivery: null, deliveryMoments: [] };
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return {
      delivery: {
        gestureRate: num(m.gestureRate),
        postureDrift: num(m.postureDrift),
        headStability: num(m.headStability),
        eyeLinePct: Math.max(0, Math.min(100, num(m.eyeLinePct))),
        presenceScore: Math.max(0, Math.min(1000, Math.round(m.presenceScore))),
      },
      deliveryMoments: Array.isArray(parsed.moments)
        ? parsed.moments.slice(0, 40)
        : [],
    };
  } catch {
    return { delivery: null, deliveryMoments: [] };
  }
}
