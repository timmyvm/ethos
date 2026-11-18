/**
 * Each measure's one name, its unit in words (#495: "/ min", "/100
 * words" and "wpm" were three spellings of two ideas). Its own module,
 * so a screen that prints one does not load the Log. The Log's What
 * moved table, which set each name over its unit, went with #506; the
 * results' Since day one card (ComparisonCard), the Index's Fillers row
 * and a Hostile take print these.
 *
 * A measure that is a trait's own number takes the trait's unit from
 * content/traits.ts (Pace, "words a minute"). A measure that is not gets
 * a name of its own, so the two cannot be read as one:
 *
 *  - Every filler counted (um, uh, like, you know, basically), a minute
 *    (E32). The Fillers trait is um or uh in 100 words, so the bare word
 *    Fillers only ever means the trait (`lib/trait-labels.test.ts`).
 *  - Pauses between sentences in one recording (#495). The Pausing trait
 *    is the same pauses a minute; a count over a whole recording is a
 *    different number, so it says "in a recording".
 */
export const ALL_FILLERS = "All fillers";
/** "All fillers a minute": the every-filler rate wherever it is printed. */
export const ALL_FILLERS_PER_MIN = `${ALL_FILLERS} a minute`;

/** Pace is the Pace trait's own number, in the trait's own unit. */
export const WORDS_A_MINUTE = "Words a minute";

/**
 * Pauses between sentences counted over one recording (#495). It counted
 * every pause of 0.8s or more, the ones inside a sentence too, so the
 * number rose with the fault Demos names on the results; now it counts
 * the pauses the Pausing trait counts (kind "pre"), over the take.
 */
export const PAUSES_PER_RECORDING = "Pauses between sentences in a recording";

/** The pauses between sentences in one recording's stored pauses. */
export function pausesBetween(pauses: readonly { kind: string }[] | null | undefined): number {
  return (pauses ?? []).filter((p) => p.kind === "pre").length;
}
