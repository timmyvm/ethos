"use client";

import type { RepGain } from "@/lib/progress";

/**
 * What this rep changed, in numbers, shown once on the results screen.
 *
 * Task-level feedback rather than self-level praise: Hattie & Timperley
 * found praise for task performance among the least effective feedback
 * there is, precisely because it carries no learning information. So
 * this row never says "great rep" — it says what moved and by how much,
 * including when the number went down.
 */
export function GainsRow({ gains }: { gains: RepGain[] }) {
  if (gains.length === 0) return null;
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto">
      {gains.map((g, i) => (
        <div
          key={i}
          className="shrink-0 rounded-[24px] border border-sage-500/30 bg-surface px-3.5 py-2.5"
        >
          <div className="font-display text-[17px] leading-none text-sage-700">
            {g.label}
          </div>
          <div className="mt-1 text-[11.5px] text-stone-500">{g.detail}</div>
        </div>
      ))}
    </div>
  );
}
