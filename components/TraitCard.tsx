"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { TRAIT } from "@/content/traits";
import { DURATION } from "@/lib/motion";
import { move, ordinal, type TraitReading } from "@/lib/trait-readings";

/**
 * One trait, one ring, one thing to do about it (DECISIONS #257).
 *
 * The card has exactly three jobs and refuses a fourth:
 *
 *  1. Where you stand, as a percentile, drawn as a ring so the gap is
 *     visible rather than implied.
 *  2. The raw number the percentile came from. A position with no
 *     measurement under it is a judgement, and vision.md says feedback
 *     traces to a number or it is not said.
 *  3. What would move it five points, in this trait's own units.
 *
 * There is no grade, no colour coding by good or bad, and no star.
 * A percentile is a position, and dressing a position as a verdict is
 * how a measurement turns into a scold.
 */
export function TraitCard({
  reading,
  delay = 0,
  href,
}: {
  reading: TraitReading;
  /** Stagger a row of these so they land one at a time. */
  delay?: number;
  /** Where the lesson for this trait lives, when there is one. */
  href?: string;
}) {
  const t = TRAIT[reading.id];
  const step = move(reading);
  const shown = fmt(reading.raw);

  const body = (
    <>
      <div className="flex items-center gap-4">
        <Ring
          value={reading.fraction}
          size={64}
          delay={delay}
          provisional={reading.quality === "provisional"}
        >
          <CountUp
            value={reading.percentile}
            durationMs={DURATION.max}
            className="font-display text-[19px] font-extrabold leading-none"
          />
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-bold">{t.name}</div>
          <div className="mt-0.5 text-caption text-stone-500">
            {/*
              * The MEASUREMENT first, always, then where it sits. What
              * somebody did is known; the place it sits is the part
              * that can be provisional, and saying "not enough data"
              * beside a number that is perfectly well measured reads
              * as though the measurement were the doubtful half.
              */}
            {/* On the DISPLAYED value, not the raw one: 0.997 prints
                as "1" and then reads "1 restarts a minute". */}
            {shown} {shown === "1" ? t.unitOne : t.unit}
            {" · "}
            {reading.quality === "provisional" ? (
              <span className="text-stone-400">scale provisional</span>
            ) : (
              <>{ordinal(reading.percentile)} percentile</>
            )}
          </div>
        </div>
      </div>

      {step && (
        <p className="mt-3 border-t border-hairline pt-2.5 text-caption text-stone-500">
          <span className="font-semibold text-ink">
            To reach the {ordinal(step.target)}:
          </span>{" "}
          {t.move(round(step.delta), step.up)}
        </p>
      )}
    </>
  );

  const shell = "elev-1 rounded-card border border-card-edge bg-raised p-4";
  return href ? (
    <Link href={href} className={`press block ${shell}`}>
      {body}
    </Link>
  ) : (
    <section className={shell}>{body}</section>
  );
}

/** One decimal for a rate, none for a count above ten. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
}

/**
 * The move is rounded to something a person can DO. "0.4 fewer fillers
 * a minute" is arithmetic; you cannot say four tenths of an um, so a
 * sub-one delta becomes one.
 */
function round(n: number): number {
  return Math.max(1, Math.round(n));
}
