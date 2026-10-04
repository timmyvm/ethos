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
 *
 * No hover step (M15, today-21, practice-tab-24, recording-2, auth-10).
 * It used to hover to terracotta-600, which is the rust hex #b2432c:
 * ink on it measures 2.9:1 and the one tap read as "wrong direction"
 * under a pointer. The `.press` veil answers every pointer instead.
 * The 200ms colour transition is how a waiting button (DISABLED_CLASS,
 * M25) lights up once it is valid: a crossfade, no scale. `.press`
 * reads the duration and curve these utilities set (globals.css).
 */
export const ACTION_CLASS =
  "press font-display block min-h-12 w-full rounded-control bg-terracotta-500 px-6 py-3.5 text-center text-body font-bold text-on-accent transition-colors duration-200 ease-out";

/**
 * Disabled, one value everywhere (#234): the control keeps its shape and
 * loses its voice. Never `opacity-40`, which fades the fill as well and
 * leaves a terracotta ghost.
 *
 * M25: `aria-disabled` wears the same look, so a Link that waits for a
 * valid form (a Link cannot be `disabled`) looks like a disabled button.
 */
export const DISABLED_CLASS =
  "disabled:!border-edge disabled:!bg-surface disabled:!text-stone-400 disabled:shadow-none aria-disabled:!border-edge aria-disabled:!bg-surface aria-disabled:!text-stone-400 aria-disabled:shadow-none";

/**
 * A field somebody types into (#246's control grammar, #249). The one
 * spelling: `surface` behind the `edge` boundary every control carries,
 * 44px minimum, and a focus border in terracotta rather than the 2.4:1
 * stone that used to make focus invisible.
 *
 * Here rather than inline because two screens now ask for the same
 * string — /you's name row and the introduction's first question — and
 * a control with two spellings is a control with two looks.
 *
 * `text-read` (16px) because iOS Safari zooms the page into any field
 * set under 16px (auth-18, intro-a-10, intro-a-11). Focus is ONE 2px
 * terracotta edge, the 1px border plus a 1px inset shadow; the global
 * focus ring is switched off here (important, since that ring is
 * unlayered), so a field never shows two rings at once.
 */
export const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-control border border-edge bg-surface px-4 text-read font-semibold placeholder:text-stone-400 focus:border-terracotta-500 focus:shadow-[inset_0_0_0_1px_var(--color-terracotta-500)] focus-visible:outline-none!";
