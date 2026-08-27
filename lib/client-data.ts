/**
 * Client-side reads over the user's own rows (RLS: own-select policies).
 * Everything degrades to empty when there's no session — the UI shows
 * honest empty states, never fake numbers.
 */

import { supabaseBrowser } from "./supabase-browser";
import type { AccuracyResult } from "./accuracy";
import type { JudgedDimension } from "./coach";
import type { CoinRow } from "./coins";
import { isUnlocked } from "./entitlement";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import type { Pause } from "./metrics";
import type { DeliveryMoment } from "./presence";
import type { CaptureMode } from "./prefs";

export interface RepRow {
  id: string;
  lesson_id: string | null;
  created_at: string;
  duration_s: number;
  transcript: string;
  wpm: number;
  filler_count: number;
  fillers: { word: string; t: number }[];
  pauses: Pause[];
  stars: number;
  focus: string | null;
  strength: string | null;
  supply: { original: string; upgrade: string; note: string } | null;
  ethos_index: number | null;
  audio_path: string | null;
  dimensions: {
    tier1: Tier1Scores;
    anchors: Tier2Anchors;
    tier2: Record<
      "structure" | "credibility" | "engagement" | "confidence",
      JudgedDimension
    > | null;
  } | null;
  mode: "daily" | "boss";
  mods: string[];
  xp_multiplier: number;
  boss_topic_id: string | null;
  accuracy: AccuracyResult | null;
  capture_mode: CaptureMode;
  /** Null on every Voice rep — the results screen branches on this. */
  delivery_metrics: Record<string, number> | null;
  presence_score: number | null;
  delivery_moments: DeliveryMoment[] | null;
}

const REP_COLUMNS =
  "id, lesson_id, created_at, duration_s, transcript, wpm, filler_count, fillers, pauses, stars, focus, strength, supply, ethos_index, dimensions, audio_path, mode, mods, xp_multiplier, boss_topic_id, accuracy, capture_mode, delivery_metrics, presence_score, delivery_moments";

export async function fetchReps(limit = 90): Promise<RepRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data: session } = await db.auth.getSession();
  if (!session.session) return [];
  const { data } = await db
    .from("reps")
    .select(REP_COLUMNS)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data as RepRow[] | null) ?? [];
}

export async function fetchRep(id: string): Promise<RepRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data } = await db
    .from("reps")
    .select(REP_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as RepRow | null) ?? null;
}

export interface LexiconRow {
  id: string;
  original: string;
  upgrade: string;
  created_at: string;
}

export async function fetchLexicon(limit = 100): Promise<LexiconRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data } = await db
    .from("lexicon")
    .select("id, original, upgrade, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as LexiconRow[] | null) ?? [];
}

export async function fetchXp(): Promise<{ total: number; week: number }> {
  const db = supabaseBrowser();
  if (!db) return { total: 0, week: 0 };
  const { data } = await db
    .from("xp_events")
    .select("amount, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = (data as { amount: number; created_at: string }[] | null) ?? [];
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = rows
    .filter((r) => new Date(r.created_at) >= monday)
    .reduce((a, r) => a + r.amount, 0);
  return { total, week };
}

/** Short-lived signed URL for a rep's audio (the bucket stays private). */
export async function repAudioUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const db = supabaseBrowser();
  if (!db) return null;
  const { data } = await db.storage.from("audio").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export interface ProfileRow {
  display_name: string | null;
  premium: boolean;
  premium_until: string | null;
  /** Which owned Demos pose sits on the floor card. Synced since 27 Aug
   *  so a bought cosmetic follows the account across devices. */
  equipped_pose: string | null;
}

/**
 * Every screen reads its entitlement from here, so `isUnlocked` is
 * applied once rather than in eight components. The stored flag is left
 * untouched underneath — this is a view of it, not a write.
 */
export async function fetchProfile(): Promise<ProfileRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data } = await db
    .from("profiles")
    .select("display_name, premium, premium_until, equipped_pose")
    .maybeSingle();
  const row = (data as ProfileRow | null) ?? null;
  const stored = row?.premium ?? false;
  return {
    display_name: row?.display_name ?? null,
    premium: isUnlocked(stored),
    premium_until: row?.premium_until ?? null,
    equipped_pose: row?.equipped_pose ?? null,
  };
}

/**
 * Which owned pose sits on the floor card. Upserted like the display
 * name (profiles are created lazily); `null` puts the default back.
 * localStorage keeps a copy so the card paints right on first render,
 * but the account is the truth — this is what makes a cosmetic follow
 * its owner to the next device.
 */
export async function updateEquippedPose(
  pose: string | null
): Promise<boolean> {
  const db = supabaseBrowser();
  if (!db) return false;
  const { data } = await db.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;
  const { error } = await db
    .from("profiles")
    .upsert({ user_id: uid, equipped_pose: pose }, { onConflict: "user_id" });
  return !error;
}

/** Display names cap at 24 characters: the league row is the widest place one shows. */
export const MAX_DISPLAY_NAME = 24;

/**
 * The one profile field the user types. Trimmed and capped here as well
 * as at the input, and an empty string clears the name rather than
 * storing "". The row is upserted because profiles are created lazily.
 */
