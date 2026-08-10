/**
 * Client-side reads over the user's own rows (RLS: own-select policies).
 * Everything degrades to empty when there's no session — the UI shows
 * honest empty states, never fake numbers.
 */

import { supabaseBrowser } from "./supabase-browser";
import type { JudgedDimension } from "./coach";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import type { Pause } from "./metrics";

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
}

const REP_COLUMNS =
  "id, lesson_id, created_at, duration_s, transcript, wpm, filler_count, fillers, pauses, stars, focus, strength, supply, ethos_index, dimensions, audio_path";

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
