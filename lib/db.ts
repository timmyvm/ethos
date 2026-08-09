/**
 * Supabase persistence — schema v1 (BUILD-PLAN).
 * Degrades gracefully: with no env configured, reps still analyze and
 * return numbers; they just aren't stored. Step 1 is the engine, not auth.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CoachOutput } from "./coach";
import type { RepMetrics } from "./metrics";

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface SavedRep {
  id: string;
  audioPath: string | null;
}

export async function saveRep(params: {
  audio: Blob;
  filename: string;
  transcript: string;
  metrics: RepMetrics;
  coach: CoachOutput | null;
  whisperRaw?: unknown;
  userId?: string;
  lessonId?: string;
}): Promise<SavedRep | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { audio, filename, transcript, metrics, coach } = params;

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
      supply: coach?.supply ?? null,
      audio_path: audioPath,
      whisper_raw: params.whisperRaw ?? null,
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

  return { id: data.id, audioPath };
}
