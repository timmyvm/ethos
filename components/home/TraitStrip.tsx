"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
import { Disclosure } from "@/components/ui/Disclosure";
import { TRAIT, TRAITS, type TraitId } from "@/content/traits";
import { DURATION } from "@/lib/motion";
import {
  fmtRaw,
  ordinal,
  readTraitsFromRow,
  type TraitReading,
} from "@/lib/trait-readings";
import type { RepRow } from "@/lib/client-data";

/**
 * One trait as a tile (26 Sep, Timothy: "at the dead space add trait
 * levels"). A tile carries the ring, the name and the one number; the
 * direction and the target live one tap away on the trait's own screen.
 * Day zero draws the same five tiles with empty rings, so the screen has
 * its shape before the first recording fills it.
 *
 * THE MATERIAL (round 2, M02). Every tile is the one neutral `.card`
 * (raised fill, card-edge, shadow-1), and the trait's tone lives on the
 * ring's arc, the percentile and the name only (`tone-ink`), never on
 * the ground. Five washes put five tinted grounds in the first scroll
 * where Imprint's home and Wellspoken's have one or none, and the floor
 * card's amber stopped being the one coloured surface. The trough is
 * the app's `sand`, so the arc is the only colour in the ring; every
 * tone clears 3:1 on it in both themes, the light ochre through its
 * deeper `--ring-arc` (`.today-trait`, lib/today-colour.test.ts).
 *
 * TWO SHAPES. The weakest trait (first in the sorted order) is a
 * full-width row: the 56px ring on the left, the name over the
 * measurement beside it and the row's chevron at the end, because it is
 * the one the floor card above is working on. The other four stack (ring, name, measurement) in an even
 * 2x2. The measurement is set as a number (Outfit 800, tabular, ink)
 * before its unit, which prints in full and wraps (today-3: a clamp cut
 * Fillers to "per hundred...", so the number lost its denominator).
 */
function TraitTile({
  id,
  reading,
  delay,
  wide,
}: {
  id: TraitId;
  reading: TraitReading | null;
  delay: number;
  wide: boolean;
}) {
  const t = TRAIT[id];
  const n = reading?.percentile ?? 0;
  const suffix = reading ? ordinal(n).slice(String(n).length) : "";
  const raw = reading ? fmtRaw(reading.raw) : null;
  const unit = raw === "1" ? t.unitOne : t.unit;

  const ring = (
    <Ring
      value={reading?.fraction ?? null}
      size={wide ? 56 : 46}
      tone="trait"
      track="var(--color-sand)"
      delay={delay}
      provisional={reading?.quality === "provisional"}
    >
      <span
        className={`font-display tone-ink flex items-baseline font-extrabold leading-none tabular-nums ${
          wide ? "text-num-s" : "text-row"
        }`}
      >
        {reading ? (
          <>
            <CountUp value={n} durationMs={DURATION.max} />
            <span className="text-suffix">{suffix}</span>
          </>
        ) : (
          <span aria-hidden className="opacity-60">–</span>
        )}
      </span>
    </Ring>
  );

  const measured = raw !== null && (
    <div className="mt-1 text-caption text-pretty text-stone-500">
      <span className="font-display text-num-s tabular-nums text-ink">{raw}</span>{" "}
      {unit}
    </div>
  );

  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      className={`card press today-trait p-4 ${
        wide ? "col-span-2 flex items-center gap-4" : "flex flex-col"
      }`}
    >
      {ring}
      <div className={`min-w-0 ${wide ? "flex-1" : "mt-3"}`}>
        <div
          className={`font-display tone-ink font-bold leading-tight ${
            wide ? "text-detail" : "text-body"
          }`}
        >
          {t.name}
        </div>
        {measured}
      </div>
      {/* The full-width tile is row-shaped, so it ends in the row's
          door (PRINCIPLES 5); the four in the 2x2 are tiles and carry
          none. */}
      {wide && <Disclosure />}
    </Link>
  );
}

/**
 * The five traits on Today, weakest first once there is a recording:
 * the weakest across the full width, the other four in an even 2x2
 * (round 2, M02; it was two wide over three narrow, #317). Before the
 * first recording, the lesson order.
 */
export function TraitStrip({ reps }: { reps: RepRow[] }) {
  const last = reps.length > 0 ? reps[reps.length - 1] : null;
  const readings = last ? readTraitsFromRow(last) : [];
  const sorted = [...readings].sort((a, b) => a.percentile - b.percentile);
  const tiles: { id: TraitId; reading: TraitReading | null }[] =
    sorted.length > 0
      ? sorted.map((r) => ({ id: r.id, reading: r }))
      : TRAITS.map((t) => ({ id: t.id, reading: null }));

  return (
    <section className="mt-7">
      <h2 className="section-head">Your traits</h2>
      <div className="stagger mt-3 grid grid-cols-2 gap-3">
        {tiles.map((t, i) => (
          <TraitTile
            key={t.id}
            id={t.id}
            reading={t.reading}
            delay={220 + i * 80}
            wide={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
