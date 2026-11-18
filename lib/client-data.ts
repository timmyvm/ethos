/**
 * Client-side reads over the user's own rows (RLS: own-select policies).
 * Everything degrades to empty when there's no session — the UI shows
 * honest empty states, never fake numbers.
 */

import { sessionToken, supabaseBrowser } from "./supabase-browser";
import { BILLING_KEY, PROFILE_KEY, SPINE_KEY, forgetBalance, forgetProfile, held, heldMark, hold, keepBetweenOpens, once } from "./held";
import type { AccuracyResult } from "./accuracy";
import type { JudgedDimension } from "./coach";
import type { CoinRow } from "./coins";
import { cleanName } from "./answers";
import { isUnlocked } from "./entitlement";
import { ownedFrom } from "./shop";
import type { Tier1Scores, Tier2Anchors } from "./index-score";
import type { Pause } from "./metrics";
import type { DeliveryMoment } from "./presence";
import type { CaptureMode } from "./prefs";
import type { GameRound } from "./round";
import { xpToday } from "./xp";
import { SUBSTANCE_SELECT, missingSubstanceColumn, withTranscripts, type SubstanceColumns } from "./rep-substance";

/**
 * A recording as the lists read it (`fetchReps`: Today, You, the Log,
 * Practice, the recorder's history): the columns some screen draws from
 * a list, and 0037's three that say what its words came to (#511). The
 * coach's text, the audio's path, the fact-check and the camera's numbers
 * are read with one recording (`fetchRep`, `StoredRep`), never with 90.
 * `tsc` holds it: a list reader that reaches for a column the list does
 * not read does not compile.
 */
export interface RepRow extends SubstanceColumns {
  id: string;
  lesson_id: string | null;
  created_at: string;
  duration_s: number;
  /**
   * Only on a row that does not carry 0037's columns yet (before the
   * migration, or a row an older server stored after it): its substance
   * is read from this, as it always was (lib/rep-substance.ts).
   */
  transcript?: string;
  wpm: number;
  filler_count: number;
  fillers: { word: string; t: number }[];
  pauses: Pause[];
  stars: number;
  ethos_index: number | null;
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
  /** The outbox key it was uploaded under (0016); a tester's answer about it is filed by this (0020). */
  client_id?: string | null;
  /**
   * A game round, measured on the server (lib/round.ts, migration 0026);
   * null on everything that is not a game, and on games recorded before.
   */
  round?: GameRound | null;
}

/** One recording whole: its page (`fetchRep`) and the export (`fetchAllReps`). */
export interface StoredRep extends RepRow {
  transcript: string;
  focus: string | null;
  strength: string | null;
  supply: { original: string; upgrade: string; note: string } | null;
  audio_path: string | null;
  xp_multiplier: number;
  boss_topic_id: string | null;
  accuracy: AccuracyResult | null;
  capture_mode: CaptureMode;
  /** Null on every Voice rep — the results screen branches on this. */
  delivery_metrics: Record<string, number> | null;
  presence_score: number | null;
  delivery_moments: DeliveryMoment[] | null;
  /**
   * Whisper's words with their times, read out of the stored raw reply
   * (`whisper_raw->words`) by `fetchRep` only (#411): the stored page's
   * transcript taps each word to when it was said. The Log's list never
   * reads it.
   */
  words?: { word: string; start: number; end: number }[] | null;
}

/** Every column of a recording: its page and the export, and the lists before 0037. */
const REP_COLUMNS =
  "id, lesson_id, created_at, duration_s, transcript, wpm, filler_count, fillers, pauses, stars, focus, strength, supply, ethos_index, dimensions, audio_path, mode, mods, xp_multiplier, boss_topic_id, accuracy, capture_mode, delivery_metrics, presence_score, delivery_moments, client_id, round";

/**
 * The lists' columns (#511, the speed audit's fix 10): what `RepRow`
 * holds, with 0037's three in the transcript's place. The coach's text
 * (focus, strength, supply), the audio's path, the fact-check, the
 * camera's numbers, the multiplier and the boss's topic id are drawn by
 * no list, so the newest 90 no longer carry them.
 */
