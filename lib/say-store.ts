/**
 * Where Say it better reads and keeps its state (DECISIONS #507).
 *
 * The swaps come from two tables the app already has: the coach's pairs
 * (`lexicon`, the browser reads its own) and the word sheet's saves
 * (`saved_words`, lib/saved-words.ts). Where each one stands in the
 * spaced test lives in `say_better` (migration 0036), one row per account
 * and swap.
 *
 * Until 0036 is applied to production the table is missing (42P01 from
 * Postgres, PGRST205 from PostgREST's schema cache, or a 404), and the app
 * keeps the test on this phone instead (`ethos.say.v1`, keyed by the
 * account that wrote it), as the carried cue went on without 0034
 * (lib/cue-store.ts) and saveRep without 0035's zero stars. The phone
 * always keeps a copy; the newer of the two wins per swap, and a newer
 * phone copy is written up to the account when the table is there.
 *
 * The count reads the account's recordings: their transcripts, Whisper's
 * own text, to find the later ones that say a better phrase, and their
 * timed words only for the few moments a screen plays.
 */

import { held, heldMark, hold, once } from "./held";
import { currentSession, supabaseBrowser } from "./supabase-browser";
import { own } from "./own-rows";
import {
  fetchSavedWords,
  noteRemoved,
  noteSaved,
  removeSavedWord,
  restoreSavedWord,
  type SavedWord,
} from "./saved-words";
import {
  coachSwap,
  freshState,
  heardState,
  mergeSwaps,
  partsOf,
  stateOf,
  usesOf,
  wordSwap,
  type Swap,
  type SwapState,
  type SwapStates,
  type SwapView,
  type TakeText,
  type TimedWord,
} from "./say";
import { saidIn } from "./upgrade";
import { SAY_KEY } from "./say-keys";

/** This phone's copy of the test, per account (lib/say-keys.ts, so signing out can forget it). */
export { SAY_KEY };

/** The table's answers before 0036 is applied. */
export function missingSayTable(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.status === 404) return true;
  return /say_better/.test(error.message ?? "") && /(does not exist|schema cache|not find)/i.test(error.message ?? "");
}

/* ---- this phone's copy -------------------------------------------------- */

