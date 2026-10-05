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
   * A wide tile puts the name beside the ring (today-10: stacked, it
   * left about 86x56px empty right of the ring) and gives the
   * measurement the tile's full width under them. A first pass set the
   * measurement beside the ring too, and its 71px column wrapped
   * "1.8 held pauses a minute" onto three lines. A narrow tile stacks.
   * The measurement is set as a number (Outfit 800, tabular, ink) before
   * its unit, which prints in full and wraps evenly (today-3:
   * `line-clamp-2` cut Fillers to "per hundred...", so the number lost
   * its denominator).
   */
  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      className={`press today-trait today-tile tone-wash flex flex-col rounded-card p-3.5 ${
        wide ? "col-span-3" : "col-span-2"
      }`}
    >
      <div className={wide ? "flex items-center gap-3" : "contents"}>
      <Ring
        value={reading?.fraction ?? null}
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
      <div className={`font-display tone-ink text-row min-w-0 leading-tight ${wide ? "" : "mt-3"}`}>
        {t.name}
      </div>
      </div>
      {raw !== null && (
        <div className={`text-caption text-pretty text-stone-500 ${wide ? "mt-2.5" : "mt-1"}`}>
          <span className="font-display text-num-s tabular-nums text-ink">{raw}</span>{" "}
          {unit}
        </div>
      )}
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
