import { describe, expect, it } from "vitest";
import { inScreen, pointerTilt, springStep, TILT, TiltTracker, tiltFrom, wrapDeg, type Axis } from "./room-tilt";

describe("the tilt", () => {
  const held = { beta: 55, gamma: 0 };

  it("is measured from how the phone was held, 20 degrees to the edge", () => {
    expect(tiltFrom(held, held)).toEqual({ x: 0, y: 0 });
    expect(tiltFrom({ beta: 55, gamma: 10 }, held)).toEqual({ x: 0.5, y: 0 });
    expect(tiltFrom({ beta: 65, gamma: 0 }, held)).toEqual({ x: 0, y: 0.5 });
    expect(tiltFrom({ beta: 35, gamma: -20 }, held)).toEqual({ x: -1, y: -1 });
  });

  it("stops at the edge of its range", () => {
    expect(tiltFrom({ beta: 140, gamma: 80 }, held)).toEqual({ x: 1, y: 1 });
  });

  it("goes the short way round", () => {
    expect(wrapDeg(350)).toBe(-10);
    expect(wrapDeg(-190)).toBe(170);
    expect(tiltFrom({ beta: -175, gamma: 0 }, { beta: 175, gamma: 0 }).y).toBeCloseTo(0.5, 5);
  });

  it("turns with the screen", () => {
    const o = { beta: 10, gamma: 4 };
    expect(inScreen(o, 0)).toEqual(o);
    expect(inScreen(o, 180)).toEqual({ beta: -10, gamma: -4 });
    expect(inScreen(o, 90)).toEqual({ beta: -4, gamma: 10 });
    expect(inScreen(o, -90)).toEqual({ beta: 4, gamma: -10 });
  });
});

describe("the tracker", () => {
  it("takes the first reading as the centre", () => {
    const t = new TiltTracker();
    expect(t.update({ beta: 70, gamma: -5 }, 0)).toEqual({ x: 0, y: 0 });
    expect(t.update({ beta: 70, gamma: 5 }, 16).x).toBeCloseTo(0.5, 5);
  });

  it("keeps its centre while the hand moves", () => {
    const t = new TiltTracker();
    t.update({ beta: 50, gamma: 0 }, 0);
    let last = { x: 0, y: 0 };
    for (let ms = 16; ms < 4000; ms += 16) {
      /* Swaying, never still. */
      last = t.update({ beta: 50, gamma: 10 * Math.sin(ms / 200) }, ms);
    }
    expect(t.base).toEqual({ beta: 50, gamma: 0 });
    expect(Math.abs(last.x)).toBeGreaterThan(0);
  });

  it("re-centres slowly once the hand settles somewhere new", () => {
    const t = new TiltTracker();
    t.update({ beta: 50, gamma: 0 }, 0);
    /* Moved to a new grip, then held there. */
    expect(t.update({ beta: 70, gamma: 0 }, 100).y).toBe(1);
    let y = 1;
    const at = (ms: number) => (y = t.update({ beta: 70, gamma: 0 }, ms).y);
    at(500);
    expect(y).toBe(1);
    for (let ms = 516; ms <= 1300; ms += 16) at(ms);
    /* Not yet: it waits for the hand to be still a while. */
    expect(y).toBeGreaterThan(0.95);
    for (let ms = 1316; ms <= 4000; ms += 16) at(ms);
    expect(y).toBeLessThan(0.7);
    expect(y).toBeGreaterThan(0.1);
    for (let ms = 4016; ms <= 16_000; ms += 16) at(ms);
    expect(y).toBeLessThan(0.02);
  });

  it("starts again from the next reading when reset", () => {
    const t = new TiltTracker();
    t.update({ beta: 50, gamma: 0 }, 0);
    t.reset();
    expect(t.update({ beta: 10, gamma: 30 }, 50)).toEqual({ x: 0, y: 0 });
  });
});

describe("the smoothing", () => {
  const run = (dt: number, ms: number, target = 1) => {
    let s: Axis = { p: 0, v: 0 };
    let peak = 0;
    for (let t = 0; t < ms; t += dt * 1000) {
      s = springStep(s, target, dt);
      peak = Math.max(peak, s.p);
    }
    return { s, peak };
  };

  it("follows the hand closely: most of the way in a fifth of a second", () => {
    expect(run(1 / 60, 200).s.p).toBeGreaterThan(0.9);
  });

  it("never overshoots from rest, so a jolt never wobbles the room", () => {
    expect(run(1 / 60, 3000).peak).toBeLessThanOrEqual(1 + 1e-9);
    expect(run(1 / 60, 3000).s.p).toBeCloseTo(1, 6);
  });

  it("moves the same at any frame rate", () => {
    const a = run(1 / 30, 300).s.p;
    const b = run(1 / 120, 300).s.p;
    expect(Math.abs(a - b)).toBeLessThan(0.02);
  });

  it("smooths a jittery sensor into a steady value", () => {
    let s: Axis = { p: 0.5, v: 0 };
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 600; i++) {
      s = springStep(s, 0.5 + (i % 2 ? 0.08 : -0.08), 1 / 120);
      if (i > 300) {
        lo = Math.min(lo, s.p);
        hi = Math.max(hi, s.p);
      }
    }
    expect(hi - lo).toBeLessThan(0.05);
  });

  it("does nothing in no time", () => {
    expect(springStep({ p: 0.3, v: 1 }, 1, 0)).toEqual({ p: 0.3, v: 1 });
  });

  it("uses the response it is given", () => {
    expect(TILT.responseS).toBeGreaterThan(0.08);
    expect(TILT.responseS).toBeLessThan(0.25);
  });
});

describe("a mouse in place of the phone", () => {
  it("maps the screen to the range, centre still", () => {
    expect(pointerTilt(195, 422, 390, 844)).toEqual({ x: 0, y: 0 });
    expect(pointerTilt(390, 0, 390, 844)).toEqual({ x: 1, y: -1 });
    expect(pointerTilt(-20, 900, 390, 844)).toEqual({ x: -1, y: 1 });
    expect(pointerTilt(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});
