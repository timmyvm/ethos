"use client";

import { useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { PremiumMark } from "@/components/PremiumMark";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Overlay } from "@/components/ui/Overlay";
import { ACTION_CLASS } from "@/lib/ui";
import { SPRING, springMs } from "@/lib/spring";
import { formatAud, formatBare, priceForMonth } from "@/lib/pricing";
import { TODAY, addMonths, dayMonth, dayMonthLong } from "./data";
import { Roll } from "./Roll";
import { Stair } from "./Stair";

/**
 * The two moments, direction B. Both are the stair doing what stairs
 * do, once: on the checkout return the token drops onto month 1 and the
 * step takes its weight; on the month the price steps down, the token
 * hops one step down and the price rolls on the frame it lands.
 */

/**
 * (6) Back from checkout, on You (?checkout=done): one arrival, Demos
 * celebrating at 128 (his clip plays), one line from him, and the plan
 * as it now stands. `role="status"` reads it once.
 */
export function CheckoutReturn({ replay = 0 }: { replay?: number }) {
  const now = priceForMonth(1);
  const next = priceForMonth(2);
  const on = addMonths(TODAY, 1);
  return (
    <section
      key={replay}
      role="status"
      aria-label={`Premium is on. Month 1, ${formatAud(now)}. ${formatAud(next)} from ${dayMonthLong(on)}.`}
      className="card arrive overflow-hidden p-5"
    >
      <div className="flex items-end gap-1">
        <DemosArt pose="celebrate" size={128} className="-ml-3 shrink-0" />
        <SpeechBubble tail="left" className="mb-7 min-w-0 flex-1">
          Premium is on. This is your first step.
        </SpeechBubble>
      </div>
      <Stair tone="neutral" size="sm" at={1} drop bleed={20} className="mt-4" label={`Month 1 of the price ladder, ${formatAud(now)}.`} />
      <div aria-hidden className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-caption text-stone-500">Month 1</p>
          <p className="font-display mt-0.5 text-num-m tabular-nums">
            <span className="lb-cur text-stone-500">A$</span>
            {formatBare(now)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-caption text-stone-500">From {dayMonth(on)}</p>
          <p className="font-display mt-0.5 text-num-m tabular-nums">
            <span className="lb-cur text-stone-500">A$</span>
            {formatBare(next)}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * (7) The month the price steps down: a short plum sheet on the first
 * open after the renewal, once per rung (the seen rung lives in the
 * database). The token hops from month 3 to month 4; on the landing
 * frame the step dips, a sheen crosses it, the haptic fires and the
 * price rolls 10.99 to 9.99, two glyphs turning, three holding still.
 * From month 8 there is no drop, so there is no moment.
 */
export function DropBody({
  month = 4,
  replay = 0,
  hopDelay = 0,
  onClose,
  className = "",
}: {
  month?: number;
  replay?: number;
  hopDelay?: number;
  onClose: () => void;
  className?: string;
}) {
  const before = priceForMonth(month - 1);
  const now = priceForMonth(month);
  const after = priceForMonth(month + 1);
  const from = addMonths(TODAY, 1); // month 4 begins on the renewal, 24 Nov
  const nextOn = addMonths(from, 1);
  const [landed, setLanded] = useState(replay === 0);
  const [seen, setSeen] = useState(replay);
  if (seen !== replay) {
    setSeen(replay);
    setLanded(false);
  }
  const shown = landed ? now : before;
  return (
    <div
      className={`card-premium w-full max-w-[430px] overflow-x-hidden rounded-t-sheet px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 text-cream ${className}`}
    >
      <div aria-hidden className="mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-cream/30" />
      <PremiumMark variant="chip" />
      <p role="status" className="sr-only">
        {landed ? `Your price dropped to ${formatAud(now)}.` : ""}
      </p>
      <div aria-hidden>
        <p className="font-display mt-3 text-detail text-cream">Your price dropped</p>
        <p className="font-display mt-1 text-num-hero tabular-nums text-cream">
          <span className="lb-cur text-cream/70">A$</span>
          <Roll text={formatBare(shown)} value={shown} />
        </p>
      </div>
      <p className="mt-2 text-caption text-cream/70">
        Month {month} starts today. {formatAud(after)} from {dayMonth(nextOn)}.
      </p>
      <Stair
        tone="plum"
        size="lg"
        at={month}
        hop={{ from: month - 1, to: month, key: replay }}
        hopDelay={hopDelay}
        onLand={() => setLanded(true)}
        bleed={24}
        className="mt-5"
        label={`Month ${month} of the price ladder, ${formatAud(now)}.`}
      />
      <button type="button" onClick={onClose} className={`${ACTION_CLASS} mt-6`}>
        Done
      </button>
    </div>
  );
}

export function DropSheet({ onClose }: { onClose: () => void }) {
  return (
    <Overlay label="Your price dropped" onClose={onClose}>
      {/* The hop waits for the sheet to be most of the way up. */}
      <DropBody onClose={onClose} replay={1} hopDelay={Math.round(springMs(SPRING.sheet) * 0.6)} />
    </Overlay>
  );
}
