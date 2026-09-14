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
    <div className="flex gap-2 overflow-x-auto">
      {gains.map((g, i) => (
        <div
          key={i}
          /* Flat on purpose: these sit ABOVE the Index on the results
             screen, and a lifted chip there makes the first thing the
             eye lands on something other than the number. */
          className={`shrink-0 rounded-card border bg-surface px-3.5 py-2.5 ${
            g.good === false ? "border-edge" : "border-sage-300"
          }`}
        >
          <div
            className={`font-display text-[19px] font-extrabold leading-none ${
              g.good === false ? "text-rust" : "text-sage-700"
            }`}
          >
            {g.label}
          </div>
          <div className="mt-1.5 text-caption text-stone-500">{g.detail}</div>
        </div>
      ))}
    </div>
  );
}
