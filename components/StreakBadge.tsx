"use client";

import { CountUp } from "@/components/CountUp";
import { IconFlame } from "@/components/Icon";
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
   * the headline no longer says "day one" in words.
   */
  const open = streak.current === 0 || streak.atRisk;

  /* M17: the flame at 18px and the number at 15/700, on the shared
     header count (HeaderCount's chip, the earned register). */
  return (
    <HeaderCount
      variant="chip"
      unlit={open}
      label={`Streak ${streak.current}${open ? ", today's open" : ""}`}
      glyph={<IconFlame size={18} />}
      value={<CountUp value={streak.current} durationMs={DURATION.max} />}
    />
  );
}
