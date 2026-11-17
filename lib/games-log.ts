/**
 * The Log's Games side (#486, Timothy 16 Nov: "log switch (daily)
 * (games) switch between ur daily log and ur games / practice logs").
 *
 * Two lists, in the Daily table's grammar (a date, a name with one line
 * under it, the Index), each row a door to the stored recording:
 *
 *  - The weekly boss: one row per week a boss was taken, newest first,
 *    the week's take as the lobby's record counted it (the first scored,
 *    else the first; `takeThisWeek`'s rule, and the week the analyze
 *    route's delta compares with, `bossWeekField`). Its topic, its
 *    Index, its date and the fact-check's score. It was six squares
 *    under /boss's stage ("Last six weeks"), which read as nothing to
 *    someone who had never taken one and as little to someone who had.
 *  - Every round: each game round and each Hostile Q&A take, newest
 *    first, its name ("Q&A, level 2"), the round's outcome in words that
 *    stand alone in a list and carry their verdict ("Paused 1.2s, just
 *    right", `roundLine`), or Hostile's first verdict ("Held the claim
 *    72 of 100"), and the Index.
 *
 * Pure: the rows come from `fetchGameRounds` and `fetchPracticeTakes`
 * (lib/client-data.ts), in any order.
 */

import { isBossTake } from "./boss";
import { gameOfLessonId } from "./games";
import { HOSTILE_TAKE_ID, hostileRecordOf } from "./hostile";
import { weekStart } from "./level";
import { recordingName } from "./log";
import { topicFromLessonId } from "./rep-config";
import { BEAT_MIN_S } from "./metrics";
import { INTERVIEW_WINDOW, type GameRound } from "./round";
import { clock, clockTenth, decidingCutIn, secs } from "./round-copy";

/** A stored take as the Games side reads it: a game round, a boss, a Hostile take. */
export interface GamesLogRow {
  id: string;
  lesson_id: string | null;
  created_at: string;
  ethos_index: number | null;
  /** The boss's fact-check (`reps.accuracy`); absent on the game rounds' read. */
  accuracy?: { score: number } | null;
  /** A game's measured round or Hostile's stored verdict (`reps.round`, 0026). */
  round?: unknown;
}

/** One week of the weekly boss. */
export interface BossWeekRow {
  /** The take the week counts, which the row opens. */
  id: string;
  at: string;
  /** Monday 00:00 of its week, on the device's calendar. */
  week: Date;
  /** The topic's title ("The Great Vowel Shift"). */
  topic: string;
  /** Null when the week's take was too short to score. */
  index: number | null;
  /** The fact-check's score out of 100; null when it was not checked. */
  accuracy: number | null;
}

/** One game round or Hostile Q&A take. */
export interface RoundRow {
  id: string;
  at: string;
  kind: "game" | "hostile";
  /** "Q&A, level 2", "Hostile Q&A". */
  name: string;
  /** The round's one number in its card's words; null when there is none to say. */
  line: string | null;
  index: number | null;
}

export interface GamesLog {
  weeks: BossWeekRow[];
  rounds: RoundRow[];
}

const time = (r: { created_at: string }) => new Date(r.created_at).getTime();
const newestFirst = <T extends { created_at: string }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => time(b) - time(a));

/**
 * The weekly boss's rows: each week a boss was taken, newest first, and
 * the take that week counts. A week with none is simply not there: a
 * missed week is not a row, and never a zero.
 */
