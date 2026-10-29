"use client";

import Link from "next/link";
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
 */
export function WeekTiles({ week }: { week: WeekView }) {
  const { index } = week;
  const most = Math.max(1, ...week.weeks);
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
        data-hill={(index !== null && index.series.length > 1) || undefined}
        className="home-tile press col-span-2"
      >
        {index && index.series.length > 1 && <Hill values={index.series} />}
        <h3 className="eyebrow text-ink">Ethos Index</h3>
        <p className="font-display mt-3 flex items-baseline gap-x-1 text-num-hero tabular-nums">
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

      <section data-compact className="home-tile">
        <h3 className="eyebrow text-ink">Days spoken</h3>
        <p className="font-display mt-auto flex items-baseline gap-x-1 text-num-l tabular-nums">
          {week.spoken}
          <span className="home-unit">of 7</span>
        </p>
        <div aria-hidden className="mt-2.5 grid grid-cols-7 gap-1">
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
        <p className="mt-2 text-caption text-stone-500">
          {week.daysAll} {week.daysAll === 1 ? "day" : "days"} since day one
        </p>
      </section>

      <Link href="/history" data-compact className="home-tile press">
        <div className="flex items-start justify-between gap-2">
          <h3 className="eyebrow text-ink">Recordings</h3>
          {/* A column a week since day one, six at most, this week's in sage. */}
          {week.weeks.length > 1 && (
            <span aria-hidden className="flex h-7 items-end gap-[3px]">
              {week.weeks.map((n, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-sm ${i === week.weeks.length - 1 ? "bg-sage-600" : "bg-sand"}`}
                  style={{ height: `${Math.max(12, (n / most) * 100)}%` }}
                />
              ))}
            </span>
          )}
        </div>
        <p className="font-display mt-auto flex items-baseline gap-x-1 text-num-l tabular-nums">
          {week.thisWeek}
          <span className="home-unit">this week</span>
        </p>
        <p className="mt-2 text-caption text-stone-500">{week.total} since day one</p>
      </Link>
    </div>
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
 * This week while the read is in flight: each line in a box of its
 * landed height (the eyebrow's 18, the number's line, the day strip's
 * 38, a caption's 18), so the week lands without moving.
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
        <div key={i} data-compact className="home-tile">
          {line("h-[18px]", "w-20")}
          <span className="mt-auto flex h-9 items-center">
            <Skeleton className="h-7 w-16" />
          </span>
          <span className="mt-2.5 flex h-[38px] items-center">
            <Skeleton className="h-6 w-full" />
          </span>
          {line("h-[18px]", "w-24", "mt-2")}
        </div>
      ))}
    </div>
  );
}
