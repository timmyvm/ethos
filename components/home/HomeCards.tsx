"use client";

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

/** The shell. Deep sage, cream on it, the shape the score card set. */
function Shell({
  eyebrow,
  children,
  foot,
}: {
  eyebrow: string;
  children: React.ReactNode;
  foot: React.ReactNode;
}) {
  return (
    <section className="card-score rounded-sheet p-5 text-cream">
      <div className="label-data !text-sage-mist">{eyebrow}</div>
      <div className="mt-4 flex items-center gap-5">{children}</div>
      <div className="mt-4 border-t border-cream/15 pt-2.5 text-caption text-sage-mist">
        {foot}
      </div>
    </section>
  );
}

const RING = { size: 104, tone: "lit" as const, track: "rgba(253,246,231,0.16)" };

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
    <Shell
      eyebrow="Where you stand"
      foot={`${movedTrait} moved ${movedBy > 0 ? "up" : "down"} ${Math.abs(movedBy)} places since day one.`}
    >
      <Ring value={percentile / 100} {...RING}>
        <CountUp
          value={percentile}
          durationMs={DURATION.max}
          className="font-display text-[30px] font-extrabold leading-none"
        />
        <span className="label-micro mt-1 !text-sage-mist">percentile</span>
      </Ring>
      <p className="font-display min-w-0 text-[19px] font-bold leading-snug">
        You speak more clearly than {percentile} people in a hundred.
      </p>
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
    <Shell
      eyebrow="Your longest clean run"
      foot={
        seconds >= best
          ? "A new best. The last one stood since " + bestWhen + "."
          : `Your best is ${best}s, ${bestWhen}.`
      }
    >
      <Ring value={seconds / target} {...RING}>
        <span className="font-display flex items-baseline text-[30px] font-extrabold leading-none">
          <CountUp value={seconds} durationMs={DURATION.max} />
          <span className="text-[17px]">s</span>
        </span>
        <span className="label-micro mt-1 !text-sage-mist">of {target}</span>
      </Ring>
      <p className="font-display min-w-0 text-[19px] font-bold leading-snug">
        {seconds} seconds straight with no filler in them.
      </p>
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
    <Shell
      eyebrow="Your tell"
      foot={
        better
          ? `Two weeks ago: every ${Math.round(wasGapS)}s. The gap is widening.`
          : `Two weeks ago: every ${Math.round(wasGapS)}s.`
      }
    >
      <Ring value={gapS / target} {...RING}>
        <span className="font-display flex items-baseline text-[30px] font-extrabold leading-none">
          <CountUp value={gapS} durationMs={DURATION.max} />
          <span className="text-[17px]">s</span>
        </span>
        <span className="label-micro mt-1 !text-sage-mist">apart</span>
      </Ring>
      <p className="font-display min-w-0 text-[19px] font-bold leading-snug">
        One &ldquo;{word}&rdquo; every {Math.round(gapS)} seconds.
      </p>
    </Shell>
  );
}
