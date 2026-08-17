/**
 * The only source of durations and easings (DESIGN-RULES.md, motion).
 *
 * Ethos animates in CSS — there is no animation library in the stack and
 * nothing here wants one — so these are milliseconds and cubic-bezier
 * strings, meant to be read into a `style` prop or a CSS variable, not a
 * framer-motion `transition` object. The rules they encode:
 *
 *  - 200ms ease-out is the default; nothing goes past 300ms except a
 *    celebration, which may take 600
 *  - only `transform` and `opacity` move
 *  - motion has to mean something (origin, causality, success);
 *    decoration that moves is decoration twice
 *
 * Anything that reads a duration from here must also honour
 * `prefersReducedMotion()` (lib/prefs) — collapse to an opacity fade, or
 * to nothing.
 */

export const DURATION = {
  /** Press states, toggles — feedback that has to feel instant. */
  fast: 120,
  /** The default: fades, expansions, sheets. */
  base: 200,
  /** The ceiling for ordinary UI. */
  max: 300,
  /** Rep complete, streak milestone, star earned. Nothing else. */
  celebrate: 600,
} as const;

/** ease-out-quart — quick off the mark, gentle landing. The default. */
export const EASE_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";

/** Symmetric, for something that has to come back the way it went. */
export const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

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
