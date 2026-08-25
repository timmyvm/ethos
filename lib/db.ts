/**
 * Supabase persistence — schema v2.
 * Degrades gracefully: with no env configured, reps still analyze and
 * return numbers; they just aren't stored. Anonymous-first (DECISIONS
 * #15): reps attribute to whatever session exists, signup comes later.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccuracyResult } from "./accuracy";
import type { CoachOutput } from "./coach";
import { isUnlocked } from "./entitlement";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import type { MeterState } from "./metering";
import type { RepMetrics } from "./metrics";
import { toRow, type DeliveryMetrics, type DeliveryMoment } from "./presence";
import type { CaptureMode } from "./prefs";

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AuthedUser {
  id: string;
  /** Anonymous-first sessions are real users on a shorter leash: the
   *  rate limiter (lib/rate-limit.ts) gives them the visitor tier. */
  anonymous: boolean;
}

/** Resolve a Supabase access token to a user; null on anything else. */
export async function getUserFromAuthHeader(
  header: string | null
): Promise<AuthedUser | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  return { id: data.user.id, anonymous: data.user.is_anonymous ?? false };
}

/** The user's latest stored index — powers the "+18" delta display. */
export async function previousEthosIndex(
  userId: string
): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("reps")
    .select("ethos_index")
    .eq("user_id", userId)
    .not("ethos_index", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.ethos_index as number | undefined) ?? null;
}

/** The user's latest stored Presence, for the second trendline. */
export async function previousPresence(
  userId: string
): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("reps")
    .select("presence_score")
    .eq("user_id", userId)
    .not("presence_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.presence_score as number | undefined) ?? null;
}

/**
 * Judged-analysis metering (§3), server side. The client can ask for a
 * judged analysis; only this decides whether it gets one.
 */
export async function readMeterState(
  userId: string | null
): Promise<MeterState> {
  const fresh: MeterState = { balance: 1, accruedOn: null, usedAt: null };
  if (!userId) return fresh;
  const db = supabaseAdmin();
  if (!db) return fresh;
  const { data } = await db
    .from("profiles")
    .select("judged_rollover, judged_accrued_on, judged_analysis_used_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return fresh;
  return {
    balance: (data.judged_rollover as number | null) ?? 1,
    accruedOn: (data.judged_accrued_on as string | null) ?? null,
    usedAt: (data.judged_analysis_used_at as string | null) ?? null,
  };
}

/**
 * Persist the balance after a judged rep. Upserts because an
 * anonymous-first user may not have a profile row until they save
 * progress, and metering can't wait for that.
 */
export async function writeMeterState(
  userId: string,
  state: MeterState
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.from("profiles").upsert(
    {
      user_id: userId,
      judged_rollover: state.balance,
      judged_accrued_on: state.accruedOn,
      judged_analysis_used_at: state.usedAt,
    },
    { onConflict: "user_id" }
  );
}

/**
 * Entitlement gate. No processor yet — one boolean, one place.
 *
 * Runs through `isUnlocked`, which is currently answering yes to
 * everyone (`EVERYTHING_FREE`). The stored flag is still read and still
 * respected underneath, so turning the paywall back on is one constant.
 */
export async function isPremium(userId: string | null): Promise<boolean> {
  const stored = await storedPremium(userId);
  return isUnlocked(stored);
}

async function storedPremium(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const { data } = await db
    .from("profiles")
    .select("premium, premium_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.premium) return false;
  const until = data.premium_until as string | null;
  return !until || new Date(until) > new Date();
}

/** XP is the effort currency (DECISIONS #16) — logged from day one. */
const XP_PER_REP = 10;

export interface SavedRep {
  id: string;
  audioPath: string | null;
}

export async function saveRep(params: {
  audio: Blob;
  filename: string;
  transcript: string;
  metrics: RepMetrics;
  tier1: Tier1Scores;
  anchors: Tier2Anchors;
  coach: CoachOutput | null;
  ethosIndex: number | null;
  whisperRaw?: unknown;
  userId?: string;
  lessonId?: string;
  mode?: "daily" | "boss";
  mods?: string[];
  xpMultiplier?: number;
  bossTopicId?: string | null;
  accuracy?: AccuracyResult | null;
  captureMode?: CaptureMode;
  /** Derived numbers only — raw video never reaches this process. */
  delivery?: DeliveryMetrics | null;
  deliveryMoments?: DeliveryMoment[] | null;
}): Promise<SavedRep | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { audio, filename, transcript, metrics, tier1, anchors, coach } =
    params;

  let audioPath: string | null = null;
  const path = `reps/${Date.now()}-${filename.replace(/[^\w.-]/g, "_")}`;
  const upload = await db.storage.from("audio").upload(path, audio, {
    contentType: audio.type || "audio/webm",
  });
  if (!upload.error) audioPath = path;

  const { data, error } = await db
    .from("reps")
    .insert({
      user_id: params.userId ?? null,
      lesson_id: params.lessonId ?? null,
      duration_s: metrics.durationS,
      transcript,
      wpm: metrics.wpm,
      filler_count: metrics.fillerCount,
      fillers: metrics.fillers,
      pauses: metrics.pauses,
      stars: metrics.stars,
      focus: coach?.focus ?? null,
      strength: coach?.strength ?? null,
      supply: coach?.supply ?? null,
      ethos_index: params.ethosIndex,
      dimensions: {
        tier1,
        anchors,
        tier2: coach?.dimensions ?? null,
      },
      audio_path: audioPath,
      whisper_raw: params.whisperRaw ?? null,
      mode: params.mode ?? "daily",
      mods: params.mods ?? [],
      xp_multiplier: params.xpMultiplier ?? 1,
      boss_topic_id: params.bossTopicId ?? null,
      accuracy: params.accuracy ?? null,
      capture_mode: params.captureMode ?? "voice",
      // Voice-mode reps store null, so the results screen branches on
      // whether presence exists rather than on which mode was picked.
      delivery_metrics: params.delivery ? toRow(params.delivery) : null,
      presence_score: params.delivery?.presenceScore ?? null,
      delivery_moments: params.deliveryMoments ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return null;

  if (coach) {
    // Supply accumulates into the personal lexicon (DECISIONS.md #12).
    await db.from("lexicon").insert({
      user_id: params.userId ?? null,
      original: coach.supply.original,
      upgrade: coach.supply.upgrade,
      rep_id: data.id,
    });
  }

  if (params.userId) {
    // Difficulty multiplies EFFORT credit only. Stars and the Index are
    // untouched by mods (DECISIONS #10, #16).
    const multiplier = params.xpMultiplier ?? 1;
    await db.from("xp_events").insert({
      user_id: params.userId,
      amount: Math.max(1, Math.round(XP_PER_REP * multiplier)),
      source:
        params.mode === "boss"
          ? "boss"
          : (params.mods?.length ?? 0) > 0
            ? "mod"
            : "rep",
      rep_id: data.id,
    });
  }

  return { id: data.id, audioPath };
}
