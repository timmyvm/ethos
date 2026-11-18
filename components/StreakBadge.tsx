"use client";

import { CountUp } from "@/components/CountUp";
import { StatIcon } from "@/components/StatIcon";
import { HeaderCount } from "@/components/ui/HeaderCount";
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
   * Day zero shows too, unlit (26 Sep, Timothy: the corner read as
   * empty). A zero with an unlit flame is a number waiting to move, and
   * the headline no longer says "day one" in words. Since D25 the whole
   * chip is unlit at zero, the wash too; since #495 a running streak on
   * an open day stands on the neutral surface too, its count in ink and
   * its flame grey, and takes the sage wash and the lit flame once today
   * is spoken (sage means earned, and today is not yet).
   */
  const open = streak.current === 0 || streak.atRisk;

  /* M17: the flame and the number at 15/700, on the shared header
     count (HeaderCount's chip, the earned register). The flame is the
     3D one since #487, at 20 because an object without a stroke reads
     a size smaller than a line glyph; unlit it is the same file greyed. */
  return (
    <HeaderCount
      variant="chip"
      unlit={open}
      empty={streak.current === 0}
      label={`Streak ${streak.current}${open ? ", today's open" : ""}`}
      glyph={<StatIcon kind="streak" lit={!open} size={20} />}
      value={<CountUp value={streak.current} durationMs={DURATION.max} />}
    />
  );
}
