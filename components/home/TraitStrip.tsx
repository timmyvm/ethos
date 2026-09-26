"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { TRAIT } from "@/content/traits";
import { DURATION } from "@/lib/motion";
import {
  aimLine,
  fmtRaw,
  ordinal,
  readTraitsFromRow,
  type TraitReading,
} from "@/lib/trait-readings";
import type { RepRow } from "@/lib/client-data";

/**
 * One trait on Today, in its own colour (the colour pass, 26 Sep).
 *
 * The same tone the trait wears on /lessons (`[data-trait]` in
 * globals.css), so a user learns "blue is pausing" once and reads it on
 * every tab. The colour is picture colour only: the ring's arc and a
 * tinted tile under it, the name in the tone's ink. It says WHICH trait,
 * never how good: the ring still measures the percentile, and the
 * ordinal inside it is the number. Terracotta stays the floor's, sage
 * stays earned.
 *
 * Every ring is drawn at full tone. `TraitCard` draws a ring below the
 * median one step lighter; here that step would break the ring: the
 * tone's arc sits at 3.1 to 3.6:1 on its trough, and even 80% of it
 * falls under the 3:1 a graphic needs. The tone says which trait, the
 * ordinal and the weakest-first order say how good.
 *
 * The raw number leads its line in ink and the rest of the line stays
 * secondary, so each row has one number in ink under the ring's and
 * the direction and target (#293) sit quietly under both. It replaces
 * `TraitCard`'s row variant here; the card shape stays for the
 * workbench.
 */
function TraitRow({
  reading,
  delay,
  last,
}: {
  reading: TraitReading;
  delay: number;
  last: boolean;
}) {
  const t = TRAIT[reading.id];
  const n = reading.percentile;
  const suffix = ordinal(n).slice(String(n).length);
  const raw = fmtRaw(reading.raw);
  const unit = raw === "1" ? t.unitOne : t.unit;
  return (
    <Link
      href={`/practice/${reading.id}`}
      data-trait={reading.id}
      className={`press today-trait flex items-center gap-3.5 border-t border-hairline py-3 ${
        last ? "border-b" : ""
      }`}
    >
      <span className="today-trait-tile tone-wash flex size-16 shrink-0 items-center justify-center rounded-control">
        <Ring
          value={reading.fraction}
          size={50}
          tone="trait"
          track="var(--today-trough)"
          delay={delay}
          provisional={reading.quality === "provisional"}
        >
          <span className="font-display tone-ink flex items-baseline text-[15px] font-extrabold leading-none tabular-nums">
            <CountUp value={n} durationMs={DURATION.max} />
            <span className="text-[10px]">{suffix}</span>
          </span>
        </Ring>
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display tone-ink text-[15px] font-bold">
          {t.name}
        </div>
        <div className="mt-0.5 text-caption text-stone-500">
          <span className="font-display font-bold text-ink tabular-nums">
            {raw}
          </span>{" "}
          {unit}
        </div>
        <div className="mt-0.5 text-caption text-stone-400">
          {aimLine(reading)}
        </div>
      </div>
      <span aria-hidden className="tone-ink shrink-0 opacity-70">
        →
      </span>
    </Link>
  );
}

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
            <TraitRow
              key={r.id}
              reading={r}
              delay={220 + i * 80}
              last={i === sorted.length - 1}
            />
          ))}
        </div>
      ) : (
        /* Day one. The five names, with nothing under them yet, beat a
           blank: they are what the first recording is about to fill in.
           Each wears its tone, so the colours are learned before the
           first number arrives. The sentence is unchanged. */
        <p className="mt-3 text-caption leading-relaxed text-stone-500">
          <span data-trait="pause" className="tone-ink font-bold">Pausing</span>,{" "}
          <span data-trait="fillers" className="tone-ink font-bold">fillers</span>,{" "}
          <span data-trait="repairs" className="tone-ink font-bold">restarts</span>,{" "}
          <span data-trait="pace" className="tone-ink font-bold">pace</span> and{" "}
          <span data-trait="range" className="tone-ink font-bold">variety</span>. Your
          first recording measures all five.
        </p>
      )}
    </section>
  );
}
