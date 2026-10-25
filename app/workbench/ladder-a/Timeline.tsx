"use client";

import { useRef, useState } from "react";
import { FLOOR_MONTH, formatAud, formatBare } from "@/lib/pricing";
import { buzz } from "@/lib/prefs";
import { RollNumber } from "./RollNumber";
import { dayMonth, monthLabel, monthName, rungOf, rungs, when, whenSpoken, type Rung } from "./ladder";

/**
 * The ladder as a timeline (direction A). Seven real calendar months
 * from the day the plan starts, each a column whose height is its price
 * measured from zero (a 46% drop looks like 46%), joined into one
 * staircase by a 2px line, so the picture is one price falling over
 * time rather than seven plans side by side. The last column runs
 * through its container's padding to the edge and fades: the floor,
 * forever, without a word.
 *
 * Read like Apple Stocks: the readout over the chart is fixed, and a
 * finger scrubbing the chart moves the selection under it, the readout
 * following 1:1 with no easing. A tap selects; letting go keeps it.
 * Each month boundary crossed is one 6ms tick (Reel's), nothing on
 * release; iOS Safari has no vibrate, so the selection jumping column
 * to column is the real detent. The selection is ONE band and ONE dot
 * moved by a transform, so a step is an object travelling down the
 * stair, never two columns swapping states.
 *
 * To a screen reader it is one slider, "Price by month", 1 to 7, whose
 * value text is the month, its date and its price. The drawn labels are
 * aria-hidden: the slider says them. Without `onSelect` the chart is a
 * picture (You's card, which is itself a button) and hides entirely,
 * its numbers said by the card's own text.
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
      /** The readout's top line on the current month ("Held"). */
      nowLine?: string;
      /** A small word over the current column (past due: "Held"). */
      tag?: string;
    };

type ColState = "paid" | "now" | "next" | "void";

