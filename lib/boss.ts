import { weeklyTopic, type ColdTopic } from "./cold-topics";
import { weekStart } from "./level";
import { BOSS_XP_BASE, topicFromLessonId } from "./rep-config";

/**
 * Cold Topic's reading clock (D30). The boss screen counts the reading
 * down from it; the recording stops at its own limit. The card that
 * names the boss (Practice's stage, /boss's) says neither since #486
 * (Timothy, 16 Nov: "they don't need to know any time frame"): the
 * clock runs where the clock is. (A Next.js page may export only its
 * own fields, so this lives here rather than in app/boss/page.tsx.)
 *
 * 90 seconds (the games plan, item 16). Four minutes of clock stood
 * over four bullets read in about 20 seconds, and pushed the boss past
 * five minutes; 90 to read, 90 to speak and about a minute of results
 * is about four.
 */
export const BOSS_RESEARCH_SECONDS = 90;

/**
 * The one line the boss card keeps (#486): a week already taken says
 * so, in sage, because it is earned. No countdown ("6 days left" went
 * with the time frame), and nothing while the week is open.
 */
export const BOSS_DONE_LINE = "Done this week";

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

/** A stored recording, as much of it as the week reads. */
export interface BossTakeRow {
  id?: string;
  created_at: string;
  lesson_id: string | null;
  ethos_index: number | null;
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
 * This week's take, the one the week counts (the Log's boss row, as the
 * lobby's record did before #486): the first scored, else the first. A
 * free account's spent week opens it ("See your take") rather than
 * running the reading clock for nothing. Null before one.
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
 * The topic the boss's card names this week (#494 review): the one the
 * week's take stored (`boss:<id>`) once it is taken, else the week's own
 * (`weeklyTopic`). Spin and Pick a topic take another than the week's,
 * and "Done this week" under the week's topic then named a take the Log's
 * row, which reads the stored topic, says was on something else.
 * Practice's stage, Today's tile and a spent week's /boss read it. Rows
 * unread (null) are the week's own topic.
 */
export function bossCardTopic(rows: readonly BossTakeRow[] | null, now: Date = new Date()): ColdTopic {
  const take = rows ? takeThisWeek(rows, now) : null;
  return topicFromLessonId(take?.lesson_id ?? null) ?? weeklyTopic(now);
}

const HOUR_MS = 3_600_000;

/**
 * Last week as the Log's boss rows count it (lib/games-log.ts, #486;
 * the lobby's record until then), sent with a boss take (`bossWeek`):
 * last Monday 00:00 and this Monday 00:00 on the device's calendar
 * (`weekStart`, `addWeeks`), as ISO instants. The server reads the
 * delta's week from these, so it names the take the Log's row shows
 * across a clock change, which an offset from one moment cannot.
 */
export function bossWeekField(at: Date = new Date()): string {
  const to = weekStart(at);
  return `${addWeeks(to, -1).toISOString()}/${to.toISOString()}`;
}

/**
 * The phone's last week (`bossWeekField`), checked: a week of 7 days,
 * give or take a clock change's hour, ending at the Monday that starts
 * the week `at` falls in. Anything else is null, and the server counts
 * the week from the offset instead (`lastBossWeek`). A forged week moves
 * only which boss the delta is drawn against: a lie to its author.
 */
export function parseBossWeek(raw: unknown, at: Date): { from: Date; to: Date } | null {
  if (typeof raw !== "string" || raw.length > 80) return null;
  const [a, b, extra] = raw.split("/");
  if (!a || !b || extra !== undefined) return null;
  const from = new Date(a);
  const to = new Date(b);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  if (Math.abs(to.getTime() - from.getTime() - 7 * DAY_MS) > HOUR_MS) return null;
  const into = at.getTime() - to.getTime();
  if (into < 0 || into >= 7 * DAY_MS + HOUR_MS) return null;
  return { from, to };
}

/**
 * Last week, on the speaker's own calendar, for the server, when the
 * phone sent no week of its own (a take from before `bossWeek`): from
 * Monday 00:00 a week before the week `at` falls in, to that week's own
 * Monday. `tzOffset` is the phone's `getTimezoneOffset()` minutes, as
 * /api/analyze receives it; with none the week is UTC's. One offset
 * serves both Mondays, so across a clock change either can sit an hour
 * off the Log's. The score step's delta compares a boss with last
 * week's row in the Log ("▲ 36 on last week's boss"), so both start a
 * week on Monday.
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
