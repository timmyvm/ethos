"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { IconCheck, IconFlag, IconWave } from "@/components/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { TraitGlyph } from "@/components/TraitGlyph";
import { TRAIT, type TraitId } from "@/content/traits";
import type { Challenge } from "@/lib/challenge";
import type { RepRow } from "@/lib/client-data";
import { RUN_FIRST, RUN_NAME, cleanRunTile, tileUnit, traitOrder, wideLine } from "@/lib/home";
import { DURATION } from "@/lib/motion";
import { fmtRaw, measured, readTraitsFromRow, type TraitReading } from "@/lib/trait-readings";

/**
 * Today's bento (#393, D22 and D23): the card's trait wide, with today's
 * line in its right half; the no-filler run as one full-width row; then
 * the other four traits, lowest percentile first. Since #495 (the
 * morning tour: "46 s", "Of 65s. Best 53s.", three numbers and a bare
 * "18th" in one tile) every tile is one number and one plain line a
 * first-timer reads in two seconds: the trait's number over its unit in
 * the trait's own words, the run's seconds over what they are. The
 * percentile bars and their ordinals are gone from the tiles; the trait
 * page says where you sit, in words.
 *
 * Every tile is the surface step at the tile radius, with no shadow:
 * the card above is the one lifted thing. Flat since #478 (Timothy, 16
 * Nov: "the glow in today traits is bad so lets remove that. fucks w
 * visual hierarchy"): no glass object, no light behind one. A trait's
 * colour is its flat glyph before its name (`TraitGlyph`, the app's
 * line set in the trait's tone), never the tile's ground. What is
 * earned (clearing your line, a stretch with no filler) is sage: the
 * line's check and the run's wave.
 *
 * Only the card stands an object (docs/plan-next.md section 1: only the
 * thing to do today glows). Today's line shows once: it lives in the
 * wide tile's right half, beside the trait's number, as one sentence.
 *
 * Unknown is never zero: with no recording a trait prints a dash, and
 * so do today's line (absent under three readings in the week,
 * lib/challenge.ts) and the run, so day zero stands the same rows the
 * skeleton held and nothing under the card moves.
 */
export function TodayTiles({
  reps,
  challenge,
  focus,
}: {
  /** Oldest first, as `fetchReps` returns them. */
  reps: RepRow[];
  challenge: Challenge | null;
  /** The card's trait: the wide tile, so the card, the line and the wide
      tile name one trait (#268). Null on day one. */
  focus: TraitId | null;
}) {
  /* The readings are the newest recording's, today's included: the
     numbers are the latest, the trait in the wide tile is the card's.
     Newest that measured something: a take too short to score read
     Pace 7 wpm and Fillers 0 here, under a results screen that said
     nothing was measured. */
  const kept = reps.filter(measured);
  const last = kept.length > 0 ? kept[kept.length - 1] : null;
  const rows = traitOrder(last ? readTraitsFromRow(last) : [], focus);
  const run = cleanRunTile(reps);
  const [first, ...rest] = rows;
  /* The line is the card's trait's (one selector, #268), so it stands in
     the wide tile; with none yet the wide tile says what sets it. */
  const line = challenge && challenge.trait === first.id ? challenge : null;

  const wide = <WideTile id={first.id} reading={first.reading} line={line} pending={!challenge} />;
  const four = rest.map((t) => <TraitTile key={t.id} id={t.id} reading={t.reading} />);

  /* Day zero: the five reading nothing yet and the clean run as a dash,
     saying what sets it, all as one block. A stagger is numbers landing
     one after another, and dashes landing one after another is theatre. */
  if (!last) {
    return (
      <div className="arrive">
        <div className="mt-3 grid grid-cols-2 gap-3">{wide}</div>
        <div className="mt-3">
          <RunRow />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">{four}</div>
      </div>
    );
  }

  return (
    /* The wide tile, the clean run and the four assemble one after
       another (the motion layer's stagger). */
    <div className="stagger mt-3 grid grid-cols-2 gap-3 [--stagger-lead:80ms]">
      {wide}
      {run ? <CleanRunRow run={run} /> : <RunRow />}
      {four}
    </div>
  );
}

