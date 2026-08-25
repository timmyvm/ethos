"use client";

import type { Milestone } from "@/lib/progress";

/**
 * The closest things you're about to earn, nearest first.
 *
 * Two findings drive the shape. Goal-gradient: effort rises as the
 * perceived gap closes, so proximity decides the order and the exact
 * remaining count is always visible. And the SDT gamification
 * meta-analysis found rewards lift motivation only when they read as
 * INFORMATION rather than control — so every row names the number it
 * measures. A milestone that can't state its number doesn't belong
 * here; that's the participation-trophy failure mode.
 */
export function NextUp({
  milestones,
  limit = 3,
}: {
  milestones: Milestone[];
  limit?: number;
}) {
  const shown = milestones.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div>
      <div className="label-data">Next up · closest first</div>
      <div className="mt-2 space-y-2">
        {shown.map((m) => (
          <div
            key={m.id}
            className="rounded-[24px] border border-hairline bg-surface lift p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold">{m.label}</span>
              <span className="label-data shrink-0">{m.remainingLabel}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-sage-500 transition-[width] duration-700"
                style={{ width: `${Math.max(3, m.progress * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[12px] text-stone-500">{m.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
