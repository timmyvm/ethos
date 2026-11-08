/**
 * Supabase persistence — schema v2.
 * Degrades gracefully: with no env configured, reps still analyze and
 * return numbers; they just aren't stored. Anonymous-first (DECISIONS
 * #15): reps attribute to whatever session exists, signup comes later.
 */

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccuracyResult } from "./accuracy";
import { neutralAudioName } from "./audio-name";
import type { CoachOutput } from "./coach";
import { isUnlocked } from "./entitlement";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import type { MeterState } from "./metering";
import type { RepMetrics } from "./metrics";
import { toRow, type DeliveryMetrics, type DeliveryMoment } from "./presence";
import type { CaptureMode } from "./prefs";
import type { GameRound } from "./round";

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
  /** The account's email, when it has one: checkout hands it to Stripe
   *  so receipts reach the inbox the account signs in with. */
  email?: string | null;
}

/**
 * What an Authorization header comes to. A missing header (or local mode
 * with no backend) is "none", the anonymous-first path. A token GoTrue
 * answered for but refused (expired, forged) is "rejected". GoTrue not
 * answering (5xx, a dropped fetch, a throw) is "unavailable". Only the
 * first is sessionless: the other two must never store a recording with
 * no owner, because the client deletes its copy once one is stored.
 */
export type AuthResolution =
  | { kind: "none" }
  | { kind: "user"; user: AuthedUser }
  | { kind: "rejected" }
  | { kind: "unavailable" };

export async function resolveAuthHeader(
  header: string | null
): Promise<AuthResolution> {
  if (!header?.startsWith("Bearer ")) return { kind: "none" };
  const db = supabaseAdmin();
  if (!db) return { kind: "none" };
  try {
    const { data, error } = await db.auth.getUser(header.slice(7));
    if (data?.user) {
      return {
        kind: "user",
        user: {
          id: data.user.id,
          anonymous: data.user.is_anonymous ?? false,
          email: data.user.email || null,
        },
      };
    }
    const status = (error as { status?: number } | null)?.status ?? 0;
    return status >= 500 || error?.name === "AuthRetryableFetchError"
      ? { kind: "unavailable" }
      : { kind: "rejected" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Resolve a Supabase access token to a user; null on anything else. */
export async function getUserFromAuthHeader(
  header: string | null
): Promise<AuthedUser | null> {
  const r = await resolveAuthHeader(header);
  return r.kind === "user" ? r.user : null;
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

/**
 * The first scored boss Index in a window, for the boss's delta ("▲ 36
 * on last week's boss", the games plan, item 16): last week's slot on
 * the lobby's record, so the score step and the record agree. Null when
 * that week holds no scored boss.
 */
export async function bossIndexBetween(
  userId: string,
  from: Date,
  to: Date
): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("reps")
    .select("ethos_index")
    .eq("user_id", userId)
    .eq("mode", "boss")
    .not("ethos_index", "is", null)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.ethos_index as number | undefined) ?? null;
}

/**
 * How many recordings of one game this account stored between two
 * instants (`lesson_id` like `game:<id>:%`): the server's count of a
 * free account's one round of today's Premium game (games review,
 * finding 3). Throws on a failed read, so the caller decides.
 */
export async function gameRoundsBetween(
  userId: string,
  gameId: string,
  from: Date,
  to: Date
): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("reps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .like("lesson_id", `game:${gameId}:%`)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (error) throw error;
  return count ?? 0;
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

/**
 * Columns a recording is stored without when the table lacks them yet,
 * because their migrations are applied by hand: the outbox key (0016) and
 * a game's round (0026). Losing either is better than losing the take.
 */
const OPTIONAL_COLUMNS = ["client_id", "round"] as const;

export interface SavedRep {
  id: string;
  audioPath: string | null;
  /** The recording was already stored under its key (a resend): this is
   *  that row, and nothing was written twice. */
  duplicate?: boolean;
}

/**
 * The recording this account already stored under the outbox key
 * `clientId`, if any (migration 0016). A resend after a lost response
 * gets this instead of a second row.
 */
export async function findRepByClientId(
  userId: string,
  clientId: string
): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("reps")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
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
  /** When it was spoken (ISO), already clamped by the route. Absent, the
   *  column's default now() dates it at the insert. */
  createdAt?: string;
  /** The outbox key (migration 0016): one stored row per key per account. */
  clientId?: string | null;
  /** A game round, measured (lib/round.ts, migration 0026). */
  round?: GameRound | null;
}): Promise<SavedRep | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { audio, filename, transcript, metrics, tier1, anchors, coach } =
    params;

  let audioPath: string | null = null;
  // Never the name the file was picked with (review P3); a random part
  // so two recordings in one millisecond never share a path.
  const path = `reps/${Date.now()}-${randomUUID().slice(0, 8)}-${neutralAudioName(filename)}`;
  const upload = await db.storage.from("audio").upload(path, audio, {
    contentType: audio.type || "audio/webm",
  });
  if (!upload.error) audioPath = path;

  const row = {
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
    ...(params.createdAt ? { created_at: params.createdAt } : {}),
  };
  const insert = (r: Record<string, unknown>) =>
    db.from("reps").insert(r).select("id").single();
  // The key goes in only when there is one (/upload and /hostile send
  // none), and the round only on a game. A table without either column
  // yet (migrations 0016 and 0026 are applied by hand) still stores the
  // recording, without what it has no column for.
  let attempt: Record<string, unknown> = {
    ...row,
    ...(params.clientId ? { client_id: params.clientId } : {}),
    ...(params.round ? { round: params.round } : {}),
  };
  let { data, error } = await insert(attempt);
  // Once per optional column at most; a taken key (23505) is not a missing column.
  for (let tries = 0; tries < OPTIONAL_COLUMNS.length && error && error.code !== "23505"; tries++) {
    const message = error.message;
    const missing = OPTIONAL_COLUMNS.find(
      (k) => k in attempt && new RegExp(`\\b${k}\\b`).test(message)
    );
    if (!missing) break;
    attempt = Object.fromEntries(Object.entries(attempt).filter(([k]) => k !== missing));
    ({ data, error } = await insert(attempt));
  }

  // Two sends of one recording raced past the route's lookup and the
  // unique index refused the second: answer with the first, drop the
  // audio just uploaded, and pay no XP or lexicon entry twice.
  if (error?.code === "23505" && params.userId && params.clientId) {
    if (audioPath) await db.storage.from("audio").remove([audioPath]);
    const first = await findRepByClientId(params.userId, params.clientId);
    return first ? { id: first, audioPath: null, duplicate: true } : null;
  }
  if (error || !data) return null;

  if (coach?.supply) {
    // Supply accumulates into the personal lexicon (DECISIONS.md #12).
    // No upgrade, no lexicon row: the coach may say none (#429).
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
      // The week's XP lands in the week it was spoken, with the recording.
      ...(params.createdAt ? { created_at: params.createdAt } : {}),
    });
  }

  return { id: data.id, audioPath };
}