export function Timeline({
  start,
  today,
  mode,
  selected,
  onSelect,
  tone,
  readout = "full",
  readoutSize = "l",
  prices = true,
  plot = 76,
  bleed = "1.5rem",
  enter = true,
  lead = 0,
  fillFirst = false,
  step = "snappy",
  sheen,
  rollSlow = false,
  pending = "Confirming…",
  className = "",
}: {
  /** The day month 1 starts (today, on the paywall). */
  start: Date;
  today: Date;
  mode: TimelineMode;
  /** 1 to 7, controlled. */
  selected: number;
  /** Absent: a picture, not a control. */
  onSelect?: (month: number) => void;
  tone: "plum" | "neutral";
  /** "skeleton" while a checkout is being confirmed: never a guessed price. */
  readout?: "full" | "skeleton" | "none";
  readoutSize?: "l" | "hero";
  /** The bare price over each column. */
  prices?: boolean;
  /** The height of A$12.99, in px; every column is measured from zero. */
  plot?: number;
  /** The container's side padding, which the floor runs through. */
  bleed?: string;
  /** The columns rise on arrival. */
  enter?: boolean;
  /** Holds the entrance back, so a rising sheet lands first. */
  lead?: number;
  /** Checkout return: month 1 fills from the baseline. */
  fillFirst?: boolean;
  /** The spring a selection change travels on. */
  step?: "snappy" | "sheet";
  /** A one-time sheen over one column (the monthly drop). */
  sheen?: { month: number; delay: number; key: number };
  rollSlow?: boolean;
  /** What the skeleton readout says on its right while it waits. */
  pending?: string;
  className?: string;
}) {
  const ladder = rungs(start);
  const plotRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  // A plan whose month is not known yet (checkout still confirming) lights
  // nothing: unknown is never drawn as month 1.
  const unknown = mode.kind === "plan" && mode.current < 1;
  const current = mode.kind === "plan" ? (unknown ? 0 : rungOf(mode.current)) : 1;
  const interactive = !!onSelect;

  const stateOf = (r: Rung): ColState => {
    if (mode.kind === "offer") return r.month === 1 ? "now" : "next";
    if (r.month < current) return "paid";
    if (r.month === current) return "now";
    return mode.ending ? "void" : "next";
  };

  const height = (cents: number) => Math.round((cents / 1299) * plot * 2) / 2;
  const sel = ladder[Math.min(Math.max(selected, 1), FLOOR_MONTH) - 1];
  const top = topLine(sel, mode, today, current);
  const bottom =
    mode.kind === "plan" && sel.month === current ? `Month ${mode.current}` : monthLabel(sel.month);

  /** The column under a finger, by the plot's own pitch. */
  const pick = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return selected;
    const i = Math.floor(((clientX - r.left) / r.width) * FLOOR_MONTH);
    return Math.min(Math.max(i, 0), FLOOR_MONTH - 1) + 1;
  };

  const go = (m: number, tick: boolean) => {
    const next = Math.min(Math.max(m, 1), FLOOR_MONTH);
    if (next === selected || !onSelect) return;
    if (tick) buzz(6);
    onSelect(next);
  };

  const handlers = interactive
    ? {
        onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
          // The sheet under this follows a finger down (Overlay); a scrub
          // is the chart's, never the sheet's.
          e.stopPropagation();
          if (e.pointerType === "mouse" && e.button !== 0) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // A pointer the browser no longer tracks; the tap still selects.
          }
          setScrubbing(true);
          go(pick(e.clientX), false);
        },
        onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
          if (!scrubbing) return;
          go(pick(e.clientX), true);
        },
        onPointerUp: () => setScrubbing(false),
        onPointerCancel: () => setScrubbing(false),
        onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
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
        },
      }
    : {};

  const num = readoutSize === "hero" ? "text-num-hero" : "text-num-l";

  return (
    <div
      className={`la-timeline la-${tone} ${className}`}
      style={{ "--la-lead": `${lead}ms` } as React.CSSProperties}
    >
      {readout !== "none" && (
        /* The readout: the price on the left, when it starts on the right,
           on one baseline. Hidden from screen readers, which hear the
           slider's value text instead of a second copy. */
        <div aria-hidden className="flex justify-between gap-3" style={{ alignItems: "last baseline" }}>
          {readout === "skeleton" ? (
            <span className={`font-display ${num} flex items-center`}>
              <span className="la-skel block h-[0.74em] w-[3.6em] rounded-control" />
            </span>
          ) : (
            <p className={`font-display ${num} la-fg whitespace-nowrap tabular-nums`}>
              <span className="la-cur">A$</span>
              <RollNumber
                text={formatBare(sel.cents)}
                value={sel.cents}
                instant={scrubbing}
                className={rollSlow ? "la-roll-slow" : ""}
              />
            </p>
          )}
          <p className="min-w-0 text-right">
            {readout === "skeleton" ? (
              <span className="la-fg2 block text-caption">{pending}</span>
            ) : (
              <>
                <span className="font-display la-fg block text-row">{top}</span>
                <span className="la-fg2 mt-0.5 block text-caption">{bottom}</span>
              </>
            )}
          </p>
        </div>
      )}

      <div
        ref={plotRef}
        {...(interactive
          ? {
              role: "slider",
              tabIndex: 0,
              "aria-label": "Price by month",
              "aria-valuemin": 1,
              "aria-valuemax": FLOOR_MONTH,
              "aria-valuenow": sel.month,
              "aria-valuetext": spoken(sel, mode, today, current),
            }
          : { "aria-hidden": true })}
        data-scrubbing={scrubbing || undefined}
        data-enter={enter || undefined}
        data-step={step}
        data-bare={!prices || undefined}
        {...handlers}
        className={`la-chart ${readout !== "none" ? "mt-3" : ""}`}
        style={
          {
            "--la-plot": `${plot}px`,
            "--la-bleed": bleed,
            "--sel": sel.month,
            "--sel-h": `${height(sel.cents)}px`,
          } as React.CSSProperties
        }
      >
        <div className="la-cols">
          {!unknown && (
            <span aria-hidden className="la-sel">
              <span className="la-sel-band" />
            </span>
          )}
          {ladder.map((r, i) => {
            const state = stateOf(r);
            const next = ladder[i + 1];
            return (
              <div
                key={r.month}
                aria-hidden
                className="la-col"
                data-state={state}
                data-sel={(!unknown && r.month === sel.month) || undefined}
                data-floor={r.month === FLOOR_MONTH || undefined}
                style={
                  {
                    "--h": `${height(r.cents)}px`,
                    "--next-h": `${next ? height(next.cents) : height(r.cents)}px`,
                    "--i": i,
                  } as React.CSSProperties
                }
              >
                {mode.kind === "plan" && mode.tag && r.month === current && (
                  <span className="la-tag label-micro">{mode.tag}</span>
                )}
                {prices && <span className="la-price font-display">{formatBare(r.cents)}</span>}
                <span className={`la-bar ${fillFirst && r.month === 1 ? "la-fill-first" : ""}`} />
                {sheen && sheen.month === r.month && (
                  <span
                    key={sheen.key}
                    className="la-sheen"
                    style={{ "--sheen-delay": `${sheen.delay}ms` } as React.CSSProperties}
                  />
                )}
                {next && <span className="la-riser" data-next={stateOf(next)} />}
                <span className="la-month font-display">
                  {monthName(r.starts)}
                  {r.month === FLOOR_MONTH && <span className="la-plus">+</span>}
                </span>
              </div>
            );
          })}
          {!unknown && (
            <span aria-hidden className="la-sel" data-layer="dot">
              <span className="la-sel-dot" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** The readout's right-hand line for the selected month. */
function topLine(r: Rung, mode: TimelineMode, today: Date, current: number): string {
  if (mode.kind === "offer") {
    return r.month === 1 ? "Today" : `From ${when(r.starts, today)}`;
  }
  if (r.month < current) return `Paid ${dayMonth(r.starts)}`;
  if (r.month === current) return mode.nowLine ?? "This month";
  const from = `From ${when(r.starts, today)}`;
  return mode.ending ? `${from}, if kept` : from;
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
