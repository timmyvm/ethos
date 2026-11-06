/**
 * A game round, measured (the games plan, items 3 and 10; proposals F2
 * and M1).
 *
 * The phone says what it ran: which game, which level, when Demos cut in
 * and with what line, and whether you or the clock stopped it. This file
 * measures what happened against that, from Whisper's word times and the
 * engine's own thresholds, and says whether the round COUNTS toward the
 * ladder (lib/ladder.ts). Pure: the analyze route runs it on the server
 * right after the pause report and stores the result in `reps.round`
 * (migration 0026).
 *
 * Every fact is a timestamp, a duration or a count. No threshold here is
 * new: a held silence is the engine's HELD_MIN_S, a breath its
 * BEAT_MIN_S, dead air its DEAD_AIR_S, a filler leaning on a silence its
 * FILLER_ADJACENCY_S, and a scorable take is `isScorable`'s. Stars and the
 * Index never change by level; a level changes only the staging, and the
 * same bar stands at every one of them.
 *
 * What the server can check, it does (M1): a cut-in past the take's end
 * is dropped, a Speed rush round that ran more than a second past its
 * level's clock is filed at the level whose clock it fits, and a Q&A
 * round whose first cut-in came at level 1's time is filed at level 1.
 * What it cannot (Interview's hidden question), it takes on trust, and a
 * forgery lies only to its author.
 */

import { classifyGap, type Envelope } from "./envelope";
import {
  clampLevel,
  gameById,
  gameLevel,
  levelCapS,
  type Game,
  type LevelN,
} from "./games";
import { BEAT_MIN_S, HELD_MIN_S, type FillerHit, type Word } from "./metrics";
import { DEAD_AIR_S, FILLER_ADJACENCY_S } from "./pause-quality";

export type GameId = "qa" | "rush" | "interview";
export type StoppedBy = "you" | "clock";

/**
 * What the silence after a cut-in did (F2):
 * - `held`: 0.8 to 3.5s, nothing leaning on it. The one that counts.
 * - `breath`: 0.3s up to 0.8s.
 * - `filled`: a filler within 1.2s of either edge, or a sound the mic heard in it.
 * - `long`: past 3.5s.
 * - `through`: under 0.3s, or no gap at all: you kept talking.
 * - `missed`: the level staged a cut-in that never came (you stopped first).
 */
export type CutInVerdict = "held" | "breath" | "filled" | "long" | "through" | "missed";

/** One staged cut-in and the silence after it. Seconds into the take throughout. */
export interface CutInFact {
  /** When Demos cut in; null when this staged cut-in never fired. */
  at: number | null;
  /** What he said. */
  line: string | null;
  /** The longest silence after him, measured from the cut-in; null when none. */
  gap: number | null;
  /** Where that silence sat: from (the cut-in or the silence's start, the later) to its end. */
  gapFrom: number | null;
  gapTo: number | null;
  verdict: CutInVerdict;
  /** The filler that broke it, or where the mic heard a sound in it. */
  fillerAt: number | null;
  /** The filler's word; null when only the mic heard it. */
  fillerWord: string | null;
  /** Seconds from the silence's end to the next filler, or to your last word. */
  cleanAfter: number | null;
  /** Your last word's end minus the cut-in: how long you kept going. */
  spokeAfter: number | null;
}

interface RoundBase {
  /** The shape of this record, so a later one can be told apart. */
  v: 1;
  /** The level the round is filed at, after the server's checks. */
  level: LevelN;
  /** The level's clock, seconds. */
  cap: number;
  durationS: number;
  stoppedBy: StoppedBy;
  /** Your last word's end; null with no words. */
  lastWord: number | null;
  stars: number;
  scorable: boolean;
  /** The engine measured the game's one thing, with two stars and a scorable take. */
  counted: boolean;
  /**
   * This round's bid for the level's best (M4): Q&A, seconds clean after
   * the cut-in (the shorter run at level 3), when every cut-in was held;
   * Interview, the Index. Speed rush's best is a run of rounds, kept by
   * the ladder, so null here.
   */
  best: number | null;
}

export interface QaRound extends RoundBase {
  game: "qa";
  /** One per cut-in the level stages, in order. */
  cutIns: CutInFact[];
}

export interface RushRound extends RoundBase {
  game: "rush";
  /** Seconds left on the clock at your last word; 0 when it ran out. */
  spare: number | null;
  /** You stopped it, at least 0.5s before the clock and at or after half of it. */
  landed: boolean;
}

export interface InterviewRound extends RoundBase {
  game: "interview";
  /** When you started talking. */
  firstWord: number | null;
  /** Last word between 60.0 and 89.5s. */
  inWindow: boolean;
  /** The first number in your last sentence ("30 percent"), or null. */
  numberAtEnd: string | null;
  /** Level 3's follow-up; empty at levels 1 and 2. */
  cutIns: CutInFact[];
}

