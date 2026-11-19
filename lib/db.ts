/**
 * Supabase persistence — schema v2.
 * Degrades gracefully: with no env configured, reps still analyze and
 * return numbers; they just aren't stored. Anonymous-first (DECISIONS
 * #15): reps attribute to whatever session exists, signup comes later.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccuracyResult } from "./accuracy";
import { neutralAudioName } from "./audio-name";
import type { CoachOutput } from "./coach";
import { isUnlocked } from "./entitlement";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import { DAILY_GRANT, type MeterState, type MeterSwap } from "./metering";
import { substance, type RepMetrics } from "./metrics";
import { toRow, type DeliveryMetrics, type DeliveryMoment } from "./presence";
import type { CaptureMode } from "./prefs";
import type { GameRound } from "./round";
import { xpForTake } from "./xp";
import { SUBSTANCE_COLUMNS, substanceColumns } from "./rep-substance";

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
  // A first-ever recording starts at the day's grant (accrue sets it too).
  const fresh: MeterState = { balance: DAILY_GRANT, accruedOn: null, usedAt: null };
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
    balance: (data.judged_rollover as number | null) ?? DAILY_GRANT,
    accruedOn: (data.judged_accrued_on as string | null) ?? null,
    usedAt: (data.judged_analysis_used_at as string | null) ?? null,
  };
}

/**
 * Move the stored meter from `from` to `to`, only while the row is still
 * at `from` (lib/metering.ts `claimRead`, `giveBackRead`): the update
 * lands on the balance and the day it was read at, so of two takes that
 * read the same row exactly one moves it, the way the reminder sender
 * claims its day (app/api/push/cron). An anonymous-first account may
 * have no profile row yet: its first recording puts one in, unless
 * another take just did.
 */
