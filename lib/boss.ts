import { weekStart } from "./level";
import { BOSS_XP_BASE, DAILY_MAX_SECONDS } from "./rep-config";

/**
 * Cold Topic's two clocks, in one place (D30). The boss screen counts
 * the reading down from the first, the recording stops at the second,
 * and the boss stage on Practice and /boss says both, so no screen can
 * promise a length the boss does not run. (A Next.js page may export only its own fields, so
 * they live here rather than in app/boss/page.tsx.)
 */
/**
 * The reading window: 90 seconds (the games plan, item 16). Four
 * minutes of clock stood over four bullets read in about 20 seconds, and
 * pushed the boss past five minutes; 90 to read, 90 to speak and about
 * a minute of results is about four.
 */
export const BOSS_RESEARCH_SECONDS = 90;

/** The answer: the recording's own limit. The boss runs no mods, so nothing shortens it. */
export const BOSS_ANSWER_SECONDS = DAILY_MAX_SECONDS;

/* A number and its unit never part at a line's end ("90 / seconds"
   at 320): a no-break space between them. */
const NBSP = " ";
const minutes = (s: number) => `${s / 60}${NBSP}minute${s === 60 ? "" : "s"}`;
const seconds = (s: number) => `${s}${NBSP}seconds`;
/** Whole minutes as minutes, anything else as seconds: "4 minutes", "90 seconds". */
const span = (s: number) => (s >= 60 && s % 60 === 0 ? minutes(s) : seconds(s));

/** What the boss asks, on Practice's stage: "Read for 90 seconds." */
export function bossReadLine(s: number = BOSS_RESEARCH_SECONDS): string {
  return `Read for ${span(s)}.`;
}

/** And then: "Explain it in 90 seconds." */
export function bossAnswerLine(): string {
  return `Explain it in ${seconds(BOSS_ANSWER_SECONDS)}.`;
}

/**
 * What a boss take pays on the boss's own account (the games plan, item
 * 16). A take the engine scored pays the boss's ×1.5. A take too short
 * to score pays what an unscored take pays anywhere else, ×1, because
 * the boss runs no mods: four empty boss takes of 0 to 6 seconds each
 * paid 15 XP on 2 Nov.
 */
export function bossXpMultiplier(scorable: boolean): number {
  return scorable ? BOSS_XP_BASE : 1;
}

const DAY_MS = 86_400_000;

/**
 * Days left in the device's week, at least one, from the week's start
 * (`weekStart()`). Read after mount, never in render: the server's week
 * is UTC and the phone's is local (practice-tab-2).
 */
export function daysLeftInWeek(week: Date, now: number = Date.now()): number {
  return Math.max(1, 7 - Math.floor((now - week.getTime()) / DAY_MS));
}

/**
 * The week's state at the foot of the boss stage, on Practice and on
 * /boss alike (E30): "Done this week", "Last day" or "3 days left". A
 * no-break space while either read is out, so the line keeps its height
 * and nothing under it moves when the words land.
 */
export function bossWeekLine(done: boolean | null, daysLeft: number | null): string {
  if (done === null || daysLeft === null) return NBSP;
  if (done) return "Done this week";
  return daysLeft === 1 ? "Last day" : `${daysLeft} days left`;
}

/* ------------------------------------------------------------------ */
/* The record: the last six weeks (the games plan, item 16)            */
/* ------------------------------------------------------------------ */

/** How many weeks the lobby's record shows, this one included. */
export const BOSS_WEEKS = 6;

/** A stored recording, as much of it as the record reads. */
export interface BossTakeRow {
  id?: string;
  created_at: string;
  lesson_id: string | null;
  ethos_index: number | null;
}

/** One slot of the record. */
export interface BossWeek {
  /** Monday 00:00 on the device's calendar. */
  monday: Date;
  /** Monday's date, as the caption under the slot says it: "2 Nov". */
  label: string;
  /** The week's first boss Index; null when no take that week was scored. */
  index: number | null;
  /** Any boss take that week, scored or not. A week with none was missed. */
  taken: boolean;
  /** This week, the slot ringed in ink. */
  current: boolean;
}

/** Three letters, always: en-AU's Intl writes "Sept". */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2 Nov", the day and month never parted. */
export function mondayLabel(d: Date): string {
  return `${d.getDate()}${NBSP}${MONTHS[d.getMonth()]}`;
}

/** A boss recording, by the lesson id it is filed under (`boss:<topic>`). */
export function isBossTake(row: { lesson_id: string | null }): boolean {
  return (row.lesson_id ?? "").startsWith("boss:");
}

/** The Monday `n` weeks from `monday`, at local midnight across a clock change. */
function addWeeks(monday: Date, n: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 7 * n);
  return d;
}

/** One week's boss takes, oldest first. */
function takesIn<T extends BossTakeRow>(rows: readonly T[], from: Date, to: Date): T[] {
  return rows
    .filter((r) => {
      if (!isBossTake(r)) return false;
      const at = new Date(r.created_at).getTime();
      return at >= from.getTime() && at < to.getTime();
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * The lobby's record, oldest week first and this week last: each week's
 * first boss Index, as Wordle counts the first attempt. A missed week
 * stays empty, never a zero; a week whose takes were all too short to
 * score is taken with no Index. Weeks are the device's (`weekStart`),
 * as the stage's week line counts them.
 */
export function bossWeeks(
  rows: readonly BossTakeRow[],
  now: Date = new Date(),
  weeks: number = BOSS_WEEKS
): BossWeek[] {
  const thisMonday = weekStart(now);
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addWeeks(thisMonday, i - (weeks - 1));
    const inWeek = takesIn(rows, monday, addWeeks(monday, 1));
    const scored = inWeek.find((r) => r.ethos_index !== null);
    return {
      monday,
      label: mondayLabel(monday),
      index: scored?.ethos_index ?? null,
      taken: inWeek.length > 0,
      current: i === weeks - 1,
    };
  });
}

/**
 * This week's take, the one its slot shows: the first scored, else the
 * first. A free account's spent week opens it ("See your take") rather
 * than running the reading clock for nothing. Null before one.
 */
export function takeThisWeek<T extends BossTakeRow>(
  rows: readonly T[],
  now: Date = new Date()
): T | null {
  const monday = weekStart(now);
  const inWeek = takesIn(rows, monday, addWeeks(monday, 1));
  return inWeek.find((r) => r.ethos_index !== null) ?? inWeek[0] ?? null;
}

/**
 * Last week, on the speaker's own calendar, for the server: from Monday
 * 00:00 a week before the week `at` falls in, to that week's own Monday.
 * `tzOffset` is the phone's `getTimezoneOffset()` minutes, as
 * /api/analyze receives it; with none the week is UTC's. The score
 * step's delta compares a boss with last week's slot on the lobby's
 * record ("▲ 36 on last week's boss"), so both start a week on Monday.
 */
export function lastBossWeek(at: Date, tzOffset: number | null): { from: Date; to: Date } {
  const offset =
    tzOffset === null || !Number.isFinite(tzOffset)
      ? 0
      : Math.max(-14 * 60, Math.min(14 * 60, Math.trunc(tzOffset)));
  // Its UTC fields read the speaker's own clock.
  const wall = new Date(at.getTime() - offset * 60_000);
  const midnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const sinceMonday = (wall.getUTCDay() + 6) % 7;
  const to = new Date(midnight - sinceMonday * DAY_MS + offset * 60_000);
  return { from: new Date(to.getTime() - 7 * DAY_MS), to };
}
