"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { DURATION } from "@/lib/motion";

/**
 * Three candidates for the first card (DECISIONS #255), rendered side
 * by side at `/workbench/home-cards` so the choice is made by looking.
 *
 * The brief: the first card needs a metric a BODY understands, not an
 * index. "648 / 1000" is a number nobody has an instinct for; it has to
 * be learned before it can mean anything, and the one thing a first
 * card cannot ask for is study.
 *
 * All three share the same shell on purpose. The comparison is between
 * the METRICS, and three different card designs would be comparing
 * three different card designs.
 *
 * Each one carries the same duty: a number with a unit a person already
 * owns, a ring whose gap is real rather than decorative, and a second
 * line that traces the number to something they can act on.
 */

/**
 * The one shell the home cards share.
 *
 * Exported because `components/home/CleanRunCard.tsx` ships the B
 * option and this file keeps all three as the archive of the choice.
 * Two copies of the same shell is two things to keep in step, and they
 * would not stay in step.
 *
 * THE MATERIAL (round 2). The standard neutral `.card` at shadow-1, ink
 * text, the ring's arc in sage because the number is earned. It wore
 * the deep sage (`.card-score`, cream ink, #165), which made it Today's
 * heaviest mass in the squint, darker than the floor card holding the
 * one tap; the deep sage stays on the Log's score card, where it is the
 * screen's hero.
 *
 * Two bands, not three (today-1): the ring row, then what follows it
 * (`after`, the day trail on Today), which draws the card's only rule
 * itself. The eyebrow is one idea in sentence case (M05). A card's
 * padding and radius (p-4, 16): the floor card is Today's hero.
 */
export function Shell({
  eyebrow,
  aside,
  children,
  after,
  href,
}: {
  /** A door: the whole card is the link, and its press is the card's. */
  href?: string;
  eyebrow: string;
  /** Top right, opposite the eyebrow. A state or the door's chevron. */
  aside?: React.ReactNode;
  /** The ring, then a `Headline` column beside it. */
  children: React.ReactNode;
  /** Under the ring row. The day trail, on Today; it draws its rule. */
  after?: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="flex min-h-[18px] items-center justify-between gap-3">
        <div className="eyebrow">{eyebrow}</div>
        {aside}
      </div>
      <div className="mt-3 flex items-center gap-5">{children}</div>
      {after && <div className="mt-4">{after}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card press block p-4">
      {inner}
    </Link>
  ) : (
    <section className="card p-4">{inner}</section>
  );
}

/**
 * The column beside the ring: what the ring shows, in words, and one
 * caption line under it (what used to be the ruled foot).
 */
export function Headline({
  children,
  foot,
}: {
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-display text-lead font-bold leading-snug text-balance">
        {children}
      </div>
      {foot && <p className="mt-1.5 text-caption text-pretty text-stone-500">{foot}</p>}
    </div>
  );
}

/** The number in the ring: Outfit 800 tabular, with its unit beside it. */
function RingNumber({ value, unit }: { value: number; unit?: string }) {
  return (
    <span className="font-display flex items-baseline text-num-l tabular-nums">
      <CountUp value={value} durationMs={DURATION.max} />
      {unit && <span className="text-num-s">{unit}</span>}
    </span>
  );
}

/** Under the ring's number: Figtree, sentence case, never tracked caps. */
function RingLabel({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 text-caption font-medium text-stone-500">{children}</span>;
}

/** Sage, because the number is earned; the trough is the app's sand. */
const RING = { size: 96, tone: "measured" as const, track: "var(--color-sand)" };

/**
 * A. THE STANDING — a position among people.
 *
 * The argument for it: "clearer than 62 out of 100 people" needs no
 * scale and no tutorial, and a percentile is the one number in the
 * brief that is already specified.
 *
 * The argument against it, stated plainly because it is the reason this
 * is a choice rather than a decision: it is still a COMPOSITE. Roll
 * five traits into one figure and you have rebuilt the Ethos Index with
 * a friendlier unit, and you have hidden which number moved.
 */
export function CardStanding({
  percentile,
  movedTrait,
  movedBy,
}: {
  percentile: number;
  movedTrait: string;
  movedBy: number;
}) {
  return (
    <Shell eyebrow="Where you stand">
      <Ring value={percentile / 100} {...RING}>
        <RingNumber value={percentile} />
        <RingLabel>percentile</RingLabel>
      </Ring>
      <Headline
        foot={`${movedTrait} moved ${movedBy > 0 ? "up" : "down"} ${Math.abs(movedBy)} places since day one.`}
      >
        You speak more clearly than {percentile} people in a hundred.
      </Headline>
    </Shell>
  );
}

/**
 * B. THE CLEAN RUN — a duration.
 *
 * The argument for it: seconds are the only speech unit a body already
 * owns. Nobody needs to be told whether forty seconds is more than
 * thirty. It is one trait, it is a personal best rather than a rank, it
 * cannot be confused with a judgement of the person, and the ring has a
 * real target to close (sixty seconds, the length of the recording).
 *
 * The argument against: it moves in lumps. One stray "um" at second 31
 * halves it, so a good day can read as a bad one.
 */
export function CardCleanRun({
  seconds,
  best,
  bestWhen,
  target = 60,
}: {
  seconds: number;
  best: number;
  bestWhen: string;
  target?: number;
}) {
  return (
    <Shell eyebrow="Your longest clean run">
      <Ring value={seconds / target} {...RING}>
        <RingNumber value={seconds} unit="s" />
        <RingLabel>of {target}s</RingLabel>
      </Ring>
      <Headline
        foot={
          seconds >= best
            ? "A new best. The last one stood since " + bestWhen + "."
            : `Your best is ${best}s, ${bestWhen}.`
        }
      >
        {seconds} seconds straight with no filler in them.
      </Headline>
    </Shell>
  );
}

/**
 * C. THE TELL — a rate, turned into the gap between.
 *
 * The argument for it: "4.3 fillers a minute" is a statistic; "an um
 * every fourteen seconds" is a rhythm, and a rhythm is something a
 * person can hear themselves doing. It names one specific habit rather
 * than grading a person, which is the least judgemental of the three.
 * The ring closes as the gap widens toward a target interval.
 *
 * The argument against: it leads with the thing you are worst at, every
 * single day. That is the one card of the three that could read as a
 * scold, and vision.md rules out manufacturing insecurity.
 */
export function CardTell({
  word,
  gapS,
  wasGapS,
  target = 30,
}: {
  word: string;
  gapS: number;
  wasGapS: number;
  target?: number;
}) {
  const better = gapS > wasGapS;
  return (
    <Shell eyebrow="Your tell">
      <Ring value={gapS / target} {...RING}>
        <RingNumber value={gapS} unit="s" />
        <RingLabel>apart</RingLabel>
      </Ring>
      <Headline
        foot={
          better
            ? `Two weeks ago: every ${Math.round(wasGapS)}s. The gap is widening.`
            : `Two weeks ago: every ${Math.round(wasGapS)}s.`
        }
      >
        One &ldquo;{word}&rdquo; every {Math.round(gapS)} seconds.
      </Headline>
    </Shell>
  );
}