export type GameRound = QaRound | RushRound | InterviewRound;

// --- the bars (all of them the engine's, or the game's stated rule) ----

/** The silence after a cut-in must start before this many seconds past it. */
export const CUT_IN_WINDOW_S = 3.0;
/** ...and end at least this far past it: a silence that ends as he speaks is not a reply. */
export const CUT_IN_SETTLE_S = 0.1;
/** A cut-in earlier than this is not one the phone stages. */
export const CUT_IN_MIN_S = 1;
/** A cut-in in the take's last half second cannot be answered. */
export const CUT_IN_TAIL_S = 0.5;
/** Q&A: you kept going at least this long after his (last) cut-in. */
export const SPOKE_AFTER_MIN_S = 5;
/** Speed rush: your last word at least this far inside the clock. */
export const RUSH_MARGIN_S = 0.5;
/** Speed rush: a round that ran this far past its clock is filed at a level it fits. */
export const RUSH_OVERRUN_S = 1;
/** Interview: the window your last word lands in. */
export const INTERVIEW_WINDOW: [number, number] = [60, 89.5];
/** Two stars or more (under 6 disfluencies a minute) for any round to count. */
export const MIN_STARS_TO_COUNT = 2;

/** Is `at` a cut-in this take could have heard and answered? */
export function validCutIn(at: number, durationS: number): boolean {
  return (
    Number.isFinite(at) && at >= CUT_IN_MIN_S && at <= durationS - CUT_IN_TAIL_S
  );
}

// --- what the phone sends ----------------------------------------------

export interface CutInClaim {
  at: number;
  line: string;
}

/** The `round` form field, parsed. Nothing in it is trusted past its shape. */
export interface RoundClaim {
  game: string | null;
  level: LevelN;
  cutIns: CutInClaim[];
  stoppedBy: StoppedBy | null;
}

const MAX_CUT_INS = 4;
const MAX_LINE = 80;

/**
 * The `round` form field: JSON `{ game, level, cutIns: [{ at, line }],
 * stoppedBy }`. Malformed is null, never half-parsed; a malformed cut-in
 * is dropped on its own.
 */
export function parseRoundField(raw: unknown): RoundClaim | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4000) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const cutIns: CutInClaim[] = [];
  if (Array.isArray(o.cutIns)) {
    for (const c of o.cutIns.slice(0, MAX_CUT_INS)) {
      if (!c || typeof c !== "object") continue;
      const at = Number((c as Record<string, unknown>).at);
      const line = (c as Record<string, unknown>).line;
      if (!Number.isFinite(at)) continue;
      cutIns.push({
        at: round2(at),
        line: typeof line === "string" ? line.trim().slice(0, MAX_LINE) : "",
      });
    }
  }
  cutIns.sort((a, b) => a.at - b.at);
  return {
    game: typeof o.game === "string" ? o.game : null,
    level: clampLevel(o.level),
    cutIns,
    stoppedBy: o.stoppedBy === "you" || o.stoppedBy === "clock" ? o.stoppedBy : null,
  };
}

/** Did Demos cut in, on this take? What Interruption's XP waits for (F2). */
export function cutInFired(claim: RoundClaim | null, durationS: number): boolean {
  return !!claim && claim.cutIns.some((c) => validCutIn(c.at, durationS));
}

// --- the measure -------------------------------------------------------

export interface RoundInput {
  game: string;
  /** The level the phone says it ran; clamped, then checked. */
  level: unknown;
  cutIns: CutInClaim[];
  stoppedBy?: StoppedBy | null;
  /** Whisper's words with their times. */
  words: Word[];
  /** The engine's fillers (`metrics.fillers`). */
  fillers: FillerHit[];
  durationS: number;
  stars: number;
  scorable: boolean;
  /** The take's Ethos Index, when it has one: Interview's best. */
  index?: number | null;
  /** The mic's envelope, when sent: a sound in a silence the transcript shows empty. */
  envelope?: Envelope | null;
}

