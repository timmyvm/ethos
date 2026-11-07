import type { Pause } from "./metrics";
import type { PauseVerdict } from "./pause-quality";

/**
 * How a take's held pauses are marked wherever the take is drawn: the
 * pause map on the numbers step (components/PauseBar.tsx) and Hear it
 * back's track on the words step (components/AudioScrubber.tsx). One
 * rule, so a pause is the same thing on both steps.
 *
 * Sage is earned, so the mark follows the verdict the take stored and
 * showed (lib/pause-quality.ts), never the kind alone: a pause before a
 * sentence with a sound in it is still a pause before a sentence, but
 * the Pause row and the pause list call it filled, and it is not drawn
 * as earned. Nothing is judged here (#422, #424); a row recorded before
 * verdicts existed falls back to the kind, as both drawings always did.
 */
export type PauseMark = "landed" | "searching";

/** What a mark is drawn from: a stored or live pause, judged or not. */
export type MarkedPause = { kind?: Pause["kind"]; verdict?: PauseVerdict };

/** The legends' words, one per mark, so both steps say the same thing. */
export const PAUSE_MARK_WORDS: Record<PauseMark, string> = {
  landed: "landed a point",
  searching: "searching",
};

/**
 * A held pause that landed a point: a landing or the opening when it
 * was judged, a pause before a sentence when it was not.
 */
export function landedPause(p: MarkedPause): boolean {
  return p.verdict ? p.verdict === "landing" || p.verdict === "opening" : p.kind === "pre";
}

/** The mark a held pause wears on the map and on the track. */
export function pauseMark(p: MarkedPause): PauseMark {
  return landedPause(p) ? "landed" : "searching";
}

/**
 * The held pauses counted by their mark, for each legend (a key only
 * for a mark the take has) and the map's name. Beats are rhythm, not
 * held pauses, and are counted in neither.
 */
export function heldPauseMarks(pauses: readonly MarkedPause[]): {
  held: number;
  landed: number;
  searching: number;
} {
  const held = pauses.filter((p) => p.kind !== "beat");
  const landed = held.filter(landedPause).length;
  return { held: held.length, landed, searching: held.length - landed };
}
