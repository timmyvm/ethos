/**
 * Class strings shared across screens.
 *
 * `ACTION_CLASS` lived in `components/LessonScreen.tsx`, which is a
 * `"use client"` module — so importing it into a server component (the
 * marketing pages, `not-found`) handed the page a client reference
 * rather than a string, and the button rendered with no styling at all.
 * A constant with seven importers is not a component's business; it
 * lives here, where both halves of the app can read it.
 */

/**
 * The one tap (brand.md: exactly one terracotta per screen). A 12px
 * rectangle, ink on terracotta, 48px tall, and no shadow — the colour
 * is the lift (DECISIONS #234).
 */
export const ACTION_CLASS =
  "press font-display block min-h-12 w-full rounded-control bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-bold text-on-accent transition-colors hover:bg-terracotta-600";

/**
 * Disabled, one value everywhere (#234): the control keeps its shape and
 * loses its voice. Never `opacity-40`, which fades the fill as well and
 * leaves a terracotta ghost.
 */
export const DISABLED_CLASS =
  "disabled:!border-edge disabled:!bg-surface disabled:!text-stone-400 disabled:shadow-none";
