"use client";

import type { RewardMoment } from "@/lib/rewards";

/**
 * One reward moment. Deliberately one component for every surface —
 * anticipation before a rep, near-miss on the path, fresh start on
 * Monday, the closing note after a rep — so the reward layer looks like
 * a system rather than a pile of one-off cards.
 *
 * Amber is used here because every moment this renders is earned or
 * true (DECISIONS #4): a held-pause count, a streak, a date.
 */
export function Moment({
  moment,
  emphasis = false,
}: {
  moment: RewardMoment | null;
  emphasis?: boolean;
}) {
  if (!moment) return null;
  const earned = moment.tone === "earned";
  return (
    <div
      className={`rounded-[24px] border p-4 ${
        earned
          ? "border-sage-500/25 bg-sage-50/50"
          : "border-hairline bg-surface"
      }`}
    >
      <div
        className={`font-display font-bold leading-tight ${
          emphasis ? "text-[19px]" : "text-[15px]"
        } ${earned ? "text-sage-700" : ""}`}
      >
        {moment.headline}
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
        {moment.detail}
      </div>
    </div>
  );
}