export const LIST_COLUMNS = `id, lesson_id, created_at, duration_s, wpm, filler_count, fillers, pauses, stars, ethos_index, dimensions, mode, mods, client_id, round, ${SUBSTANCE_SELECT}`;

/**
 * The columns again without `round`, for a database that has not had
 * migration 0026 yet (it is applied by hand): a read that names a column
 * the table lacks fails whole, and the Log, Today and You would all read
 * as failed over a column only the games use.
 */
const REP_COLUMNS_BEFORE_0026 = REP_COLUMNS.replace(/, round$/, "");

/** PostgREST's and Postgres's answers for a column the table does not have. */
function missingRoundColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    (error.code === "42703" || error.code === "PGRST204" || /column/i.test(error.message ?? "")) &&
    /\bround\b/.test(error.message ?? "")
  );
}

/**
 * A list's select, as far as this database has come: 0037's (`LIST_COLUMNS`)
 * when it has the columns, the select from before it (`REP_COLUMNS`, the
 * transcript and all) when it answers 42703 for one of them, each without
 * `round` before 0026. Tried in that order, each step once.
 */
async function readListed<T>(
  read: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  let substanceCols = true;
  let round = true;
  for (;;) {
    const base = substanceCols ? LIST_COLUMNS : REP_COLUMNS;
    const columns = round ? base : base.replace(/, round\b/, "");
    const answer = await read(columns);
    if (substanceCols && missingSubstanceColumn(answer.error)) {
      substanceCols = false;
      continue;
    }
    if (round && missingRoundColumn(answer.error)) {
      round = false;
      continue;
    }
    return answer;
  }
}

/** The transcripts of a few recordings, for the rows 0037 has not filled (lib/rep-substance.ts). */
async function readTranscripts(ids: string[]): Promise<{ id: string; transcript: string | null }[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data, error } = await db.from("reps").select("id, transcript").in("id", ids);
  if (error) throw error;
  return (data as { id: string; transcript: string | null }[] | null) ?? [];
}

export function fetchReps(limit = 90): Promise<RepRow[]> {
  return once(repsKey(limit), () => readReps(limit));
}

async function readReps(limit = 90): Promise<RepRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const mark = heldMark();
  const { data: session } = await db.auth.getSession();
  if (!session.session) return [];
  // The NEWEST `limit` rows. Ascending with a limit kept the oldest 90,
  // so anyone past 90 recordings lost this week's (the boss's "taken
  // this week", Hostile's allowance, today's streak day).
  const read = (columns: string) =>
    db
      .from("reps")
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(limit);
  const { data, error } = await readListed(read);
  // An answered error (500, an expired JWT's 401) used to come back as
  // [], and every screen drew its zero state over a read that never
  // happened. "Nothing yet" and "didn't load" are different screens
  // (DECISIONS #147); only a throw reaches the error card.
  if (error) throw error;
  /* A row 0037 has not filled reads its transcript, and only it (#511):
     no read at all once the table is filled. */
  const rows = await withTranscripts((data as unknown as RepRow[] | null) ?? [], readTranscripts);
  // Handed back oldest first, the order every caller reads the log in.
  return hold(repsKey(limit), [...rows].reverse(), mark);
}

/*
 * What this visit last read (lib/held.ts, #433): a screen draws these in
 * its first frame and reads again behind them. null (undefined for the
 * profile, whose own null means no backend) is "not read yet", which is
 * the skeleton's cue, exactly as before.
 */
const repsKey = (limit: number) => `reps:${limit}`;
const ROUNDS_KEY = "rounds";
const XP_KEY = "xp";
const lexiconKey = (limit: number) => `lexicon:${limit}`;

/**
 * The newest `limit` rows as last read. The other size read this visit
 * (Lessons reads 200, every other screen 90) stands in until this one
 * lands: the newest of a longer read, or all of a shorter one.
 */
