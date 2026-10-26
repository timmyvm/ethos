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
 * One trait as a row (the cohesion pass, 26 Oct). It was a tile: five
 * neutral cards, one wide over a 2x2, each with a 46 to 56px ring in its
 * tone and its name in its tone's ink, which on Today made five hues at
 * equal weight under an amber card, a blue ring and a sage ring ("I
 * think everything competes", a first-time tester). Today's one hero is
 * the stage now, so the traits are what every other tab's list is: rows
 * on the ground under a section head, a hairline between them, each
 * ending in the row's door (Lessons' rows, the Log's tables, You's
 * traits).
 *
 * The trait's colour is the accent and nothing more: its 8px mark
 * before the name and the 3px arc of its 40px ring, on the app's `sand`
 * (3:1 or better in both themes, lib/today-colour.test.ts), with the
 * percentile in ink inside it. The cohesion pass drew the arcs in stone,
 * and five grey arcs read as five loading spinners (the fix round): a
 * ring that measures a trait wears the trait, grey is only ever the
 * trough. Below the first screen, at 3px, they do not compete with the
 * stage. The name is in ink, the measurement a number before its unit
 * (today-3: the unit prints in full and wraps).
 * The direction and the target live one tap away on the trait's own
 * screen. Day zero draws the same five rows with empty rings.
 */
function TraitRow({
  id,
  reading,
  delay,
  first,
}: {
  id: TraitId;
  reading: TraitReading | null;
  delay: number;
  first: boolean;
}) {
  const t = TRAIT[id];
  const n = reading?.percentile ?? 0;
  const suffix = reading ? ordinal(n).slice(String(n).length) : "";
  const raw = reading ? fmtRaw(reading.raw) : null;
  const unit = raw === "1" ? t.unitOne : t.unit;

  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      className={`press-row today-trait relative -mx-5 flex items-center gap-3.5 px-5 py-3 focus-visible:-outline-offset-3! ${
        first ? "" : ROW_RULE
      }`}
    >
      <Ring
        value={reading?.fraction ?? null}
        size={40}
        thickness={3}
        tone="trait"
        track="var(--color-sand)"
        delay={delay}
        provisional={reading?.quality === "provisional"}
      >
        <span className="font-display flex items-baseline text-caption font-extrabold leading-none tabular-nums">
          {reading ? (
            <>
              <CountUp value={n} durationMs={DURATION.max} />
              <span className="text-suffix">{suffix}</span>
            </>
          ) : (
            <span aria-hidden className="text-stone-400">–</span>
          )}
        </span>
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="font-display flex items-center gap-1.5 text-row">
          <span aria-hidden className="trait-dot" />
          {t.name}
        </span>
        {raw !== null && (
          <span className="mt-0.5 block text-caption text-pretty text-stone-500">
            <span className="font-display font-bold tabular-nums text-ink">{raw}</span>{" "}
            {unit}
          </span>
        )}
      </span>
      <Disclosure />
    </Link>
  );
}

/**
 * The inset rule between rows: a hairline from the name's edge (20 gutter
 * + 40 ring + 14 gap = 74px) to the row's end, Lessons' row grammar.
 */
const ROW_RULE =
  "before:absolute before:left-[74px] before:right-0 before:top-0 before:h-px before:origin-top before:scale-y-50 before:bg-hairline";

/**
 * The five traits on Today, weakest first once there is a recording (the
 * one the stage above is working on leads). Before the first recording,
 * the lesson order.
 */
export function TraitStrip({ reps }: { reps: RepRow[] }) {
  const last = reps.length > 0 ? reps[reps.length - 1] : null;
  const readings = last ? readTraitsFromRow(last) : [];
  const sorted = [...readings].sort((a, b) => a.percentile - b.percentile);
  const rows: { id: TraitId; reading: TraitReading | null }[] =
    sorted.length > 0
      ? sorted.map((r) => ({ id: r.id, reading: r }))
      : TRAITS.map((t) => ({ id: t.id, reading: null }));

  return (
    <section className="mt-7">
      <h2 className="section-head">Your traits</h2>
      <div className="stagger mt-1">
        {rows.map((t, i) => (
          <TraitRow
            key={t.id}
            id={t.id}
            reading={t.reading}
            delay={220 + i * 80}
            first={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
