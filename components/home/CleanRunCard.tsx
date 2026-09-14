"use client";

import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { Shell } from "@/components/home/HomeCards";
import { DURATION } from "@/lib/motion";
import { longestCleanRun } from "@/lib/clean-run";
import type { RepRow } from "@/lib/client-data";

/**
 * Today's first measurement: the longest stretch of the last recording
 * with no filler in it (DECISIONS #254, #267).
 *
 * This is the card that replaces the Ethos Index on the first screen,
 * and the reason is the whole shift in one comparison. "648 out of
 * 1000" is a number nobody has an instinct for: it has to be learned
 * before it can mean anything, and once learned it still hides which of
 * five traits moved. "41 seconds straight with no filler" is a
 * DURATION, and a duration is the only speech number a body already
 * knows how to feel. Nobody needs telling whether forty seconds is more
 * than thirty.
 *
 * It is also the one number here that is not a position. Every trait
 * below it is a percentile against a population whose spread is not
 * published well enough to trust yet (docs/percentiles.md), and this
 * one is a personal best against your own last two weeks. That is worth
 * having at the top: a measurement that is exactly true, on a scale
 * that needs no source.
 *
 * The Index is not deleted, it is demoted: /history still opens on it.
 */
export function CleanRunCard({
  reps,
  children,
}: {
  /** Oldest first, as `fetchReps` returns them. */
  reps: RepRow[];
  /** The day trail. Behaviour, kept beside the outcome and never mixed
      into it (docs/closure.md, the matching effect). */
  children?: React.ReactNode;
}) {
  const runs = reps.map((r) => ({
    at: r.created_at,
    s: longestCleanRun(r.fillers ?? [], r.duration_s).seconds,
    of: r.duration_s,
  }));
  if (runs.length === 0) return null;

  const now = runs[runs.length - 1];
  const earlier = runs.slice(0, -1);
  const best = earlier.reduce<{ at: string; s: number } | null>(
    (b, r) => (b === null || r.s > b.s ? r : b),
    null
  );
  const isBest = best === null || now.s >= best.s;
  const shown = Math.round(now.s);

  /*
   * The ring is drawn against THIS RECORDING'S OWN LENGTH, so a full
   * ring means the whole thing was clean. A real ceiling rather than a
   * chosen target, which is the one kind of ring docs/closure.md says
   * can honestly close.
   *
   * It used to say "of 60" and that was simply wrong: lib/rep-config.ts
   * caps a daily recording at DAILY_MAX_SECONDS = 90, so a 75 second
   * clean run overfilled the ring and the label misstated the ceiling.
   * The recording's own duration needs no constant and is true whatever
   * mods are on, including the tight timer's 30.
   */
  const ceiling = Math.max(1, now.of);
  return (
    <Shell
      eyebrow="Your longest clean run"
      aside={
        isBest && shown > 0 ? (
          <div className="label-micro !text-sage-lit">Best yet</div>
        ) : undefined
      }
      foot={
        /* Fillers only, said where the number is, because
           self-corrections are counted and not timestamped and a
           measure that quietly ignores half of what it names is worse
           than a narrow one. */
        best === null
          ? "Fillers only. Self-corrections are counted separately."
          : isBest
            ? `A new best. The last one was ${Math.round(best.s)}s.`
            : `Your best is ${Math.round(best.s)}s.`
      }
      after={children}
    >
      <Ring
        value={now.s / ceiling}
        size={104}
        tone="lit"
        track="rgba(253,246,231,0.16)"
        delay={160}
      >
        <span className="font-display flex items-baseline text-[30px] font-extrabold leading-none">
          <CountUp value={shown} durationMs={DURATION.max} />
          <span className="text-[17px]">s</span>
        </span>
        <span className="label-micro mt-1 !text-sage-mist">of {Math.round(ceiling)}</span>
      </Ring>
      <p className="font-display min-w-0 text-[19px] font-bold leading-snug">
        {shown} seconds straight with no filler in them.
      </p>
    </Shell>
  );
}
