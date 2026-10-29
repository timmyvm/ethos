"use client";

import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { IconCheck, IconFlag } from "@/components/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { TRAIT, type TraitId } from "@/content/traits";
import type { Challenge } from "@/lib/challenge";
import type { RepRow } from "@/lib/client-data";
import {
  SHORT_UNIT,
  cleanRunTile,
  lineTile,
  objectSrc,
  tileObject,
  traitOrder,
} from "@/lib/home";
import { DURATION } from "@/lib/motion";
import { fmtRaw, ordinal, readTraitsFromRow, type TraitReading } from "@/lib/trait-readings";

/**
 * Today's bento (#393): today's line and the clean run as two tiles,
 * then the five traits, the weakest wide, each with its glass object,
 * its number big and its percentile under a bar.
 *
 * Every tile is the surface step at the tile radius, with no shadow:
 * the card above is the one lifted thing. A trait's colour is its 8px
 * mark, its bar's fill and the light behind its object, which is part
 * of the picture and never the tile's ground. What is earned (clearing
 * your line, a clean stretch) fills in sage.
 *
 * Unknown is never zero: with no recording a trait prints a dash and an
 * empty trough, the line is absent until there are three readings in
 * the week (lib/challenge.ts), and the clean run until the first
 * recording.
 */
export function TodayTiles({
  reps,
  challenge,
  focus,
  hero,
}: {
  /** Oldest first, as `fetchReps` returns them. */
  reps: RepRow[];
  challenge: Challenge | null;
  /** The card's trait: the wide tile, so the card, the line and the wide
      tile name one trait (#268). Null on day one. */
  focus: TraitId | null;
  /** The card's object, so no tile repeats it. */
  hero: string | null;
}) {
  /* The readings are the newest recording's, today's included: the
     numbers are the latest, the trait in the wide tile is the card's. */
  const last = reps.length > 0 ? reps[reps.length - 1] : null;
  const rows = traitOrder(last ? readTraitsFromRow(last) : [], focus);
  const run = cleanRunTile(reps);
  const [first, ...rest] = rows;

  const traits = (
    <>
      <TraitTile id={first.id} reading={first.reading} hero={hero} wide />
      {rest.map((t) => (
        <TraitTile key={t.id} id={t.id} reading={t.reading} hero={hero} />
      ))}
    </>
  );

  /* Day zero: the five read nothing yet, so they arrive as one block. A
     stagger is numbers landing one after another, and dashes landing one
     after another is theatre. */
  if (!last) {
    return <div className="arrive mt-3 grid grid-cols-2 gap-3">{traits}</div>;
  }

  return (
    <>
      {/* The line and the clean run land with the read, in one fade. A
          clean run with no line (under three readings this week) takes
          the row. */}
      <div className="arrive mt-3 grid grid-cols-2 gap-3">
        {challenge && <LineTile c={challenge} />}
        {run && <CleanRunTile run={run} wide={!challenge} />}
      </div>
      {/* The five assemble one after another (the motion layer's stagger). */}
      <div className="stagger mt-3 grid grid-cols-2 gap-3 [--stagger-lead:80ms]">{traits}</div>
    </>
  );
}

/**
 * Today's line (#281): the number to clear in the trait's own unit, a
 * flag while today is open and a sage check once it closes. The bar
 * runs today's reading to the line's mark, on the trait's own standing.
 */
function LineTile({ c }: { c: Challenge }) {
  const t = lineTile(c);
  const name = TRAIT[c.trait].name;
  return (
    <section
      data-trait={c.trait}
      data-compact
      aria-label={`Today's line, ${name}. ${t.state === "open" ? "Clear" : "Today"} ${fmtRaw(t.shown)} ${TRAIT[c.trait].unit}. ${t.caption}`}
      className="home-tile today-trait"
    >
      <h3 className="eyebrow flex min-h-7 items-start gap-1.5 text-ink">
        <span aria-hidden className="trait-dot mt-[5px]" />
        Today&apos;s line
      </h3>
      <p aria-hidden className="font-display mt-auto flex items-center gap-2 text-num-l tabular-nums">
        <span className="flex items-baseline gap-x-1">
          {fmtRaw(t.shown)}
          <span className="home-unit">{SHORT_UNIT[c.trait]}</span>
        </span>
        {t.state === "closed" ? (
          <span className="home-check ml-auto">
            <IconCheck size={16} />
          </span>
        ) : t.state === "open" ? (
          <span className="home-flag ml-auto">
            <IconFlag size={15} />
          </span>
        ) : null}
      </p>
      {/* Clearing your line is earned: the fill is sage. */}
      <span aria-hidden data-marked className="home-bar home-bar-earned mt-2.5 block">
        <i style={{ width: `${t.fill * 100}%` }} />
        <span className="home-bar-mark" style={{ left: `${t.mark * 100}%` }} />
      </span>
      <p aria-hidden className="mt-2 text-caption text-pretty text-stone-500">
        {t.caption}
      </p>
    </section>
  );
}

