/**
 * Supabase persistence — schema v2.
 * Degrades gracefully: with no env configured, reps still analyze and
 * return numbers; they just aren't stored. Anonymous-first (DECISIONS
 * #15): reps attribute to whatever session exists, signup comes later.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccuracyResult } from "./accuracy";
import type { CoachOutput } from "./coach";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import type { RepMetrics } from "./metrics";

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolve a Supabase access token to a user id; null on anything else. */
export async function getUserFromAuthHeader(
  header: string | null
): Promise<string | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  return data.user.id;
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

/** Entitlement gate. No processor yet — one boolean, one place. */
export async function isPremium(userId: string | null): Promise<boolean> {
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
