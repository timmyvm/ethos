import { IconFlame } from "@/components/Icon";
import type { StreakState } from "@/lib/streak";

/**
 * Streak chip. Loss-aversion framing is allowed (mechanics.md), guilt
 * is not: an unfinished day reads as an open invitation, never a
 * scolding, and there is no sad mascot.
 *
 * The flame means streak everywhere it appears (DECISIONS #153). The
 * warm terracotta wash is a wash, not a tap — the flame is the only
 * thing on it that could be mistaken for one, and it isn't pressable.
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-100 px-[13px] py-1.5 text-[13.5px] font-bold text-terracotta-800">
      <span className={streak.didToday ? "" : "opacity-50"}>
        <IconFlame size={14} />
      </span>
      {streak.current} days
      {streak.atRisk && (
        <span className="font-semibold opacity-70">· today&apos;s open</span>
      )}
    </span>
  );
}