/**
 * A tile's number, at the tile's number size, with its unit in words on
 * the line under it (#495). The unit is the tile's one line: "0.7" over
 * "um or uh in 100 words". `suffix` is a unit short enough to stand on
 * the number's baseline, the run's seconds.
 */
function NumLine({
  shown,
  unit,
  suffix,
  children,
}: {
  shown: string;
  unit?: string;
  suffix?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden
        className="home-num-line font-display tabular-nums"
        /* The number takes the tile's size; the room sum (.home-num) has
           no unit beside it now, only the run's "s". */
        style={{ "--num-em": shown.length * 0.6, "--unit-em": suffix ? 0.5 : 0 } as CSSProperties}
      >
        <span className="home-num">{children ?? shown}</span>
        {suffix && <span className="home-suffix">{suffix}</span>}
      </span>
      {unit && (
        <span aria-hidden className="home-unit-line text-caption text-pretty text-stone-500">
          {unit}
        </span>
      )}
    </>
  );
}

/** A dash where a number will be, on the number's own line. */
function DashLine() {
  return (
    <span
      aria-hidden
      className="home-num-line font-display tabular-nums"
      style={{ "--num-em": 0.6, "--unit-em": 0 } as CSSProperties}
    >
      <span className="home-num text-stone-400">&ndash;</span>
    </span>
  );
}

/**
 * The no-filler run (#254, #267) as one full-width row (D23): its head
 * with the wave Earned draws, the newest recording's longest stretch
 * with no filler in seconds, and one sentence saying what it is, with
 * the best before it (#495). Named apart from You's "Clean run" badge,
 * which counts fillers a minute. A door to the Log.
 */
function CleanRunRow({ run }: { run: NonNullable<ReturnType<typeof cleanRunTile>> }) {
  return (
    <Link
      href="/history"
      data-row
      aria-label={`${RUN_NAME}, ${run.s} seconds. ${run.caption}`}
      className="home-tile press col-span-2"
    >
      <span className="home-row">
        <span className="flex flex-col">
          <RunHead />
          <span className="mt-auto" />
          <NumLine shown={String(run.s)} suffix="s">
            <CountUp value={run.s} durationMs={DURATION.max} />
          </NumLine>
        </span>
        <p aria-hidden className="home-run-line text-caption text-pretty text-stone-500">
          {run.caption}
        </p>
      </span>
    </Link>
  );
}

/** The run's head: the wave in earned sage, then its name. */
function RunHead() {
  return (
    <span aria-hidden className="font-display flex min-h-[22px] items-center gap-1.5 text-row">
      <span className="home-run-glyph">
        <IconWave size={18} />
      </span>
      {RUN_NAME}
    </span>
  );
}

/**
 * The run before there is one: the head, a dash where the number will
 * be, and what sets it, at the landed row's height.
 */
function RunRow() {
  return (
    <section data-row aria-label={`${RUN_NAME}: ${RUN_FIRST}`} className="home-tile col-span-2">
      <span className="home-row">
        <span className="flex flex-col">
          <RunHead />
          <span className="mt-auto" />
          <DashLine />
        </span>
        <p aria-hidden className="home-run-line text-caption text-pretty text-stone-500">
          {RUN_FIRST}
        </p>
      </span>
    </section>
  );
}

/** A trait's label for a screen reader: its name and its number in its unit, as the tile shows them. */
function traitLabel(id: TraitId, reading: TraitReading | null): string {
  const t = TRAIT[id];
  if (!reading) return `${t.name}, no reading yet`;
  const raw = fmtRaw(reading.raw);
  return `${t.name}, ${raw} ${tileUnit(id, raw)}`;
}

/**
 * The card's trait, wide (D22, D23): no object, since the card above
 * stands the lesson's. Its left holds the name, the number at the
 * tile's hero size and its unit in words; its right half holds today's
 * line, the head with its flag (open) or check (closed) and one
 * sentence saying what clears it (#495).
 */
