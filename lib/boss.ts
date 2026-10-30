import { DAILY_MAX_SECONDS } from "./rep-config";

/**
 * Cold Topic's two clocks, in one place (D30). The boss screen counts
 * the reading down from the first, the recording stops at the second,
 * and Practice's stage says both, so no screen can promise a length the
 * boss does not run. (A Next.js page may export only its own fields, so
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

/** The boss screen's lobby line, from the same two numbers. */
export function bossLobbyLine(): string {
  return `Read for ${minutes(BOSS_RESEARCH_SECONDS)}, then explain it from memory in ${seconds(BOSS_ANSWER_SECONDS)}.`;
}
