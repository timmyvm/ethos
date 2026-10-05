"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { Headline, Shell } from "@/components/home/HomeCards";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/Skeleton";
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
  const whole = shown >= Math.round(ceiling);
  /*
   * Reframed after the 16 Sep review (#293). "Your longest clean run"
   * over a full ring and then "your best is 52s" contradicted itself:
   * the eyebrow says WHICH recording, the ring carries the unit, and
   * the headline says what the ring shows rather than repeating its
   * number. The card was the loudest thing on the page and did nothing
   * when tapped; it opens the log now, where the run and the Index live.
   *
   * Slimmed for the squint (today-1): the foot line sits under the
   * headline beside the ring instead of in a ruled band of its own, and
   * the eyebrow is one idea, "Last recording's clean run", where it was
   * two in caps joined by a middot. The door is the app's one chevron
   * (today-17). The "Best yet" tag went with the band: the line under
   * the headline already says "A new best", and the tag said it twice.
   */
  return (
    <Link href="/history" className="press block rounded-card">
      <Shell
        eyebrow="Last recording's clean run"
        aside={<Disclosure className="text-sage-mist" />}
        after={children}
      >
        <Ring
          value={now.s / ceiling}
          size={96}
          tone="lit"
          track="rgba(253,246,231,0.16)"
          delay={160}
        >
          <span className="font-display flex items-baseline text-num-l tabular-nums">
            <CountUp value={shown} durationMs={DURATION.max} />
            <span className="text-num-s">s</span>
          </span>
          {/* Sentence case in Figtree (today-13): `.label-micro`
              capitalised the seconds symbol, "OF 65S". */}
          <span className="mt-1 text-caption font-medium text-sage-mist">
            of {Math.round(ceiling)}s
          </span>
        </Ring>
        <Headline
          foot={
            /* Fillers only, said where the number is, because
               self-corrections are counted and not timestamped and a
               measure that quietly ignores half of what it names is
               worse than a narrow one. */
            best === null
              ? "Fillers only. Self-corrections are counted separately."
              : isBest
                ? `A new best. The last one was ${Math.round(best.s)}s.`
                : `Best so far: ${Math.round(best.s)}s.`
          }
        >
          {whole ? "The whole recording, no filler." : "Longest stretch without a filler."}
        </Headline>
      </Shell>
    </Link>
  );
}

/**
 * The clean run while the history read is in flight, shaped to the card
 * as it is now (today-1): the eyebrow, the 96px ring with the headline
 * and its caption beside it, then the trail under its rule. Here rather
 * than in components/ui/Skeleton.tsx because it has to change whenever
 * this card does; `SkeletonCleanRun` there still draws the old ruled
 * foot band, the 34px it would shift by.
 */
export function SkeletonCleanRunCard() {
  const bar = "!bg-cream/10";
  return (
    <section aria-hidden className="card-score rounded-card p-4">
      <div className="flex h-[18px] items-center">
        <Skeleton className={`h-2.5 w-44 ${bar}`} />
      </div>
      <div className="mt-3 flex items-center gap-5">
        <div className="size-[96px] shrink-0 rounded-full border-[8px] border-cream/10" />
        <div className="min-w-0 flex-1">
          <Skeleton className={`h-5 w-full ${bar}`} />
          <Skeleton className={`mt-2 h-5 w-3/4 ${bar}`} />
          <Skeleton className={`mt-3 h-3 w-24 ${bar}`} />
        </div>
      </div>
      <div className="mt-4 border-t border-cream/10 pt-4">
        <Skeleton className={`h-[22px] w-full ${bar}`} />
        <div className="mt-2.5 flex h-[18px] items-center">
          <Skeleton className={`h-3 w-48 ${bar}`} />
        </div>
      </div>
    </section>
  );
}