export function heldReps(limit = 90): RepRow[] | null {
  const own = held<RepRow[]>(repsKey(limit));
  if (own) return own;
  const other = held<RepRow[]>(repsKey(limit === 90 ? 200 : 90));
  return other ? other.slice(-limit) : null;
}
export const heldSpine = (): RepSpine[] | null => held<RepSpine[]>(SPINE_KEY) ?? null;
export const heldGameRounds = (): GameRoundRow[] | null => held<GameRoundRow[]>(ROUNDS_KEY) ?? null;
export const heldLexicon = (limit = 100): LexiconRow[] | null => held<LexiconRow[]>(lexiconKey(limit)) ?? null;
export const heldXp = (): XpRead | null => held<XpRead>(XP_KEY) ?? null;
export const heldProfile = (): ProfileRow | null | undefined => held<ProfileRow | null>(PROFILE_KEY);
/** The plan as last read: null is unknown, never free (#353). */
export function heldPremium(): boolean | null {
  const p = heldProfile();
  return p === undefined ? null : (p?.premium ?? false);
}

/** One game round as the ladder reads it (lib/ladder.ts `LadderRow`). */
export interface GameRoundRow {
  id: string;
  lesson_id: string | null;
  created_at: string;
  stars: number;
  ethos_index: number | null;
  round: GameRound | null;
}

/** The newest this many game recordings: months of rounds, so a level opened long ago stays open. */
export const GAME_ROUNDS_LIMIT = 500;

/**
 * Every game recording the ladder needs (proposal-mastery 3): a few
 * columns each, the newest 500 of `game:*`, handed back oldest first.
 * `fetchReps` keeps 90 whole rows, which would lose a level opened past
 * them. Throws on a failed read, as every fetcher here does (#147); a
 * database without migration 0026 reads its game rows with `round` null.
 */
export function fetchGameRounds(): Promise<GameRoundRow[]> {
  return once(ROUNDS_KEY, readGameRounds);
}

async function readGameRounds(): Promise<GameRoundRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const mark = heldMark();
  const { data: session } = await db.auth.getSession();
  if (!session.session) return [];
  const read = (columns: string) =>
    db
      .from("reps")
      .select(columns)
      .like("lesson_id", "game:%")
      .order("created_at", { ascending: false })
      .limit(GAME_ROUNDS_LIMIT);
  let { data, error } = await read("id, lesson_id, created_at, stars, ethos_index, round");
  if (missingRoundColumn(error)) {
    ({ data, error } = await read("id, lesson_id, created_at, stars, ethos_index"));
  }
  if (error) throw error;
  return hold(
    ROUNDS_KEY,
    ((data as unknown as GameRoundRow[] | null) ?? [])
      .filter((r) => r.lesson_id?.startsWith("game:"))
      .map((r) => ({ ...r, round: r.round ?? null }))
      .reverse(),
    mark
  );
}

/** A boss or Hostile Q&A take, as the Log's Games side reads it (lib/games-log.ts). */
export interface PracticeTakeRow {
  id: string;
  lesson_id: string | null;
  created_at: string;
  stars: number;
  ethos_index: number | null;
  /** The boss's fact-check; null on a Hostile take. */
  accuracy: { score: number } | null;
  /** Hostile's stored verdict (0026); null on a boss take and before 0026. */
  round: unknown;
}

const PRACTICE_KEY = "practiceTakes";
/** lib/hostile.ts `HOSTILE_TAKE_ID`, spelt here so every page's reads do not pull in the verdict's schema. */
export const HOSTILE_TAKE_LESSON = "hostile-take";
export const heldPracticeTakes = (): PracticeTakeRow[] | null => held<PracticeTakeRow[]>(PRACTICE_KEY) ?? null;

/** The newest this many of each, boss and Hostile: years of weeks. */
export const PRACTICE_TAKES_LIMIT = 200;

/**
 * Every boss take (`boss:*`) and Hostile Q&A take (`hostile-take`) the
 * Log's Games side lists (#486), a few columns each, newest
 * `PRACTICE_TAKES_LIMIT` of each, handed back oldest first. The game
 * rounds come from `fetchGameRounds`. Throws on a failed read (#147); a
 * database without migration 0026 reads them with `round` null.
 */
