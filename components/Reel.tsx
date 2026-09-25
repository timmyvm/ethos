"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EASE_IN_OUT, EASE_OUT, SPIN, spinAt, spinStop, spinTicks } from "@/lib/motion";
import { buzz, prefersReducedMotion } from "@/lib/prefs";

/**
 * The reel (DECISIONS #278, lengthened by the first-user feedback round).
 *
 * Two screens drew a topic at random and both called what they did "a
 * reel, not a swap" while doing neither: six `setState` swaps 70ms
 * apart with the text held at 40% opacity. Nothing travelled. #278 made
 * it one strip in a fixed window, but kept it inside 300ms with three
 * candidates, "fast, on purpose". A first-time user asked for a longer
 * spin: at that speed the draw is over before it reads as a draw.
 *
 * So it is a slot reel now (`SPIN` and `spinAt` in lib/motion.ts):
 * about twenty candidates, fast off the mark and braking steadily, so
 * the last few tick past late; it arrives still moving, bounces a few
 * pixels past and back, and the landed prompt lifts from dim to full
 * and pops. Haptic ticks follow the same curve, so they space out as
 * it slows, and a thunk marks the stop. `transform` and `opacity` only.
 *
 * The bounce is why there is a frame AFTER the one it settles on.
 * Without something under the landing frame the swing shows the empty
 * bottom of the window, which looks like a bug rather than a wheel.
 * That frame fades out as the reel arrives, so what peeks up during the
 * bounce is a dim edge, never a row of stray ascenders.
 *
 * `data-motion="reduce"` never starts: the draw is handed back
 * immediately.
 */

