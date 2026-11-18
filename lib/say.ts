/**
 * Say it better (DECISIONS #507): the better ways to say what you said
 * in your own recordings, and the one number that says whether they
 * stuck. Timothy, 18 Nov: "the lexicon's so great ... that's how you
 * actually improve", and of its name, "change the word". Three readers
 * read nine names cold; "Say it better" was the one all three got in two
 * seconds.
 *
 * One list from two sources: the coach's "Say this instead" (#429, the
 * `lexicon` table, one a recording at most) and the word sheet's "Try
 * instead" saves (#411, #428, `saved_words`). Each is a swap: what you
 * said, the better way, the sentence it was said in.
 *
 * The number is "N of M you now say on your own": a swap counts once its
 * better phrase turns up in a LATER real recording (one stored after the
 * swap was saved, never the one it came from). The test's one-line takes
 * are never stored, so they can never count.
 *
 * The test is spaced: 1, 3, 7, then every 14 days; a miss comes back
 * tomorrow; at most three a day.
 *
 * Pure: no network, no storage. The page, You's card, the walk, the
 * glance and the tests share it.
 */

/** m:ss, as every timestamp in the app reads (lib/glance.ts clock). */
export function clock(t: number): string {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** The gaps between tests, in days: the first is from the day it was saved. */
export const SPACING_DAYS = [1, 3, 7, 14] as const;
export const LAST_STEP = SPACING_DAYS.length - 1;
/** At most this many are tested on one day. */
export const DUE_A_DAY = 3;

export type SwapSource = "coach" | "word";

/** One swap: what you said and the better way to say it. */
export interface Swap {
  /** "c:<lexicon id>" for the coach's, "w:<saved_words id>" for a word sheet save. */
  key: string;
  source: SwapSource;
  /** The row's own id in its table. */
  id: string;
  /** What you said ("the thing is"). */
  said: string;
  /** The better way ("the point is"). */
  better: string;
  /** The sentence it was said in, when known. */
  sentence: string | null;
  /** The recording it came from, when known. */
  repId: string | null;
  /** When it was saved (ISO). */
  savedAt: string;
  /**
   * Every row merged into this swap (mergeSwaps), the first saved first,
   * each as its own table holds it: the coach's pair and a word sheet's
   * save of the same words are one swap. Remove takes all of them off,
   * Undo puts all of them back, its state is kept under each key, and
   * none of their recordings can count as a later use. Absent for a swap
   * of one row.
   */
  rows?: Swap[];
}

/** Every row a swap stands for, each as its table holds it. */
export const partsOf = (s: Swap): Swap[] => s.rows ?? [s];

/** Every recording the swap came from: never a later use of it. */
export const sourcesOf = (s: Swap): string[] => partsOf(s).flatMap((p) => (p.repId ? [p.repId] : []));

export type TestResult = "said" | "missed" | "shown";

/** Where one swap stands in the test, per account (migration 0036, or the phone's copy before it). */
export interface SwapState {
  /** Which gap comes next: an index into SPACING_DAYS. */
  step: number;
  /** The day it is next tested (YYYY-MM-DD, the phone's calendar). */
  due: string;
  /** The last test's answer. */
  last: TestResult | null;
  /** The day it was last tested. */
  testedOn: string | null;
  /** When a real recording was first seen to use it (the glance's proof line says it once). */
  heardAt: string | null;
  /** Taken off the list (a coach pair stays in its table; #435's Undo puts it back). */
  hidden: boolean;
  /** When this state was written (ISO): the newer of two copies wins. */
  at: string;
}

export type SwapStates = Readonly<Record<string, SwapState>>;

/* ---- the two sources, one list ---------------------------------------- */

export function coachSwap(row: { id: string; original: string; upgrade: string; created_at: string; rep_id?: string | null }, sentence: string | null = null): Swap {
  return {
    key: `c:${row.id}`,
    source: "coach",
    id: row.id,
    said: row.original,
    better: row.upgrade,
    sentence,
    repId: row.rep_id ?? null,
    savedAt: row.created_at,
  };
}

export function wordSwap(row: { id: string; word: string; instead: string; sentence: string | null; rep_id: string | null; created_at: string }): Swap {
  return {
    key: `w:${row.id}`,
    source: "word",
    id: row.id,
    said: row.word,
    better: row.instead,
    sentence: row.sentence,
    repId: row.rep_id,
    savedAt: row.created_at,
  };
}

const pairOf = (s: Swap) => `${fold(s.said).trim()}|${fold(s.better).trim()}`;

/**
 * The coach's pairs and the word sheet's saves as one list, newest
 * first. A pair saved both ways is one swap: the first saved, keeping
 * every row in `rows`. Its sentence and its recording come from one row,
 * never one from each (a sentence from one recording beside another's
 * moment would be a claim nothing traces to): the first saved with a
 * recording, else the first with a sentence.
 */
export function mergeSwaps(...lists: readonly Swap[][]): Swap[] {
  const byPair = new Map<string, Swap[]>();
  for (const s of lists.flat()) {
    const k = pairOf(s);
    byPair.set(k, [...(byPair.get(k) ?? []), ...partsOf(s)]);
  }
  const out: Swap[] = [];
  for (const rows of byPair.values()) {
    const all = [...rows].sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : 0));
    const first = all[0];
    if (all.length === 1) {
      out.push(first);
      continue;
    }
    const from = all.find((r) => r.repId) ?? all.find((r) => r.sentence) ?? first;
    /* A row from the same recording may hold the sentence the coach's pair does not. */
    const sentence = from.sentence ?? (from.repId ? (all.find((r) => r.repId === from.repId && r.sentence)?.sentence ?? null) : null);
    out.push({ ...first, sentence, repId: from.repId, rows: all });
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

/* ---- days -------------------------------------------------------------- */

/** A day on the phone's calendar, YYYY-MM-DD. */
export function dayOf(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const at = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/* ---- the spacing ------------------------------------------------------- */

/** A swap nobody has tested: first due the day after it was saved. */
export function freshState(swap: Pick<Swap, "savedAt">): SwapState {
  return {
    step: 0,
    due: addDays(dayOf(swap.savedAt), SPACING_DAYS[0]),
    last: null,
    testedOn: null,
    heardAt: null,
    hidden: false,
    at: swap.savedAt,
  };
}

/**
 * Where a swap stands: the newest state kept under any of its rows' keys
 * (a merged swap's state is written under each, so it holds when one row
 * leaves its table), else a fresh one.
 */
export function stateOf(swap: Swap, states: SwapStates): SwapState {
  return keptState(swap, states) ?? freshState(swap);
}

/** The newest state kept under any of a swap's keys, or undefined when none was ever written. */
export function keptState(swap: Swap, states: SwapStates): SwapState | undefined {
  let best: SwapState | undefined;
  for (const p of partsOf(swap)) {
    const s = states[p.key];
    if (s && (!best || Date.parse(s.at) > Date.parse(best.at))) best = s;
  }
  return best;
}

/**
 * The state after one test. Said: the next gap (3, then 7, then 14, then
 * 14 again). Missed: back tomorrow, from the start. Shown (a quiet room,
 * nothing said): back tomorrow, its place in the gaps kept.
 */
export function afterTest(state: SwapState, result: TestResult, today: string, now: Date = new Date()): SwapState {
  const at = now.toISOString();
  if (result === "said") {
    const step = Math.min(state.step + 1, LAST_STEP);
    return { ...state, step, due: addDays(today, SPACING_DAYS[step]), last: "said", testedOn: today, at };
  }
  if (result === "missed") {
    return { ...state, step: 0, due: addDays(today, SPACING_DAYS[0]), last: "missed", testedOn: today, at };
  }
  return { ...state, due: addDays(today, SPACING_DAYS[0]), last: "shown", testedOn: today, at };
}

/** One swap as the page reads it: its state and the later recordings that used it. */
export interface SwapView {
  swap: Swap;
  state: SwapState;
  uses: SwapUse[];
}

/**
 * Said on your own in a later recording: one the page read, or one seen
 * before and marked heard (the glance's proof, or an earlier read), which
 * keeps it counted once that recording is past the newest the page reads.
 */
export const nowSays = (v: SwapView) => v.uses.length > 0 || !!v.state.heardAt;

/** When it was last heard in a real recording. */
const lastHeard = (v: SwapView) => v.uses[0]?.createdAt ?? v.state.heardAt ?? "";

/** How many of today's three are already spent: a swap answered today, however it went. */
export function testedToday(views: readonly SwapView[], today: string): number {
  return views.filter((v) => v.state.testedOn === today).length;
}

/**
 * Today's test: the swaps still being learned whose day has come, the
 * longest waiting first, then the oldest saved; three a day at most, so
 * one answered earlier today takes a place (finishing the test never
 * brings the next three the same day). One you now say is never tested:
 * the recording already proved it.
 */
export function dueToday<V extends SwapView>(views: readonly V[], today: string): V[] {
  const room = Math.max(0, DUE_A_DAY - testedToday(views, today));
  return views
    .filter((v) => !v.state.hidden && !nowSays(v) && v.state.due <= today)
    .sort((a, b) => (a.state.due < b.state.due ? -1 : a.state.due > b.state.due ? 1 : a.swap.savedAt < b.swap.savedAt ? -1 : 1))
    .slice(0, room);
}

/**
 * The next day anything is due, when nothing is due today; null when
 * nothing is being learned. One whose day has come but past today's
 * three is tomorrow's.
 */
export function nextDue(views: readonly SwapView[], today: string): string | null {
  const due = new Set(dueToday(views, today).map((v) => v.swap.key));
  const days = views
    .filter((v) => !v.state.hidden && !nowSays(v))
    .map((v) => (due.has(v.swap.key) ? today : v.state.due <= today ? addDays(today, 1) : v.state.due));
  return days.length ? days.sort()[0] : null;
}

/** The page's three lists and its number. */
export interface SayLists<V extends SwapView = SwapView> {
  due: V[];
  nowSay: V[];
  learning: V[];
  /** N of M: the swaps you now say, and every swap on the list. */
  n: number;
  m: number;
}

/**
 * The day a swap is next tested: today for one of today's three; one due
 * but past the three waits a day; else the day it comes back. Say it
 * better's sheet says it under "In your recordings" until the swap is said.
 */
export function nextTestOn<V extends SwapView>(views: readonly V[], v: V, today: string): string {
  const due = dueToday(views.filter((x) => !x.state.hidden), today);
  return due.some((d) => d.swap.key === v.swap.key) ? today : v.state.due > today ? v.state.due : addDays(today, 1);
}

export function sayLists<V extends SwapView>(views: readonly V[], today: string): SayLists<V> {
  const shown = views.filter((v) => !v.state.hidden);
  const due = dueToday(shown, today);
  const dueKeys = new Set(due.map((v) => v.swap.key));
  const nowSay = shown
    .filter(nowSays)
    .sort((a, b) => timesUsed(b.uses) - timesUsed(a.uses) || (lastHeard(a) < lastHeard(b) ? 1 : -1));
  const learning = shown
    .filter((v) => !nowSays(v) && !dueKeys.has(v.swap.key))
    .sort((a, b) => (a.state.due < b.state.due ? -1 : a.state.due > b.state.due ? 1 : a.swap.savedAt < b.swap.savedAt ? 1 : -1));
  return { due, nowSay, learning, n: nowSay.length, m: shown.length };
}

/* ---- finding a phrase in what was said ---------------------------------- */

/** Lowercase, apostrophes straightened (curly, and the modifier letter), as lib/upgrade.ts folds. */
function fold(s: string): string {
  return s.toLowerCase().replace(/[‘’ʼ]/g, "'");
}
/** A word: letters and digits with inner apostrophes ("don't"). Hyphens split ("well-known" is two). */
const WORD = /[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;
/** A phrase's words, folded, apostrophes dropped, so "dont" finds "don't". */
export function phraseWords(s: string): string[] {
  return [...fold(s).matchAll(WORD)].map((m) => m[0].replace(/'/g, ""));
}

/** One of Whisper's timed words (lib/metrics.ts Word). */
export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

/**
 * One word of a text, where a match may start and stop: `joined` when a
 * hyphen ties it to the word before ("known" in "well-known", so "known"
 * alone is never found inside it), `stops` when a sentence ends after it
 * (a phrase never runs across a full stop, "1.5" aside).
 */
interface Tok {
  w: string;
  /** Where it stands in the text it was read from, by characters. */
  from: number;
  to: number;
  joined: boolean;
  stops: boolean;
}

const HYPHEN_GAP = /^\s*[-‐‑]$/;
const STOP = /[.!?…]/;

function tokensOf(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of fold(text).matchAll(WORD)) {
    const from = m.index ?? 0;
    const prev = out[out.length - 1];
    const gap = text.slice(prev ? prev.to : 0, from);
    if (prev && STOP.test(gap) && !(/^[.,]$/.test(gap) && /\d$/.test(prev.w) && /^\d/.test(m[0]))) prev.stops = true;
    out.push({ w: m[0].replace(/'/g, ""), from, to: from + m[0].length, joined: !!prev && HYPHEN_GAP.test(gap), stops: false });
  }
  return out;
}

/** A transcript read once per visit, however many swaps look in it. */
const tokenCache = new Map<string, Tok[]>();
function tokensCached(text: string): Tok[] {
  let t = tokenCache.get(text);
  if (!t) {
    if (tokenCache.size > 400) tokenCache.clear();
    t = tokensOf(text);
    tokenCache.set(text, t);
  }
  return t;
}

/** Whisper's timed words as one text, each token knowing the word it came from. */
function wordTokens(words: readonly TimedWord[]): { toks: Tok[]; item: number[] } {
  let text = "";
  const starts: number[] = [];
  for (const w of words) {
    starts.push(text.length);
    text += `${w.word} `;
  }
  const toks = tokensOf(text);
  const item: number[] = [];
  let k = 0;
  for (const t of toks) {
    while (k + 1 < starts.length && starts[k + 1] <= t.from) k++;
    item.push(k);
  }
  return { toks, item };
}

/**
 * Where `phrase` stands in tokens, as [first, last] token: its words one
 * after another, whole words only (never the tail or head of a hyphened
 * word), inside one sentence. A place inside `not` (the phrase it
 * replaces) is not a place: "unique" said inside "kind of unique" is the
 * old phrase said again, never the better one. In order, none overlapping.
 */
function placesIn(toks: readonly Tok[], phrase: string, not?: string | null): [number, number][] {
  const want = phraseWords(phrase);
  if (want.length === 0) return [];
  const find = (ws: string[]) => {
    const out: [number, number][] = [];
    for (let i = 0; i + ws.length <= toks.length; i++) {
      if (toks[i].joined) continue;
      let ok = true;
      for (let k = 0; k < ws.length && ok; k++) ok = toks[i + k].w === ws[k] && (k === ws.length - 1 || !toks[i + k].stops);
      if (!ok || toks[i + ws.length]?.joined) continue;
      out.push([i, i + ws.length - 1]);
    }
    return out;
  };
  const notWords = not ? phraseWords(not) : [];
  const inside = notWords.length >= want.length ? find(notWords) : [];
  const out: [number, number][] = [];
  for (const [i, j] of find(want)) {
    if (inside.some(([a, b]) => a <= i && j <= b)) continue;
    if (out.length && i <= out[out.length - 1][1]) continue;
    out.push([i, j]);
  }
  return out;
}

/**
 * Where `phrase` was said in Whisper's timed words: the first place its
 * words come one after another, whole words only, case, punctuation and
 * apostrophes aside, and never inside `not` (the phrase it replaces).
 * Null when it was not said.
 */
export function phraseAt(
  words: readonly TimedWord[] | null | undefined,
  phrase: string,
  not?: string | null
): { start: number; end: number } | null {
  if (!words || words.length === 0) return null;
  const { toks, item } = wordTokens(words);
  const hit = placesIn(toks, phrase, not)[0];
  return hit ? { start: words[item[hit[0]]].start, end: words[item[hit[1]]].end } : null;
}

/** How many times `phrase` was said in `text`, whole words inside one sentence, never inside `not`. */
export function timesIn(text: string | null | undefined, phrase: string, not?: string | null): number {
  if (!text) return 0;
  return placesIn(tokensCached(text), phrase, not).length;
}

/**
 * Where `phrase` stands in `sentence`, by characters, so a screen can
 * mark it: what comes before, the phrase as the sentence spells it, and
 * what comes after. Null when the sentence does not hold it.
 */
export function markIn(sentence: string, phrase: string): { before: string; match: string; after: string } | null {
  const toks = tokensOf(sentence);
  const hit = placesIn(toks, phrase)[0];
  if (!hit) return null;
  const from = toks[hit[0]].from;
  const to = toks[hit[1]].to;
  return { before: sentence.slice(0, from), match: sentence.slice(from, to), after: sentence.slice(to) };
}

/**
 * The sentence said better: the better phrase where the weak one stood,
 * a capital kept where the sentence started with it. Null when the
 * sentence does not hold what was said.
 */
export function saidBetter(sentence: string, said: string, better: string): { before: string; match: string; after: string } | null {
  const at = markIn(sentence, said);
  if (!at) return null;
  const capital = at.before.trim() === "" || /[.!?“"]\s*$/.test(at.before);
  const word = capital && /^[A-Z]/.test(at.match) ? better.charAt(0).toUpperCase() + better.slice(1) : better;
  return { before: at.before, match: word, after: at.after };
}

/* ---- uses: the later recordings that say it ------------------------------ */

/** A stored recording, as much of it as the count reads. */
export interface TakeText {
  id: string;
  created_at: string;
  transcript: string | null;
  /** Whisper's timed words, when read; undefined when not read. */
  words?: readonly TimedWord[] | null;
}

/** A later recording that used the better phrase. */
export interface SwapUse {
  repId: string;
  createdAt: string;
  /** How many times in that recording. */
  times: number;
  /** Where, on that recording's clock; null when its words were not read. */
  at: number | null;
}

/**
 * The real recordings that used a swap's better phrase, newest first:
 * stored after the swap was saved, never a recording it came from (any
 * row merged into it included). Whisper's own text finds them, never
 * inside a place the old phrase was said again; where the timed words
 * were read they must hold it too, and give the moment. The test's
 * one-line takes are never stored, so they are never here.
 */
export function usesOf(swap: Swap, takes: readonly TakeText[]): SwapUse[] {
  const out: SwapUse[] = [];
  const from = new Set(sourcesOf(swap));
  const saved = Date.parse(swap.savedAt);
  for (const t of takes) {
    if (from.has(t.id) || !(Date.parse(t.created_at) > saved)) continue;
    const times = timesIn(t.transcript, swap.better, swap.said);
    if (times === 0) continue;
    let at: number | null = null;
    if (t.words !== undefined) {
      const hit = phraseAt(t.words, swap.better, swap.said);
      if (t.words && !hit) continue;
      at = hit?.start ?? null;
    }
    out.push({ repId: t.id, createdAt: t.created_at, times, at });
  }
  return out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Every time across the later recordings: "6 times". */
export const timesUsed = (uses: readonly SwapUse[]) => uses.reduce((n, u) => n + u.times, 0);

/* ---- the glance's proof token (#509) ------------------------------------- */

/** A saved swap this take used: the moment the count moves. */
export interface Proof {
  key: string;
  said: string;
  better: string;
  /** Where the better phrase starts on the take's clock. */
  at: number;
  end: number;
}

/** The take the glance is on, as much of it as the proof line reads. */
export interface ProofTake {
  /** The stored recording; null when it was not stored, and then nothing is proof. */
  id: string | null | undefined;
  /** Whisper's text: the count reads it, so the proof must agree with it. */
  transcript: string | null | undefined;
  /** Whisper's timed words: where the phrase was said. */
  words: readonly TimedWord[] | null | undefined;
  /** When the take began. */
  startedAt: Date;
}

/**
 * The swap this take proves, if any: one saved before the take started,
 * not taken off the list, not from this take, whose better phrase is in
 * the take's text as the count reads it (never inside the old phrase said
 * again) and in its timed words for the moment, and has not been seen in
 * a real recording before (the line is said once a swap). Only a stored
 * take proves anything: "you now say" counts stored recordings, and the
 * line marks the swap heard. The earliest said wins.
 */
export function proofIn(swaps: readonly Swap[], states: SwapStates, take: ProofTake): Proof | null {
  if (!take.id) return null;
  let best: Proof | null = null;
  for (const s of swaps) {
    const st = keptState(s, states);
    if (st?.hidden || st?.heardAt) continue;
    if (!(Date.parse(s.savedAt) < take.startedAt.getTime())) continue;
    if (sourcesOf(s).includes(take.id)) continue;
    if (timesIn(take.transcript, s.better, s.said) === 0) continue;
    const hit = phraseAt(take.words, s.better, s.said);
    if (!hit) continue;
    if (!best || hit.start < best.at) best = { key: s.key, said: s.said, better: s.better, at: hit.start, end: hit.end };
  }
  return best;
}

/** A swap the glance has shown as proof, heard: its place in the test kept, only when it was heard moves. */
export function heardState(swap: Swap, states: SwapStates, at: Date = new Date()): SwapState {
  const iso = at.toISOString();
  return { ...stateOf(swap, states), heardAt: iso, at: iso };
}

/**
 * The test's states with a swap heard under every key it stands for, as
 * markHeard keeps it (the #509 review). The recorder's screen holds this
 * for its next take: it read the swaps once, as it opened, so a Retake,
 * Practice 2 of 3 or the next lesson that said the same phrase proved it
 * again, token, sound and cheer, on every take.
 */
export function heardIn(states: SwapStates, swap: Swap, at: Date = new Date()): SwapStates {
  const next = heardState(swap, states, at);
  const out: Record<string, SwapState> = { ...states };
  for (const p of partsOf(swap)) out[p.key] = next;
  return out;
}

/* ---- the words on the screens ------------------------------------------ */

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const dateOfDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** "6 times", "1 time". */
export function timesLine(n: number): string {
  return `${n} time${n === 1 ? "" : "s"}`;
}

/** When a swap is next tested: "Back tomorrow", "Back Fri", "Back 2 Dec". */
export function backLine(due: string, today: string): string {
  const n = daysBetween(today, due);
  if (n <= 0) return "Today";
  if (n === 1) return "Back tomorrow";
  const d = dateOfDay(due);
  if (n < 7) return `Back ${WEEKDAY[d.getDay()].slice(0, 3)}`;
  return `Back ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** When the next test is, on a day with none due: "Next test tomorrow", "Next test Fri". */
export function nextTestLine(due: string, today: string): string {
  return daysBetween(today, due) <= 0 ? "Next test today" : backLine(due, today).replace(/^Back /, "Next test ");
}

/** The day a recording was made, as the walk says it: "today", "yesterday", "Monday", "12 Nov". */
export function saidOn(at: string, now: Date = new Date()): string {
  const n = daysBetween(dayOf(at), dayOf(now));
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  const d = new Date(at);
  if (n < 7) return WEEKDAY[d.getDay()];
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** A recording's chip: "Mon 0:33", or "12 Nov 0:33" past a week. */
export function chipDay(at: string, now: Date = new Date()): string {
  const n = daysBetween(dayOf(at), dayOf(now));
  const d = new Date(at);
  if (n <= 0) return "Today";
  if (n < 7) return WEEKDAY[d.getDay()].slice(0, 3);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/**
 * The empty page's one line (and You's card): a new account's first, or,
 * once every one was taken off, the next. Never "first" to someone who
 * had a list.
 */
export function emptyLine(hadAny: boolean): string {
  return hadAny ? "Your next one comes from today's recording." : "Your first one comes from today's recording.";
}

/** The test's one tap: "Test 3". */
export function testLabel(n: number): string {
  return `Test ${n}`;
}

/** The end of the test, in Demos's words. */
export function endLine(said: number, of: number): string {
  if (of > 0 && said === of) return of === 1 ? "You said it out loud." : of === 2 ? "You said both out loud." : "You said all three out loud.";
  if (said === 0) return "They're back tomorrow.";
  return `You said ${said} of ${of} out loud.`;
}


/* ---- the test's one line (/api/say) --------------------------------------- */

/** What the test says when its room is spent (/api/say's 429): when to come back, never "try again" at once. */
export const SAY_LIMITED = "That's a lot of lines for now. Try again later.";

/** The longest phrase the check takes: the coach's said side (lib/upgrade.ts UPGRADE_LIMITS). */
/* 120: production holds a coach pair from before #429's 40-character rule
   whose better phrase is 71 characters (aggregate check, 18 Nov); at 60 its
   test failed every time. */
export const SAY_PHRASE_CHARS = 120;
/** A line said in under fifteen seconds is a few dozen kilobytes; a megabyte is generous. */
export const SAY_AUDIO_BYTES = 1_000_000;

/** What the check answers: whether the better phrase was heard, where, and what was heard. */
export interface LineCheck {
  heard: boolean;
  /** Where the better phrase starts in the line; null when it was not heard or has no time. */
  at: number | null;
  /** Whether the old phrase was said instead. */
  old: boolean;
  /** What Whisper heard, cut to 200 characters; empty when it heard nothing. */
  text: string;
}

/**
 * Whether one spoken line says the better phrase: Whisper's timed words
 * first, its text where the words came back empty. Pure, so the route's
 * one decision is tested without a microphone.
 */
export function checkLine(
  t: { text: string; words: readonly TimedWord[] },
  better: string,
  said: string | null
): LineCheck {
  /* Never inside the old phrase: "unique" said inside "kind of unique"
     is the old phrase again, and "good" inside "really good" when the
     better one is "really good" is the better one said. */
  const hit = phraseAt(t.words, better, said);
  const heard = !!hit || timesIn(t.text, better, said) > 0;
  const old = !!said && (!!phraseAt(t.words, said, better) || timesIn(t.text, said, better) > 0);
  return { heard, at: hit?.start ?? null, old, text: t.text.trim().slice(0, 200) };
}

/** A phrase the check will look for: words, at most SAY_PHRASE_CHARS, or null. */
export function cleanPhrase(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || s.length > SAY_PHRASE_CHARS || phraseWords(s).length === 0) return null;
  return s;
}
