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
