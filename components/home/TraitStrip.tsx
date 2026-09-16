"use client";

import { TraitCard } from "@/components/TraitCard";
import { readTraitsFromRow } from "@/lib/trait-readings";
import type { RepRow } from "@/lib/client-data";

/**
 * The five traits, on Today, where the fixed road used to be
 * (DECISIONS #267, #293).
 *
 * Read off the last recording, and the only reason any one of them is
 * in front of you is that its number is yours. Since #293 they are ROWS
 * rather than cards, sorted weakest first, and the section is called
 * what it is: "Last recording", not "Your traits", because these are
 * per-recording measurements and "traits" promised a personality.
 *
 * The paragraph that used to sit under the list ("every placement here
 * is provisional until the population data is sourced") was roadmap
 * language on the first screen and is gone; the floor card already
 * says which number is lowest and why. The "Browse every lesson" link
 * went with it: the Lessons tab is directly beneath.
 */
export function TraitStrip({ reps }: { reps: RepRow[] }) {
  const last = reps.length > 0 ? reps[reps.length - 1] : null;
  const readings = last ? readTraitsFromRow(last) : [];
  const sorted = [...readings].sort((a, b) => a.percentile - b.percentile);

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-data">Last recording</h2>
        {last && (
          <span className="text-caption text-stone-400">
            Weakest first. Rings are percentiles.
          </span>
        )}
      </div>

      {sorted.length > 0 ? (
        <div className="stagger mt-3">
          {sorted.map((r, i) => (
            <TraitCard
              key={r.id}
              reading={r}
              delay={220 + i * 80}
              href={`/practice/${r.id}`}
              variant="row"
              last={i === sorted.length - 1}
            />
          ))}
        </div>
      ) : (
        /* Day one. The five names, with nothing under them yet, beat a
           blank: they are what the first recording is about to fill in. */
        <p className="mt-3 text-caption leading-relaxed text-stone-500">
          Pausing, fillers, restarts, pace and variety. Your first recording
          measures all five.
        </p>
      )}
    </section>
  );
}
