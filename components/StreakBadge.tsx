import type { StreakState } from "@/lib/streak";

/**
 * The streak, said plainly. Loss-aversion framing is allowed
 * (mechanics.md), guilt is not: an unfinished day reads as an open
 * invitation, never a scolding, and there is no sad mascot.
 *
 * Instrument grammar (#201): no pill, no wash, no flame — olive text
 * because a streak is earned, at the exact volume of the star count
 * beside it. The uppercase comes from the CSS, not the copy.
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
    <span className="font-display text-[13px] font-semibold uppercase tracking-[0.02em] text-sage-700 tabular-nums">
      Streak {streak.current}
      {streak.atRisk && (
        <span className="normal-case opacity-70"> · today&apos;s open</span>
      )}
    </span>
  );
}
