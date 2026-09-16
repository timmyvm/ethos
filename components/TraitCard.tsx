"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { TRAIT } from "@/content/traits";
import { DURATION } from "@/lib/motion";
import { aimLine, ordinal, withUnit, type TraitReading } from "@/lib/trait-readings";

/**
 * One trait, one ring, and since #293 a direction and a target on every
 * one (DECISIONS #257, #293).
 *
 * Three jobs:
 *
 *  1. Where you stand, as a percentile, drawn as a ring. The number in
 *     the ring is an ORDINAL ("18th"), because a bare "18" beside
 *     "Pace" read as a score out of an unknown total.
 *  2. The raw number the percentile came from, in its own unit.
 *  3. Which way is better, and a target with a source: `aimLine`.
 *
 * The ring is one step lighter below the median, so the colour carries
 * some of the meaning the digit used to carry alone.
 *
 * Two shapes. "card" is the original, kept for the workbench; "row" is
 * what Today uses, a hairline row in the same grammar as every other
 * list in the app, so five traits stop taking a screen and a half.
 */
export function TraitCard({
  reading,
  delay = 0,
  href,
  variant = "card",
  last = false,
}: {
  reading: TraitReading;
  /** Stagger a row of these so they land one at a time. */
  delay?: number;
  /** Where the lesson for this trait lives, when there is one. */
  href?: string;
  variant?: "card" | "row";
  /** The last row closes the list with a rule. */
  last?: boolean;
}) {
  const t = TRAIT[reading.id];
  const row = variant === "row";
  const n = reading.percentile;
  const suffix = ordinal(n).slice(String(n).length);

  const body = (
    <>
      <Ring
        value={reading.fraction}
        size={row ? 52 : 64}
        delay={delay}
        tone={n >= 50 ? "measured" : "dim"}
        provisional={reading.quality === "provisional"}
      >
        <span className="font-display flex items-baseline text-[15px] font-extrabold leading-none tabular-nums">
          <CountUp value={n} durationMs={DURATION.max} />
          <span className="text-[10px]">{suffix}</span>
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] font-bold">{t.name}</div>
        <div className="mt-0.5 text-caption text-stone-500">
          {withUnit(reading.id, reading.raw)}
        </div>
        <div className="mt-0.5 text-caption text-stone-400">{aimLine(reading)}</div>
      </div>
      {row && href && (
        <span aria-hidden className="shrink-0 text-stone-400">
          →
        </span>
      )}
    </>
  );

  const shell = row
    ? `flex items-center gap-4 border-t border-hairline py-3 ${last ? "border-b" : ""}`
    : "elev-1 flex items-center gap-4 rounded-card border border-card-edge bg-raised p-4";
  return href ? (
    <Link href={href} className={`press ${shell}`}>
      {body}
    </Link>
  ) : (
    <section className={shell}>{body}</section>
  );
}
