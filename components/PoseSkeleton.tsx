"use client";

import { useEffect, useRef } from "react";
import type { PoseFrame, RingState } from "@/lib/presence";

/**
 * Your limbs, drawn over the self-view while you speak.
 *
 * The pose model was already running — MediaPipe's landmarks fed the
 * Presence score and were then thrown away. Drawing them costs one
 * canvas and turns an invisible measurement into something you can watch
 * working, which is the whole argument for the ring being free (§2:
 * feeling seen is what makes the readout worth paying for).
 *
 * Deliberately a SKELETON and not a mesh or a silhouette: it reads as
 * measurement rather than a filter, and it makes the thing being scored
 * legible — the line between your shoulders is the posture number, the
 * one from your nose is the eye line, the arms are the gesture rate.
 *
 * Cream when the ring is clean, stone when it isn't. Amber is spent on
 * the hold counter instead (DECISIONS #127) — the skeleton dimming is
 * one of the three channels that make a nudge unmissable without it.
 */

/** MediaPipe Pose connections, limited to what we actually score. */
const BONES: [keyof PoseFrame, keyof PoseFrame][] = [
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftWrist"],
  ["rightShoulder", "rightWrist"],
  ["nose", "leftShoulder"],
  ["nose", "rightShoulder"],
  ["leftEye", "rightEye"],
  ["leftEar", "leftEye"],
  ["rightEar", "rightEye"],
];

const JOINTS: (keyof PoseFrame)[] = [
  "nose",
  "leftEye",
  "rightEye",
  "leftEar",
  "rightEar",
  "leftShoulder",
  "rightShoulder",
  "leftWrist",
  "rightWrist",
];

const OK_STROKE = "rgba(250, 247, 242, 0.92)";
const OK_JOINT = "#FAF7F2";
const NUDGE_STROKE = "rgba(168, 162, 158, 0.95)";
const NUDGE_JOINT = "#A8A29E";

/** MediaPipe's own confidence, below which a limb is a guess. */
const MIN_VISIBILITY = 0.5;

export function PoseSkeleton({
  frames,
  ring,
  mirrored = true,
  className = "",
}: {
  /** The sampler's live array. Mutated in place; only the last one draws. */
  frames: PoseFrame[];
  ring: RingState;
  mirrored?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  // Read through refs so the draw loop never restarts mid-rep — it runs
  // for the length of the recording and re-subscribing would drop frames.
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const ringRef = useRef(ring);
  ringRef.current = ring;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /*
     * Match the backing store to the element's real box. Landmarks are
     * fractions of the video FRAME and the video element shows the whole
     * frame, so a canvas of the same box maps one to one — but only if
     * it isn't being stretched from a hardcoded size, which turns joints
     * into ellipses on any camera that isn't 4:3.
     */
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const f = framesRef.current[framesRef.current.length - 1];
      if (!f) return;

      const nudging = ringRef.current !== "ok";
      ctx.strokeStyle = nudging ? NUDGE_STROKE : OK_STROKE;
      ctx.fillStyle = nudging ? NUDGE_JOINT : OK_JOINT;
      ctx.lineWidth = Math.max(2, width / 110);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // The video is mirrored so it behaves like a mirror. The skeleton
      // has to match, or your right hand lights up on your left.
      const px = (x: number) => (mirrored ? 1 - x : x) * width;
      const py = (y: number) => y * height;
      const seen = (p: { visibility?: number } | null): boolean =>
        !!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY);

      for (const [a, b] of BONES) {
        const pa = f[a] as { x: number; y: number; visibility?: number } | null;
        const pb = f[b] as { x: number; y: number; visibility?: number } | null;
        if (!seen(pa) || !seen(pb)) continue;
        ctx.beginPath();
        ctx.moveTo(px(pa!.x), py(pa!.y));
        ctx.lineTo(px(pb!.x), py(pb!.y));
        ctx.stroke();
      }

      for (const key of JOINTS) {
        const p = f[key] as { x: number; y: number; visibility?: number } | null;
        if (!seen(p)) continue;
        ctx.beginPath();
        ctx.arc(px(p!.x), py(p!.y), Math.max(2.5, width / 90), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf.current);
      observer.disconnect();
    };
  }, [mirrored]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
