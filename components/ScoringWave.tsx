"use client";

import { useMemo } from "react";

/**
 * What the scoring wait shows (#219): the recording being read.
 *
 * The loudness envelope the meter just captured, bucketed to one bar
 * per slot, with a scan line sweeping across it. It is the same shape
 * the person watched grow while they spoke, so the wait is legibly
 * "the engine is going through that", not a spinner standing in for
 * nothing. Every bar is measured; the sweep is the only thing that is
 * not, and it is a loop, not a progress claim.
 *
 * A retry from the outbox has no envelope in hand, so the track is
 * flat and the sweep still runs: honest about having nothing to draw,
 * still visibly working.
 */
export function ScoringWave({
  levels,
  bars = 48,
  height = 40,
}: {
  /** Raw envelope samples, any length. Empty draws a flat track. */
  levels: number[];
  bars?: number;
  height?: number;
}) {
  const heights = useMemo(() => bucket(levels, bars), [levels, bars]);
  return (
    <div
      className="relative mx-auto flex w-full max-w-[280px] items-center gap-[3px] overflow-hidden"
      style={{ height }}
      aria-hidden
    >
      {heights.map((v, i) => (
        <span
          key={i}
          className="block h-full w-1 origin-center bg-stone-300"
          style={{ transform: `scaleY(${Math.max(FLOOR, v)})` }}
        />
      ))}
      {/* A full-width box whose right edge is the line: translating it
          from -100% to 0 walks the edge across, and only transform
          moves (DESIGN-RULES, motion). */}
      <span className="scoring-cursor absolute inset-y-0 left-0 w-full border-r-[3px] border-ink" />
    </div>
  );
}

const FLOOR = 0.08;

/**
 * Max per bucket, scaled to the recording's own loudest moment, then
 * square-rooted so the quiet parts still show. The envelope is stored
 * at the engine's gain (lib/envelope.ts), which is tuned for gap
 * detection, not for drawing.
 */
function bucket(levels: number[], bars: number): number[] {
  if (levels.length === 0) return Array(bars).fill(0);
  const size = levels.length / bars;
  const peak = Math.max(0.05, ...levels);
  return Array.from({ length: bars }, (_, i) => {
    const a = Math.floor(i * size);
    const b = Math.max(a + 1, Math.floor((i + 1) * size));
    let m = 0;
    for (let j = a; j < b && j < levels.length; j++) m = Math.max(m, levels[j]);
    return Math.sqrt(Math.min(1, m / peak));
  });
}
