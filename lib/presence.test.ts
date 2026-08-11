import { describe, expect, it } from "vitest";
import {
  fromRow,
  MIN_USABLE_FRAMES,
  ringState,
  scorePresence,
  toRow,
  type PoseFrame,
} from "./presence";

/**
 * Synthetic landmark frames. A speaker facing the camera at a fixed
 * distance: shoulders 0.30 of the frame apart, nose above the shoulder
 * line, eyes above the nose. Looking down foreshortens the nose-to-eye
 * gap, which is exactly the signal `eyeLineUp` reads.
 */
function frames(opts: {
  seconds?: number;
  fps?: number;
  lookingDown?: boolean | ((i: number, t: number) => boolean);
  /** Second at which the torso starts to sink and stays sunk. */
  slouchFrom?: number;
  handsGone?: [number, number];
  /** Frames between gesture bursts. 0 = hands never move. */
  gestureEvery?: number;
  noShoulders?: boolean;
}): PoseFrame[] {
  const fps = opts.fps ?? 10;
  const seconds = opts.seconds ?? 90;
  const total = Math.round(seconds * fps);
  const out: PoseFrame[] = [];

  for (let i = 0; i < total; i++) {
    const t = i / fps;
    const sink = opts.slouchFrom !== undefined && t >= opts.slouchFrom ? 0.05 : 0;
    const shoulderY = 0.7 + sink;
    const noseY = 0.42 + sink;

    const down =
      typeof opts.lookingDown === "function"
        ? opts.lookingDown(i, t)
        : !!opts.lookingDown;
    // Facing: eyes sit 0.04 above the nose (pitch 0.133 of a shoulder
    // width). Down: 0.008 (pitch 0.027) — under the floor.
    const eyeY = noseY - (down ? 0.008 : 0.04);

    const gone =
      opts.handsGone && t >= opts.handsGone[0] && t < opts.handsGone[1];
    const every = opts.gestureEvery ?? 0;
    const inBurst = every > 0 && i % every < 4;
    const wristDx = inBurst ? 0.02 * (i % every) : 0;

    const p = (x: number, y: number) => ({ x, y, visibility: 1 });
    out.push({
      t,
      nose: p(0.5, noseY),
      leftEye: p(0.46, eyeY),
      rightEye: p(0.54, eyeY),
      leftEar: p(0.43, noseY - 0.02),
      rightEar: p(0.57, noseY - 0.02),
      leftShoulder: opts.noShoulders ? null : p(0.35, shoulderY),
      rightShoulder: opts.noShoulders ? null : p(0.65, shoulderY),
      leftWrist: gone ? null : p(0.4 - wristDx, 0.95 + sink),
      rightWrist: gone ? null : p(0.6 + wristDx, 0.95 + sink),
    });
  }
  return out;
}

describe("the substance floor for video", () => {
  it("refuses to score a rep with almost no body in it", () => {
    const r = scorePresence(frames({ seconds: 2 }));
    expect(r.scorable).toBe(false);
    expect(r.metrics.presenceScore).toBe(0);
  });

  it("treats frames with no shoulders as absent, not as bad posture", () => {
    const r = scorePresence(frames({ seconds: 90, noShoulders: true }));
    expect(r.usableFrames).toBe(0);
    expect(r.scorable).toBe(false);
  });

  it("scores once there are enough usable frames", () => {
    const r = scorePresence(
      frames({ seconds: MIN_USABLE_FRAMES / 10 + 1, gestureEvery: 40 })
    );
    expect(r.scorable).toBe(true);
  });
});

describe("a composed speaker", () => {
  const result = scorePresence(frames({ seconds: 90, gestureEvery: 40 }));

  it("reads the eye line as up throughout", () => {
    expect(result.metrics.eyeLinePct).toBe(100);
  });

  it("counts gestures in bursts, not in frames of movement", () => {
    // One burst every 4 seconds over 90s ≈ 15 a minute.
    expect(result.metrics.gestureRate).toBeGreaterThan(12);
    expect(result.metrics.gestureRate).toBeLessThan(18);
  });

  it("scores well without hitting a fake ceiling", () => {
    expect(result.metrics.presenceScore).toBeGreaterThan(800);
    expect(result.metrics.presenceScore).toBeLessThanOrEqual(1000);
  });

  it("has nothing to timestamp", () => {
    expect(result.moments).toEqual([]);
  });

  it("weights four dimensions at 250 each, like the Index", () => {
    expect(result.dimensions).toHaveLength(4);
    const byHand = result.dimensions.reduce(
      (sum, d) => sum + Math.round(d.score * 2.5),
      0
    );
    expect(result.metrics.presenceScore).toBe(byHand);
  });
});