function readLocal(uid: string): SwapStates {
  try {
    const raw = localStorage.getItem(SAY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { uid?: unknown; states?: unknown };
    if (parsed.uid !== uid || !parsed.states || typeof parsed.states !== "object") return {};
    const out: Record<string, SwapState> = {};
    for (const [k, v] of Object.entries(parsed.states as Record<string, unknown>)) {
      const s = parseState(v);
      if (s) out[k] = s;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLocal(uid: string, states: SwapStates) {
  try {
    localStorage.setItem(SAY_KEY, JSON.stringify({ uid, states }));
  } catch {}
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A stored state, or null where it is not one. */
export function parseState(v: unknown): SwapState | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.step !== "number" || typeof s.due !== "string" || !DAY.test(s.due) || typeof s.at !== "string") return null;
  const last = s.last === "said" || s.last === "missed" || s.last === "shown" ? s.last : null;
  return {
    step: Math.max(0, Math.min(3, Math.round(s.step))),
    due: s.due,
    last,
    testedOn: typeof s.testedOn === "string" && DAY.test(s.testedOn) ? s.testedOn : null,
    heardAt: typeof s.heardAt === "string" ? s.heardAt : null,
    hidden: s.hidden === true,
    at: s.at,
  };
}

/** The newer of two copies of one swap's state, by when each was written. */
export function newerState(a: SwapState | undefined, b: SwapState | undefined): SwapState | undefined {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

/** Two copies of the whole test, swap by swap. */
export function mergeStates(a: SwapStates, b: SwapStates): SwapStates {
  const out: Record<string, SwapState> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = newerState(out[k], v)!;
  return out;
}

interface Row {
  swap: string;
  step: number;
  due: string;
  last: SwapState["last"];
  tested_on: string | null;
  heard_at: string | null;
  hidden: boolean;
  updated_at: string;
}

const toRow = (uid: string, key: string, s: SwapState) => ({
  user_id: uid,
  swap: key,
  step: s.step,
  due: s.due,
  last: s.last,
  tested_on: s.testedOn,
  heard_at: s.heardAt,
  hidden: s.hidden,
  updated_at: s.at,
});

const fromRow = (r: Row): SwapState => ({
  step: r.step,
  due: r.due,
  last: r.last,
  testedOn: r.tested_on,
  heardAt: r.heard_at,
  hidden: r.hidden,
  at: r.updated_at,
});

/** The session's account id, which every read of its rows names (lib/own-rows.ts); null with none. */
const myId = async (): Promise<string | null> => (await currentSession())?.userId ?? null;

/** A key 0036's check takes: "c:" or "w:" and a uuid. A fixture's short id stays on the phone. */
const ROW_KEY = /^[cw]:[0-9a-f-]{36}$/;

/**
 * The account's test state: the table's rows and this phone's copy, the
 * newer of each. Throws on a failed read (unknown is not "never tested"),
 * except for the missing table, which is this phone's copy alone.
 */
export async function fetchStates(): Promise<SwapStates> {
  const db = supabaseBrowser();
  const me = await currentSession();
  if (!db || !me) return {};
  const local = readLocal(me.userId);
  const { data, error } = await own(db.from("say_better").select("swap, step, due, last, tested_on, heard_at, hidden, updated_at"), me.userId)
    .limit(2000);
  if (error) {
    if (missingSayTable(error as { code?: string; message?: string })) return local;
    throw error;
  }
  const server: Record<string, SwapState> = {};
  for (const r of (data as Row[] | null) ?? []) server[r.swap] = fromRow(r);
  const merged = mergeStates(server, local);
  writeLocal(me.userId, merged);
  /* This phone holds newer copies than the account (written before 0036,
     or a write that failed): the account takes them now. Best effort. */
  const behind = Object.entries(local).filter(([k, v]) => ROW_KEY.test(k) && (!server[k] || Date.parse(v.at) > Date.parse(server[k].at)));
  if (behind.length > 0) {
    void db
      .from("say_better")
      .upsert(behind.map(([k, v]) => toRow(me.userId, k, v)), { onConflict: "user_id,swap" })
      .then(
        () => {},
        () => {}
      );
  }
  return merged;
}

/**
 * Keep one swap's state: on this phone at once, then on the account.
 * The missing table keeps it on the phone alone; any other failure too,
 * and the next read writes the newer copy up. True when the account has it.
 */
export async function saveState(key: string, state: SwapState): Promise<boolean> {
  const me = await currentSession();
  if (!me) return false;
  writeLocal(me.userId, { ...readLocal(me.userId), [key]: state });
  const cached = held<SayRead>(SAY_READ_KEY);
  if (cached) hold(SAY_READ_KEY, withState(cached, key, state));
  const db = supabaseBrowser();
  if (!db || !ROW_KEY.test(key)) return false;
  const { error } = await db.from("say_better").upsert(toRow(me.userId, key, state), { onConflict: "user_id,swap" });
  return !error;
}

/**
 * Keep a swap's state under every key it stands for (a merged swap's rows,
 * lib/say.ts mergeSwaps), so it holds whichever row is left. True when
 * the account has all of them.
 */
export async function saveSwapState(swap: Swap, state: SwapState): Promise<boolean> {
  let all = true;
  for (const key of new Set(partsOf(swap).map((p) => p.key))) all = (await saveState(key, state)) && all;
  return all;
}

/* ---- the swaps ----------------------------------------------------------- */

export interface LexiconPair {
  id: string;
  original: string;
  upgrade: string;
  rep_id: string | null;
  created_at: string;
}

/** The coach's pairs, newest first, as many as the page reads. */
async function readPairs(): Promise<LexiconPair[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const me = await myId();
  const { data, error } = await own(db.from("lexicon").select("id, original, upgrade, rep_id, created_at"), me)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as LexiconPair[] | null) ?? [];
}

/** One list: the coach's pairs and the word sheet's saves (lib/say.ts mergeSwaps). */
export async function fetchSwaps(): Promise<Swap[]> {
  const [pairs, words] = await Promise.all([readPairs(), fetchSavedWords()]);
  return mergeSwaps(pairs.map((p) => coachSwap(p)), words.map(wordSwap));
}

/* ---- the recordings the count reads ------------------------------------ */

/** The newest recordings the count reads: about a few months of daily practice. */
export const TAKES_READ = 200;

async function readTakes(since: string): Promise<TakeText[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const me = await myId();
  const { data, error } = await own(db.from("reps").select("id, created_at, transcript"), me)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(TAKES_READ);
  if (error) throw error;
  return ((data as { id: string; created_at: string; transcript: string | null }[] | null) ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    transcript: r.transcript,
  }));
}

/**
 * The recordings swaps came from that the newest-first read did not reach
 * (a phrase saved from an old recording in the Log): their day is the day
 * you said it, and a coach pair's sentence is read from their text.
 */
async function readTakesById(ids: readonly string[]): Promise<TakeText[]> {
  const db = supabaseBrowser();
  const want = [...new Set(ids)];
  if (!db || want.length === 0) return [];
  const me = await myId();
  const out: TakeText[] = [];
  for (let i = 0; i < want.length; i += 100) {
    const { data, error } = await own(db.from("reps").select("id, created_at, transcript"), me)
      .in("id", want.slice(i, i + 100));
    if (error) throw error;
    for (const r of (data as { id: string; created_at: string; transcript: string | null }[] | null) ?? []) {
      out.push({ id: r.id, created_at: r.created_at, transcript: r.transcript });
    }
  }
  return out;
}

/** Whisper's timed words for a few recordings, for the moments a screen plays. */
export async function fetchTakeWords(ids: readonly string[]): Promise<Map<string, TimedWord[] | null>> {
  const out = new Map<string, TimedWord[] | null>();
  const want = [...new Set(ids)].slice(0, 24);
  const db = supabaseBrowser();
  if (!db || want.length === 0) return out;
  const me = await myId();
  const { data, error } = await own(db.from("reps").select("id, words:whisper_raw->words"), me).in("id", want);
  if (error) throw error;
  for (const r of (data as { id: string; words: TimedWord[] | null }[] | null) ?? []) {
    out.set(r.id, Array.isArray(r.words) ? r.words : null);
  }
  return out;
}

/* ---- what a screen draws ------------------------------------------------- */

/** One swap as a screen draws it: its state, its later uses, and where it was said. */
export interface SayItem extends SwapView {
  /** When the recording it came from was made (or when it was saved). */
  saidOn: string;
}

export interface SayRead {
  items: SayItem[];
  /** The recordings read, by id, for a sheet's moments. */
  takes: Map<string, TakeText>;
}

export const SAY_READ_KEY = "say";

function withState(read: SayRead, key: string, state: SwapState): SayRead {
  return { ...read, items: read.items.map((i) => (i.swap.key === key ? { ...i, state } : i)) };
}

/** What this visit last read, for a first frame. */
export const heldSay = (): SayRead | null => held<SayRead>(SAY_READ_KEY) ?? null;

/**
 * Everything Say it better draws: the swaps with their state, the later
 * recordings that used each, and the sentence each was said in. A coach
 * pair's sentence is read from the recording it came from (Whisper's
 * text), as the word sheet's save keeps its own.
 */
export function fetchSay(): Promise<SayRead> {
  return once(SAY_READ_KEY, readSay);
}

async function readSay(): Promise<SayRead> {
  const mark = heldMark();
  const [swaps, states] = await Promise.all([fetchSwaps(), fetchStates()]);
  if (swaps.length === 0) return hold(SAY_READ_KEY, { items: [], takes: new Map() }, mark);
  const oldest = swaps.reduce((a, s) => (s.savedAt < a ? s.savedAt : a), swaps[0].savedAt);
  const since = new Date(Date.parse(oldest) - 2 * 86_400_000).toISOString();
  const list = await readTakes(since);
  const takes = new Map(list.map((t) => [t.id, t]));
  /* A source past the newest read is read by its id: "You said, Monday"
     is the day it was said, never the day it was saved. */
  const missing = swaps.flatMap((s) => (s.repId && !takes.has(s.repId) ? [s.repId] : []));
  for (const t of await readTakesById(missing)) takes.set(t.id, t);
  const items: SayItem[] = swaps.map((s) => {
    const source = s.repId ? takes.get(s.repId) : undefined;
    const sentence = s.sentence ?? (source?.transcript ? (saidIn(s.said, source.transcript)?.sentence ?? null) : null);
    const swap = sentence === s.sentence ? s : { ...s, sentence };
    return { swap, state: stateOf(swap, states), uses: usesOf(swap, list), saidOn: source?.created_at ?? s.savedAt };
  });
  /* A swap a recording now uses is marked heard, once, so the glance's
     proof line never says it again and the count keeps it when that
     recording is past the newest the page reads. */
  for (const i of items) {
    if (i.uses.length > 0 && !i.state.heardAt) {
      const next = { ...i.state, heardAt: i.uses[i.uses.length - 1].createdAt, at: new Date().toISOString() };
      i.state = next;
      void saveSwapState(i.swap, next).catch(() => {});
    }
  }
  return hold(SAY_READ_KEY, { items, takes }, mark);
}

/* ---- taking one off, and putting it back (#435) -------------------------- */

/**
 * The read this visit holds, with one swap shown off the list or back on
 * it, so You's card and the page drawn from it agree with what was just
 * done (a word save leaves its table; nothing else would tell the held
 * read until the next one).
 */
function holdHidden(key: string, hidden: boolean) {
  const cached = held<SayRead>(SAY_READ_KEY);
  if (!cached) return;
  const item = cached.items.find((i) => i.swap.key === key);
  if (item) hold(SAY_READ_KEY, withState(cached, key, { ...item.state, hidden }));
}

/**
 * Take a swap off the list: every row merged into it (lib/say.ts
 * mergeSwaps), or the pair saved the other way would come back on the
 * next read as a new swap. A word sheet save is taken out of its table,
 * as Your words always did; a coach pair stays in its table and is marked
 * off the list, its place in the test kept, so Undo puts it back as it
 * was.
 */
export async function removeSwap(item: SayItem, words: readonly SavedWord[] = []): Promise<void> {
  const off = { ...item.state, hidden: true, at: new Date().toISOString() };
  for (const part of partsOf(item.swap)) {
    if (part.source === "word") {
      await removeSavedWord(part.id);
      const row = words.find((w) => w.id === part.id);
      noteRemoved(row?.word ?? part.said, row?.instead ?? part.better);
    } else {
      await saveState(part.key, off);
    }
  }
  holdHidden(item.swap.key, true);
}

/** Undo: the same swap back where it was, every row merged into it with it. */
export async function restoreSwap(item: SayItem): Promise<void> {
  const on = { ...item.state, hidden: false, at: new Date().toISOString() };
  for (const part of partsOf(item.swap)) {
    if (part.source === "word") {
      const row: SavedWord = {
        id: part.id,
        word: part.said,
        instead: part.better,
        sentence: part.sentence,
        rep_id: part.repId,
        created_at: part.savedAt,
      };
      noteSaved(await restoreSavedWord(row));
    } else {
      await saveState(part.key, on);
    }
  }
  holdHidden(item.swap.key, false);
}

/** For the glance: the swaps and their states, read once a visit. */
export async function fetchSwapsForProof(): Promise<{ swaps: Swap[]; states: SwapStates }> {
  const [swaps, states] = await Promise.all([fetchSwaps(), fetchStates()]);
  return { swaps, states };
}

/** A swap the glance has just shown as proof: heard, so it is said once (lib/say.ts heardState). */
export async function markHeard(states: SwapStates, swap: Swap, at: Date = new Date()): Promise<void> {
  await saveSwapState(swap, heardState(swap, states, at));
}