function WideTile({
  id,
  reading,
  line,
  pending,
}: {
  id: TraitId;
  reading: TraitReading | null;
  line: Challenge | null;
  /** No line yet anywhere: under three readings this week. */
  pending: boolean;
}) {
  const raw = reading ? fmtRaw(reading.raw) : null;
  const l = line ? wideLine(line) : null;
  const lineLabel = l ? ` Today's line${l.state === "closed" ? ", cleared" : ""}: ${l.sentence}` : "";
  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      data-wide
      aria-label={`${traitLabel(id, reading)}.${lineLabel}`}
      className="home-tile today-trait press col-span-2"
    >
      <span className="home-wide">
        <span className="flex min-w-0 flex-col">
          <TraitName id={id} />
          {raw !== null ? (
            <NumLine shown={raw} unit={tileUnit(id, raw)} />
          ) : (
            <>
              <DashLine />
              {/* Day zero: what the dash is waiting for, said once, here. */}
              <span aria-hidden className="home-unit-line text-caption text-pretty text-stone-500">
                Your first recording reads all five.
              </span>
            </>
          )}
        </span>
        {(l || pending) && (
          <span aria-hidden className="home-wide-line">
            <span className="flex min-h-[22px] items-center gap-2">
              <span className="eyebrow">Today&apos;s line</span>
              {l?.state === "closed" ? (
                <span className="home-check">
                  <IconCheck size={13} />
                </span>
              ) : l ? (
                <span className="home-flag">
                  <IconFlag size={12} />
                </span>
              ) : null}
            </span>
            <p className="home-line-sentence text-caption text-pretty text-stone-600">
              {l ? l.sentence : "Three recordings set it."}
            </p>
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * A trait's name with its flat glyph before it, in the trait's tone
 * (#478): the tile's one coloured mark, where the 8px dot was.
 */
function TraitName({ id }: { id: TraitId }) {
  return (
    <span aria-hidden className="font-display flex min-h-[22px] items-center gap-1.5 text-row">
      <span className="home-trait-glyph">
        <TraitGlyph id={id} size={18} />
      </span>
      {TRAIT[id].name}
    </span>
  );
}

/**
 * One of the other four, flat (#478): its glyph and name, the
 * measurement big and its unit in words under it (#495). A door to the
 * trait's own page, where the direction, the target and where you sit
 * live.
 */
function TraitTile({ id, reading }: { id: TraitId; reading: TraitReading | null }) {
  const raw = reading ? fmtRaw(reading.raw) : null;
  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      data-four
      aria-label={traitLabel(id, reading)}
      className="home-tile today-trait press"
    >
      <TraitName id={id} />
      {raw !== null ? <NumLine shown={raw} unit={tileUnit(id, raw)} /> : <DashLine />}
    </Link>
  );
}

/**
 * The bento while the read is in flight: every tile at its landed
 * height (`.home-tile`'s minimums, which every landed tile's content
 * stays under), so nothing under the card moves when the numbers land.
 */
export function TilesSkeleton() {
  return (
    <div aria-hidden className="mt-3 grid grid-cols-2 gap-3">
      <div data-wide className="home-tile col-span-2">
        <span className="home-wide">
          <span className="flex flex-col">
            <span className="flex min-h-[22px] items-center">
              <Skeleton className="h-3 w-20" />
            </span>
            <span className="home-num-line flex items-center">
              <Skeleton className="h-11 w-24" />
            </span>
            <span className="home-unit-line flex items-start pt-1">
              <Skeleton className="h-3 w-28" />
            </span>
          </span>
          <span className="home-wide-line">
            <span className="flex min-h-[22px] items-center">
              <Skeleton className="h-3 w-20" />
            </span>
            <span className="home-line-sentence flex items-start pt-1">
              <Skeleton className="h-3 w-24" />
            </span>
          </span>
        </span>
      </div>
      <div data-row className="home-tile col-span-2">
        <span className="home-row">
          <span className="flex flex-col">
            <span className="flex min-h-[22px] items-center">
              <Skeleton className="h-3 w-24" />
            </span>
            <span className="mt-auto" />
            <span className="home-num-line flex items-center">
              <Skeleton className="h-7 w-14" />
            </span>
          </span>
          <span className="home-run-line flex items-end pb-1">
            <Skeleton className="h-3 w-28" />
          </span>
        </span>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} data-four className="home-tile">
          <span className="flex min-h-[22px] items-center">
            <Skeleton className="h-3 w-20" />
          </span>
          <span className="home-num-line flex items-center">
            <Skeleton className="h-7 w-14" />
          </span>
          <span className="home-unit-line flex items-start pt-1">
            <Skeleton className="h-3 w-20" />
          </span>
        </div>
      ))}
    </div>
  );
}
