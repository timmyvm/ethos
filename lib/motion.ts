/**
 * The only source of durations and easings (DESIGN.md, continuity).
 *
 * Ethos animates in CSS — there is no animation library in the stack and
 * nothing here wants one — so these are milliseconds and cubic-bezier
 * strings, meant to be read into a `style` prop or a CSS variable, not a
 * framer-motion `transition` object. The rules they encode:
 *
 *  - 200ms ease-out is the default; nothing goes past 300ms except a
 *    celebration, which may take 600, and the spin (`SPIN`), which is
 *    the one thing on screen that is meant to be watched
 *  - only `transform` and `opacity` move
 *  - motion has to mean something (origin, causality, success);
 *    decoration that moves is decoration twice
 *
 * Movement that a finger or a layout causes runs on springs now, not
 * on these curves: lib/spring.ts (damping and response, Apple's two
 * numbers) and its `--spring-*` tokens. What stays here is fades,
 * celebrations and the spin.
 *
 * Anything that reads a duration from here must also honour
 * `prefersReducedMotion()` (lib/prefs) — collapse to an opacity fade, or
 * to nothing.
 *
 * The same numbers live in app/globals.css as `--duration-*` and
 * `--ease-*`, for the animations CSS drives (the `.arrive`, `.reveal`,
 * `.fill`, `.star-land` and sheet classes; DECISIONS #221), and
 * lib/motion.test.ts asserts the two copies match. Reduced motion on
 * the CSS side is `data-motion="reduce"` on <html> (components/Theme).
 */

export const DURATION = {
  /** Press states, toggles — feedback that has to feel instant. */
  fast: 120,
  /** The default: fades, expansions, sheets. */
  base: 200,
  /** The ceiling for ordinary UI. */
  max: 300,
  /** Recording done, streak milestone, star earned. Nothing else. */
  celebrate: 600,
} as const;

/** ease-out-quart — quick off the mark, gentle landing. The default. */
export const EASE_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";

/** Symmetric, for something that has to come back the way it went. */
export const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * The spring. Overshoots by about 6% and settles — the curve a finger
 * expects when it lets go of something (DECISIONS #240).
 *
 * Only for RELEASE and for arrival, never for departure: a thing
 * leaving the screen that bounces on its way out is a thing that looks
 * uncertain about leaving. Press-down uses EASE_OUT at 60ms, because
 * going down should feel like contact rather than like animation.
 */
export const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** `transition` shorthand for the properties we're allowed to animate. */
export function transition(
  properties: string,
  ms: number = DURATION.base,
  easing: string = EASE_OUT
): string {
  return properties
    .split(/,\s*/)
    .map((p) => `${p} ${ms}ms ${easing}`)
    .join(", ");
}

/**
 * The spin: the topic roulette and the boss wheel (components/Reel.tsx).
 *
 * A slot reel, not a flick. The first build ran three candidates past
 * in 300ms and a first-time user asked for a longer spin: at that speed
 * the draw is over before anyone sees it was a draw. So it runs past
 * the ordinary ceiling, on purpose, the one motion here meant to be
 * watched.
 *
 * The shape is a function of time (`spinAt`), not a cubic-bezier,
 * because one bezier cannot do both halves. A slot reel slows at a
 * steady rate, so the last few candidates tick past visibly late
 * instead of the whole spin ending early and creeping; and it reaches
 * the landing still MOVING, so the swing past is a bounce that passes
 * through rather than a hold with the prompt's first line clipped.
 * The ticks and the keyframes both read the same function.
 *
 * Only `transform` and `opacity` move, and `data-motion="reduce"` never
 * starts it: the draw lands at once.
 */
export const SPIN = {
  /** Tap to hand-back: the travel, the bounce and the pop. */
  ms: 2200,
  /** Candidates that flash past before the one it lands on. */
  lead: 18,
  /** Share of `ms` spent reaching the landing. That moment is the stop:
      the thunk, the label change, the pop. */
  travel: 0.84,
  /** Share of the travel run at the speed it lands with, so it arrives
      moving; the rest brakes at a steady rate. */
  carry: 0.2,
  /** The bounce past the landing and back, in ms. */
  bounce: 140,
  /** The landed prompt's pop, from the stop, in ms. */
  pop: 320,
  /** Haptic ticks closer together than this merge into a buzz. */
  tickGap: 60,
} as const;

type Spin = { [K in keyof typeof SPIN]: number };

/** The ms from the tap at which the reel reaches the landing. */
export function spinStop(spec: Spin = SPIN): number {
  return spec.ms * spec.travel;
}

/**
 * Where the reel is, in cells, `t` ms after the tap. `landing` is the
 * cell it stops on. Up to the stop: steady braking from about eighteen
 * cells a second, arriving at `carry` of its average speed. After: a
 * damped swing that leaves the landing at that speed, peaks a few
 * pixels past inside a tenth of a second and is back by `bounce` (a
 * sub-pixel dip after that, then exactly home).
 */
export function spinAt(t: number, landing: number, spec: Spin = SPIN): number {
  const stop = spinStop(spec);
  if (t <= 0) return 0;
  if (t < stop) {
    const left = 1 - t / stop;
    return landing * (1 - spec.carry * left - (1 - spec.carry) * left * left);
  }
  const speed = (landing * spec.carry) / stop;
  const w = Math.PI / spec.bounce;
  const since = t - stop;
  if (since >= spec.bounce * 2) return landing;
  return landing + (speed / w) * Math.exp((-2 * since) / spec.bounce) * Math.sin(w * since);
}

/**
 * When the reel crosses each cell, in ms from the tap: a tick as each
 * candidate takes the window (half a cell in), thinned to `tickGap` so
 * the fast start reads as a whirr and the brake as ticks spacing out.
 * The last entry is the landed prompt taking the window; the thunk
 * belongs at `spinStop()`, when it arrives.
 */
export function spinTicks(landing: number, spec: Spin = SPIN): number[] {
  const stop = spinStop(spec);
  const out: number[] = [];
  let cell = 1;
  for (let t = 0; t <= stop && cell <= landing; t += 4) {
    if (spinAt(t, landing, spec) < cell - 0.5) continue;
    const last = out[out.length - 1];
    if (cell === landing || last === undefined || t - last >= spec.tickGap) {
      out.push(t);
    }
    cell++;
  }
  return out;
}
