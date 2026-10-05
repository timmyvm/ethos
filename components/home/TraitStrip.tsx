"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Ring } from "@/components/Ring";
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
 * One trait as a tile, in its own colour (26 Sep, Timothy: "at the dead
 * space add trait levels"). The rows that were here carried three lines
 * of prose each; a tile carries the ring, the name and the one number,
 * and the direction and target live one tap away on the trait's own
 * screen. Day zero draws the same five tiles with empty rings, so the
 * screen has its shape before the first recording fills it.
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
  /*
   * Two shapes in one grid (#317's two wide over three narrow, kept).
   * A wide tile is a row (today-10): the ring on the left and the name
   * and the measurement beside it, where it used to stack like a narrow
   * one and leave about 86x56px empty right of the ring. A narrow tile
   * stays stacked. The measurement is set as a number (Outfit 800,
   * tabular, ink) over its unit, which prints in full and wraps evenly
   * (today-3: `line-clamp-2` cut Fillers to "per hundred...", so the
   * number lost its denominator).
   */
  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      className={`press today-trait today-tile tone-wash flex rounded-card p-3.5 ${
        wide ? "col-span-3 flex-row items-center gap-3.5" : "col-span-2 flex-col"
      }`}
    >
      <Ring
        value={reading?.fraction ?? 0}
        size={wide ? 56 : 46}
        tone="trait"
        track="var(--today-trough)"
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
      <div className={`min-w-0 ${wide ? "flex-1" : "mt-3"}`}>
        <div className="font-display tone-ink text-row leading-tight">{t.name}</div>
        {raw !== null && (
          <div className="mt-1 text-caption text-pretty text-stone-500">
            <span className="font-display text-num-s tabular-nums text-ink">{raw}</span>{" "}
            {unit}
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * The five traits, on Today, as a bento of tiles (26 Sep), weakest
 * first once there is a recording: two wide tiles on top, three under
 * them. Before it, the lesson order.
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
      <div className="stagger mt-3 grid grid-cols-6 gap-3">
        {tiles.map((t, i) => (
          <TraitTile
            key={t.id}
            id={t.id}
            reading={t.reading}
            delay={220 + i * 80}
            wide={i < 2}
          />
        ))}
      </div>
    </section>
  );
}
