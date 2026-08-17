"use client";

import { Overlay } from "@/components/ui/Overlay";

/**
 * Premium sheet. mechanics.md: annual pushed hard, monthly present,
 * and it only ever appears AFTER visible progress (day-3 card) or on a
 * deliberate tap into locked content — never at install, never a quiz.
 * Prices are placeholders until the research pass (open queue).
 *
 * The dialog behaviour (Escape, focus trap, focus return) used to live
 * here and only here; it belongs to `<Overlay>` now, so the next sheet
 * inherits it instead of copying the version before the fix.
 */
export function Paywall({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
  return (
    <Overlay label="Ethos Premium" onClose={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[22px] bg-ground px-5 pb-8 pt-6">
        <div className="label-data">{reason}</div>
        <h2 className="font-display mt-1 text-[22px] font-bold">
          Ethos Premium
        </h2>
        <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-stone-600">
          <li>· Full pause analytics — the silence scores</li>
          <li>· Complete history + day-1-vs-day-30 cards</li>
          <li>· Your whole lexicon, not just today&apos;s swap</li>
          <li>· Boss modes: Cold Topic, Debate, Hostile Q&amp;A</li>
          <li>· Stress mods and unlimited retries</li>
        </ul>

        <div className="mt-4 flex items-center justify-between rounded-[18px] border-2 border-terracotta-500 bg-surface p-4">
          <div>
            <div className="text-[15px] font-bold">Annual</div>
            <div className="text-[12.5px] text-stone-500">
              A$6.67/mo, billed A$79.99
            </div>
          </div>
          <span className="label-data !text-terracotta-600">save 55%</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between rounded-[18px] border border-hairline bg-surface lift p-4">
          <div>
            <div className="text-[15px] font-bold">Monthly</div>
            <div className="text-[12.5px] text-stone-500">A$14.99/mo</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="press mt-4 min-h-11 w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream hover:bg-terracotta-600"
        >
          Start with annual
        </button>
        <button
          onClick={onClose}
          className="mt-3 min-h-11 w-full text-[13.5px] text-stone-500"
        >
          Not yet
        </button>
        <p className="mt-3 text-center text-[11.5px] text-stone-400">
          Money never buys stars, streaks, or scores.
        </p>
      </div>
    </Overlay>
  );
}
