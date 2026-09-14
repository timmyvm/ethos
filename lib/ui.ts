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

/**
 * A field somebody types into (#246's control grammar, #249). The one
 * spelling: `surface` behind the `edge` boundary every control carries,
 * 44px minimum, and a focus border in terracotta rather than the 2.4:1
 * stone that used to make focus invisible.
 *
 * Here rather than inline because two screens now ask for the same
 * string — /you's name row and the introduction's first question — and
 * a control with two spellings is a control with two looks.
 */
export const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-control border border-edge bg-surface px-4 text-[15px] font-semibold placeholder:text-stone-400 focus:border-terracotta-500";