export function fetchPracticeTakes(): Promise<PracticeTakeRow[]> {
  return once(PRACTICE_KEY, readPracticeTakes);
}

async function readPracticeTakes(): Promise<PracticeTakeRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const mark = heldMark();
  const { data: session } = await db.auth.getSession();
  if (!session.session) return [];
  const read = async (columns: string) => {
    const base = () => db.from("reps").select(columns).order("created_at", { ascending: false }).limit(PRACTICE_TAKES_LIMIT);
    const [boss, hostile] = await Promise.all([
      base().like("lesson_id", "boss:%"),
      base().eq("lesson_id", HOSTILE_TAKE_LESSON),
    ]);
    return { data: [...((boss.data as unknown[]) ?? []), ...((hostile.data as unknown[]) ?? [])], error: boss.error ?? hostile.error };
  };
  let { data, error } = await read("id, lesson_id, created_at, stars, ethos_index, accuracy, round");
  if (missingRoundColumn(error)) ({ data, error } = await read("id, lesson_id, created_at, stars, ethos_index, accuracy"));
  if (error) throw error;
  const seen = new Set<string>();
  return hold(
    PRACTICE_KEY,
    (data as PracticeTakeRow[])
      // The filters again, on the client: the look loop's mock answers every row.
      .filter((r) => (r.lesson_id ?? "").startsWith("boss:") || r.lesson_id === HOSTILE_TAKE_LESSON)
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .map((r) => ({ ...r, accuracy: r.accuracy ?? null, round: r.round ?? null }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    mark
  );
}

/**
 * Every recording the account holds, a few columns each: what the
 * lifetime numbers are counted from (the streak and the longest run, the
 * freezes earned from it, the day counter, stars, the recording count,
 * Day 1, and the Log's list, #506). `fetchReps` reads the newest 90 whole
 * rows, which is right for one screen's detail and wrong for anything
 * that counts from the first day: past 90 recordings the streak capped
 * and Day 1 moved, and the Log said "Recordings 100" over 90 rows.
 */
export interface RepSpine {
  /** The recording's own id: the Log lists every recording from the spine, each a door to /rep/[id] (#506). */
  id: string;
  created_at: string;
  lesson_id: string | null;
  stars: number;
  ethos_index: number | null;
  /** A boss take or a daily one, so a row past the newest 90 is named as its whole read would be. */
  mode: RepRow["mode"];
}

/** The spine's columns: a few short ones per recording, read for every recording the account holds. */
export const SPINE_COLUMNS = "id, created_at, lesson_id, stars, ethos_index, mode";

/** PostgREST answers at most this many rows (max_rows), so whole reads page. */
const PAGE = 1000;

/** Every row of one of the account's tables, oldest first, paged; throws on a failed page. */
async function readAll<T>(
  table: "reps" | "lexicon" | "coin_ledger" | "xp_events",
  columns: string
): Promise<T[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data: session } = await db.auth.getSession();
  if (!session.session) return [];
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data as T[] | null) ?? [];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

export function fetchRepSpine(): Promise<RepSpine[]> {
  return once(SPINE_KEY, readRepSpine);
}

/**
 * The spine is kept between opens (lib/held.ts, rule 4, #508): six short
 * columns a recording, its date, lesson, stars and Index. Never a word of
 * what was said. Read back only in exactly that shape.
 */
export function spineOf(raw: unknown): RepSpine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: RepSpine[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) return null;
    const { id, created_at, lesson_id, stars, ethos_index, mode } = r as Record<string, unknown>;
    if (typeof id !== "string" || typeof created_at !== "string" || Number.isNaN(Date.parse(created_at))) return null;
    if (lesson_id !== null && typeof lesson_id !== "string") return null;
    if (typeof stars !== "number" || (ethos_index !== null && typeof ethos_index !== "number")) return null;
    if (mode !== "daily" && mode !== "boss") return null;
    out.push({ id, created_at, lesson_id, stars, ethos_index, mode });
  }
  return out;
}
keepBetweenOpens<RepSpine[]>(SPINE_KEY, { save: (v) => spineOf(v), load: spineOf });

