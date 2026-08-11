/**
 * On-device pose sampling (decisions 11 Aug, §1).
 *
 * MediaPipe Pose as a WASM task, ~30fps, entirely in the browser. The
 * video element is never recorded to a blob, never uploaded and never
 * stored — this module turns a live <video> into `PoseFrame`s, and
 * `presence.ts` turns those into five numbers. The five numbers are the
 * only thing that persists.
 *
 * Load is lazy and failure is honest: if the assets aren't staged (see
 * scripts/fetch-pose-assets.mjs) the mode toggle reports Voice + Video
 * as unavailable rather than recording video it can't measure.
 */

import type { PoseFrame, Point } from "./presence";

/** MediaPipe Pose landmark indices we actually read. */
const LM = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
} as const;

const ASSET_BASE = "/pose";
const TARGET_FPS = 30;

export type PoseAvailability = "ready" | "loading" | "unavailable";

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface LandmarkerResult {
  landmarks: Landmark[][];
}

interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): LandmarkerResult;
  close(): void;
}

let cached: Promise<Landmarker | null> | null = null;

/**
 * Load the task once per page. Repeated calls share the promise, and a
 * failed load is remembered as a failure rather than retried on every
 * rep — a browser without WASM support won't grow it mid-session.
 */
export function loadPose(): Promise<Landmarker | null> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(ASSET_BASE);
      const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: `${ASSET_BASE}/pose_landmarker_lite.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return landmarker as unknown as Landmarker;
    } catch {
      return null;
    }
  })();
  return cached;
}

/** Is on-device pose actually available here? Asked before offering it. */
export async function poseAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return (await loadPose()) !== null;
}

function point(l: Landmark | undefined): Point | null {
  if (!l) return null;
  return { x: l.x, y: l.y, visibility: l.visibility ?? 1 };
}

export interface PoseSampler {
  /** Frames captured so far. The array is live — read it, don't keep it. */
  frames: PoseFrame[];
  stop(): PoseFrame[];
}

/**
 * Sample a live video element until stopped. `onFrame` fires with the
 * running frame list so the live ring can read a trailing window without
 * a second detection pass.
 */
export function samplePose(
  video: HTMLVideoElement,
  landmarker: Landmarker,
  onFrame?: (frames: PoseFrame[]) => void
): PoseSampler {
  const frames: PoseFrame[] = [];
  const startedAt = performance.now();
  let raf = 0;
  let lastAt = -Infinity;
  let stopped = false;
  // detectForVideo rejects a timestamp it has already seen, and rAF can
  // fire twice inside one millisecond on a high-refresh display.
  let lastStamp = -1;

  const tick = () => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);

    const now = performance.now();
    if (now - lastAt < 1000 / TARGET_FPS) return;
    if (video.readyState < 2) return;
    lastAt = now;

    const stamp = Math.max(lastStamp + 1, Math.round(now - startedAt));
    lastStamp = stamp;

    let result: LandmarkerResult;
    try {
      result = landmarker.detectForVideo(video, stamp);
    } catch {
      return;
    }

    const lm = result.landmarks?.[0];
    const t = stamp / 1000;
    // A frame with nobody in it is still a frame — recorded as empty so
    // "you walked out of shot" is measurable rather than invisible.
    frames.push(
      lm
        ? {
            t,
            nose: point(lm[LM.nose]),
            leftEye: point(lm[LM.leftEye]),
            rightEye: point(lm[LM.rightEye]),
            leftEar: point(lm[LM.leftEar]),
            rightEar: point(lm[LM.rightEar]),
            leftShoulder: point(lm[LM.leftShoulder]),
            rightShoulder: point(lm[LM.rightShoulder]),
            leftWrist: point(lm[LM.leftWrist]),
            rightWrist: point(lm[LM.rightWrist]),
          }
        : emptyFrame(t)
    );
    onFrame?.(frames);
  };

  raf = requestAnimationFrame(tick);

  return {
    frames,
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      return frames;
    },
  };
}

function emptyFrame(t: number): PoseFrame {
  return {
    t,
    nose: null,
    leftEye: null,
    rightEye: null,
    leftEar: null,
    rightEar: null,
    leftShoulder: null,
    rightShoulder: null,
    leftWrist: null,
    rightWrist: null,
  };
}
