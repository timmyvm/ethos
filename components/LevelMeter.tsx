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
}: {
  /** 0 to 1, already normalised. Written by the recorder every frame. */
  level: MutableRefObject<number>;
  bars?: number;
  height?: number;
}) {
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const buffer = new Float32Array(bars);
    const interval = prefersReducedMotion() ? 1000 / 12 : 0;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < interval) return;
      last = now;
      buffer.copyWithin(0, 1);
      buffer[bars - 1] = level.current;
      for (let i = 0; i < bars; i++) {
        const el = nodes.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(FLOOR, buffer[i])})`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, bars]);

  return (
    <div
      className="flex items-center gap-[3px]"
      style={{ height }}
      aria-hidden
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          className="block h-full w-1 origin-center bg-stone-400"
          style={{ transform: `scaleY(${FLOOR})` }}
        />
      ))}
    </div>
  );
}

/** A bar never vanishes: silence is a flat line, not an empty row. */
const FLOOR = 0.08;
