import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  POINTER_STOPPED_MS,
  SPRING,
  animateSpring,
  project,
  releaseVelocity,
  rubberband,
  springDuration,
  springEasing,
  springMs,
  springOffset,
  springProgress,
  springStateAt,
  springVelocity,
  velocityAt,
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

  /*
   * A finger that stops and holds still sends no moves, so the last ones
   * still say how fast it WAS going (handoff review: a pull held 400ms
   * then let go closed the paywall, and content held still glided on).
   * Asked with the moment it lifted, a finger that sat still longer than
   * a lift ever trails the last move has stopped.
   */
  it("reads a finger that held still before it lifted as stopped", () => {
    const swipe = Array.from({ length: 8 }, (_, i) => ({ t: 16 + i * 12, y: i * 9 }));
    expect(releaseVelocity(swipe)).toBeGreaterThan(700);
    // Lifted on the last move's heels: still the swipe's speed.
    expect(releaseVelocity(swipe, 100 + 16)).toBeCloseTo(releaseVelocity(swipe), 6);
    // Held 400ms, 150ms, or just past a lift's longest trail, then lifted.
    expect(releaseVelocity(swipe, 100 + 400)).toBe(0);
    expect(releaseVelocity(swipe, 100 + 150)).toBe(0);
    expect(releaseVelocity(swipe, 100 + POINTER_STOPPED_MS + 1)).toBe(0);
    expect(releaseVelocity(swipe, 100 + POINTER_STOPPED_MS - 1)).toBeGreaterThan(700);
  });
});

describe("a spring read mid-flight (the grab-it-halfway problem)", () => {
  const cases = [
    { name: "critically damped", spring: SPRING.base },
    { name: "thrown", spring: SPRING.thrown },
  ];

  it("starts at exactly the speed it was given", () => {
    for (const { spring } of cases) {
      for (const v of [0, 2, -3, 8]) expect(springVelocity(spring, 0, v)).toBeCloseTo(-v, 10);
    }
  });

  it("is the true slope of the curve all the way to rest", () => {
    const h = 1e-6;
    for (const { spring } of cases) {
      for (const v of [0, 1.5, -2]) {
        for (const t of [0.02, 0.1, 0.2, 0.35, 0.6]) {
          const slope = (springOffset(spring, t + h, v) - springOffset(spring, t - h, v)) / (2 * h);
          expect(springVelocity(spring, t, v)).toBeCloseTo(slope, 4);
        }
      }
    }
  });

  it("hands a retarget the position and the speed, so neither jumps", () => {
    const run = { from: 0, to: 400, velocity: 0, spring: SPRING.sheet };
    const at = springStateAt(run, 0.09);
    expect(at.value).toBeGreaterThan(0);
    expect(at.velocity).toBeGreaterThan(0);
    // Turned round toward 0 from there, carrying the speed it had.
    const back = { from: at.value, to: 0, velocity: at.velocity, spring: SPRING.sheet };
    const h = 1e-4;
    const start = springStateAt(back, 0);
    const slope = (springStateAt(back, h).value - start.value) / h;
    expect(start.value).toBeCloseTo(at.value, 6);
    expect(slope).toBeCloseTo(at.velocity, -1);
    // Still moving away for a moment before it turns: momentum, not a stall.
    expect(springStateAt(back, 0.02).value).toBeGreaterThan(at.value);
  });

  it("finds the run's speed from where the element is, a frame late or cancelled", () => {
    const run = { from: 0, to: 600, velocity: 0, spring: SPRING.base };
    const truth = springStateAt(run, 0.1);
    // The clock says 116ms (the animation started a frame after it was made).
    expect(velocityAt(run, 0.116, truth.value)).toBeCloseTo(truth.velocity, -1);
    // Moved by something else since: off the path, so no inherited speed.
    expect(velocityAt(run, 0.116, truth.value + 80)).toBe(0);
  });
});

describe("animateSpring carries an interrupted run's speed in", () => {
  function fakeEl() {
    const animations: { easing: string; cancel: ReturnType<typeof vi.fn> }[] = [];
    const el = {
      style: {} as Record<string, string>,
      animate: vi.fn((_frames: unknown, opts: { easing: string }) => {
        const a = { easing: opts.easing, cancel: vi.fn(), finished: new Promise<void>(() => {}) };
        animations.push(a);
        return a;
      }),
    };
    return { el: el as unknown as HTMLElement, animations };
  }

  it("turns a rising sheet round with its momentum when nothing else is moving it", () => {
    const clock = vi.spyOn(performance, "now");
    const { el, animations } = fakeEl();
    clock.mockReturnValue(1000);
    void animateSpring(el, { from: 600, to: 0, spring: SPRING.sheet });
    // 100ms later it is asked to close from wherever it is.
    const run = { from: 600, to: 0, velocity: 0, spring: SPRING.sheet };
    const here = springStateAt(run, 0.1);
    clock.mockReturnValue(1100);
    void animateSpring(el, { from: here.value, to: 700, spring: SPRING.sheet });
    expect(animations[0].cancel).toHaveBeenCalled();
    const relative = here.velocity / (700 - here.value);
    expect(relative).toBeLessThan(0); // still moving up, away from the new target
    expect(animations[1].easing).toBe(springEasing(SPRING.sheet, relative));
    clock.mockRestore();
  });

  it("lets a finger's speed win, and starts from rest when the element was moved", () => {
    const clock = vi.spyOn(performance, "now");
    const { el, animations } = fakeEl();
    clock.mockReturnValue(0);
    void animateSpring(el, { from: 0, to: 300, spring: SPRING.base });
    clock.mockReturnValue(50);
    void animateSpring(el, { from: 120, to: 0, velocity: -900, spring: SPRING.base });
    expect(animations[1].easing).toBe(springEasing(SPRING.base, -900 / (0 - 120)));
    clock.mockReturnValue(5000);
    void animateSpring(el, { from: 40, to: 200, spring: SPRING.base });
    expect(animations[2].easing).toBe(springEasing(SPRING.base, 0));
    clock.mockRestore();
  });

  /*
   * A caller that tidies up after a run (Overlay's spring home clears the
   * panel's transform) must know whether it landed or was caught: caught
   * by a finger, the tidy-up wiped the transform the grab had just put
   * there, and the sheet flashed to its rest for a few frames (handoff
   * review).
   */
  it("says whether the run landed or was interrupted", async () => {
    function settling(outcome: "lands" | "cancelled") {
      const el = {
        style: {} as Record<string, string>,
        animate: vi.fn(() => ({
          cancel: vi.fn(),
          finished: outcome === "lands" ? Promise.resolve() : Promise.reject(new DOMException("", "AbortError")),
        })),
      };
      return el as unknown as HTMLElement;
    }
    await expect(animateSpring(settling("lands"), { from: 120, to: 0 })).resolves.toBe(true);
    await expect(animateSpring(settling("cancelled"), { from: 120, to: 0 })).resolves.toBe(false);
    // Nothing to move, or reduced motion: it lands at once.
    await expect(animateSpring(settling("cancelled"), { from: 0.2, to: 0 })).resolves.toBe(true);
    await expect(animateSpring(settling("cancelled"), { from: 120, to: 0, reduced: true })).resolves.toBe(true);
  });
});