async function readRepSpine(): Promise<RepSpine[]> {
  const mark = heldMark();
  return hold(SPINE_KEY, await readAll<RepSpine>("reps", SPINE_COLUMNS), mark);
}

/** Every recording, whole, for the export: nothing capped, nothing guessed. */
export async function fetchAllReps(): Promise<StoredRep[]> {
  try {
    return await readAll<StoredRep>("reps", REP_COLUMNS);
  } catch (e) {
    if (!missingRoundColumn(e as { code?: string; message?: string })) throw e;
    return readAll<StoredRep>("reps", REP_COLUMNS_BEFORE_0026);
  }
}

/** Every lexicon upgrade, for the export. */
export function fetchAllLexicon(): Promise<LexiconRow[]> {
  return readAll<LexiconRow>("lexicon", "id, original, upgrade, created_at");
}

export async function fetchRep(id: string): Promise<StoredRep | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const read = (columns: string) =>
    db
      .from("reps")
      .select(`${columns}, words:whisper_raw->words`)
      .eq("id", id)
      .maybeSingle();
  let { data, error } = await read(REP_COLUMNS);
  if (missingRoundColumn(error)) ({ data, error } = await read(REP_COLUMNS_BEFORE_0026));
  if (error) throw error;
  return (data as unknown as StoredRep | null) ?? null;
}

export interface LexiconRow {
  id: string;
  original: string;
  upgrade: string;
  created_at: string;
}

export function fetchLexicon(limit = 100): Promise<LexiconRow[]> {
  return once(lexiconKey(limit), () => readLexicon(limit));
}

async function readLexicon(limit = 100): Promise<LexiconRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const mark = heldMark();
  const { data, error } = await db
    .from("lexicon")
    .select("id, original, upgrade, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  // An answered error is "didn't load", not "no upgrades yet" (#147).
  if (error) throw error;
  return hold(lexiconKey(limit), (data as LexiconRow[] | null) ?? [], mark);
}

/** The account's XP: every event's total, this week's (from Monday) and today's (#485). */
export interface XpRead {
  total: number;
  week: number;
  today: number;
}

export function fetchXp(): Promise<XpRead> {
  return once(XP_KEY, readXp);
}

async function readXp(): Promise<XpRead> {
  const db = supabaseBrowser();
  if (!db) return { total: 0, week: 0, today: 0 };
  const mark = heldMark();
  // Every event, paged: a read capped at the newest 1000 stopped the
  // total (and the Level) rising after about 1000 recordings. A failed
  // page throws: a failed read is not Level 1 (#147).
  const rows = await readAll<{ amount: number; created_at: string }>(
    "xp_events",
    "amount, created_at"
  );
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = rows
    .filter((r) => new Date(r.created_at) >= monday)
    .reduce((a, r) => a + r.amount, 0);
  return hold(XP_KEY, { total, week, today: xpToday(rows) }, mark);
}

/**
 * A short-lived link to play one stored recording, or null. The server
 * signs it (app/api/audio) after checking the recording is this
 * account's: the bucket stays private and the browser never signs
 * storage itself, so no storage policy has to let it.
 */
