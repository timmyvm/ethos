import { DAILY_MAX_SECONDS } from "./rep-config";

/**
 * Cold Topic's two clocks, in one place (D30). The boss screen counts
 * the reading down from the first, the recording stops at the second,
 * and the boss stage on Practice and /boss says both, so no screen can
 * promise a length the boss does not run. (A Next.js page may export only its own fields, so
 * they live here rather than in app/boss/page.tsx.)
 */
/** The reading window: 4 minutes (mechanics.md: a 3 to 5 minute window). */
export const BOSS_RESEARCH_SECONDS = 240;

/** The answer: the recording's own limit, untimed by any mod. */
export const BOSS_ANSWER_SECONDS = DAILY_MAX_SECONDS;

/* A number and its unit never part at a line's end ("90 / seconds"
   at 320): a no-break space between them. */
const NBSP = "\u00a0";
const minutes = (s: number) => `${s / 60}${NBSP}minute${s === 60 ? "" : "s"}`;
const seconds = (s: number) => `${s}${NBSP}seconds`;

/** What the boss asks, on Practice's stage: "Read for 4 minutes." */
export function bossReadLine(): string {
  return `Read for ${minutes(BOSS_RESEARCH_SECONDS)}.`;
}

/** And then: "Explain it in 90 seconds." */
export function bossAnswerLine(): string {
  return `Explain it in ${seconds(BOSS_ANSWER_SECONDS)}.`;
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
  if (done === null || daysLeft === null) return " ";
  if (done) return "Done this week";
  return daysLeft === 1 ? "Last day" : `${daysLeft} days left`;
}
