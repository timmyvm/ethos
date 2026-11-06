/**
 * What a game round says after Stop (the games plan, items 4, 5, 6, 8,
 * 11 and 13; proposal-feel F3, F6a, F7 and proposal-mastery M4, M5).
 *
 * Every string here reads a number off the measured round (lib/round.ts)
 * or the ladder (lib/ladder.ts): a timestamp, a duration, a count. Nothing
 * is said about a cut-in that did not come, and nothing here moves a star,
 * the Index or a threshold. Pure, so each line is tested where it is
 * written (lib/round-copy.test.ts), the copy rules included.
 */

import { gameLevel, type Game, type LevelN } from "./games";
import type { LadderRow, LadderState } from "./ladder";
import { BEAT_MIN_S, HELD_MIN_S, MIN_WORDS_TO_SCORE } from "./metrics";
import { DEAD_AIR_S } from "./pause-quality";
import type { RewardMoment } from "./rewards";
import {
  INTERVIEW_WINDOW,
  RUSH_MARGIN_S,
  SPOKE_AFTER_MIN_S,
  type CutInFact,
  type GameRound,
  type InterviewRound,
  type QaRound,
  type RushRound,
  type StoppedBy,
} from "./round";

// --- numbers as the screen writes them ---------------------------------

/** m:ss, whole seconds down: 17.8 reads "0:17", as a clock does. */
export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** m:ss.s, to the tenth: "0:27.4". */
export function clockTenth(t: number): string {
  const tenths = Math.max(0, Math.round(t * 10));
  const s = Math.floor(tenths / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${tenths % 10}`;
}

/** Seconds to one decimal: "1.2s". */
export function secs(t: number): string {
  return `${(Math.round(t * 10) / 10).toFixed(1)}s`;
}

/** A run of seconds, whole once it is long: "22s", "8.5s". */
function run(t: number): string {
  return t >= 10 ? `${Math.round(t)}s` : secs(t);
}

/** "An “um”", "A “like”". */
function quoted(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "An" : "A"} “${word}”`;
}

// --- the round card (F3) -------------------------------------------------

/** What the round card shows, top to bottom. */
export interface RoundReveal {
  game: GameRound["game"];
  eyebrow: string;
  /** The round's one number ("1.2s", "2.6s", "1:14"); null when there is none. */
  number: string | null;
  /** The number behind it, for the roll. */
  value: number;
  /** Beside the number: what it measures ("held after he cut in"). */
  note: string | null;
  /** One sentence under it, when one helps. */
  line: string | null;
  /** The game's one thing, done: sage, and the round's one sound (F5). */
  win: boolean;
}

/**
 * The cut-in that decides a Q&A round: the first one not held, else the
 * shortest held. Null when he never got in.
 */
export function decidingCutIn(round: QaRound | InterviewRound): CutInFact | null {
  const fired = round.cutIns.filter((f) => f.at !== null);
  if (fired.length === 0) return null;
  const miss = fired.find((f) => f.verdict !== "held");
  if (miss) return miss;
  return fired.reduce((a, b) => ((b.gap ?? 0) < (a.gap ?? 0) ? b : a));
}

/** The take's measured silence after the cut-in, as written. */
function gapNumber(f: CutInFact): string {
  if (f.verdict === "through" || f.gap === null || f.gap < BEAT_MIN_S) return `<${BEAT_MIN_S}s`;
  return secs(f.gap);
}

/**
 * What a screen reader hears for Q&A's strip: each cut-in and the silence
 * after it, rounded as the card writes the number ("1.2s", "<0.3s").
 */
export function stripLabel(facts: readonly CutInFact[]): string {
  return facts
    .filter((f) => f.at !== null)
    .map((f) => {
      const n = gapNumber(f);
      const silence = n.startsWith("<")
        ? `under ${BEAT_MIN_S} seconds of silence`
        : `${n.slice(0, -1)} seconds of silence`;
      return `Demos cut in at ${Math.floor(f.at as number)} seconds, then ${silence}`;
    })
    .join(". ");
}

/** What a Q&A verdict says under its number (F, "Every new string"). */
function verdictLine(f: CutInFact): string | null {
  switch (f.verdict) {
    case "breath":
      return `Held starts at ${HELD_MIN_S}s.`;
    case "filled":
      return f.fillerAt === null
        ? null
        : f.fillerWord
          ? `${quoted(f.fillerWord)} at ${clock(f.fillerAt)} broke it.`
          : `A sound at ${clock(f.fillerAt)} broke it.`;
    case "long":
      return `Past ${DEAD_AIR_S}s, a pause reads as lost.`;
    case "through":
      return "You kept talking through him.";
    default:
      return null;
  }
}

/** Where a level's first cut-in can come, for a round he never reached. */
function firstAim(game: Game, level: LevelN): number | null {
  return gameLevel(game, level).cutIns[0]?.[0] ?? null;
}

function qaReveal(game: Game, round: QaRound, heldRun: number): RoundReveal {
  const fired = round.cutIns.filter((f) => f.at !== null);
  const stoppedAt = round.lastWord ?? round.durationS;
  if (fired.length === 0) {
    const aim = firstAim(game, round.level);
    return {
      game: "qa",
      eyebrow: "Demos didn't get in",
      number: null,
      value: 0,
      note: null,
      line:
        aim === null
          ? `You stopped at ${clock(stoppedAt)}.`
          : `You stopped at ${clock(stoppedAt)}. He cuts in after ${clock(aim)}.`,
      win: false,
    };
  }
  const f = decidingCutIn(round) as CutInFact;
  const allHeld = fired.every((x) => x.verdict === "held");
  const missedLater = round.cutIns.some((x) => x.at === null);
  /* Plan item 3: held after each cut-in, and you kept talking. */
  const keptTalking = (fired[fired.length - 1].spokeAfter ?? 0) >= SPOKE_AFTER_MIN_S;
  const eyebrow =
    fired.length === 1
      ? `Demos cut in at ${clock(fired[0].at as number)}`
      : `Demos cut in at ${clock(fired[0].at as number)} and ${clock(fired[1].at as number)}`;

  let line: string | null;
  if (f.verdict !== "held") {
    line = verdictLine(f);
  } else if (missedLater) {
    line = `You stopped at ${clock(stoppedAt)}, before he cut in again.`;
  } else if (allHeld && !keptTalking) {
    const last = fired[fired.length - 1];
    line = `You stopped ${Math.round(last.spokeAfter ?? 0)}s after he cut in.`;
  } else if (fired.length > 1) {
    line = `Both held: ${fired.map((x) => secs(x.gap ?? 0)).join(" and ")}.`;
  } else if (heldRun >= 2) {
    line = `You've held ${heldRun} in a row.`;
  } else if (f.cleanAfter !== null && f.cleanAfter >= 1) {
    line = `You spoke ${run(f.cleanAfter)} clean after it.`;
  } else {
    line = null;
  }

  return {
    game: "qa",
    eyebrow,
    number: gapNumber(f),
    value: f.gap ?? 0,
    note: f.verdict === "held" ? "held after he cut in" : "after he cut in",
    line,
    win: round.scorable && allHeld && !missedLater && keptTalking,
  };
}

function rushReveal(round: RushRound): RoundReveal {
  const eyebrow = `${round.cap} seconds`;
  const short = !round.scorable || round.lastWord === null;
  if (round.stoppedBy === "clock" || round.lastWord === null) {
    return {
      game: "rush",
      eyebrow,
      number: clock(round.cap),
      value: round.cap,
      note: "the clock stopped you",
      line: short
        ? `It takes ${MIN_WORDS_TO_SCORE} words to count.`
        : `Last word at ${clockTenth(round.lastWord as number)}.`,
      win: false,
    };
  }
  const spare = round.spare ?? Math.max(0, round.cap - round.lastWord);
  const win = round.landed && round.scorable;
  let line: string;
  if (short) line = `It takes ${MIN_WORDS_TO_SCORE} words to count.`;
  else if (round.lastWord < round.cap / 2) {
    // Level 1's half is 22.5s: never "0:22", a time a 22.3s round passed.
    const half = round.cap / 2;
    line = `A round counts from ${Number.isInteger(half) ? clock(half) : clockTenth(half)}.`;
  }
  else if (spare < RUSH_MARGIN_S) line = `A round needs ${RUSH_MARGIN_S}s to spare.`;
  else line = `Last word at ${clockTenth(round.lastWord)}.`;
  return { game: "rush", eyebrow, number: secs(spare), value: spare, note: "to spare", line, win };
}

function interviewReveal(round: InterviewRound): RoundReveal {
  const [lo, hi] = INTERVIEW_WINDOW;
  const eyebrow = `${clock(lo)} to ${clock(round.cap)}`;
  const last = round.lastWord;
  if (!round.scorable || last === null) {
    return {
      game: "interview",
      eyebrow,
      number: clock(last ?? round.durationS),
      value: last ?? round.durationS,
      note: null,
      line: `It takes ${MIN_WORDS_TO_SCORE} words to count.`,
      win: false,
    };
  }
  if (round.inWindow) {
    return {
      game: "interview",
      eyebrow,
      number: clock(last),
      value: last,
      note: "inside the window",
      line: round.numberAtEnd
        ? `Your last sentence had a number: “${round.numberAtEnd}”.`
        : round.level > 1 && round.firstWord !== null
          ? `First word at ${clock(round.firstWord)}.`
          : null,
      win: true,
    };
  }
  if (last < lo) {
    const short = Math.max(1, Math.round(lo - last));
    return {
      game: "interview",
      eyebrow,
      number: clock(last),
      value: last,
      note: `under ${clock(lo)}`,
      line: `${short} second${short === 1 ? "" : "s"} short.`,
      win: false,
    };
  }
  // Past 1:29.5: the clock's, or a last word on the window's edge, to the
  // tenth, so 1:29.7 never reads "1:29" beside "past 1:29".
  return {
    game: "interview",
    eyebrow,
    number: round.stoppedBy === "clock" ? clock(round.cap) : clockTenth(last),
    value: round.stoppedBy === "clock" ? round.cap : last,
    note: round.stoppedBy === "clock" ? "the clock stopped you" : `past ${clockTenth(hi)}`,
    line: round.stoppedBy === "clock" ? `Last word at ${clockTenth(last)}.` : null,
    win: false,
  };
}

/**
 * The round card's words. `heldRun` is how many Q&A rounds in a row,
 * this one included, held every cut-in (`heldInARow`).
 */
export function roundReveal(game: Game, round: GameRound, heldRun = 0): RoundReveal {
  if (round.game === "qa") return qaReveal(game, round, heldRun);
  if (round.game === "rush") return rushReveal(round);
  return interviewReveal(round);
}

/** Did the reveal land the game's one thing (F5: the one sound's condition)? */
export function roundWon(game: Game, round: GameRound): boolean {
  return roundReveal(game, round).win;
}

/**
 * Q&A rounds in a row, newest back, that held every cut-in that came.
 * A round he never got into is skipped; the first that did not hold ends
 * the run. `rows` in any order.
 */
export function heldInARow(rows: readonly LadderRow[]): number {
  const qa = rows
    .filter((r) => r.round?.game === "qa")
    .map((r) => ({ t: new Date(r.created_at).getTime(), round: r.round as QaRound }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t);
  let n = 0;
  for (const { round } of qa) {
    const fired = round.cutIns.filter((f) => f.at !== null);
    if (fired.length === 0) continue;
    if (!fired.every((f) => f.verdict === "held")) break;
    n++;
  }
  return n;
}

// --- the XP line ---------------------------------------------------------

/** XP a recording pays, the server's own sum (lib/db.ts XP_PER_REP). */
export const XP_PER_RECORDING = 10;

/** "×2", "×2.5", "×1.88". */
function times(m: number): string {
  return `×${Math.round(m * 100) / 100}`;
}

/**
 * The XP line that closes the round card: what was paid ("+20 XP") and
 * what multiplied it ("×2 for the cut-in"), from the stored multiplier
 * and mods. No note at ×1.
 */
export function xpLine(p: {
  gameId: GameRound["game"];
  xpMultiplier: number;
  mods: readonly string[];
  level: LevelN;
}): { amount: string; note: string | null } {
  const mult = Number.isFinite(p.xpMultiplier) && p.xpMultiplier > 0 ? p.xpMultiplier : 1;
  const amount = `+${Math.max(1, Math.round(XP_PER_RECORDING * mult))} XP`;
  if (Math.abs(mult - 1) < 0.005) return { amount, note: null };
  const why: string[] = [];
  for (const id of p.mods) {
    if (id === "interrupt") why.push(p.gameId === "interview" ? "the follow-up" : "the cut-in");
    else if (id === "tight") why.push("the tight timer");
    else if (id === "crowd") why.push("the crowd");
    else if (id === "no-notes") why.push("no notes");
  }
  const at = p.level > 1 ? ` at level ${p.level}` : "";
  if (why.length) return { amount, note: `${times(mult)} for ${why.join(" and ")}${at}` };
  return { amount, note: p.level > 1 ? `${times(mult)} for level ${p.level}` : times(mult) };
}

// --- the walk around it -------------------------------------------------

/** The results header (F6a): "Q&A, round 3"; round 1 is the name alone. */
export function roundHeader(name: string, roundsToday: number): string {
  return roundsToday >= 2 ? `${name}, round ${roundsToday}` : name;
}

/**
 * The scoring wait's one line (F7), from what the phone knows at Stop:
 * when Demos cut in, or who stopped the clock. Null for a recording that
 * is not a game.
 */
export function waitFact(p: {
  gameId: string | null;
  /** The level stages a cut-in (Q&A, Interview's follow-up). */
  cutInStaged: boolean;
  cutIns: readonly number[];
  stoppedBy: StoppedBy;
  seconds: number;
}): string | null {
  if (!p.gameId) return null;
  if (p.cutInStaged) {
    const at = [...p.cutIns].sort((a, b) => a - b).slice(0, 2);
    if (at.length === 0) return "Demos didn't get in.";
    return `Demos cut in at ${at.map(clock).join(" and ")}.`;
  }
  return p.stoppedBy === "clock"
    ? `The clock stopped it at ${clock(p.seconds)}.`
    : `You stopped it at ${clock(p.seconds)}.`;
}

/** What the last step's Tomorrow says for a game round (M5). */
export interface LadderView {
  /** "Q&A, level 2". */
  head: string;
  /** "1 of 2 counted. One more on another day opens level 3." */
  line: string;
  /** The game's rule, once, when this round did not count. */
  rule: string | null;
  /** A level opened or the game was mastered: the closing Moment, with emphasis. */
  moment: RewardMoment | null;
}

const WORD = ["Zero", "One", "Two", "Three"] as const;

/**
 * The ladder after this round, against where it stood before it. `before`
 * is null when the history before the take could not be read: then
 * nothing is said to have opened. `counted` is this round's verdict, null
 * when the round was not measured.
 */
export function ladderView(
  game: Game,
  before: LadderState | null,
  after: LadderState,
  counted: boolean | null
): LadderView {
  const head = `${game.name}, level ${after.open}`;
  let line: string;
  if (after.mastered) {
    line = `${after.of} of ${after.of} days at three stars.`;
  } else if (after.open === 3) {
    const left = after.of - after.counted;
    const rest =
      after.counted === 0
        ? `${WORD[after.of]} on ${WORD[after.of].toLowerCase()} different days master ${game.name}.`
        : left === 1
          ? `One more${after.countedToday ? " on another day" : ""} masters ${game.name}.`
          : `${WORD[left]} more${after.countedToday ? " on other days" : ""} master ${game.name}.`;
    line = `${after.counted} of ${after.of} days at three stars. ${rest}`;
  } else {
    const nextLevel = after.open + 1;
    line =
      after.counted === 0
        ? `0 of ${after.of} counted. Two on two different days open level ${nextLevel}.`
        : `${after.counted} of ${after.of} counted. One more${
            after.countedToday ? " on another day" : ""
          } opens level ${nextLevel}.`;
  }

  let moment: RewardMoment | null = null;
  if (before && after.mastered && !before.mastered) {
    moment = {
      headline: `${game.name} mastered`,
      detail: "Three days at level 3, three stars each.",
      tone: "earned",
    };
  } else if (before && after.open > before.open) {
    moment = {
      headline: `Level ${after.open} is open`,
      detail: gameLevel(game, after.open).condition,
      tone: "earned",
    };
  }
  return { head, line, rule: counted === false ? game.countsWhen : null, moment };
}

/** The level's best, as the record line writes it (M4). */
function bestText(gameId: string, level: LevelN, v: number): string {
  if (gameId === "qa") return run(v);
  if (gameId === "rush") return String(v);
  return `${v} at level ${level}`;
}

/**
 * "Best round yet" (M4), when this round beat the level's best from
 * before the take. Nothing when there was no best to beat: a first round
 * sets one, it breaks nothing.
 */
export function bestMoment(p: {
  gameId: string;
  level: LevelN;
  before: number | null;
  now: number | null;
}): RewardMoment | null {
  if (p.before === null || p.now === null || !(p.now > p.before)) return null;
  let a = bestText(p.gameId, p.level, p.now);
  let b = bestText(p.gameId, p.level, p.before);
  if (p.gameId === "qa" && a === b) {
    a = secs(p.now);
    b = secs(p.before);
  }
  const detail =
    p.gameId === "qa"
      ? `${a} clean after the cut-in, past your ${b}`
      : p.gameId === "rush"
        ? `${a} landed in a row, past your ${b}`
        : `${a}, past your ${p.before}`;
  return { headline: "Best round yet", detail, tone: "earned" };
}

// --- the ask after the taste (plan 13) ----------------------------------

/** The sheet's second line after a free round of a Premium game. */
export const TASTE_LINE = "Play it any day.";

/**
 * The plum sheet's headline after today's free round of a Premium game:
 * the game, the level and that round's real number. "Speed rush, level 1.
 * 2.6s to spare."
 */
export function tasteHeadline(game: Game, round: GameRound | null): string {
  const lead = `${game.name}, level ${round?.level ?? 1}.`;
  if (!round || round.lastWord === null || !round.scorable) return lead;
  if (round.game === "rush") {
    return round.stoppedBy === "you"
      ? `${lead} ${secs(round.spare ?? 0)} to spare.`
      : `${lead} Last word at ${clockTenth(round.lastWord)}.`;
  }
  if (round.game === "interview") {
    return round.inWindow
      ? `${lead} ${clock(round.lastWord)} inside the window.`
      : `${lead} Finished at ${clock(round.lastWord)}.`;
  }
  const f = decidingCutIn(round);
  return f && f.gap !== null ? `${lead} ${secs(f.gap)} after he cut in.` : lead;
}

/** Once per game, ever, on this device (localStorage). */
export function tasteKey(gameId: string): string {
  return `ethos.taste.${gameId}`;
}
