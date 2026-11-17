/**
 * The Log's measures, each with one name and one unit in words (#495:
 * "/ min", "/100 words" and "wpm" were three spellings of two ideas).
 * Its own module, so a screen that prints one does not load the Log.
 *
 * A measure that is a trait's own number takes the trait's name and its
 * unit from content/traits.ts (Pace, "words a minute"). A measure that
 * is not gets a name of its own, so the two cannot be read as one:
 *
 *  - Every filler counted (um, uh, like, you know, basically), a minute
 *    (E32). The Fillers trait is um or uh in 100 words, so the bare word
 *    Fillers only ever means the trait (`lib/trait-labels.test.ts`).
 *  - Pauses between sentences in one recording (#495). The Pausing trait
 *    is the same pauses a minute; a count over a whole recording is a
 *    different number, so it says "in a recording".
 */
export interface Measure {
  /** What is counted, sentence case: the row's first line. */
  name: string;
  /** What it is counted against, in words: the row's second line. */
  unit: string;
  /** The two as one phrase, where a label has one line. */
  said: string;
}

export const ALL_FILLERS = "All fillers";
export const ALL_FILLERS_RATE: Measure = { name: ALL_FILLERS, unit: "a minute", said: `${ALL_FILLERS} a minute` };
/** "All fillers a minute": the every-filler rate wherever one line names it. */
export const ALL_FILLERS_PER_MIN = ALL_FILLERS_RATE.said;

/** Pace is the Pace trait's own number, so it wears the trait's name and unit. */
export const PACE_RATE: Measure = { name: "Pace", unit: "words a minute", said: "Words a minute" };
export const WORDS_A_MINUTE = PACE_RATE.said;

/**
 * Pauses between sentences counted over one recording (#495). It counted
 * every pause of 0.8s or more, the ones inside a sentence too, so the
 * Log's number rose with the fault Demos names on the results; now it
 * counts the pauses the Pausing trait counts (kind "pre"), over the take.
 */
export const PAUSES_IN_RECORDING: Measure = {
  name: "Pauses between sentences",
  unit: "in a recording",
  said: "Pauses between sentences in a recording",
};
export const PAUSES_PER_RECORDING = PAUSES_IN_RECORDING.said;

/** The pauses between sentences in one recording's stored pauses. */
export function pausesBetween(pauses: readonly { kind: string }[] | null | undefined): number {
  return (pauses ?? []).filter((p) => p.kind === "pre").length;
}
