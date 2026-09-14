"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DURATION, EASE_SPRING } from "@/lib/motion";
import { buzz, prefersReducedMotion } from "@/lib/prefs";

/**
 * The reel (DECISIONS #278).
 *
 * Two screens drew a topic at random and both called what they did "a
 * reel, not a swap" while doing neither: six `setState` swaps 70ms
 * apart with the text held at 40% opacity, and each new draw playing
 * the app's 6px `.arrive`. Nothing travelled. The card flickered, which
 * reads as a page struggling rather than as a wheel being turned.
 *
 * This is the wheel. One strip of drawn candidates in a fixed window,
 * one transition, and the spring's overshoot at the end so it lands
 * with a stop instead of arriving. `transform` and `opacity` only, and
 * inside `DURATION.max`, because `lib/motion.ts` keeps 600ms for
 * celebrations and a draw is not one. Fast, on purpose: the point of
 * the spin is the prompt it lands on.
 *
 * The overshoot is why there is a frame AFTER the one it settles on.
 * `--ease-spring` travels past its target and comes back; without
 * something under the landing frame that overshoot shows the empty
 * bottom of the window, which looks like a bug rather than a wheel.
 *
 * `data-motion="reduce"` never starts: the draw is handed back
 * immediately, which is what the two screens already did.
 */

/** Frames before the one it lands on. Five at 300ms is a flick. */
export const REEL_LEAD = 3;

export interface ReelState<T> {
  /** The strip, or null when the wheel is at rest. */
  strip: T[] | null;
  /** Index within `strip` the wheel settles on. */
  landing: number;
  rolling: boolean;
  spin: () => void;
}

/**
 * Owns the draw and the timing; the caller owns the button and what a
 * drawn item looks like.
 *
 * `draw` takes the id to exclude, which is the signature both existing
 * pools already have (`spin` in lib/topics.ts, the boss's own picker).
 */
export function useReel<T extends { id: string }>({
  current,
  draw,
  onLand,
  duration = DURATION.max,
}: {
  current: T;
  draw: (excludeId: string | null) => T;
  onLand: (item: T) => void;
  duration?: number;
}): ReelState<T> {
  const [strip, setStrip] = useState<T[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function spin() {
    if (strip) return;
    buzz(20);
    const landed = draw(current.id);
    if (prefersReducedMotion()) {
      onLand(landed);
      return;
    }
    /* The strip: where it is now, the blur, where it stops, and one
       under that for the overshoot to show. */
    const lead: T[] = [];
    let last = current.id;
    for (let i = 0; i < REEL_LEAD; i++) {
      const t = draw(last);
      lead.push(t);
      last = t.id;
    }
    setStrip([current, ...lead, landed, draw(landed.id)]);
    timer.current = setTimeout(() => {
      setStrip(null);
      onLand(landed);
      buzz([10, 30, 10]);
    }, duration + 40);
  }

  return {
    strip,
    landing: strip ? strip.length - 2 : 0,
    rolling: strip !== null,
    spin,
  };
}

/**
 * The window. Fixed height, one cell per frame, the whole column
 * translated by whole cells so nothing has to know a pixel value.
 */
export function Reel<T extends { id: string }>({
  state,
  current,
  render,
  duration = DURATION.max,
  className = "",
}: {
  state: ReelState<T>;
  current: T;
  render: (item: T) => ReactNode;
  duration?: number;
  className?: string;
}) {
  /*
   * Two renders: the strip mounts at rest and travels on the NEXT
   * frame. Setting the final transform in the same commit as the mount
   * gives the browser no starting value to animate from, and the strip
   * appears in place instead of moving.
   *
   * `off` is DERIVED rather than stored, which is not a style
   * preference. Resetting it in an effect when the strip clears leaves
   * one painted frame where a one-cell column is still translated four
   * cells up, so the window is empty: the first build of this flashed
   * blank for about 160ms after every landing.
   */
  const [travelling, setTravelling] = useState(false);
  const { strip, landing } = state;

  useEffect(() => {
    if (!strip) {
      setTravelling(false);
      return;
    }
    const id = requestAnimationFrame(() => setTravelling(true));
    return () => cancelAnimationFrame(id);
  }, [strip]);

  const frames = strip ?? [current];
  const off = strip && travelling ? landing : 0;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      /* The WINDOW is one cell tall and clips. Without a height here the
         column simply makes the page grow, which is what the first
         version did: the card became six prompts tall and the strip
         travelled past the fold. */
      style={{ height: CELL }}
      aria-live="polite"
    >
      <div
        style={{
          /* Cell heights, not percentages. A percentage on a transform
             is a percentage of the moving element's own box, and the
             column is `frames.length` cells tall, so -100% would travel
             the whole strip rather than one prompt. */
          transform: `translateY(calc(${CELL} * -${off}))`,
          transition: strip
            ? `transform ${duration}ms ${EASE_SPRING}`
            : undefined,
        }}
      >
        {frames.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            style={{ height: CELL }}
            className="overflow-hidden"
            aria-hidden={strip ? i !== landing : undefined}
          >
            {render(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One prompt's worth of window. Overridable per screen with the same
    custom property, because the boss's titles are shorter. */
const CELL = "var(--reel-cell, 5.75rem)";
