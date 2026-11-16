"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { afterSplash, browserSplashEnv } from "@/lib/after-splash";
import { countedBefore, rememberCounted } from "@/lib/counted";
import { DURATION } from "@/lib/motion";
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
 * On a cold open it holds at its start until the splash has left
 * (lib/after-splash.ts, E60), so the climb is seen rather than spent
 * under the splash.
 * On a tab, a number counts once per visit (#467): coming back to the
 * tab (a swipe, a tap on the bar) shows it where it landed, and only a
 * number that changed since counts again. A recording's result is not a
 * tab, so its score counts every time it is earned.
 * The default length is the celebration ceiling (DESIGN-RULES, motion):
 * the score landing is the rep-complete moment, and nothing else in
 * the product may take this long.
 */
export function CountUp({
  value,
  durationMs = DURATION.celebrate,
  className,
  format = round,
}: {
  value: number;
  durationMs?: number;
  className?: string;
  /**
   * How the running value is written. The default rounds, which is
   * right for a score and wrong for the two numbers it was quietly
   * refusing to animate: total XP reads 1,195 with a separator and
   * fillers-per-minute reads 2.8 with a decimal, and a tick that
   * degrades the number underneath it is worse than no tick.
   */
  format?: (value: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const raf = useRef(0);
  /* The tab and the number: React's ids are new on every client mount,
     so a place on the page cannot be told apart from one mount to the next. */
  const place = `${usePathname()}#${value}`;

  useEffect(() => {
    if (prefersReducedMotion() || countedBefore(place, value)) {
      setShown(value);
      return;
    }
    rememberCounted(place, value);
    // Start low enough to feel like a climb without a silly long count.
    const from = Math.max(0, value * 0.82);
    let start = 0;
    setShown(from);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out: fast then settling, so the last digits land softly.
      const eased = 1 - Math.pow(1 - t, 3);
      // Carried as a float and rounded by `format`, so a decimal can
      // count without the component deciding it is an integer.
      setShown(t < 1 ? from + (value - from) * eased : value);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    const cancel = afterSplash(() => {
      start = performance.now();
      raf.current = requestAnimationFrame(tick);
    }, browserSplashEnv());
    return () => {
      cancel();
      cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs, place]);

  return <span className={className}>{format(shown)}</span>;
}

/** The default: a whole number, which is what most of them are. */
function round(value: number): string {
  return String(Math.round(value));
}