describe("looking down", () => {
  /**
   * The one that matters: scoring the eye line against the rep's own
   * median would hand someone who stared at their desk for ninety
   * seconds a perfect 100%. The floor is absolute for that reason.
   */
  it("scores a whole rep spent looking down as 0%, not 100%", () => {
    const r = scorePresence(frames({ seconds: 90, lookingDown: true, gestureEvery: 40 }));
    expect(r.metrics.eyeLinePct).toBe(0);
    expect(r.dimensions.find((d) => d.key === "eyes")?.score).toBe(0);
  });

  it("timestamps a look-away that lasted long enough to matter", () => {
    const r = scorePresence(
      frames({
        seconds: 90,
        gestureEvery: 40,
        lookingDown: (_i, t) => t >= 47 && t < 53,
      })
    );
    const m = r.moments.find((x) => x.kind === "eyes-down");
    expect(m).toBeDefined();
    expect(m!.t).toBeCloseTo(47, 0);
    expect(m!.seconds).toBe(6);
    expect(m!.note).toContain("0:47");
  });

  it("ignores a glance too short to be worth a timestamp", () => {
    const r = scorePresence(
      frames({
        seconds: 90,
        gestureEvery: 40,
        lookingDown: (_i, t) => t >= 30 && t < 31,
      })
    );
    expect(r.moments.some((x) => x.kind === "eyes-down")).toBe(false);
  });
});

describe("posture and hands", () => {
  it("timestamps a collapse against where you started, not an ideal", () => {
    const r = scorePresence(
      frames({ seconds: 90, gestureEvery: 40, slouchFrom: 40 })
    );
    const m = r.moments.find((x) => x.kind === "slouch");
    expect(m).toBeDefined();
    expect(m!.t).toBeCloseTo(40, 0);
  });

  it("notices hands that left the frame and stayed gone", () => {
    const r = scorePresence(
      frames({ seconds: 90, gestureEvery: 40, handsGone: [20, 60] })
    );
    const m = r.moments.find((x) => x.kind === "hands-gone");
    expect(m).toBeDefined();
    expect(m!.seconds).toBeGreaterThanOrEqual(20);
  });

  it("calls out hands parked for a long stretch", () => {
    const r = scorePresence(frames({ seconds: 90, gestureEvery: 0 }));
    expect(r.moments.some((x) => x.kind === "stillness")).toBe(true);
    expect(r.dimensions.find((d) => d.key === "gesture")?.score).toBeLessThan(60);
  });

  it("does not call a gesturing speaker still", () => {
    const r = scorePresence(frames({ seconds: 90, gestureEvery: 40 }));
    expect(r.moments.some((x) => x.kind === "stillness")).toBe(false);
  });
});

describe("the live ring (free tier)", () => {
  it("stays quiet on a composed speaker", () => {
    expect(ringState(frames({ seconds: 10, gestureEvery: 40 }))).toBe("ok");
  });

  it("goes to eyes when the trailing window is spent looking down", () => {
    const f = frames({
      seconds: 10,
      gestureEvery: 40,
      lookingDown: (_i, t) => t >= 8,
    });
    expect(ringState(f)).toBe("eyes");
  });

  it("goes to hands when both wrists have left the frame", () => {
    const f = frames({ seconds: 10, gestureEvery: 40, handsGone: [8, 999] });
    expect(ringState(f)).toBe("hands");
  });

  it("does not fire on a single dropped frame", () => {
    const f = frames({
      seconds: 10,
      gestureEvery: 40,
      lookingDown: (i) => i === 98,
    });
    expect(ringState(f)).toBe("ok");
  });
});

describe("what persists", () => {
  it("round-trips the five numbers and nothing else", () => {
    const r = scorePresence(frames({ seconds: 90, gestureEvery: 40 }));
    const row = toRow(r.metrics);
    expect(Object.keys(row).sort()).toEqual([
      "eye_line_pct",
      "gesture_rate",
      "head_stability",
      "posture_drift",
      "presence_score",
    ]);
    expect(fromRow(row)).toEqual(r.metrics);
  });

  it("reads a Voice-mode rep back as null, not as zeroes", () => {
    expect(fromRow(null)).toBeNull();
  });
});
