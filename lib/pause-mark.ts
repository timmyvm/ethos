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

/**
 * The legends' words, one per mark, so both steps say the same thing
 * (#490, the two-second test: "landed a point" and "searching" were the
 * app's own words). A sage mark is always a pause before a sentence, so
 * it is "between sentences"; the quiet mark is "other pause" unless every
 * one on the take is the same kind (`otherKey`), and then it says which:
 * "mid-sentence". The swatch is a pause's band, so the key does not say
 * "pause" again: "pause between sentences" and "pause mid-sentence" took
 * Hear it back's key from one line to three at 320 (the review of #490).
 */
export const PAUSE_MARK_WORDS: Record<PauseMark, string> = {
  landed: "between sentences",
  searching: "other pause",
};

/**
 * Why a held pause did or did not count, in the house's plain words
 * (#490): between sentences (it counted), mid-sentence, after a sentence
 * too short to be a point, past 3.5 seconds, next to an um, or with a
 * sound the phone heard in it (a stored verdict from before #476 says so
 * in its note). Read off the stored verdict and kind, never judged again.
 */
export type PauseWhy = "between" | "mid" | "short" | "long" | "um" | "sound";

export function pauseWhy(p: MarkedPause & { note?: string }): PauseWhy {
  if (landedPause(p)) return "between";
  if (p.verdict === "filled") return /mic heard/i.test(p.note ?? "") ? "sound" : "um";
  if (p.verdict === "dead") return "long";
  if (p.kind === "mid") return "mid";
  return "short";
}

/** Each reason as the words after "a pause" or a count of pauses. */
export const PAUSE_WHY_WORDS: Record<PauseWhy, string> = {
  between: "between sentences",
  mid: "mid-sentence",
  short: "after only a few words",
  long: "over 3.5 seconds",
  um: "next to an um",
  sound: "with a sound in it",
};

/**
 * The reason every held pause that did not count shares, or null when
 * they differ (or there are none). Beats are not held pauses.
 */
export function sharedMiss(pauses: readonly (MarkedPause & { note?: string })[]): PauseWhy | null {
  const whys = new Set(pauses.filter((p) => p.kind !== "beat" && !landedPause(p)).map(pauseWhy));
  return whys.size === 1 ? [...whys][0] : null;
}

/**
 * Each reason as a key's or the glance's few words, where a line has no
 * room for the whole one: Hear it back's pause keys hold one line in a
 * 320 card ("after only a few words", "over 3.5 seconds" and "with a
 * sound in it" each took it to a third, measured by
 * scripts/look-plain-words.mjs), and the glance holds seven words. The
 * Pause row says the whole reason under them.
 */
export const PAUSE_KEY_WORDS: Record<PauseWhy, string> = {
  between: "between sentences",
  mid: "mid-sentence",
  short: "misplaced",
  long: "too long",
  um: "next to an um",
  sound: "with a sound",
};

/** The quiet mark's key: "mid-sentence" where every one is, else "other pause". */
export function otherKey(pauses: readonly (MarkedPause & { note?: string })[]): string {
  const why = sharedMiss(pauses);
  return why ? PAUSE_KEY_WORDS[why] : PAUSE_MARK_WORDS.searching;
}

/**
 * What the filled pauses had in them, after a count of them: "had an um
 * next to it", "had a sound in them". An um is what fills a pause since
 * #476; a stored verdict the phone's trace made says "The mic heard it"
 * in its note, and is called a sound.
 */
export function filledWords(pauses: readonly (MarkedPause & { note?: string })[], n: number): string {
  const whys = new Set(pauses.filter((p) => p.verdict === "filled").map(pauseWhy));
  const it = n === 1 ? "it" : "them";
  if (whys.has("sound") && whys.has("um")) return `had an um or a sound in ${it}`;
  if (whys.has("sound")) return `had a sound in ${it}`;
  return `had an um next to ${it}`;
}

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