export async function repAudioUrl(repId: string): Promise<string | null> {
  const token = await sessionToken();
  if (!token) return null;
  const res = await fetch(`/api/audio?rep=${encodeURIComponent(repId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { url?: unknown } | null;
  return typeof body?.url === "string" ? body.url : null;
}

export interface ProfileRow {
  display_name: string | null;
  premium: boolean;
  premium_until: string | null;
  /** The person's picture, as chosen (#488, lib/picture.ts): a bought
   *  pose's id, "photo", "initial", "hello", or null for none. Synced
   *  since 27 Aug so a bought cosmetic follows the account across devices. */
  equipped_pose: string | null;
}

/**
 * The profile row is kept between opens (lib/held.ts, rule 4, #508): the
 * name, the plan and the picture, read back only in exactly that shape.
 * A plan whose `premium_until` has passed since is read back as it would
 * be read now.
 */
export function profileOf(raw: unknown, now: Date = new Date()): ProfileRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { display_name, premium, premium_until, equipped_pose } = raw as Record<string, unknown>;
  if (display_name !== null && typeof display_name !== "string") return null;
  if (typeof premium !== "boolean") return null;
  if (premium_until !== null && typeof premium_until !== "string") return null;
  if (equipped_pose !== null && typeof equipped_pose !== "string") return null;
  const lapsed = premium_until !== null && !(new Date(premium_until) > now);
  return { display_name, premium: lapsed ? isUnlocked(false) : premium, premium_until, equipped_pose };
}
keepBetweenOpens<ProfileRow | null>(PROFILE_KEY, {
  save: (v) => (v === null ? null : profileOf(v)),
  load: (raw) => profileOf(raw),
});

/**
 * Every screen reads its entitlement from here, so `isUnlocked` is
 * applied once rather than in eight components. The stored flag is left
 * untouched underneath — this is a view of it, not a write.
 */
export function fetchProfile(): Promise<ProfileRow | null> {
  return once(PROFILE_KEY, readProfile);
}

async function readProfile(): Promise<ProfileRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const mark = heldMark();
  const { data, error } = await db
    .from("profiles")
    .select("display_name, premium, premium_until, equipped_pose")
    .maybeSingle();
  // A failed read used to resolve as "not premium", which showed a
  // paying account the Premium wall (#146). Unknown is not free: throw,
  // and each caller decides what an unknown plan draws.
  if (error) throw error;
  const row = (data as ProfileRow | null) ?? null;
  // premium_until is the server's backstop on a paid plan (#377): if the
  // webhook that ends a plan never lands, the flag still runs out.
  const until = row?.premium_until ?? null;
  const stored = (row?.premium ?? false) && (!until || new Date(until) > new Date());
  return hold(
    PROFILE_KEY,
    {
      display_name: row?.display_name ?? null,
      premium: isUnlocked(stored),
      premium_until: row?.premium_until ?? null,
      equipped_pose: row?.equipped_pose ?? null,
    },
    mark
  );
}

/**
 * The account's plan on the price ladder (#377, migration 0012), as the
 * server last synced it from Stripe. Null when the account has never
 * started one; throws on a failed read, like every fetcher here.
 */
export interface BillingRow {
  status: string | null;
  /** Months paid in a row on this plan; 0 before the first payment. */
  ladder_month: number;
  price_cents: number | null;
  next_price_cents: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/**
 * The plan row as this visit last read it (#468), for a page's first
 * frame only: You's plan card drew its placeholder for the length of a
 * read on every arrival, a paying account included. It is never handed
 * back in place of a read (`usePlan` reads on every mount, and `once`
 * is not used here), and any billing route's answer replaces it.
 * Undefined is not read yet.
 */
export const heldBilling = (): BillingRow | null | undefined => held<BillingRow | null>(BILLING_KEY);

export async function fetchBilling(): Promise<BillingRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const mark = heldMark();
  const { data, error } = await db
    .from("billing")
    .select(
      "status, ladder_month, price_cents, next_price_cents, current_period_end, cancel_at_period_end"
    )
    .maybeSingle();
  if (error) throw error;
  return hold(BILLING_KEY, (data as BillingRow | null) ?? null, mark);
}

/**
 * The introduction's answers and the plan built from them (DECISIONS
 * #232, migration 0009). One row per user, upserted; the answers exist
 * before the row does, so the client keeps a copy (lib/answers.ts) and
 * lib/answers-sync.ts decides which way they travel.
 */
export interface OnboardingRow {
  age_band: string | null;
  goal: string | null;
  pains: string[];
  level: string | null;
  context: string | null;
  /** The hour they picked for the daily nudge, 0-23, or null for off. */
  reminder_hour: number | null;
  portfolio: unknown;
  rules_version: number;
}

export async function fetchOnboarding(): Promise<OnboardingRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data: session } = await db.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await db
    .from("onboarding")
    .select("age_band, goal, pains, level, context, reminder_hour, portfolio, rules_version")
    .maybeSingle();
  if (error) throw error;
  return (data as OnboardingRow | null) ?? null;
}

export async function upsertOnboarding(row: OnboardingRow): Promise<boolean> {
  const db = supabaseBrowser();
  if (!db) return false;
  const { data } = await db.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;
  const { error } = await db
    .from("onboarding")
    .upsert(
      { user_id: uid, ...row, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  return !error;
}

/**
 * The person's picture, as chosen (#488): a bought pose's id, "photo",
 * "initial" or "hello"; `null` is no choice. Upserted like the display
 * name (profiles are created lazily). localStorage keeps a copy so the
 * picture paints right on first render, but the account is the truth:
 * this is what makes a cosmetic follow its owner to the next device.
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
  if (!error) forgetProfile();
  return !error;
}

/** Display names cap at 24 characters: the league row is the widest place one shows. */


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
  const clean = cleanName(name);
  const { error } = await db
    .from("profiles")
    .upsert(
      { user_id: uid, display_name: clean },
      { onConflict: "user_id" }
    );
  if (!error) forgetProfile();
  return !error;
}

export interface StreakRow {
  freezes_equipped: number;
}

export async function fetchStreakRow(): Promise<StreakRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data, error } = await db
    .from("streaks")
    .select("freezes_equipped")
    .maybeSingle();
  if (error) throw error;
  return (data as StreakRow | null) ?? null;
}

/** Local calendar dates a freeze has already rescued. */
export async function fetchFrozenDays(): Promise<Date[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data, error } = await db
    .from("streak_freezes")
    .select("used_on")
    .order("used_on", { ascending: true });
  // A failed read must not look like "no freezes spent": the streak
  // would lose its bridged days, and a sync would spend them twice.
  if (error) throw error;
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

/**
 * The whole coin ledger, paged, oldest first: what the balance and the
 * purchases are counted from, so they agree with spend_coins, which sums
 * every row. The capped read below drifted once an account passed 400
 * rows (a lower balance, and a pose bought in month one shown unbought).
 */
export function fetchWholeLedger(): Promise<CoinRow[]> {
  return readAll<CoinRow>("coin_ledger", "id, kind, amount, reason, earned_on, created_at");
}

/** The newest `limit` ledger rows (DECISIONS: §4, 11 Aug). */
export async function fetchCoinLedger(limit = 400): Promise<CoinRow[]> {
  const db = supabaseBrowser();
  if (!db) return [];
  const { data, error } = await db
    .from("coin_ledger")
    .select("id, kind, amount, reason, earned_on, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  // An answered error used to come back as [], and the shop priced every
  // button against a zero balance. Only a throw reaches the error card.
  if (error) throw error;
  return (data as CoinRow[] | null) ?? [];
}

/**
 * Pay out the streak-day coins for days that haven't been paid. Returns
 * how many rows were actually written — the partial unique index means a
 * double-tap or a second tab collapses to one, so re-running is free.
 */
export async function grantCoins(
  days: string[],
  reason: "streak_day" | "challenge_week" = "streak_day"
): Promise<number> {
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
        reason,
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
  // Spent: no screen opens on the balance from before it (lib/held.ts).
  if (row?.ok) forgetBalance();
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
  if (error) {
    // The coin grant's lesson: a write that fails without a word is how
    // a count stays wrong for months.
    console.warn("[freezes] grant failed:", error.message);
    return 0;
  }
  return target;
}

/**
 * How many freezes were bought in the shop, for the freeze derivation.
 * Counted by `ownedFrom`, so a spend below the price (possible before
 * migration 0015) buys nothing here either.
 */
export async function purchasedFreezes(): Promise<number> {
  const db = supabaseBrowser();
  if (!db) return 0;
  const { data, error } = await db
    .from("coin_ledger")
    .select("kind, reason, amount")
    .eq("kind", "spent")
    .eq("reason", "shop:streak_freeze");
  // A failed read is not "none bought": the sync would write a lower count.
  if (error) throw error;
  return ownedFrom((data as { kind: string; reason: string; amount: number }[] | null) ?? []).freezes;
}
