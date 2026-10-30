"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { IconCheck, IconFlag } from "@/components/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { TRAIT, type TraitId } from "@/content/traits";
import type { Challenge } from "@/lib/challenge";
import type { RepRow } from "@/lib/client-data";
import {
  SHORT_UNIT,
  UNIT_EM,
  artBox,
  cleanRunTile,
  numEm,
  objectSrc,
  tileObject,
  traitOrder,
  wideLine,
} from "@/lib/home";
import { DURATION } from "@/lib/motion";
import { fmtRaw, ordinal, readTraitsFromRow, type TraitReading } from "@/lib/trait-readings";

/**
 * Today's bento (#393, D22 and D23): the card's trait wide, with today's
 * line in its right half; the clean run as one full-width row; then the
 * other four traits, lowest percentile first, each with its emblem, its
 * number big and its percentile under a bar.
 *
 * Every tile is the surface step at the tile radius, with no shadow:
 * the card above is the one lifted thing. A trait's colour is its 8px
 * mark, its bar's fill and the light behind its object, which is part
 * of the picture and never the tile's ground. What is earned (clearing
 * your line, a clean stretch) fills in sage.
 *
 * Each object shows once: the card stands the lesson's object, the wide
 * tile (the card's trait) stands none, and each of the other four its
 * trait's fixed emblem. Today's line shows once too: it lives in the
 * wide tile, where the trait's number already is, as a tick on its bar.
 *
 * Unknown is never zero: with no recording a trait prints a dash and an
 * empty trough, and so do today's line (absent under three readings in
 * the week, lib/challenge.ts) and the clean run, so day zero stands the
 * same rows the skeleton held and nothing under the card moves.
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
     numbers are the latest, the trait in the wide tile is the card's. */
  const last = reps.length > 0 ? reps[reps.length - 1] : null;
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
          <RunRow head="Clean run" caption="Your longest stretch with no filler." />
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
      {run ? (
        <CleanRunRow run={run} />
      ) : (
        <RunRow head="Clean run" caption="Your longest stretch with no filler." />
      )}
      {four}
    </div>
  );
}

/**
 * A number and its unit on one line, sharing a baseline. The line's own
 * size is the tile's number size, so its baseline holds whatever the
 * number fits to; the number takes the largest size up to the tile's
 * that leaves its unit room (`.home-num`), so no unit wraps under it.
 */
function NumLine({ shown, unit, children }: { shown: string; unit: string; children?: ReactNode }) {
  return (
    <span
      aria-hidden
      className="home-num-line font-display tabular-nums"
      style={{ "--num-em": numEm(shown), "--unit-em": UNIT_EM[unit] ?? 2 } as CSSProperties}
    >
      <span className="home-num">{children ?? shown}</span>
      <span className="home-unit">{unit}</span>
    </span>
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

/** A compact tile's head, in a 28px row like a trait tile's. */
function CompactHead({ children }: { children: ReactNode }) {
  return (
    <span className="flex min-h-7 items-start">
      <h3 className="eyebrow flex items-start gap-1.5 pt-[5px] text-ink">{children}</h3>
    </span>
  );
}

/**
 * The clean run (#254, #267) as one full-width row (D23): the newest
 * recording's longest stretch with no filler on the left, the bar
 * against that recording's own length and the caption on the right,
 * the best before it as the bar's mark. A door to the Log, where the
 * run and the Index live.
 */
function CleanRunRow({ run }: { run: NonNullable<ReturnType<typeof cleanRunTile>> }) {
  return (
    <Link
      href="/history"
      data-row
      aria-label={`Clean run: ${run.s} seconds with no filler, of ${run.of}. ${run.caption.replace(/^Of \d+s\. ?/, "")}`}
      className="home-tile press col-span-2"
    >
      <span className="home-row">
        <span className="flex flex-col">
          <CompactHead>Clean run</CompactHead>
          <span className="mt-auto" />
          <NumLine shown={String(run.s)} unit="s">
            <CountUp value={run.s} durationMs={DURATION.max} />
          </NumLine>
        </span>
        <span className="flex flex-col justify-end">
          <span aria-hidden data-marked className="home-bar home-bar-earned block">
            <i style={{ width: `${(run.s / run.of) * 100}%` }} />
            {run.best !== null && (
              <span
                className="home-bar-mark"
                style={{ left: `${Math.min(100, (run.best / run.of) * 100)}%` }}
              />
            )}
          </span>
          <p aria-hidden className="mt-2 text-caption text-pretty text-stone-500">
            {run.caption}
          </p>
        </span>
      </span>
    </Link>
  );
}

/**
 * The clean run before there is one: the head, a dash where the number
 * will be, an empty trough and what sets it, at the landed row's height.
 */
function RunRow({ head, caption }: { head: string; caption: string }) {
  return (
    <section data-row aria-label={`${head}: ${caption}`} className="home-tile col-span-2">
      <span className="home-row">
        <span className="flex flex-col">
          <CompactHead>{head}</CompactHead>
          <span className="mt-auto" />
          <DashLine />
        </span>
        <span className="flex flex-col justify-end">
          <span aria-hidden className="home-bar block" />
          <p aria-hidden className="mt-2 text-caption text-pretty text-stone-500">
            {caption}
          </p>
        </span>
      </span>
    </section>
  );
}

/** A trait's label for a screen reader: its name, number and percentile. */
function traitLabel(id: TraitId, reading: TraitReading | null): string {
  const t = TRAIT[id];
  if (!reading) return `${t.name}, no reading yet`;
  const raw = fmtRaw(reading.raw);
  const unit = raw === "1" ? t.unitOne : t.unit;
  return `${t.name}, ${raw} ${unit}, ${ordinal(reading.percentile)} percentile${
    reading.quality === "provisional" ? ", an estimate" : ""
  }`;
}

/**
 * The card's trait, wide (D22, D23): no object, since the card above
 * stands the lesson's. Its left holds the name, the number at the
 * tile's hero size and the percentile bar with its ordinal; its right
 * half holds today's line, the head with its flag (open) or check
 * (closed) and the caption, and the line itself is the ink tick on the
 * bar, at its own percentile on the bar's scale.
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
  const t = TRAIT[id];
  const raw = reading ? fmtRaw(reading.raw) : null;
  const l = line ? wideLine(line) : null;
  const lineLabel = l
    ? ` Today's line, ${l.line} ${t.unit}${
        l.state === "closed" ? ", cleared" : ""
      }. ${l.caption}`
    : "";
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
          <span aria-hidden className="font-display flex min-h-[22px] items-center gap-1.5 text-row">
            <span className="trait-dot" />
            {t.name}
          </span>
          <span className="mt-auto" />
          {raw !== null ? <NumLine shown={raw} unit={SHORT_UNIT[id]} /> : <DashLine />}
          {reading ? (
            <span aria-hidden className="mt-2.5 flex items-center gap-2.5">
              <span data-marked={l ? true : undefined} className="home-bar flex-1">
                <i style={{ width: `${reading.percentile}%` }} />
                {l && <span className="home-bar-mark" style={{ left: `${l.tick}%` }} />}
              </span>
              <span className="font-display shrink-0 text-caption font-bold tabular-nums text-stone-500">
                {ordinal(reading.percentile)}
              </span>
            </span>
          ) : (
            /* Day zero: what the dash is waiting for, said once, here. */
            <span aria-hidden className="mt-2.5 text-caption text-pretty text-stone-500">
              Your first recording reads all five.
            </span>
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
              ) : l?.state === "open" ? (
                <span className="home-flag">
                  <IconFlag size={12} />
                </span>
              ) : null}
            </span>
            {/* The line as a number (E24), at the tile's precision with
                its unit, "1.0 /min": the caption read "Line 1." as a
                label, and the half stood empty where the number goes. */}
            {l && (
              <span className="font-display mt-2 flex items-baseline whitespace-nowrap tabular-nums">
                <span className="text-num-m font-extrabold">{l.line}</span>
                <span className="ml-1 text-suffix text-stone-500">{SHORT_UNIT[id]}</span>
              </span>
            )}
            <span className="mt-auto" />
            <p className="home-caption text-caption text-pretty text-stone-500">
              {l ? l.caption : "Three recordings set it."}
            </p>
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * One of the other four: its emblem at the top right in its own light,
 * its name and mark, the measurement big with its short unit on its
 * line, the percentile as a bar in its tone with the ordinal beside it.
 * A door to the trait's own page, where the direction and the target
 * live.
 */
