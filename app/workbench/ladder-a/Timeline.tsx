"use client";

import { useRef, useState } from "react";
import { FLOOR_MONTH, formatAud, formatBare } from "@/lib/pricing";
import { buzz } from "@/lib/prefs";
import { RollNumber } from "./RollNumber";
import {
  cap,
  dayMonth,
  monthLabel,
  monthName,
  rungOf,
  rungs,
  when,
  whenSpoken,
  type Rung,
} from "./ladder";

/**
 * The ladder as a timeline (direction A). Seven real calendar months
 * from the day the plan starts, each a column whose height is its price
 * measured from zero (a 46% drop looks like 46%), joined into one
 * staircase by a 2px line, so the picture is one price falling over
 * time rather than seven plans side by side. The last column runs
 * through the sheet's padding to its edge and fades: the floor, forever,
 * without a word.
 *
 * Read like Apple Stocks: the readout over the chart is fixed, and a
 * finger scrubbing the chart moves the selection under it, the readout
 * following 1:1 with no easing. A tap selects; letting go keeps it.
 * Each month boundary crossed is one 6ms tick (Reel's), nothing on
 * release; iOS Safari has no vibrate, so the selection band jumping
 * column to column is the real detent.
 *
 * To a screen reader it is one slider, "Price by month", 1 to 7, whose
 * value text is the month, its date and its price. The drawn labels are
 * aria-hidden: the slider says them.
 */
export type TimelineMode =
  /** The paywall: month 1 is today and nothing is paid yet. */
  | { kind: "offer" }
  /** A subscriber: months before `current` are paid, `current` is now. */
  | {
      kind: "plan";
      current: number;
      /** Cancelled: the months after this one are not on the plan. */
      ending?: boolean;
      /** The top line of the readout on the current month ("Kept to 7 Nov"). */
      nowLine?: string;
      /** A small label over the current column (past due: "Kept"). */
      tag?: string;
    };

type ColState = "paid" | "now" | "next" | "void";

