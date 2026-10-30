"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { prefersReducedMotion } from "@/lib/prefs";

/**
 * The live meter under the clock while the mic is hot (#219).
 *
 * A scrolling bar per frame, newest on the right, grown from the
 * centre so speech reads as a waveform rather than a bar chart. The
 * bars are driven straight from the analyser through `transform` on
 * the DOM nodes: the page used to push every frame through React
 * state, which re-rendered the whole rep screen sixty times a second
 * and stuttered on the phones this is for. The page writes one number
 * into `level` per audio frame; this component reads it on its own
 * animation frame and never re-renders.
 *
 * Reduced motion keeps the meter, because it is data (is the mic
 * hearing me?), at a twelfth of the rate.
 */
export function LevelMeter({
  level,
  bars = 36,
  height = 48,
  centre = false,
  className = "",
}: {
  /** 0 to 1, already normalised. Written by the recorder every frame. */
  level: MutableRefObject<number>;
  bars?: number;
  /** In px, or any CSS length (the live waveform's clamp). */
  height?: number | string;
  /**
   * The live screen's waveform (D51): the bars span the column, the
   * newest lands at the centre and the take rolls left from it, and the
   * right half is the flat line still to come. Stroked in `--wave` (the
   * practice's tone, `.rec-wave`).
   */
  centre?: boolean;
  className?: string;
}) {
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  /* In the centre layout only the left half moves. */
  const live = centre ? Math.ceil(bars / 2) : bars;

  useEffect(() => {
    const buffer = new Float32Array(live);
    /* The centre waveform keeps about two seconds in its half (15 bars
       a second, each the loudest frame since the last), so it reads as
       the take rolling by rather than a flicker. */
    const interval = prefersReducedMotion() ? 1000 / 12 : centre ? 1000 / 15 : 0;
    let raf = 0;
    let last = 0;
    let peak = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      peak = Math.max(peak, level.current);
      if (now - last < interval) return;
      last = now;
      buffer.copyWithin(0, 1);
      buffer[live - 1] = centre ? peak : level.current;
      peak = 0;
      for (let i = 0; i < live; i++) {
        const el = nodes.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(FLOOR, buffer[i])})`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, live, centre]);

  return (
    <div
      className={`flex items-center ${centre ? "w-full justify-between" : "gap-0.5"} ${className}`}
      style={{ height }}
      aria-hidden
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          className={`block h-full w-1 origin-center ${
            centre
              ? `rounded-full bg-[var(--wave)] ${i >= live ? "opacity-35" : ""}`
              : "bg-[var(--rec-bar-lit)]"
          }`}
          style={{ transform: `scaleY(${FLOOR})` }}
        />
      ))}
    </div>
  );
}

/**
 * A bar never vanishes: silence is a flat line, not an empty row.
 * recording-17: at 4% of 48px and 2px apart, silence reads as one
 * near-continuous amber hairline (the scoring wave's lit colour, so the
 * recording and its reading wear one colour) rather than a dotted rule.
 * #219 stands: the bars still move with the voice.
 */
const FLOOR = 0.04;
