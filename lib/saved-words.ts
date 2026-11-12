/**
 * Your words (#411, migration 0023): the swaps saved from a recording's
 * word sheet, one row per word said and word to use instead. The browser
 * reads, saves and removes its own rows through the anon key; row level
 * security keeps every account to its own.
 *
 * Reads throw on a failed answer, so a dead connection is a retry, never
 * an empty list (lib/client-data.ts, #147). The screens are optimistic:
 * a save or a removal shows at once and goes back if the write fails.
 */

import { currentSession, supabaseBrowser } from "./supabase-browser";

export interface SavedWord {
  id: string;
  word: string;
  instead: string;
  sentence: string | null;
  rep_id: string | null;
  created_at: string;
}

export const SAVED_LIMITS = { word: 40, instead: 40, sentence: 300 } as const;

const COLUMNS = "id, word, instead, sentence, rep_id, created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How a pair is known on the phone: the word as said and its swap, lowercased. */
export function pairKey(word: string, instead: string): string {
  return `${word.trim().toLowerCase()}|${instead.trim().toLowerCase()}`;
}

export class SaveFailed extends Error {
  constructor(message = "save failed") {
    super(message);
    this.name = "SaveFailed";
  }
}

/** Every saved swap, newest first. */
export async function fetchSavedWords(limit = 500): Promise<SavedWord[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data, error } = await db
    .from("saved_words")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as SavedWord[] | null) ?? [];
}

/**
 * Save one swap. A pair already saved answers with the row it already
 * is, so a second tap (or a second phone) is never an error.
 */
export async function saveWord(input: {
  word: string;
  instead: string;
  sentence?: string | null;
  repId?: string | null;
}): Promise<SavedWord> {
  const db = supabaseBrowser();
  const me = await currentSession();
  if (!db || !me) throw new SaveFailed("no session");
  const row = {
    user_id: me.userId,
    word: input.word.trim().toLowerCase().slice(0, SAVED_LIMITS.word),
    instead: input.instead.trim().slice(0, SAVED_LIMITS.instead),
    sentence: input.sentence?.trim().slice(0, SAVED_LIMITS.sentence) || null,
    rep_id: input.repId && UUID.test(input.repId) ? input.repId : null,
  };
  const { data, error } = await db.from("saved_words").insert(row).select(COLUMNS).single();
  if (!error && data) return data as SavedWord;
  // 23505: the pair is saved already. Read it back rather than fail.
  if ((error as { code?: string } | null)?.code === "23505") {
    const { data: held, error: readError } = await db
      .from("saved_words")
      .select(COLUMNS)
      .eq("word", row.word)
      .eq("instead", row.instead)
      .maybeSingle();
    if (!readError && held) return held as SavedWord;
  }
  throw new SaveFailed(error?.message);
}

/** Take one swap off the list. */
export async function removeSavedWord(id: string): Promise<void> {
  const db = supabaseBrowser();
  if (!db) throw new SaveFailed("no client");
  const { error } = await db.from("saved_words").delete().eq("id", id);
  if (error) throw new SaveFailed(error.message);
}

/**
 * Put back a swap that was just taken off (#435, the undo): the same
 * row, its id and its date with it, so it returns to its own place in
 * the list. A row that never left (the removal had not landed, or
 * another phone saved the pair again) answers as kept.
 */
export async function restoreSavedWord(row: SavedWord): Promise<SavedWord> {
  const db = supabaseBrowser();
  const me = await currentSession();
  if (!db || !me) throw new SaveFailed("no session");
  const { data, error } = await db
    .from("saved_words")
    .insert({
      id: row.id,
      user_id: me.userId,
      word: row.word,
      instead: row.instead,
      sentence: row.sentence,
      rep_id: row.rep_id,
      created_at: row.created_at,
    })
    .select(COLUMNS)
    .single();
  if (!error && data) return data as SavedWord;
  if ((error as { code?: string } | null)?.code === "23505") return row;
  throw new SaveFailed(error?.message);
}

/** A row in its place in the list: newest first, as the read orders it. */
export function withRow(rows: SavedWord[], row: SavedWord): SavedWord[] {
  if (rows.some((r) => r.id === row.id)) return rows;
  return [...rows, row].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/*
 * The pairs this account has saved, as the phone last knew them, so a
 * word sheet opens with a swap already saved marked as saved. Read once a
 * visit and kept in step with every save and removal made here; a read
 * that fails leaves it unknown, and a second save of a saved pair is
 * answered with its row (saveWord).
 */
let known: Map<string, string> | null = null;
let knownRead: Promise<Map<string, string> | null> | null = null;

export function knownSaved(): Promise<Map<string, string> | null> {
  if (known) return Promise.resolve(known);
  if (!knownRead) {
    knownRead = fetchSavedWords()
      .then((rows) => {
        known = new Map(rows.map((r) => [pairKey(r.word, r.instead), r.id]));
        return known;
      })
      .catch(() => null)
      .finally(() => {
        knownRead = null;
      });
  }
  return knownRead;
}

export function noteSaved(row: SavedWord) {
  known?.set(pairKey(row.word, row.instead), row.id);
}

export function noteRemoved(word: string, instead: string) {
  known?.delete(pairKey(word, instead));
}