export function bossWeekRows(rows: readonly GamesLogRow[]): BossWeekRow[] {
  const byWeek = new Map<number, GamesLogRow[]>();
  for (const r of rows) {
    if (!isBossTake(r) || !Number.isFinite(time(r))) continue;
    const key = weekStart(new Date(r.created_at)).getTime();
    byWeek.set(key, [...(byWeek.get(key) ?? []), r]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => b - a)
    .map(([key, takes]) => {
      const oldestFirst = [...takes].sort((a, b) => time(a) - time(b));
      const take = oldestFirst.find((t) => t.ethos_index !== null) ?? oldestFirst[0];
      const score = take.accuracy?.score;
      return {
        id: take.id,
        at: take.created_at,
        week: new Date(key),
        topic: topicFromLessonId(take.lesson_id)?.title ?? "Weekly boss",
        index: take.ethos_index,
        accuracy: typeof score === "number" && Number.isFinite(score) ? Math.round(score) : null,
      };
    });
}

/** The filler that broke a pause, quoted at the head of its line: "“Um”", "“You know”". */
function heading(word: string): string {
  return `“${word.charAt(0).toUpperCase()}${word.slice(1)}”`;
}

/**
 * A game round's outcome, in words that stand on their own in a list
 * (the round card's own lines lean on the card around them: "0.5s after
 * he cut in" names nobody out of it) and that say whether it went well
 * (#494, the morning tour: "Paused 0.5s at the cut-in" beside "Held
 * 1.2s at the cut-in" never said which was the good one). Each traces
 * to the measured round (lib/round.ts) and to the number its card shows.
 *   Q&A        "Paused 1.2s, just right" (held: 0.8 to 3.5s, nothing on
 *              it), "Paused 0.5s, too short", "Paused 4.1s, too long",
 *              "“Um” broke the pause", "Talked over Demos" (no pause
 *              at all), "Ended before Demos cut in"
 *   Speed rush "Finished 2.4s early", "Clock ran out at 0:20"
 *   Interview  "Ended at 1:13, in time", "Ended at 0:48, 12s short",
 *              "Ended at 1:31.2, too long", "Clock ran out at 1:30"
 * Each holds one line in the Log's row at 320.
 */
export function roundLine(round: GameRound): string {
  if (round.game === "qa") {
    const fired = round.cutIns.filter((f) => f.at !== null);
    if (fired.length === 0) return "Ended before Demos cut in";
    const f = decidingCutIn(round);
    if (!f || f.verdict === "through" || f.gap === null || f.gap < BEAT_MIN_S) return "Talked over Demos";
    if (f.verdict === "filled") return f.fillerWord ? `${heading(f.fillerWord)} broke the pause` : "A sound broke the pause";
    if (f.verdict === "held") return `Paused ${secs(f.gap)}, just right`;
    return `Paused ${secs(f.gap)}, ${f.verdict === "long" ? "too long" : "too short"}`;
  }
  if (round.game === "rush") {
    if (round.stoppedBy === "clock" || round.lastWord === null) return `Clock ran out at ${clock(round.cap)}`;
    return `Finished ${secs(round.spare ?? Math.max(0, round.cap - round.lastWord))} early`;
  }
  const last = round.lastWord;
  if (round.stoppedBy === "clock" && !round.inWindow) return `Clock ran out at ${clock(round.cap)}`;
  if (last === null) return `Ended at ${clock(round.durationS)}`;
  const [lo] = INTERVIEW_WINDOW;
  if (round.inWindow) return `Ended at ${clock(last)}, in time`;
  if (last < lo) return `Ended at ${clock(last)}, ${Math.max(1, Math.round(lo - last))}s short`;
  return `Ended at ${clockTenth(last)}, too long`;
}

/** A stored game round's line, or null when the row holds none this build can read. */
function gameLine(lessonId: string | null, round: unknown): string | null {
  const game = gameOfLessonId(lessonId);
  const r = round as GameRound | null | undefined;
  if (!game || !r || typeof r !== "object" || r.game !== game.id) return null;
  try {
    return roundLine(r);
  } catch {
    // A round stored in a shape this build does not read: no line, never a wrong one.
    return null;
  }
}

/** Hostile's first verdict, the claim held, out of 100. */
function hostileLine(round: unknown): string | null {
  const record = hostileRecordOf(round);
  return record ? `Held the claim ${record.verdict.held.score} of 100` : null;
}

/** Every game round and Hostile Q&A take, newest first. */
export function roundRows(rows: readonly GamesLogRow[]): RoundRow[] {
  return newestFirst(
    rows.filter((r) => gameOfLessonId(r.lesson_id) !== null || r.lesson_id === HOSTILE_TAKE_ID)
  ).map((r) => {
    const hostile = r.lesson_id === HOSTILE_TAKE_ID;
    const round = (r.round ?? null) as { game?: unknown; level?: unknown } | null;
    return {
      id: r.id,
      at: r.created_at,
      kind: hostile ? "hostile" : "game",
      name: recordingName({ lesson_id: r.lesson_id, mode: "daily", round }),
      line: hostile ? hostileLine(r.round) : gameLine(r.lesson_id, r.round),
      index: r.ethos_index,
    };
  });
}

/**
 * Both lists from every row the Games side read. A row read twice (a
 * game round is in both reads only if a caller passes it twice) counts
 * once.
 */
export function gamesLog(rows: readonly GamesLogRow[]): GamesLog {
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return { weeks: bossWeekRows(unique), rounds: roundRows(unique) };
}
