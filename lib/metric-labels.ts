/**
 * Every filler counted (um, uh, like, you know), a minute (E32). The
 * Fillers trait is um or uh per hundred words (content/traits.ts), so
 * Today's tile and this rate are two different numbers: a row or a card
 * that printed this one under the trait's own name read as the same
 * trait in a second unit. One label for it wherever it is printed
 * (Timothy, 31 October: What moved, Day 1 vs now, the shared picture,
 * the results' Since day one card, the Log's insights, a Hostile take,
 * the Index's Fillers row), so the bare word Fillers only ever means
 * the trait (`lib/trait-labels.test.ts` holds every label to it). Its
 * own module, so a screen that prints it does not load the Log with it.
 */
export const ALL_FILLERS = "All fillers";
export const ALL_FILLERS_PER_MIN = `${ALL_FILLERS} / min`;

/**
 * Held pauses counted in one recording (L08, with E32). The Pausing
 * trait is held pauses a minute (content/traits.ts), so a row that set
 * one recording's count beside another's under the bare words read as
 * the trait's rate. A screen about one take (the numbers step, a
 * Hostile take) keeps "Held pauses": the count is that take's.
 */
export const HELD_PER_RECORDING = "Held pauses / recording";

/**
 * A label and its unit, each one piece: the subject's words hold
 * together (no-break spaces), the unit holds to its slash (no-break thin
 * spaces), and the one place a narrow column may break is just before
 * the slash (a zero-width space). "All fillers / min" holds one line in
 * the Log at 320 and from 375 up, and "Held pauses / recording" sets
 * "Held pauses" over "/ recording" instead of stranding "Held" over a
 * "pauses/recording" too wide for the column. A label with no unit is
 * returned as it is.
 */
export function unitBreak(label: string): string {
  const at = label.indexOf(" / ");
  if (at < 0) return label;
  return `${label.slice(0, at).replace(/ /g, "\u00A0")}\u202F\u200B/\u202F${label.slice(at + 3)}`;
}