export function Timeline({
  start,
  today,
  mode,
  selected,
  onSelect,
  readout = "full",
  fillFirst = false,
  lead = 0,
  className = "",
}: {
  /** The day month 1 starts (today, on the paywall). */
  start: Date;
  today: Date;
  mode: TimelineMode;
  /** 1 to 7, controlled. */
  selected: number;
  onSelect: (month: number) => void;
  /** "skeleton" while a checkout is being confirmed: never a guessed price. */
  readout?: "full" | "skeleton";
  /** Checkout return: month 1 fills from 60% on the base spring. */
  fillFirst?: boolean;
  /** Holds the columns' entrance back, so a rising sheet lands first. */
  lead?: number;
  className?: string;
}) {
  const ladder = rungs(start);
  const plot = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const current = mode.kind === "plan" ? rungOf(mode.current) : 1;

  const stateOf = (r: Rung): ColState => {
    if (mode.kind === "offer") return r.month === 1 ? "now" : "next";
    if (r.month < current) return "paid";
    if (r.month === current) return "now";
    return mode.ending ? "void" : "next";
  };

  const sel = ladder[Math.min(Math.max(selected, 1), FLOOR_MONTH) - 1];
  const top = topLine(sel, mode, today, current);
  const bottom =
    mode.kind === "plan" && sel.month === current ? `Month ${mode.current}` : monthLabel(sel.month);

  /** The column under a finger, by the plot's own pitch (floor(x / pitch)). */
  const pick = (clientX: number) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r || r.width === 0) return selected;
    const i = Math.floor(((clientX - r.left) / r.width) * FLOOR_MONTH);
    return Math.min(Math.max(i, 0), FLOOR_MONTH - 1) + 1;
  };

  const go = (m: number, tick: boolean) => {
    const next = Math.min(Math.max(m, 1), FLOOR_MONTH);
    if (next === selected) return;
    if (tick) buzz(6);
    onSelect(next);
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // The sheet under this follows a finger down (Overlay); a scrub is
    // the chart's, never the sheet's.
    e.stopPropagation();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the tap still selects.
    }
    setScrubbing(true);
    go(pick(e.clientX), false);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    go(pick(e.clientX), true);
  }
  function onPointerEnd() {
    setScrubbing(false);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowUp: selected + 1,
      PageUp: selected + 1,
      ArrowLeft: selected - 1,
      ArrowDown: selected - 1,
      PageDown: selected - 1,
      Home: 1,
      End: FLOOR_MONTH,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    go(map[e.key], false);
  }

  return (
    <div className={`la-timeline ${className}`} style={{ "--la-lead": `${lead}ms` } as React.CSSProperties}>
      {/* The readout: the price on the left, when it starts on the right,
          on one baseline. Hidden from screen readers, which hear the
          slider's value text instead of a second copy. */}
      <div aria-hidden className="flex items-end justify-between gap-3">
        {readout === "skeleton" ? (
          <span className="la-readout-skeleton font-display text-num-l">
            <span className="la-skel block h-[0.78em] w-[4.2em] rounded-control" />
          </span>
        ) : (
          <p className="font-display text-num-l whitespace-nowrap text-cream">
            <span className="la-currency">A$</span>
            <RollNumber text={formatBare(sel.cents)} value={sel.cents} instant={scrubbing} />
          </p>
        )}
        <p className="min-w-0 pb-0.5 text-right">
          {readout === "skeleton" ? (
            <>
              <span className="la-skel ml-auto block h-3.5 w-20 rounded-full" />
              <span className="la-skel ml-auto mt-2 block h-3 w-14 rounded-full" />
            </>
          ) : (
            <>
              <span className="font-display block text-row text-cream">{top}</span>
              <span className="mt-0.5 block text-caption text-cream/70">{bottom}</span>
            </>
          )}
        </p>
      </div>

      <div
        ref={plot}
        role="slider"
        tabIndex={0}
        aria-label="Price by month"
        aria-valuemin={1}
        aria-valuemax={FLOOR_MONTH}
        aria-valuenow={sel.month}
        aria-valuetext={spoken(sel, mode, today, current)}
        data-scrubbing={scrubbing || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className="la-chart mt-3"
      >
        <div className="la-cols">
          {ladder.map((r, i) => {
            const state = stateOf(r);
            const next = ladder[i + 1];
            const isSel = r.month === sel.month;
            return (
              <div
                key={r.month}
                aria-hidden
                className="la-col"
                data-state={state}
                data-sel={isSel || undefined}
                data-floor={r.month === FLOOR_MONTH || undefined}
                style={
                  {
                    "--h": `${height(r.cents)}px`,
                    "--next-h": `${next ? height(next.cents) : height(r.cents)}px`,
                    "--i": i,
                  } as React.CSSProperties
                }
              >
                <span className="la-band" />
                {mode.kind === "plan" && mode.tag && r.month === current && (
                  <span className="la-tag label-micro">{mode.tag}</span>
                )}
                <span className="la-price font-display">{formatBare(r.cents)}</span>
                <span className={`la-bar ${fillFirst && r.month === 1 ? "la-fill-first" : ""}`} />
                {next && <span className="la-riser" data-next={stateOf(next)} />}
                <span className="la-dot" />
                <span className="la-month font-display">
                  {monthName(r.starts)}
                  {r.month === FLOOR_MONTH && <span className="la-plus">+</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The column's height: its price from zero, 88px for A$12.99. */
export const PLOT_MAX = 88;
const height = (cents: number) => Math.round((cents / 1299) * PLOT_MAX * 2) / 2;

/** The readout's right-hand line for the selected month. */
function topLine(r: Rung, mode: TimelineMode, today: Date, current: number): string {
  if (mode.kind === "offer") {
    return r.month === 1 ? "Today" : `From ${when(r.starts, today)}`;
  }
  if (r.month < current) return `Paid ${dayMonth(r.starts)}`;
  if (r.month === current) return mode.nowLine ?? "This month";
  const from = `From ${when(r.starts, today)}`;
  return mode.ending ? `${from} if kept` : from;
}

/** The slider's value text: "Month 2, from 24 November, A$11.99". */
function spoken(r: Rung, mode: TimelineMode, today: Date, current: number): string {
  const name =
    r.month === FLOOR_MONTH ? `Month ${FLOOR_MONTH} and every month after` : `Month ${r.month}`;
  const price = formatAud(r.cents);
  if (mode.kind === "offer") {
    return r.month === 1
      ? `${name}, today, ${price}`
      : `${name}, from ${whenSpoken(r.starts, today)}, ${price}`;
  }
  if (r.month < current) return `${name}, paid ${whenSpoken(r.starts, today)}, ${price}`;
  if (r.month === current) {
    const line = mode.nowLine ? `, ${mode.nowLine.toLowerCase()}` : "";
    return `Month ${mode.current}, this month${line}, ${price}`;
  }
  const kept = mode.ending ? ", if you keep your plan" : "";
  return `${name}, from ${whenSpoken(r.starts, today)}${kept}, ${price}`;
}

export { cap };
