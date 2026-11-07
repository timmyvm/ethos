/**
 * Rules of the recording screen (app/rep/page.tsx) worth a test, kept out
 * of the component so they can be read and checked on their own. The
 * screen stays mounted through Retake, Go again, Practice N of 3, Next
 * lesson and Another round, so most of these are about what one take may
 * claim when another came before it on the same day or the same screen.
 */

import { achievements } from "./achievements";
import type { RepRow } from "./client-data";
import type { LevelN } from "./games";
import type { RepMetrics } from "./metrics";
import { nextMilestones, type RepGain } from "./progress";
import {
  anticipation,
  endNote,
  personalBests,
  type RewardMoment,
} from "./rewards";
import { bestMoment } from "./round-copy";
import type { StreakState } from "./streak";

/**
 * The streak roll-up plays on the take that made today count, and only
 * there: the increment is the event (#226), and its chime is earned once
 * (#140). A second take of a day already spoken used to roll 6 to 7 and
 * play the fanfare again, and so did a take whose row never landed while
 * yesterday kept the streak alive.
 */
export function celebratesStreak(
  streak: StreakState,
  before: { didToday: boolean } | null
): boolean {
  return streak.current > 0 && streak.didToday && !(before?.didToday ?? false);
}

/**
 * The line under Record: what the next take is about to earn (#48). Read
 * on open and again after every take, so the next take on this screen
 * never repeats "This one keeps a 6-day streak alive" once the debrief
 * has said 7.
 */
export function recordCue(p: {
  reps: RepRow[];
  starMap: Record<string, number>;
  streak: StreakState;
  xp: number;
}): RewardMoment | null {
  return anticipation(
    nextMilestones({
      reps: p.reps,
      starMap: p.starMap,
      streak: p.streak,
      xp: p.xp,
      freezesEquipped: 0,
      achievements: achievements(p.reps),
    }),
    p.streak
  );
}

/**
 * The records and the closing line on the results walk. A take too short
 * to score measured nothing (NotScored: "1 star, nothing measured"), so
 * it breaks no record and its closing line reads no number off it: a
 * one-word take used to end on "Zero fillers, 5 seconds, clean." It ends
 * on the streak, or on the count.
 */
export function takeRewards(p: {
  scorable: boolean;
  /** The history from before this take, captured up front (personalBests). */
  prior: RepRow[];
  metrics: RepMetrics;
  ethosIndex: number | null;
  gains: RepGain[];
  streak: StreakState;
  repCount: number;
  /**
   * A game round's best at its level (M4): `before` from the snapshot
   * taken before the take (#53), `now` with this round in. "Best round
   * yet" leads the records when it went up; a first round breaks nothing.
   */
  gameBest?: {
    game: string;
    level: LevelN;
    before: number | null;
    now: number | null;
  } | null;
}): { bests: RewardMoment[]; closing: RewardMoment } {
  if (p.scorable) {
    const round = p.gameBest ? bestMoment({ gameId: p.gameBest.game, ...p.gameBest }) : null;
    return {
      bests: [
        ...(round ? [round] : []),
        ...personalBests(p.prior, p.metrics, p.ethosIndex),
      ],
      closing: endNote({
        gains: p.gains,
        metrics: p.metrics,
        streak: p.streak,
        repCount: p.repCount,
      }),
    };
  }
  // endNote's own last two lines, the ones that read nothing off the take.
  if (p.streak.current > 1) {
    return {
      bests: [],
      closing: {
        headline: `${p.streak.current} days running`,
        detail: "You showed up again.",
        tone: "earned",
      },
    };
  }
  return {
    bests: [],
    closing: {
      headline: `Recording ${p.repCount} logged`,
      // Nothing was measured, so it does not say so (#416 review).
      detail: "Kept. Give the next one 60 to 90 seconds.",
      tone: "neutral",
    },
  };
}

/**
 * The round's one sound (F5, #34, #140): the daily chime and the landing
 * buzz when the reveal lands the game's one thing (Q&A held, Speed rush
 * or Interview landed). Never on a miss, never twice in a round, and
 * never when the streak celebration already played this round, since
 * that was the round's one sound. The mic is torn down by the results,
 * so it can never reach a recording.
 */
export function roundChimes(p: {
  /** The reveal landed a win (`roundWon`). */
  win: boolean;
  /** The streak celebration played, or is up, for this round. */
  streakCelebrated: boolean;
  /** This round's reveal already chimed (a step back to the score). */
  played: boolean;
}): boolean {
  return p.win && !p.streakCelebrated && !p.played;
}

/**
 * The other side of the round's one sound: the streak celebration chimes
 * unless the round's reveal already did. The reveal stops waiting for the
 * rewards after 2.5s, so on a slow connection a held round can chime
 * before the day's first streak roll lands; the roll then shows quiet.
 */
export function streakChimes(p: { roundChimed: boolean }): boolean {
  return !p.roundChimed;
}

/**
 * Think time (DECISIONS #35) opens before a take, once. When it runs out
 * the screen goes back to Record, and that Record starts the take: it
 * used to open another thirty seconds, so only "I'm ready" could ever
 * start one.
 */
export function thinksFirst(frameStep: boolean, thoughtAlready: boolean): boolean {
  return frameStep && !thoughtAlready;
}

/**
 * What stands between a tapped exit and where it goes (DECISIONS #427):
 * at most one beat per exit, in this order. The save wall (#134) and a
 * free account's taste of a Premium game (#419) on any exit, as before;
 * Since day one (#11, #198 a) and the reminder ask only on an exit that
 * leaves the session (the header's back, Back to the lesson, Next
 * lesson, Go again), never between a lesson's practices, on Another
 * round or on Retake. A beat not shown stays due for the next exit that
 * leaves.
 */
export type ExitBeat = "gate" | "taste" | "pro" | "reminder" | null;

export function exitBeat(p: {
  /** The save wall is due (gateMoment). */
  gate: boolean;
  /** A free account's taste of a Premium game is due. */
  tasteDue: boolean;
  /** Since day one is due (proMomentDue). */
  proDue: boolean;
  /** The reminder ask is due (lib/reminder-ask.ts reminderDue). */
  reminderDue: boolean;
  /** The exit leaves the session. */
  leaves: boolean;
  /** The streak celebration is up: the taste never plays over it. */
  streakUp: boolean;
}): ExitBeat {
  if (p.gate) return "gate";
  if (p.tasteDue && !p.streakUp) return "taste";
  if (p.leaves && p.proDue) return "pro";
  if (p.leaves && p.reminderDue) return "reminder";
  return null;
}

/**
 * Where the recording screen's back link goes when nothing sent a
 * `back`: the place a take of this kind is opened from. A game opens
 * from Practice, and its debrief already leaves to Practice; its back
 * link used to say Today.
 */
export function defaultBack(config: { kind: string; lessonId: string }): string {
  if (config.kind === "boss") return "/boss";
  if (config.lessonId.startsWith("game:")) return "/games";
  return "/";
}

/**
 * recording-4: the back control names where it goes, like every other
 * back in the app (BackLink, system-4), never a lowercase "back". The
 * names are the tab bar's.
 */
export function backLabel(href: string): string {
  const path = href.split(/[?#]/)[0];
  if (path === "/") return "Today";
  if (path === "/games") return "Practice";
  if (path === "/boss" || path.startsWith("/boss/")) return "Boss";
  if (/^\/(lessons?|practice)\//.test(path)) return "Lesson";
  return "Back";
}
