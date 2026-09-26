"use client";

import { CountUp } from "@/components/CountUp";
import { IconFlame } from "@/components/Icon";
import { DURATION } from "@/lib/motion";
import type { StreakState } from "@/lib/streak";

/**
 * The streak, said plainly. Loss-aversion framing is allowed
 * (mechanics.md), guilt is not: an unfinished day reads as an open
 * invitation, never a scolding, and there is no sad mascot.
 *
 * Instrument grammar (#201) said no pill, no wash, no flame. The colour
 * pass (26 Sep, "pop with colour") takes the chip and the flame back:
 * the flame is already the streak's mark everywhere else (Icon.tsx),
 * and the chip is the earned register, a sage wash beside the stars.
 * Still earned, never a tap. An open day shows the flame unlit, in
 * place of the words "today's open" (which pushed the chips into the
 * wordmark on phones under 390px); the words stay for screen readers,
 * and the floor card's eyebrow ("Today's practice" against "One
 * more") already says whether today is spoken for.
 */
export function StreakBadge({ streak }: { streak: StreakState }) {
  /*
   * Nothing on day zero (#209). This corner used to read "Day 1 starts
   * today" and now the floor's headline says it, in voice.md's words,
   * at four times the size. Saying it twice on one screen makes it a
   * slogan instead of a fact, and the smaller copy is the one that
   * loses.
   */
  if (streak.current === 0) return null;

  return (
    <span
      className="today-earned"
      data-open={streak.atRisk ? "true" : undefined}
    >
      <span className="sr-only">
        Streak {streak.current}
        {streak.atRisk ? ", today's open" : ""}
      </span>
      <span aria-hidden className="today-earned-mark">
        <IconFlame size={16} />
      </span>
      <span aria-hidden>
        <CountUp value={streak.current} durationMs={DURATION.max} />
      </span>
    </span>
  );
}
