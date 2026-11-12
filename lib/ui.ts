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
 * The one tap on a page (one per screen, brand.md). A pill
 * (`rounded-tap`, D11: Today's Start was the first, and one action wears
 * one shape on every screen), 48px tall, and no shadow.
 *
 * Its fill is ink since #437 (Timothy, 12 Nov: "the orange button is
 * ugly ... a futuristic gradient 3D against a flat button", then "8 for
 * home and 10 for feedback" from the ten directions in
 * docs/look/buttons). A tap has no colour of its own now: on the page
 * it is ink (`.tap`, globals.css), on a coloured card it is cut from
 * the card (`.tap-tonal`). It was terracotta-500 with ink on it.
 *
 * No hover step (M15, today-21, practice-tab-24, recording-2, auth-10):
 * the `.press` veil answers every pointer instead. The 200ms colour
 * transition is how a waiting button (DISABLED_CLASS, M25) lights up
 * once it is valid: a crossfade, no scale. `.press` reads the duration
 * and curve these utilities set (globals.css).
 *
 * `leading-5` makes it a whole 48px (14 + 20 + 14): on the body's 1.5
 * line it came to 50.5, and a sticky shelf of a fractional height let a
 * device row of the content behind it show under its edge at 2x (B4).
 */
const ACTION_SHAPE =
  "press font-display block min-h-12 w-full rounded-tap px-6 py-3.5 text-center text-body leading-5 font-bold transition-colors duration-200 ease-out";

export const ACTION_CLASS = `${ACTION_SHAPE} tap`;

/**
 * The same tap standing on a coloured card (the plum sheet): a pale
 * tint of the card and the card's deep tone for its word, which the
 * card names in `--tap-tint` and `--tap-tint-ink` (globals.css).
 * Today's Start is the first of these and keeps its own class.
 */
export const ACTION_TONAL_CLASS = `${ACTION_SHAPE} tap-tonal`;

/**
 * The way on (#437, direction 10: "10 for feedback"). The tap that
 * moves you to the next thing: its words start at the left and a round
 * arrow stands at its right end, drawn by `<TapArrow />` as its last
 * child. 48px like the others (6 + the 36px disc + 6); words that wrap
 * grow it. The results' way on wears it, and since #438 the tap under
 * Lessons' Up next ("Carry on"): the two that keep you going.
 */
export const ACTION_ARROW_CLASS =
  "press font-display flex min-h-12 w-full items-center justify-between gap-3 rounded-tap py-1.5 pr-1.5 pl-5.5 text-left text-body leading-5 font-bold transition-colors duration-200 ease-out tap";

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
const INPUT_SHAPE =
  "w-full min-w-0 rounded-control border px-4 font-semibold placeholder:text-stone-400 focus:border-terracotta-500 focus:shadow-[inset_0_0_0_1px_var(--color-terracotta-500)] focus-visible:outline-none!";

export const INPUT_CLASS = `min-h-11 ${INPUT_SHAPE} border-edge bg-surface text-read`;

/**
 * The same field at an answer's size (B12): 56px at 17px, the height of
 * the introduction's answer rows (still past the 16 that stops iOS
 * zooming in). No resting fill or edge: the caller sets the resting look
 * or the picked one, so two utilities for one property never meet.
 */
export const INPUT_ANSWER_CLASS = `min-h-14 ${INPUT_SHAPE} text-detail`;