/**
 * The clean run (#254, #267): the newest recording's longest stretch
 * with no filler, against that recording's own length, the best before
 * it as the mark. A door to the Log, where the run and the Index live.
 */
function CleanRunTile({
  run,
  wide,
}: {
  run: NonNullable<ReturnType<typeof cleanRunTile>>;
  wide: boolean;
}) {
  return (
    <Link
      href="/history"
      data-compact
      aria-label={`Clean run: ${run.s} seconds with no filler, of ${run.of}. ${run.caption.replace(/^Of \d+s\. ?/, "")}`}
      className={`home-tile press ${wide ? "col-span-2" : ""}`}
    >
      <h3 className="eyebrow flex min-h-7 items-start text-ink">Clean run</h3>
      <p aria-hidden className="font-display mt-auto flex items-baseline gap-x-1 text-num-l tabular-nums">
        <CountUp value={run.s} durationMs={DURATION.max} />
        <span className="home-unit">s</span>
      </p>
      <span
        aria-hidden
        data-marked
        className={`home-bar home-bar-earned mt-2.5 block ${wide ? "max-w-[60%]" : ""}`}
      >
        <i style={{ width: `${(run.s / run.of) * 100}%` }} />
        {run.best !== null && (
          <span
            className="home-bar-mark"
            style={{ left: `${Math.min(100, (run.best / run.of) * 100)}%` }}
          />
        )}
      </span>
      <p aria-hidden className="mt-2 text-caption text-stone-500">
        {run.caption}
      </p>
    </Link>
  );
}

/**
 * One trait: its object at the top right in its own light, its name and
 * mark, the measurement big with its short unit, the percentile as a
 * bar in its tone with the ordinal beside it. A door to the trait's own
 * page, where the direction and the target live.
 */
function TraitTile({
  id,
  reading,
  hero,
  wide = false,
}: {
  id: TraitId;
  reading: TraitReading | null;
  hero: string | null;
  wide?: boolean;
}) {
  const t = TRAIT[id];
  const raw = reading ? fmtRaw(reading.raw) : null;
  const unit = raw === "1" ? t.unitOne : t.unit;
  const label = reading
    ? `${t.name}, ${raw} ${unit}, ${ordinal(reading.percentile)} percentile${
        reading.quality === "provisional" ? ", an estimate" : ""
      }`
    : `${t.name}, no reading yet`;
  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      data-wide={wide || undefined}
      aria-label={label}
      className={`home-tile today-trait press ${wide ? "col-span-2" : ""}`}
    >
      <span aria-hidden className="home-tile-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={objectSrc(tileObject(id, hero), wide)}
        alt=""
        width={wide ? 212 : 140}
        height={wide ? 212 : 140}
        className="home-tile-art"
        draggable={false}
      />
      <span aria-hidden className="font-display flex items-center gap-1.5 text-row">
        <span className="trait-dot" />
        {t.name}
      </span>
      {/* The number and its unit. On the wide tile they share a line;
          on a half tile the unit takes its own line under the number,
          every tile alike, so the four numbers sit on one baseline per
          row whatever their units' lengths ("wpm", "/100 words"), and no
          unit runs under the object. */}
      <span
        aria-hidden
        className={`font-display mt-auto tabular-nums ${
          wide ? "flex items-baseline gap-x-1 text-num-hero" : "flex flex-col text-num-l"
        }`}
      >
        <span className="leading-none">
          {raw ?? <span className="text-stone-400">&ndash;</span>}
        </span>
        {raw !== null ? (
          <span className={`home-unit ${wide ? "" : "mt-1"}`}>{SHORT_UNIT[id]}</span>
        ) : (
          !wide && <span className="home-unit invisible mt-1">&nbsp;</span>
        )}
      </span>
      {reading ? (
        <span aria-hidden className={`mt-2.5 flex items-center gap-2.5 ${wide ? "max-w-[56%]" : ""}`}>
          <span className="home-bar flex-1">
            <i style={{ width: `${reading.percentile}%` }} />
          </span>
          <span className="font-display shrink-0 text-caption font-bold tabular-nums text-stone-500">
            {ordinal(reading.percentile)}
          </span>
        </span>
      ) : wide ? (
        /* Day zero: what the dash is waiting for, said once, on the wide tile. */
        <span aria-hidden className="mt-2.5 text-caption text-stone-500">
          Your first recording reads all five.
        </span>
      ) : (
        <span aria-hidden className="home-bar mt-2.5 block" />
      )}
    </Link>
  );
}

/**
 * The bento while the read is in flight: every tile at its landed
 * height (`.home-tile`'s minimums), so nothing under the card moves
 * when the numbers land.
 */
export function TilesSkeleton() {
  return (
    <div aria-hidden>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} data-compact className="home-tile">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-auto h-8 w-16" />
            <Skeleton className="mt-3 h-1 w-full" />
            <Skeleton className="mt-2.5 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div data-wide className="home-tile col-span-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-auto h-12 w-28" />
          <Skeleton className="mt-3 h-1 w-1/2" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="home-tile">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-auto h-8 w-16" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
