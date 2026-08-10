import type { StreakState } from "@/lib/streak";

/**
 * Streak chip. Loss-aversion framing is allowed (mechanics.md), guilt
 * is not: an unfinished day reads as an open invitation, never a
 * scolding, and there is no sad mascot.
 */
export function StreakBadge({ streak }: { streak: StreakState }) {
  if (streak.current === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-[13px] font-semibold text-stone-500">
        Day 1 starts today
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-[13px] font-semibold">
      <span className={streak.didToday ? "text-amber-500" : "text-stone-400"}>
        ●
      </span>
      {streak.current}-day streak
      {streak.atRisk && (
        <span className="font-normal text-stone-500">· today&apos;s open</span>
      )}
    </span>
  );
}