/** How dim a candidate is while it flashes past. The landing lifts to 1. */
const PASSING = 0.42;

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
}: {
  current: T;
  draw: (excludeId: string | null) => T;
  onLand: (item: T) => void;
}): ReelState<T> {
  const [strip, setStrip] = useState<T[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
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
    /* Where it is now, the candidates, where it stops, and one under
       that for the bounce to show. No two neighbours repeat, and
       neither the prompt it leaves nor the one it lands on flashes past
       mid-spin: seeing the landing a cell early, in the slowest part,
       reads as a stutter. `draw` only excludes one id, so the rest is a
       retry; the pools run to fifty and more, so it rarely takes two. */
    const avoid = (...ids: string[]) => {
      let t = draw(ids[0]);
      for (let tries = 0; tries < 8 && ids.includes(t.id); tries++) t = draw(ids[0]);
      return t;
    };
    const lead: T[] = [];
    let last = current.id;
    for (let i = 0; i < SPIN.lead; i++) {
      const t = avoid(last, landed.id, current.id);
      lead.push(t);
      last = t.id;
    }
    const next = [current, ...lead, landed, avoid(landed.id, last)];
    setStrip(next);

    /* A tick as each candidate takes the window, and on the stop the
       thunk and the hand-back together, so the screen's labels (the
       shape, "The wheel says") change as it lands rather than a beat
       after. The buttons wait for the settle: `rolling` holds until the
       strip clears. */
    const ticks = spinTicks(next.length - 2);
    const stop = spinStop();
    timers.current = [
      ...ticks.map((at) => setTimeout(() => buzz(6), at)),
      setTimeout(() => {
        buzz([10, 30, 10]);
        onLand(landed);
      }, stop),
      setTimeout(() => {
        timers.current = [];
        setStrip(null);
      }, SPIN.ms),
    ];
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
 * translated by whole cells.
 */
export function Reel<T extends { id: string }>({
  state,
  current,
  render,
  className = "",
}: {
  state: ReelState<T>;
  current: T;
  render: (item: T) => ReactNode;
  className?: string;
}) {
  const { strip, landing } = state;
  const win = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const landed = useRef<HTMLDivElement>(null);

  /*
   * The spin runs on the Web Animations API, started in a LAYOUT effect:
   * the animation exists before the strip's first paint, so that paint
   * is keyframe 0 (the current prompt, in place) and never the resting
   * transform. That replaces #278's two-render dance, which mounted the
   * strip at rest and set the transform on the next frame.
   *
   * Pixels, measured off the window, because a keyframe cannot lean on
   * `--reel-cell` the way the resting transform does.
   */
  useLayoutEffect(() => {
    if (!strip || !win.current || !column.current) return;
    /* `offsetHeight`, the layout size: a bounding rect includes ancestor
       transforms, and the roulette arrives scaled to 0.985, so a Spin
       tapped during that entrance would measure every cell short and
       snap by twenty-odd pixels when the animation hands back. */
    const cell = win.current.offsetHeight;
    const { ms, pop } = SPIN;
    const stop = spinStop();
    const at = (t: number) => Math.min(1, t / ms);
    /* The path, sampled about once a frame from `spinAt`, linear in
       between. One function drives this and the haptic ticks. */
    const path: Keyframe[] = [];
    for (let t = 0; t < ms; t += 16) {
      path.push({ offset: at(t), transform: `translateY(${-spinAt(t, landing) * cell}px)` });
    }
    path.push({ offset: 1, transform: `translateY(${-landing * cell}px)` });
    /* The last candidate taking the window: from here the landed prompt
       brightens, and the one under it fades, both done by the stop. */
    const ticks = spinTicks(landing);
    const arriving = at(ticks[ticks.length - 1] ?? stop * 0.9);
    const running = [
      column.current.animate(path, { duration: ms }),
      /* The pop: the window lifts a few percent at the stop, and back. */
      win.current.animate(
        [
          { offset: 0, transform: "scale(1)" },
          { offset: at(stop), transform: "scale(1)", easing: EASE_OUT },
          { offset: at(stop + pop * 0.35), transform: "scale(1.045)", easing: EASE_IN_OUT },
          { offset: at(stop + pop), transform: "scale(1)" },
          { offset: 1, transform: "scale(1)" },
        ],
        { duration: ms }
      ),
    ];
    /* The highlight: the landed prompt arrives dim like every other
       candidate and comes up to full as it stops. */
    const fade = (el: Element | null | undefined, from: number, to: number) => {
      if (!el) return;
      running.push(
        el.animate(
          [
            { offset: 0, opacity: from },
            { offset: arriving, opacity: from, easing: EASE_OUT },
            { offset: at(stop), opacity: to },
            { offset: 1, opacity: to },
          ],
          { duration: ms }
        )
      );
    };
    fade(landed.current, PASSING, 1);
    fade(landed.current?.nextElementSibling, PASSING, 0);
    return () => {
      for (const a of running) a.cancel();
    };
  }, [strip, landing]);

  /*
   * `off` is DERIVED rather than stored, which is not a style
   * preference. Resetting it in an effect when the strip clears leaves
   * one painted frame where a one-cell column is still translated
   * twenty cells up, so the window is empty. Derived, the strip and its
   * transform leave in the same commit the landed prompt arrives in.
   * While rolling it is the landing, which is what the animation hands
   * back to when it ends.
   */
  const frames = strip ?? [current];
  const off = strip ? landing : 0;

  return (
    <div
      ref={win}
      className={`relative origin-left overflow-hidden ${className}`}
      /* The WINDOW is one cell tall and clips. Without a height here the
         column simply makes the page grow. */
      style={{ height: CELL }}
      aria-live="polite"
    >
      <div
        ref={column}
        /* Promoted only while it spins. At rest a standing layer is one
           per reel for nothing, and the pop would scale a 1x bitmap of
           the landed prompt, softening it just when it should be crisp. */
        className={strip ? "will-change-transform" : undefined}
        style={{
          /* Cell heights, not percentages. A percentage on a transform
             is a percentage of the moving element's own box, and the
             column is `frames.length` cells tall. */
          transform: `translateY(calc(${CELL} * -${off}))`,
        }}
      >
        {frames.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            ref={strip && i === landing ? landed : undefined}
            style={{
              height: CELL,
              /* The prompt it leaves stays full, so frame 0 is exactly
                 the card at rest; everything passing is dim. */
              opacity: strip && i !== 0 && i !== landing ? PASSING : undefined,
            }}
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
