import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SPRING,
  project,
  releaseVelocity,
  rubberband,
  springDuration,
  springEasing,
  springMs,
  springProgress,
} from "./spring";

const css = readFileSync("app/globals.css", "utf8");
function token(name: string): string | null {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe("springs", () => {
  it("mirrors every house spring into CSS", () => {
    for (const [name, spring] of Object.entries(SPRING)) {
      expect(token(`spring-${name}`)).toBe(springEasing(spring));
      expect(token(`spring-${name}-duration`)).toBe(`${springMs(spring)}ms`);
    }
  });

  it("starts at 0 and lands exactly on 1", () => {
    for (const spring of Object.values(SPRING)) {
      const stops = springEasing(spring).slice(7, -1).split(", ").map(Number);
      expect(stops[0]).toBe(0);
      expect(stops[stops.length - 1]).toBe(1);
    }
  });

  it("never overshoots when critically damped and started from rest", () => {
    for (const spring of [SPRING.base, SPRING.snappy, SPRING.sheet]) {
      const end = springDuration(spring);
      for (let t = 0; t <= end; t += 1 / 240) {
        expect(springProgress(spring, t)).toBeLessThanOrEqual(1.0005);
      }
    }
  });

  it("overshoots a little, and only a little, when thrown", () => {
    let peak = 0;
    for (let t = 0; t < 1; t += 1 / 240) {
      peak = Math.max(peak, springProgress(SPRING.thrown, t));
    }
    expect(peak).toBeGreaterThan(1.005);
    expect(peak).toBeLessThan(1.06);
  });

  it("gets most of the way in about the response time", () => {
    // Response is not duration, but it should mean what it says.
    expect(springProgress(SPRING.base, SPRING.base.response)).toBeGreaterThan(0.9);
  });

  it("arrives sooner when it starts moving toward the target", () => {
    expect(springProgress(SPRING.sheet, 0.05, 4)).toBeGreaterThan(
      springProgress(SPRING.sheet, 0.05, 0)
    );
  });
});

describe("gesture maths", () => {
  it("projects a flick forward, further when faster", () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeGreaterThan(project(500));
    expect(project(-800)).toBeLessThan(0);
    // Apple's own numbers: 1000px/s at 0.998 rests about 499px on.
    expect(project(1000)).toBeCloseTo(499, 0);
  });

  it("resists harder the further past the edge", () => {
    const a = rubberband(40, 600);
    const b = rubberband(400, 600);
    expect(a).toBeLessThan(40);
    expect(b / 400).toBeLessThan(a / 40);
    expect(rubberband(10_000, 600)).toBeLessThan(600);
    expect(rubberband(1, 600)).toBeCloseTo(0.55, 2);
    expect(rubberband(-40, 600)).toBe(-a);
  });

  it("reads velocity from the end of the drag, not its average", () => {
    const slowThenFlick = [
      { t: 0, y: 0 },
      { t: 400, y: 20 },
      { t: 450, y: 30 },
      { t: 480, y: 90 },
    ];
    expect(releaseVelocity(slowThenFlick)).toBeGreaterThan(500);
    const stoppedDead = [
      { t: 0, y: 0 },
      { t: 50, y: 100 },
      { t: 300, y: 100 },
    ];
    expect(releaseVelocity(stoppedDead)).toBe(0);
  });
});