export async function updateDisplayName(name: string): Promise<boolean> {
  const db = supabaseBrowser();
  if (!db) return false;
  const { data } = await db.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;
  const clean = name.trim().slice(0, MAX_DISPLAY_NAME);
  const { error } = await db
    .from("profiles")
    .upsert(
      { user_id: uid, display_name: clean || null },
      { onConflict: "user_id" }
    );
  return !error;
}

export interface StreakRow {
  freezes_equipped: number;
}

export async function fetchStreakRow(): Promise<StreakRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data } = await db
    .from("streaks")
    .select("freezes_equipped")
    .maybeSingle();
  return (data as StreakRow | null) ?? null;
}

/** Local calendar dates a freeze has already rescued. */
export async function fetchFrozenDays(): Promise<Date[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data } = await db
    .from("streak_freezes")
    .select("used_on")
    .order("used_on", { ascending: true });
  const rows = (data as { used_on: string }[] | null) ?? [];
  // `used_on` is a bare date; parse as local, not UTC, or a timezone
  // west of Greenwich shifts every freeze back a day.
  return rows.map((r) => {
    const [y, m, d] = r.used_on.split("-").map(Number);
    return new Date(y, m - 1, d);
  });
}

function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Spend freezes on the given days. Returns how many were actually
 * consumed — the unique index means a double-tap or a second tab can't
 * spend twice for the same day.
 */
export async function spendFreezes(
  days: Date[],
  equipped: number
): Promise<number> {
  const db = supabaseBrowser();
  if (!db || days.length === 0) return 0;
  const { data: session } = await db.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return 0;

  const { data, error } = await db
    .from("streak_freezes")
    .upsert(
      days.map((d) => ({ user_id: userId, used_on: dateOnly(d) })),
      { onConflict: "user_id,used_on", ignoreDuplicates: true }
    )
    .select("id");
  if (error) return 0;

  const spent = data?.length ?? 0;
  if (spent > 0) {
    await db
      .from("streaks")
      .upsert(
        { user_id: userId, freezes_equipped: Math.max(0, equipped - spent) },
        { onConflict: "user_id" }
      );
  }
  return spent;
}

/** The coin ledger — append-only, read whole (DECISIONS: §4, 11 Aug). */
export async function fetchCoinLedger(limit = 400): Promise<CoinRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data } = await db
    .from("coin_ledger")
    .select("id, kind, amount, reason, earned_on, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as CoinRow[] | null) ?? [];
}

/**
 * Pay out the streak-day coins for days that haven't been paid. Returns
 * how many rows were actually written — the partial unique index means a
 * double-tap or a second tab collapses to one, so re-running is free.
 */
export async function grantCoins(days: string[]): Promise<number> {
  const db = supabaseBrowser();
  if (!db || days.length === 0) return 0;
  const { data: session } = await db.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return 0;

  const { data, error } = await db
    .from("coin_ledger")
    .upsert(
      days.map((d) => ({
        user_id: userId,
        kind: "earned" as const,
        amount: 1,
        reason: "streak_day",
        earned_on: d,
      })),
      // Must match `coin_ledger_earn_uniq` exactly. The original target
      // was (user_id, earned_on) against a PARTIAL index, which Postgres
      // refuses with 42P10 — so every grant failed silently and nobody
      // ever earned a coin (migration 0005).
      { onConflict: "user_id,reason,earned_on", ignoreDuplicates: true }
    )
    .select("id");
  if (error) {
    // Silent failure here is how the coin bug survived: grantCoins
    // returned 0, syncCoins caught nothing, and the balance just stayed
    // at zero forever with no symptom.
    console.warn("[coins] grant failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Buy something. Balance is checked and the row written inside one
 * locked transaction (`spend_coins`), so two taps can't both spend the
 * same coin — a policy-level check would race against itself.
 */
export async function spendCoins(
  reason: string,
  amount: number
): Promise<{ ok: boolean; balance: number; detail: string }> {
  const db = supabaseBrowser();
  if (!db) return { ok: false, balance: 0, detail: "offline" };
  const { data, error } = await db.rpc("spend_coins", {
    p_reason: reason,
    p_amount: amount,
  });
  if (error) return { ok: false, balance: 0, detail: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: !!row?.ok,
    balance: row?.balance ?? 0,
    detail: row?.detail ?? "",
  };
}

/** Top the user's equipped freezes up to what their streak has earned. */
export async function grantFreezes(target: number): Promise<number> {
  const db = supabaseBrowser();
  if (!db) return 0;
  const { data: session } = await db.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return 0;
  const { error } = await db
    .from("streaks")
    .upsert(
      { user_id: userId, freezes_equipped: target },
      { onConflict: "user_id" }
    );
  return error ? 0 : target;
}

/** How many freezes were bought in the shop, for the freeze derivation. */
export async function purchasedFreezes(): Promise<number> {
  const db = supabaseBrowser();
  if (!db) return 0;
  const { data } = await db
    .from("coin_ledger")
    .select("id")
    .eq("kind", "spent")
    .eq("reason", "shop:streak_freeze");
  return data?.length ?? 0;
}
