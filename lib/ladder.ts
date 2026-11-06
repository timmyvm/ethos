/**
 * The ladder (the games plan, items 3, 5 and 6; proposal-mastery 3 and 4).
 *
 * Every game has three levels. A round COUNTS when the engine measured
 * the game's one thing, with two stars and a scorable take
 * (lib/round.ts). Two counted rounds on two different days at the open
 * level open the next one. At level 3, three different days with a
 * counted three-star round master the game. Nothing ever goes down.
 *
 * A day counts once, toward one level: the round that opens level 2 is
 * that day's count, so the next one is tomorrow's (the two-day rule is
 * what keeps a sitting to one round and the loop under five minutes).
 * Days are the device's own (`dayKey`, lib/challenge.ts).
 *
 * It reads only stored engine outcomes: never a plan, never an
 * entitlement, never a price (a test walks its imports). Money buys
 * games and rounds, never a rung.
 */

import { dayKey } from "./challenge";
import { clampLevel, type LevelN } from "./games";
import type { GameRound } from "./round";

/** The columns the ladder reads (`fetchGameRounds` in lib/client-data.ts). */
export interface LadderRow {
  created_at: string;
  lesson_id: string | null;
  stars?: number | null;
  ethos_index?: number | null;
  round?: GameRound | null;
}

export interface LadderState {
  /** The highest level opened. */
  open: LevelN;
  /** Days counted toward the next step: opening the next level, or at level 3 mastery. */
  counted: number;
  /** How many it takes: 2 to open the next level, 3 to master at level 3. */
  of: 2 | 3;
  /** Today already gave the ladder its count. */
  countedToday: boolean;
  mastered: boolean;
  /** The best per level (M4); null where there is none yet. */
  best: Record<LevelN, number | null>;
  /** Speed rush: counted rounds in a row at the open level. 0 for the others. */
  chain: number;
}

/** Days with a counted round that open the next level. */
export const DAYS_TO_OPEN = 2;
/** Days at level 3 with a counted three-star round that master a game. */
export const DAYS_TO_MASTER = 3;

/** This game's measured rounds, oldest first. */
function roundsOf(rows: readonly LadderRow[], gameId: string): { day: string; row: LadderRow; round: GameRound }[] {
  return rows
    .filter((r) => r.round && r.round.game === gameId)
    .map((r) => ({ row: r, round: r.round as GameRound, t: new Date(r.created_at) }))
    .filter((x) => Number.isFinite(x.t.getTime()))
    .sort((a, b) => a.t.getTime() - b.t.getTime())
    .map((x) => ({ day: dayKey(x.t), row: x.row, round: x.round }));
}

/** Counts toward mastery: a counted round at level 3 with three stars. */
function mastersDay(round: GameRound, row: LadderRow): boolean {
  return round.counted && round.level === 3 && (row.stars ?? round.stars) >= 3;
}

/**
 * Where this game's ladder stands. `rows` are the account's game
 * recordings in any order (rows of other games and rows without a
 * measured round are skipped); `now` names today.
 */
export function ladderState(
  rows: readonly LadderRow[],
  gameId: string,
  now: Date = new Date()
): LadderState {
  const today = dayKey(now);
  let open: LevelN = 1;
  let days = new Set<string>();
  const used = new Set<string>();
  const masteryDays = new Set<string>();

  for (const { day, row, round } of roundsOf(rows, gameId)) {
    if (used.has(day) || round.level !== open) continue;
    if (open < 3) {
      if (!round.counted) continue;
      days.add(day);
      used.add(day);
      if (days.size >= DAYS_TO_OPEN) {
        open = (open + 1) as LevelN;
        days = new Set();
      }
    } else if (mastersDay(round, row)) {
      masteryDays.add(day);
      used.add(day);
    }
  }

  const mastered = masteryDays.size >= DAYS_TO_MASTER;
  return {
    open,
    counted: open === 3 ? Math.min(DAYS_TO_MASTER, masteryDays.size) : days.size,
    of: open === 3 ? DAYS_TO_MASTER : DAYS_TO_OPEN,
    countedToday: used.has(today),
    mastered,
    best: {
      1: bestFor(rows, gameId, 1),
      2: bestFor(rows, gameId, 2),
      3: bestFor(rows, gameId, 3),
    },
    chain: gameId === "rush" ? chainsAt(rows, gameId, open).current : 0,
  };
}

/**
 * Speed rush's run at a level: a counted round adds one, a scorable round
 * that did not count ends it, and an unscorable take is skipped, so a
 * mis-tap never breaks a run.
 */
function chainsAt(
  rows: readonly LadderRow[],
  gameId: string,
  level: LevelN
): { current: number; longest: number } {
  let current = 0;
  let longest = 0;
  for (const { round } of roundsOf(rows, gameId)) {
    if (round.level !== level || !round.scorable) continue;
    current = round.counted ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}

/**
 * The best at one level (M4), from scorable rounds only:
 * - Q&A: the most seconds clean after the cut-in (each round's shorter run at level 3).
 * - Speed rush: the most counted rounds in a row.
 * - Interview: the highest Index.
 * Null when there is none yet.
 */
export function bestFor(
  rows: readonly LadderRow[],
  gameId: string,
  level: unknown
): number | null {
  const n = clampLevel(level);
  if (gameId === "rush") {
    const { longest } = chainsAt(rows, gameId, n);
    return longest > 0 ? longest : null;
  }
  let best: number | null = null;
  for (const { row, round } of roundsOf(rows, gameId)) {
    if (round.level !== n || !round.scorable) continue;
    const v =
      round.best ?? (gameId === "interview" ? (row.ethos_index ?? null) : null);
    if (typeof v === "number" && Number.isFinite(v) && (best === null || v > best)) {
      best = v;
    }
  }
  return best;
}

/**
 * Rounds of this game recorded today on this device's calendar, measured
 * or not: what the game of the day's one free round is counted against
 * (lib/games.ts `gameOpen`).
 */
export function roundsToday(
  rows: readonly LadderRow[],
  gameId: string,
  now: Date = new Date()
): number {
  const today = dayKey(now);
  const prefix = `game:${gameId}:`;
  return rows.filter((r) => {
    const mine = r.lesson_id ? r.lesson_id.startsWith(prefix) : r.round?.game === gameId;
    if (!mine) return false;
    const t = new Date(r.created_at);
    return Number.isFinite(t.getTime()) && dayKey(t) === today;
  }).length;
}
