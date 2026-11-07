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

/**
 * Hear it back's track, in px (#425): a landed band is never drawn
 * narrower than LANDED_MIN_PX, grown rightward from its pause's second,
 * and the playhead is PLAYHEAD_PX wide from its own second. The
 * component's classes (`min-w-[4px]`, `w-[2px]`) are held to these in
 * lib/pause-mark.test.ts.
 */
export const LANDED_MIN_PX = 4;
export const PLAYHEAD_PX = 2;

/**
 * Whether Hear it back's playhead, at second `t`, stands in a held pause
 * that landed as the track draws it, so it can be read over the sage
 * band it crosses (#425). Decided by the drawn geometry, not the pause's
 * seconds alone (the review of #425): on a long take a short landing is
 * drawn wider than its seconds, and a playhead crossing those extra
 * pixels in the light ink was 2.25:1 on the sage in dark. So a band is
 * [p.t, p.t + max(p.len, LANDED_MIN_PX px)) and what stands on it is the
 * playhead's centre, PLAYHEAD_PX / 2 right of `t`; a centre past the
 * band's end is off it. `secondsPerPx` is the track's scale, the take's
 * seconds over the track's drawn width; 0, before the track is measured,
 * reads the pause's own seconds and the playhead as a point. Beats are
 * never drawn on the track and never count.
 */
export function landedAt(
  pauses: readonly (MarkedPause & { t: number; len: number })[],
  t: number,
  secondsPerPx = 0
): boolean {
  const px = Number.isFinite(secondsPerPx) && secondsPerPx > 0 ? secondsPerPx : 0;
  const centre = t + (PLAYHEAD_PX / 2) * px;
  const floor = LANDED_MIN_PX * px;
  return pauses.some((p) => p.kind !== "beat" && landedPause(p) && centre >= p.t && centre < p.t + Math.max(p.len, floor));
}
