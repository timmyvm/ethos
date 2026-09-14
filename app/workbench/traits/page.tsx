"use client";

import { useEffect, useState } from "react";
import { TraitCard } from "@/components/TraitCard";
import { fetchReps } from "@/lib/client-data";
import { nextTrait, readTraitsFromRow, type TraitReading } from "@/lib/trait-readings";

/**
 * The trait set, read off the last recording (DECISIONS #257).
 *
 * A workbench page rather than a screen, for now: where these cards
 * finally live is Today, and putting them there is the change that
 * retires the Ethos Index from the first card. That is a bigger move
 * than the shift's first pass, so they are rendered here where they can
 * be looked at, photographed and argued with first.
 *
 * What it is worth checking here: every card carries the NEXT MOVE and
 * not only the position. A percentile on its own is a bare descriptive
 * norm, and the field evidence in docs/closure.md is that a bare
 * descriptive norm makes people who are doing well ease off.
 */
export default function Traits() {
  const [readings, setReadings] = useState<TraitReading[] | null>(null);

  useEffect(() => {
    fetchReps(5)
      .then((reps) => {
        if (reps.length === 0) return;
        setReadings(readTraitsFromRow(reps[reps.length - 1]));
      })
      .catch(() => {});
  }, []);

  const next = readings ? nextTrait(readings) : null;

  return (
    <main className="mx-auto max-w-[390px] px-5 pb-16 pt-8">
      <h1 className="label-data">Your traits, from the last recording</h1>

      <div className="stagger mt-4 space-y-3">
        {(readings ?? []).map((r, i) => (
          <TraitCard
            key={r.id}
            reading={r}
            delay={200 + i * 90}
            href={`/practice/${r.id}`}
          />
        ))}
      </div>

      <p className="mt-5 text-caption leading-relaxed text-stone-500">
        {next
          ? `Next lesson: ${next.next.id}, because it is the lowest.`
          : "No lesson yet: every percentile here is provisional, and a lesson chosen on a number the evidence does not support would be a guess wearing a reason."}
      </p>
    </main>
  );
}
