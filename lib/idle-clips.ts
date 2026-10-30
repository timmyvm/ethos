/**
 * Which Demos poses have an idle clip (DECISIONS #316), and where it
 * lives. Each is `public/idle/<pose>.webm` (VP9, first choice) and
 * `.mp4` (H.264, for Safari), colour stacked over alpha, cut by
 * scripts/make-idle-clips.py. lib/idle-clips.test.ts holds both files
 * to existing and to a size a phone can afford.
 */

export const CLIP_POSES = [
  "wave",
  "speaking",
  "celebrate",
  "clipboard",
  "clock",
  "hello",
  "listening",
] as const;

export type ClipPose = (typeof CLIP_POSES)[number];

const SET: ReadonlySet<string> = new Set(CLIP_POSES);

export function hasClip(pose: string): pose is ClipPose {
  return SET.has(pose);
}

export const clipSrc = (pose: ClipPose, ext: "webm" | "mp4") =>
  `/idle/${pose}.${ext}`;

/** A clip is at most this, in either format. The celebration, whose
    bounce moves every pixel every frame, is the one that sets it. */
export const CLIP_MAX_BYTES = 280_000;

/**
 * How long Demos rests after a play (E59). The first three plays on a
 * mount rest a few seconds each, so he is plainly alive when a screen
 * opens; after the third he settles, and rests a quarter to half a
 * minute, so a screen left open is not a screensaver. Each rest is drawn
 * afresh, so two screens never beat in time.
 *
 *   played  plays that have finished on this mount (1 after the first)
 *   random  a draw in [0, 1)
 */
export const REST_SHORT_MS: readonly [number, number] = [2600, 5200];
export const REST_LONG_MS: readonly [number, number] = [15000, 30000];
export const SHORT_PLAYS = 3;

export function restMs(played: number, random: number = Math.random()): number {
  const [lo, hi] = played < SHORT_PLAYS ? REST_SHORT_MS : REST_LONG_MS;
  const r = Math.min(Math.max(random, 0), 1);
  return lo + r * (hi - lo);
}
