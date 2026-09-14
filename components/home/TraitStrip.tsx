"use client";

import Link from "next/link";
import { TraitCard } from "@/components/TraitCard";
import { TRAIT } from "@/content/traits";
import { nextTrait, readTraitsFromRow } from "@/lib/trait-readings";
import type { RepRow } from "@/lib/client-data";

/**
 * The five traits, on Today, where the fixed road used to be
 * (DECISIONS #267).
 *
 * The road was the same road for everybody: a list of units in an order
 * chosen once, gated on stars. These five are read off the last
 * recording, and the only reason any one of them is in front of you is
 * that its number is yours. That is the shift, and putting it on the
 * first screen is what makes it real rather than a workbench page.
 *
 * The road is not deleted. It lives at /path, linked from the bottom of
 * this strip, because somebody who wants to pick a lesson by name
 * should still be able to.
 */
export function TraitStrip({ reps }: { reps: RepRow[] }) {
  const last = reps.length > 0 ? reps[reps.length - 1] : null;
  const readings = last ? readTraitsFromRow(last) : [];
  const next = readings.length > 0 ? nextTrait(readings) : null;

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-data">Your traits</h2>
        {last && (
          <span className="text-caption text-stone-400">
            From the last recording
          </span>
        )}
      </div>

      {readings.length > 0 ? (
        <>
          <div className="stagger mt-3 space-y-2.5">
            {readings.map((r, i) => (
              <TraitCard
                key={r.id}
                reading={r}
                delay={220 + i * 80}
                href={`/practice/${r.id}`}
              />
            ))}
          </div>
          <p className="mt-4 text-caption leading-relaxed text-stone-500">
            {next
              ? `Next up: ${TRAIT[next.next.id].name}, because it is your lowest.`
              : "Every scale here is provisional while the population data gets sourced, so nothing is choosing a lesson for you yet. Pick the one you want."}
          </p>
        </>
      ) : (
        /* Day one. The five names, with nothing under them yet, beat a
           blank: they are what the first recording is about to fill in,
           and the link out has to exist for somebody who has never
           spoken (it used to return null here, so day one had a floor
           button and no other door in the app). */
        <p className="mt-3 text-caption leading-relaxed text-stone-500">
          Pausing, fillers, restarts, pace and variety. Your first recording
          measures all five.
        </p>
      )}

      <Link
        href="/lessons"
        className="press mt-1 -mb-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-terracotta-700"
      >
        Browse every lesson →
      </Link>
    </section>
  );
}
