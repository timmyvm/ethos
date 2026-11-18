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
}

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
 * first. A pair saved both ways is one swap: the first saved, with the
 * other's sentence and recording where it has none.
 */
export function mergeSwaps(...lists: readonly Swap[][]): Swap[] {
  const byPair = new Map<string, Swap>();
  for (const s of lists.flat()) {
    const k = pairOf(s);
    const held = byPair.get(k);
    if (!held) {
      byPair.set(k, s);
      continue;
    }
    const [first, second] = held.savedAt <= s.savedAt ? [held, s] : [s, held];
    byPair.set(k, { ...first, sentence: first.sentence ?? second.sentence, repId: first.repId ?? second.repId });
  }
  return [...byPair.values()].sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
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

export function stateOf(swap: Swap, states: SwapStates): SwapState {
  return states[swap.key] ?? freshState(swap);
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

/**
 * Today's test: the swaps still being learned whose day has come, the
 * longest waiting first, then the oldest saved; three at most. One you
 * now say is never tested: the recording already proved it.
 */
export function dueToday(views: readonly SwapView[], today: string): SwapView[] {
  return views
    .filter((v) => !v.state.hidden && !nowSays(v) && v.state.due <= today)
    .sort((a, b) => (a.state.due < b.state.due ? -1 : a.state.due > b.state.due ? 1 : a.swap.savedAt < b.swap.savedAt ? -1 : 1))
    .slice(0, DUE_A_DAY);
}

/** The next day anything is due, when nothing is due today; null when nothing is being learned. */
export function nextDue(views: readonly SwapView[], today: string): string | null {
  const days = views.filter((v) => !v.state.hidden && !nowSays(v)).map((v) => (v.state.due <= today ? today : v.state.due));
  return days.length ? days.sort()[0] : null;
}

/** The page's three lists and its number. */
export interface SayLists {
  due: SwapView[];
  nowSay: SwapView[];
  learning: SwapView[];
  /** N of M: the swaps you now say, and every swap on the list. */
  n: number;
  m: number;
}

export function sayLists(views: readonly SwapView[], today: string): SayLists {
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
 * Where `phrase` was said in Whisper's timed words: the first place its
 * words come one after another, whole words only, case, punctuation and
 * apostrophes aside. Null when it was not said.
 */
export function phraseAt(words: readonly TimedWord[] | null | undefined, phrase: string): { start: number; end: number } | null {
  const want = phraseWords(phrase);
  if (!words || want.length === 0) return null;
  const flat: { w: string; start: number; end: number }[] = [];
  for (const w of words) for (const t of phraseWords(w.word)) flat.push({ w: t, start: w.start, end: w.end });
  for (let i = 0; i + want.length <= flat.length; i++) {
    if (want.every((w, k) => flat[i + k].w === w)) return { start: flat[i].start, end: flat[i + want.length - 1].end };
  }
  return null;
}

/** The transcript's sentences: a terminator ends one unless it sits between digits ("1.5"). */
function sentencesOf(text: string): string[] {
  return text.split(/(?<!\d)[.!?…]+(?!\d)\s*/).filter((s) => s.trim());
}

/** How many times `phrase` was said in `text`, whole words inside one sentence. */
export function timesIn(text: string | null | undefined, phrase: string): number {
  const want = phraseWords(phrase);
  if (!text || want.length === 0) return 0;
  let n = 0;
  for (const s of sentencesOf(text)) {
    const t = phraseWords(s);
    for (let i = 0; i + want.length <= t.length; i++) {
      if (want.every((w, k) => t[i + k] === w)) {
        n++;
        i += want.length - 1;
      }
    }
  }
  return n;
}

/**
 * Where `phrase` stands in `sentence`, by characters, so a screen can
 * mark it: what comes before, the phrase as the sentence spells it, and
 * what comes after. Null when the sentence does not hold it.
 */
export function markIn(sentence: string, phrase: string): { before: string; match: string; after: string } | null {
  const want = phraseWords(phrase);
  if (want.length === 0) return null;
  const toks = [...fold(sentence).matchAll(WORD)].map((m) => ({ w: m[0].replace(/'/g, ""), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  for (let i = 0; i + want.length <= toks.length; i++) {
    if (want.every((w, k) => toks[i + k].w === w)) {
      const from = toks[i].start;
      const to = toks[i + want.length - 1].end;
      return { before: sentence.slice(0, from), match: sentence.slice(from, to), after: sentence.slice(to) };
    }
  }
  return null;
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
 * stored after the swap was saved, never the recording it came from.
 * Whisper's own text finds them; where the timed words were read they
 * must hold it too, and give the moment. The test's one-line takes are
 * never stored, so they are never here.
 */
export function usesOf(swap: Swap, takes: readonly TakeText[]): SwapUse[] {
  const out: SwapUse[] = [];
  for (const t of takes) {
    if (t.created_at <= swap.savedAt || t.id === swap.repId) continue;
    const times = timesIn(t.transcript, swap.better);
    if (times === 0) continue;
    let at: number | null = null;
    if (t.words !== undefined) {
      const hit = phraseAt(t.words, swap.better);
      if (t.words && !hit) continue;
      at = hit?.start ?? null;
    }
    out.push({ repId: t.id, createdAt: t.created_at, times, at });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Every time across the later recordings: "6 times". */
export const timesUsed = (uses: readonly SwapUse[]) => uses.reduce((n, u) => n + u.times, 0);

/* ---- the glance's proof line -------------------------------------------- */

/** A saved swap this take used: the moment the count moves. */
export interface Proof {
  key: string;
  said: string;
  better: string;
  /** Where the better phrase starts on the take's clock. */
  at: number;
  end: number;
}

/**
 * The swap this take proves, if any: one saved before the take started,
 * not taken off the list, whose better phrase is in the take's timed
 * words and has not been seen in a real recording before (the line is
 * said once a swap). The earliest said wins.
 */
export function proofIn(
  swaps: readonly Swap[],
  states: SwapStates,
  words: readonly TimedWord[] | null | undefined,
  takeStarted: Date
): Proof | null {
  let best: Proof | null = null;
  for (const s of swaps) {
    const st = states[s.key];
    if (st?.hidden || st?.heardAt) continue;
    if (new Date(s.savedAt).getTime() >= takeStarted.getTime()) continue;
    const hit = phraseAt(words, s.better);
    if (!hit) continue;
    if (!best || hit.start < best.at) best = { key: s.key, said: s.said, better: s.better, at: hit.start, end: hit.end };
  }
  return best;
}

/**
 * The proof line's words as the ceiling counts them: whole, "the thing is
 * → ✓ the point is 0:14", or short, the struck phrase dropped first
 * ("✓ the point is 0:14").
 */
export function proofWords(p: Proof, form: "full" | "short"): string {
  const tail = `✓ ${p.better} ${clock(p.at)}`;
  return form === "full" ? `${p.said} → ${tail}` : tail;
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

/** The longest phrase the check takes: the coach's said side (lib/upgrade.ts UPGRADE_LIMITS). */
export const SAY_PHRASE_CHARS = 60;
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
  const hit = phraseAt(t.words, better);
  const heard = !!hit || timesIn(t.text, better) > 0;
  const old = !!said && (!!phraseAt(t.words, said) || timesIn(t.text, said) > 0);
  return { heard, at: hit?.start ?? null, old, text: t.text.trim().slice(0, 200) };
}

/** A phrase the check will look for: words, at most SAY_PHRASE_CHARS, or null. */
export function cleanPhrase(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || s.length > SAY_PHRASE_CHARS || phraseWords(s).length === 0) return null;
  return s;
}