export async function swapMeterState(
  userId: string,
  from: MeterState,
  to: MeterState
): Promise<MeterSwap> {
  const db = supabaseAdmin();
  if (!db) return "unavailable";
  const row = {
    judged_rollover: to.balance,
    judged_accrued_on: to.accruedOn,
    judged_analysis_used_at: to.usedAt,
  };
  const at = db
    .from("profiles")
    .update(row)
    .eq("user_id", userId)
    .eq("judged_rollover", from.balance);
  const { data, error } = await (
    from.accruedOn === null
      ? at.is("judged_accrued_on", null)
      : at.eq("judged_accrued_on", from.accruedOn)
  ).select("user_id");
  if (error) return "unavailable";
  if (data && data.length > 0) return "swapped";
  if (from.accruedOn !== null) return "moved";
  const { data: made, error: makeError } = await db
    .from("profiles")
    .upsert({ user_id: userId, ...row }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("user_id");
  if (makeError) return "unavailable";
  return made && made.length > 0 ? "swapped" : "moved";
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

/**
 * Columns a recording is stored without when the table lacks them yet,
 * because their migrations are applied by hand: the outbox key (0016), a
 * game's round (0026), and what its words came to (0037, #511: the three
 * go together, so a table before 0037 costs one more insert, not three).
 * Losing any is better than losing the take; the readers re-read a row
 * without 0037's columns from its transcript (lib/rep-substance.ts).
 */
const OPTIONAL_COLUMNS: readonly (readonly string[])[] = [["client_id"], ["round"], SUBSTANCE_COLUMNS];

/**
 * The reps table's check refused a take of 0 stars (#504): Postgres's
 * check violation, naming the stars column's check, for a row that asked
 * for 0. Anything else is a real failure.
 */
export function starsRefused(error: { code?: string; message?: string }, stars: unknown): boolean {
  return stars === 0 && error.code === "23514" && /stars/i.test(error.message ?? "");
}

export interface SavedRep {
  id: string;
  audioPath: string | null;
  /** The recording was already stored under its key (a resend): this is
   *  that row, and nothing was written twice. */
  duplicate?: boolean;
  /**
   * The account XP this save paid (#510, lib/xp.ts `xpForTake`): 0 for a
   * take that earned no star, for a take with no account and for a
   * resend. The server's answer says it, so no screen says another.
   */
  xp?: number;
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

/**
 * A take's audio into the private bucket under a fresh path (#472). The
 * route starts this beside Whisper, so the save after Demos's read waits
 * on its rows alone. Null when it did not go in, which stores the take
 * with no audio, as a failed upload always has.
 */
export async function uploadRepAudio(audio: Blob, filename: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  // Never the name the file was picked with (review P3); a random part
  // so two recordings in one millisecond never share a path.
  const path = `reps/${Date.now()}-${randomUUID().slice(0, 8)}-${neutralAudioName(filename)}`;
  const upload = await db.storage.from("audio").upload(path, audio, {
    contentType: audio.type || "audio/webm",
  });
  return upload.error ? null : path;
}

/** Takes back the audio of a take that ended up stored nowhere. */
export async function removeRepAudio(path: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.storage.from("audio").remove([path]);
}

export async function saveRep(params: {
  audio: Blob;
  filename: string;
  /**
   * Where `uploadRepAudio` already put the audio (null: it did not go
   * in). Absent, the audio is uploaded here first, as it always was.
   */
  audioPath?: string | null;
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
  /**
   * The pause rules that scored it (#491, lib/pause-rules.ts
   * PAUSE_RULES), kept as `dimensions.pauseRules`: a stored take without
   * it was scored before #476, so the first take after it can say its
   * jump is partly the rule's. Only ever written with a new row; nothing
   * stored is touched (#422).
   */
  pauseRules?: number;
}): Promise<SavedRep | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { audio, filename, transcript, metrics, tier1, anchors, coach } =
    params;

  const audioPath =
    params.audioPath !== undefined ? params.audioPath : await uploadRepAudio(audio, filename);

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
      ...(params.pauseRules ? { pauseRules: params.pauseRules } : {}),
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
    /* What its transcript's words came to (0037, #511), by the rule every
       reader ran on the stored transcript until now, so the columns read
       the same as the text they stand in for. Not `metrics.substance`:
       the engine counts Whisper's word list, which can part from its
       text ("Twenty" and "20", a word in one and not the other). */
    ...(substanceColumns(substance(transcript)) ?? {}),
  };
  let { data, error } = await insert(attempt);
  // Once per optional group at most; a taken key (23505) is not a missing column.
  for (let tries = 0; tries < OPTIONAL_COLUMNS.length && error && error.code !== "23505"; tries++) {
    const message = error.message;
    const missing = OPTIONAL_COLUMNS.find((group) =>
      group.some((k) => k in attempt && new RegExp(`\\b${k}\\b`).test(message))
    );
    if (!missing) break;
    attempt = Object.fromEntries(Object.entries(attempt).filter(([k]) => !missing.includes(k)));
    ({ data, error } = await insert(attempt));
  }
  // A take that earned no star (#504) on a table whose check still says
  // 1 to 3 (migration 0035 is applied by hand): it is stored at 1, as
  // every take too thin to score was before, rather than not at all.
  if (error && starsRefused(error, attempt.stars)) {
    attempt = { ...attempt, stars: 1 };
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

  // The lexicon row and the XP each hang off the stored row and not off
  // each other, so they are written side by side (#472).
  const writes: PromiseLike<unknown>[] = [];
  if (coach?.supply) {
    // Supply accumulates into the personal lexicon (DECISIONS.md #12).
    // No upgrade, no lexicon row: the coach may say none (#429).
    writes.push(
      db.from("lexicon").insert({
        user_id: params.userId ?? null,
        original: coach.supply.original,
        upgrade: coach.supply.upgrade,
        rep_id: data.id,
      })
    );
  }

  /*
   * Difficulty multiplies EFFORT credit only. Stars and the Index are
   * untouched by mods (DECISIONS #10, #16). XP is the effort currency
   * (DECISIONS #16), and every stored take that earns a star pays it,
   * Today's practice and a lesson's alike: lib/xp.ts holds the one figure
   * (#485). A take that earns none, too short or too thin to score
   * (#504), pays nothing and writes no XP row (#510). The measured stars,
   * never `attempt.stars`, which a table before 0035 holds at 1.
   */
  const xp = params.userId ? xpForTake(metrics.stars, params.xpMultiplier ?? 1) : 0;
  if (params.userId && xp > 0) {
    writes.push(
      db.from("xp_events").insert({
        user_id: params.userId,
        amount: xp,
        source:
          params.mode === "boss"
            ? "boss"
            : (params.mods?.length ?? 0) > 0
              ? "mod"
              : "rep",
        rep_id: data.id,
        // The week's XP lands in the week it was spoken, with the recording.
        ...(params.createdAt ? { created_at: params.createdAt } : {}),
      })
    );
  }
  await Promise.all(writes);

  return { id: data.id, audioPath, xp };
}