/** The round, measured; null when `game` is not one of the three. */
export function measureRound(input: RoundInput): GameRound | null {
  const game = gameById(input.game);
  if (!game) return null;
  const durationS = round2(Math.max(0, input.durationS));
  const words = [...input.words]
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end))
    .sort((a, b) => a.start - b.start);
  const lastWord = words.length ? round2(words[words.length - 1].end) : null;
  const cutIns = input.cutIns
    .filter((c) => validCutIn(c.at, durationS))
    .sort((a, b) => a.at - b.at);
  const ctx: Ctx = {
    words,
    fillers: [...input.fillers].sort((a, b) => a.t - b.t),
    durationS,
    lastWord,
    envelope: input.envelope ?? null,
  };
  const twoStars = input.stars >= MIN_STARS_TO_COUNT && input.scorable;
  const common = {
    v: 1 as const,
    durationS,
    lastWord,
    stars: input.stars,
    scorable: input.scorable,
  };

  if (game.id === "qa") {
    let level = clampLevel(input.level);
    // Level 1's cut-in comes by 0:20; one at 0:21 or later ran level 1.
    const lateFirst = gameLevel(game, 1).cutIns[0][1] + 1;
    if (level > 1 && cutIns.length > 0 && cutIns[0].at >= lateFirst) level = 1;
    const facts = stagedFacts(game, level, cutIns, ctx);
    const allHeld = facts.length > 0 && facts.every((f) => f.verdict === "held");
    const last = facts[facts.length - 1];
    const counted =
      allHeld && (last?.spokeAfter ?? 0) >= SPOKE_AFTER_MIN_S && twoStars;
    const cap = levelCapS(game, level);
    return {
      ...common,
      game: "qa",
      level,
      cap,
      stoppedBy: input.stoppedBy ?? inferStop(durationS, cap),
      cutIns: facts,
      counted,
      best: allHeld ? Math.min(...facts.map((f) => f.cleanAfter ?? 0)) : null,
    };
  }

  if (game.id === "rush") {
    const level = rushLevel(game, clampLevel(input.level), durationS);
    const cap = levelCapS(game, level);
    const stoppedBy = input.stoppedBy ?? inferStop(durationS, cap);
    const landed =
      stoppedBy === "you" &&
      lastWord !== null &&
      lastWord <= cap - RUSH_MARGIN_S &&
      lastWord >= cap / 2;
    return {
      ...common,
      game: "rush",
      level,
      cap,
      stoppedBy,
      spare: lastWord === null ? null : Math.max(0, round2(cap - lastWord)),
      landed,
      counted: landed && twoStars,
      best: null,
    };
  }

  // Interview.
  const level = clampLevel(input.level);
  const cap = levelCapS(game, level);
  const facts = stagedFacts(game, level, cutIns, ctx);
  const followUp = facts.every((f) => f.at !== null);
  const inWindow =
    lastWord !== null &&
    lastWord >= INTERVIEW_WINDOW[0] &&
    lastWord <= INTERVIEW_WINDOW[1];
  return {
    ...common,
    game: "interview",
    level,
    cap,
    stoppedBy: input.stoppedBy ?? inferStop(durationS, cap),
    firstWord: words.length ? round2(words[0].start) : null,
    inWindow,
    numberAtEnd: numberInLastSentence(words),
    cutIns: facts,
    counted: inWindow && twoStars && followUp,
    best: input.scorable && typeof input.index === "number" ? input.index : null,
  };
}

interface Ctx {
  words: Word[];
  fillers: FillerHit[];
  durationS: number;
  lastWord: number | null;
  envelope: Envelope | null;
}

/** With no word from the phone, the clock stopped it when the take ran to its cap. */
function inferStop(durationS: number, cap: number): StoppedBy {
  return durationS >= cap - 0.3 ? "clock" : "you";
}

/** A Speed rush round that ran past its level's clock is filed at the highest level it fits. */
function rushLevel(game: Game, claimed: LevelN, durationS: number): LevelN {
  if (durationS <= levelCapS(game, claimed) + RUSH_OVERRUN_S) return claimed;
  for (const n of [3, 2, 1] as const) {
    if (durationS <= levelCapS(game, n) + RUSH_OVERRUN_S) return n;
  }
  return 1;
}

/** One fact per cut-in the level stages: measured when it came, `missed` when it never did. */
function stagedFacts(
  game: Game,
  level: LevelN,
  cutIns: CutInClaim[],
  ctx: Ctx
): CutInFact[] {
  const staged = gameLevel(game, level).cutIns.length;
  return Array.from({ length: staged }, (_, i) =>
    cutIns[i] ? cutInFact(cutIns[i], ctx) : MISSED
  );
}

const MISSED: CutInFact = {
  at: null,
  line: null,
  gap: null,
  gapFrom: null,
  gapTo: null,
  verdict: "missed",
  fillerAt: null,
  fillerWord: null,
  cleanAfter: null,
  spokeAfter: null,
};

/**
 * The silence after one cut-in (F2). Every gap between consecutive words
 * that ends after `at + 0.1` and starts before `at + 3.0`, each measured
 * from the later of its own start and the cut-in, because a silence you
 * were already in is not a reply. The longest one is the answer's.
 *
 * When no word follows the cut-in at all, the silence runs to the take's
 * end: you stopped talking when he cut in, and that silence is measured
 * the same way (and `spokeAfter` says you never came back). The take's
 * start counts as a word's end, so a cut-in forced into the quiet before
 * your first word is measured from him to that word, like any gap.
 */
