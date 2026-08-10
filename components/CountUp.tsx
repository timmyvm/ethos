"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/prefs";

/**
 * Counts a number up on arrival.
 *
 * The delivery moment is worth making into an event rather than a
 * static render — reward-prediction work treats the arrival of a reward
 * as its own signal, and a number that lands feels like it arrived. The
 * value is real either way; only the reveal is animated.
 *
 * Honours reduced motion by rendering the final number immediately.
 */
export function CountUp({
  value,
  durationMs = 900,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const raf = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    // Start low enough to feel like a climb without a silly long count.
    const from = Math.max(0, Math.round(value * 0.82));
    const start = performance.now();
    setShown(from);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out: fast then settling, so the last digits land softly.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, durationMs]);

  return <span className={className}>{shown}</span>;
}