function TraitTile({ id, reading }: { id: TraitId; reading: TraitReading | null }) {
  const t = TRAIT[id];
  const raw = reading ? fmtRaw(reading.raw) : null;
  const object = tileObject(id);
  return (
    <Link
      href={`/practice/${id}`}
      data-trait={id}
      aria-label={traitLabel(id, reading)}
      className="home-tile today-trait press"
      style={artBox(object) as CSSProperties}
    >
      <span aria-hidden className="home-tile-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={objectSrc(object)}
        alt=""
        width={140}
        height={140}
        className="home-tile-art"
        draggable={false}
      />
      <span aria-hidden className="font-display flex items-center gap-1.5 text-row">
        <span className="trait-dot" />
        {t.name}
      </span>
      <span className="mt-auto" />
      {raw !== null ? <NumLine shown={raw} unit={SHORT_UNIT[id]} /> : <DashLine />}
      {reading ? (
        <span aria-hidden className="mt-2.5 flex items-center gap-2.5">
          <span className="home-bar flex-1">
            <i style={{ width: `${reading.percentile}%` }} />
          </span>
          <span className="font-display shrink-0 text-caption font-bold tabular-nums text-stone-500">
            {ordinal(reading.percentile)}
          </span>
        </span>
      ) : (
        <span aria-hidden className="home-bar mt-2.5 block" />
      )}
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
            <Skeleton className="h-3 w-20" />
            <span className="mt-auto" />
            <span className="home-num-line flex items-center">
              <Skeleton className="h-11 w-28" />
            </span>
            <Skeleton className="mt-3 h-1 w-full" />
          </span>
          <span className="home-wide-line">
            <span className="flex min-h-7 items-start pt-[5px]">
              <Skeleton className="h-3 w-20" />
            </span>
            <span className="mt-auto" />
            <span className="home-caption flex items-end pb-1">
              <Skeleton className="h-3 w-24" />
            </span>
          </span>
        </span>
      </div>
      <div data-row className="home-tile col-span-2">
        <span className="home-row">
          <span className="flex flex-col">
            <span className="flex min-h-7 items-start pt-[5px]">
              <Skeleton className="h-3 w-16" />
            </span>
            <span className="mt-auto" />
            <span className="home-num-line flex items-center">
              <Skeleton className="h-7 w-16" />
            </span>
          </span>
          <span className="flex flex-col justify-end">
            <Skeleton className="h-1 w-full" />
            <span className="mt-2 flex items-start pt-1">
              <Skeleton className="h-3 w-24" />
            </span>
          </span>
        </span>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="home-tile">
          <Skeleton className="h-3 w-20" />
          <span className="mt-auto" />
          <span className="home-num-line flex items-center">
            <Skeleton className="h-7 w-16" />
          </span>
          <Skeleton className="mt-3 h-1 w-full" />
        </div>
      ))}
    </div>
  );
}