function cutInFact(c: CutInClaim, ctx: Ctx): CutInFact {
  const { words, fillers, durationS, lastWord } = ctx;
  const at = c.at;
  let best: { from: number; to: number; len: number } | null = null;
  const consider = (start: number, end: number) => {
    if (!(end > at + CUT_IN_SETTLE_S && start < at + CUT_IN_WINDOW_S)) return;
    const from = Math.max(start, at);
    const len = round2(end - from);
    if (len > 0 && (!best || len > best.len)) best = { from, to: end, len };
  };
  if (words.length > 0) consider(0, words[0].start);
  for (let i = 0; i < words.length - 1; i++) {
    consider(words[i].end, words[i + 1].start);
  }
  const replied = words.some((w) => w.start > at + CUT_IN_SETTLE_S);
  if (!replied) consider(lastWord ?? 0, durationS);
  const gap = best as { from: number; to: number; len: number } | null;

  let verdict: CutInVerdict;
  let fillerAt: number | null = null;
  let fillerWord: string | null = null;
  if (!gap || gap.len < BEAT_MIN_S) {
    verdict = "through";
  } else {
    const leaning = nearestFiller(fillers, gap.from, gap.to);
    if (leaning) {
      verdict = "filled";
      fillerAt = leaning.t;
      fillerWord = leaning.word;
    } else if (ctx.envelope && classifyGap(ctx.envelope, gap.from, gap.to) === "voiced") {
      // The mic heard a sound the transcript has no word for (lib/envelope.ts).
      verdict = "filled";
      fillerAt = round2(gap.from);
    } else if (gap.len > DEAD_AIR_S) {
      verdict = "long";
    } else if (gap.len >= HELD_MIN_S) {
      verdict = "held";
    } else {
      verdict = "breath";
    }
  }

  const cleanFrom = gap ? gap.to : at;
  const next = fillers.find((f) => f.t >= cleanFrom - 1e-6);
  const cleanTo = next ? next.t : lastWord;
  return {
    at,
    line: c.line || null,
    gap: gap ? gap.len : null,
    gapFrom: gap ? round2(gap.from) : null,
    gapTo: gap ? round2(gap.to) : null,
    verdict,
    fillerAt,
    fillerWord,
    cleanAfter: cleanTo === null ? null : Math.max(0, round2(cleanTo - cleanFrom)),
    spokeAfter: lastWord === null ? 0 : Math.max(0, round2(lastWord - at)),
  };
}

/** The filler nearest either edge of a silence, within FILLER_ADJACENCY_S. */
function nearestFiller(fillers: FillerHit[], from: number, to: number): FillerHit | null {
  let hit: FillerHit | null = null;
  let bestD = Infinity;
  for (const f of fillers) {
    const d = round2(Math.min(Math.abs(f.t - from), Math.abs(f.t - to)));
    if (d <= FILLER_ADJACENCY_S && d < bestD) {
      hit = f;
      bestD = d;
    }
  }
  return hit;
}

// --- a number at the end (Interview) ------------------------------------

const NUMBER_WORDS = new Set([
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
  "seventy", "eighty", "ninety", "hundred", "thousand", "million", "percent",
  "half", "twice", "double",
]);
/** Words that carry a number on: "30 percent", "two per cent". */
const NUMBER_TAIL = new Set(["percent", "per", "cent", "%"]);

const SENTENCE_END = /[.?!]["')\]]*\s*$/;

function bare(token: string): string {
  return token.toLowerCase().replace(/^[^\w$%]+|[^\w%]+$/g, "");
}

function isNumberToken(token: string): boolean {
  const t = bare(token);
  if (!t) return false;
  if (/\d/.test(t)) return true;
  return t.split("-").every((part) => NUMBER_WORDS.has(part));
}

/**
 * The first number in your last sentence, as you said it ("30 percent",
 * "twenty five", "$40"), or null (M1: a digit run, or a number word from
 * one to twenty, the tens, hundred, thousand, million, percent, half,
 * twice, double). The last sentence is the words after the last full
 * stop, question or exclamation mark before your final word.
 */
export function numberInLastSentence(words: Word[]): string | null {
  if (words.length === 0) return null;
  let i = words.length - 2;
  while (i >= 0 && !SENTENCE_END.test(words[i].word)) i--;
  const tokens = words.slice(i + 1).map((w) => w.word.trim()).filter(Boolean);
  const first = tokens.findIndex(isNumberToken);
  if (first < 0) return null;
  let end = first + 1;
  while (
    end < tokens.length &&
    !SENTENCE_END.test(tokens[end - 1]) &&
    (isNumberToken(tokens[end]) || NUMBER_TAIL.has(bare(tokens[end])))
  ) {
    end++;
  }
  const phrase = tokens.slice(first, end).join(" ");
  return phrase.replace(/[^\w%]+$/, "") || null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
