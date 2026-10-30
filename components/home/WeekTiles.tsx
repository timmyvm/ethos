"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui/Skeleton";
import { signed, type WeekView } from "@/lib/home";
import { DURATION } from "@/lib/motion";

/**
 * This week (#393): the Ethos Index with its hill, the days spoken and
 * the recordings, all from the account's own recordings (lib/home.ts
 * `weekView`). The behaviour channel the day trail carried on the old
 * Today (the days you spoke, the counter that never resets) lives here
 * now, beside the Index the Log opens on, a tap away from the practice
 * rather than under it.
 *
 * The two half tiles are built alike, row for row: the head, the
 * number, a chart, a caption. So their numbers, their charts and their
 * captions each share a line, and "22 days in all" has a row of its own
 * rather than being packed under the strip.
 */
export function WeekTiles({ week }: { week: WeekView }) {
  const { index } = week;
  const most = Math.max(1, ...week.weeks);
  /* Six weekly slots, this week last; a week before day one has no
     column at all, never a zero. */
  const slots: (number | null)[] = [...Array(Math.max(0, 6 - week.weeks.length)).fill(null), ...week.weeks];
  const moved = index
    ? [
        index.week !== null ? `${signed(index.week)} this week` : null,
        index.since !== null ? `${signed(index.since)} since day one` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  /* Up is earned (sage); a drop is said in stone, never in red. */
  const up = index !== null && (index.week ?? index.since ?? 0) >= 0;

  return (
    <div className="arrive mt-3 grid grid-cols-2 gap-3">
      <Link
        href="/history"
        data-wide
        /* The hill's band is held with or without a hill (a new account,
           one scored recording), so the tile lands at the skeleton's
           height. */
        data-hill
        className="home-tile press col-span-2"
      >
        {index && index.series.length > 1 && <Hill values={index.series} />}
        <h3 className="eyebrow text-ink">Ethos Index</h3>
        <p className="font-display mt-3 flex items-baseline text-num-hero tabular-nums">
          {index ? (
            <>
              <CountUp value={index.now} durationMs={DURATION.max} />
              <span className="home-unit">/1000</span>
            </>
          ) : (
            <span className="text-stone-400">&ndash;</span>
          )}
        </p>
        <p
          className={`font-display mt-1 min-h-[18px] text-caption font-bold ${
            up ? "text-sage-700" : "text-stone-500"
          }`}
        >
          {index ? moved : <span className="font-normal text-stone-500">Your first recording sets it.</span>}
        </p>
      </Link>

      <section data-week className="home-tile">
        <h3 className="home-week-head eyebrow text-ink">Days spoken</h3>
        <WeekNum n={week.spoken} unit="of 7" />
        <div aria-hidden className="home-week-chart grid grid-cols-7 gap-1">
          {week.days.map((d, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span className="home-day w-full" data-on={d.on || undefined} />
              <span
                className={`font-display text-suffix ${d.today ? "font-extrabold text-ink" : "text-stone-400"}`}
              >
                {d.label}
              </span>
            </span>
          ))}
        </div>
        <p className="home-week-caption text-caption text-stone-500">
          {week.daysAll} {week.daysAll === 1 ? "day" : "days"} in all
        </p>
      </section>

      <Link href="/history" data-week className="home-tile press">
        <h3 className="home-week-head eyebrow text-ink">Recordings</h3>
        <WeekNum n={week.thisWeek} unit="this week" />
        {/* A column a week, six weeks, this week's in sage, each with
            its count under it (E23) in the day letters' grammar beside
            it: the same 24px band over the same 10/700 row, so the
            counts and the letters share a baseline. Earlier weeks' counts
            are stone, this week's ink, as today's letter is. */}
        <span aria-hidden className="home-week-chart flex gap-1">
          {slots.map((n, i) => {
            const now = i === slots.length - 1;
            return (
              <span key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="flex h-6 w-full items-end">
                  {n !== null && (
                    <span
                      className={`w-full rounded-[3px] ${now ? "bg-sage-600" : "bg-sand"}`}
                      style={{ height: `${Math.max(10, (n / most) * 100)}%` }}
                    />
                  )}
                </span>
                <span
                  className={`font-display text-suffix whitespace-nowrap tabular-nums ${
                    now ? "text-ink" : "text-stone-500"
                  }`}
                >
                  {n ?? "\u00a0"}
                </span>
              </span>
            );
          })}
        </span>
        <p className="home-week-caption text-caption text-stone-500">{week.total} since day one</p>
      </Link>
    </div>
  );
}

/** A half tile's number and its unit, on the number's line. */
function WeekNum({ n, unit }: { n: number; unit: string }) {
  return (
    <p
      className="home-num-line home-week-num font-display tabular-nums"
      style={{ "--num-em": String(n).length * 0.58, "--unit-em": unit.length * 0.52 } as CSSProperties}
    >
      <span className="home-num">{n}</span>
      <span className="home-unit">{unit}</span>
    </p>
  );
}

/** The Index's history as a filled hill: the sage of anything earned. */
function Hill({ values }: { values: number[] }) {
  /* One hill on the screen: the This week view mounts alone. */
  const id = "home-hill-fill";
  const w = 350;
  const h = 84;
  const lo = Math.min(...values) - 8;
  const hi = Math.max(...values) + 4;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - lo) / (hi - lo)) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="home-hill">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * This week while the read is in flight: each row in a box of its
 * landed size (`.home-week-*`), so the week lands without moving.
 */
export function WeekSkeleton() {
  const line = (h: string, w: string, extra = "") => (
    <span className={`flex items-center ${h} ${extra}`}>
      <Skeleton className={`h-3 ${w}`} />
    </span>
  );
  return (
    <div aria-hidden className="mt-3 grid grid-cols-2 gap-3">
      <div data-wide data-hill className="home-tile col-span-2">
        {line("h-[18px]", "w-24")}
        <span className="mt-3 flex h-14 items-center">
          <Skeleton className="h-11 w-32" />
        </span>
        {line("h-[18px]", "w-48", "mt-1")}
      </div>
      {[0, 1].map((i) => (
        <div key={i} data-week className="home-tile">
          <span className="home-week-head flex items-center">
            <Skeleton className="h-3 w-20" />
          </span>
          <span className="home-num-line home-week-num flex items-center">
            <Skeleton className="h-7 w-16" />
          </span>
          <span className="home-week-chart flex items-end">
            <Skeleton className="h-6 w-full" />
          </span>
          <span className="home-week-caption flex items-center">
            <Skeleton className="h-3 w-24" />
          </span>
        </div>
      ))}
    </div>
  );
}
