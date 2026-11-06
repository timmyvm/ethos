/**
 * What Practice's tiles say (the games plan, items 7, 12 and 15;
 * proposal-mastery 6). Pure, so the page only lays the words out.
 *
 * - A game's tile carries its ladder: the open level, pips toward the
 *   next count, and the best at that level (lib/ladder.ts). Unknown is
 *   never drawn as Level 1: a failed read gives no ladder at all.
 * - The game of the day (lib/games.ts `gameOfTheDay`): a free account
 *   plays one Premium game a day, in rotation. Its tile says so, then
 *   says when it is free again once today's round is taken.
 * - Hostile Q&A's weekly free take is a door from Practice.
 *
 * Days are the device's own (`dayKey`, lib/challenge.ts), read after
 * mount, never in render (a server's UTC day is not the phone's).
 */

import { dayKey } from "./challenge";
import { DAY_ROTATION, gameById, gameOfTheDay, gameOpen, type Game, type LevelN } from "./games";
import { HOSTILE_TAKE_ID } from "./hostile";
import { ladderState, roundsToday, type LadderRow } from "./ladder";
import { weekStart } from "./level";

/** A game's tile, as its ladder draws it. */
export interface TileLadder {
  level: LevelN;
  /** Pips filled: days counted toward the next step. */
  counted: number;
  /** Pips drawn: 2 toward the next level, 3 toward mastery at level 3. */
  of: 2 | 3;
  mastered: boolean;
  /** "Best 31s clean", "Best 4 in a row", "Best 712"; null with none yet. */
  best: string | null;
}

/**
 * The best at a level in the tile's words (M4, M6). Each game's best is
 * the one number its conditions stress: seconds clean after the cut-in,
 * landed rounds in a row, the Index.
 */
export function bestLine(gameId: string, best: number | null): string | null {
  if (best === null || !Number.isFinite(best)) return null;
  if (gameId === "qa") {
    const s = Math.round(best);
    return s >= 1 ? `Best ${s}s clean` : null;
  }
  if (gameId === "rush") return best >= 1 ? `Best ${Math.round(best)} in a row` : null;
  if (gameId === "interview") return best > 0 ? `Best ${Math.round(best)}` : null;
  return null;
}

/** The ladder a tile draws, from the account's game rounds. */
export function tileLadder(rows: readonly LadderRow[], gameId: string, now: Date = new Date()): TileLadder {
  const s = ladderState(rows, gameId, now);
  return {
    level: s.open,
    counted: Math.min(s.counted, s.of),
    of: s.of,
    mastered: s.mastered,
    best: bestLine(gameId, s.best[s.open]),
  };
}

/**
 * The question ids already asked in a game, newest first, for
 * `drawFresh`. `rows` come oldest first, as `fetchGameRounds` hands them.
 */
export function lessonIdsNewestFirst(rows: readonly { lesson_id: string | null }[]): (string | null)[] {
  return [...rows].reverse().map((r) => r.lesson_id);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
}

/** The next day after today on which `gameId` is the free game, or null if it never is. */
export function nextFreeDay(gameId: string, now: Date = new Date()): Date | null {
  for (let k = 1; k <= DAY_ROTATION.length; k++) {
    const d = addDays(now, k);
    if (gameOfTheDay(dayKey(d)) === gameId) return d;
  }
  return null;
}

/** "Free again Sunday", or "Free again tomorrow". */
export function freeAgainLine(gameId: string, now: Date = new Date()): string | null {
  const d = nextFreeDay(gameId, now);
  if (!d) return null;
  const tomorrow = dayKey(addDays(now, 1)) === dayKey(d);
  return `Free again ${tomorrow ? "tomorrow" : WEEKDAYS[d.getDay()]}`;
}

/** Tomorrow's free game, named: "Interview is free tomorrow." */
export function tomorrowLine(now: Date = new Date()): string {
  const game = gameById(gameOfTheDay(dayKey(addDays(now, 1))));
  return `${game?.name ?? "Another game"} is free tomorrow.`;
}

/**
 * What a free account's Premium card says each paid game holds (M6,
 * the plan's item 14): the levels you would be buying, never a rung.
 */
export const PREMIUM_DEPTH: Record<string, string> = {
  rush: "45, 30, then 20 seconds.",
  interview: "Three levels, the last with a follow-up.",
};

/** Where today's free game stands for a free account. */
export type DayState =
  /** Not read yet: no caption, no door decided. */
  | "unknown"
  /** Playable now: "Free today". */
  | "open"
  /** Today's round is taken: free again on its next day, the tap opens the paywall. */
  | "spent";

/**
 * Today's free game for a free account. A failed read of the rounds
 * degrades open, as every allowance here does: the round is the
 * player's own, and nothing paid is given away by one more.
 */
export function dayState(
  game: Game,
  opts: { dayKey: string | null; rows: readonly LadderRow[] | null | "failed"; now?: Date }
): DayState {
  if (!opts.dayKey) return "unknown";
  if (opts.rows === null) return "unknown";
  const played = opts.rows === "failed" ? 0 : roundsToday(opts.rows, game.id, opts.now ?? new Date());
  return gameOpen(game, { premium: false, dayKey: opts.dayKey, roundsTodayOfGame: played }) ? "open" : "spent";
}

/**
 * Has this account taken its free Hostile Q&A this week? Its take is
 * banked as `hostile-take` (app/api/hostile/route.ts counts the same
 * rows from Monday on the phone's calendar). Null when unknown.
 */
export function hostileUsedThisWeek(
  rows: readonly { lesson_id: string | null; created_at: string }[] | null,
  now: Date = new Date()
): boolean | null {
  if (!rows) return null;
  const since = weekStart(now).getTime();
  return rows.some((r) => r.lesson_id === HOSTILE_TAKE_ID && new Date(r.created_at).getTime() >= since);
}
