import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { drawExpected, expectDraw, isDrawn, markDrawn, onDrawn, resetDrawn } from "./first-draw";
import { SPLASH_FLOOR_MS, SPLASH_WAIT_CAP_MS } from "./splash-timing";

const root = path.resolve(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");

/*
 * The first screen's numbers are drawn (#508): the splash, the service
 * worker's install and Today's warming of You's reads wait for it.
 */
describe("the first draw", () => {
  beforeEach(resetDrawn);

  it("runs what waited, once, when the screen says it is drawn", () => {
    const a = vi.fn();
    const b = vi.fn();
    onDrawn(a);
    const cancel = onDrawn(b);
    cancel();
    expect(isDrawn()).toBe(false);
    markDrawn();
    markDrawn();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("runs at once for what asks after", () => {
    markDrawn();
    const a = vi.fn();
    onDrawn(a);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("knows whether the screen on show will say so", () => {
    expect(drawExpected()).toBe(false);
    expectDraw();
    expect(drawExpected()).toBe(true);
  });

  it("one waiter's failure stops nobody else", () => {
    const after = vi.fn();
    onDrawn(() => {
      throw new Error("x");
    });
    onDrawn(after);
    markDrawn();
    expect(after).toHaveBeenCalled();
  });
});

describe("the splash lands on a drawn Today", () => {
  it("waits a beat, never longer than its cap, and the cap sits under the CSS fallback", () => {
    expect(SPLASH_FLOOR_MS).toBeLessThan(900);
    expect(SPLASH_FLOOR_MS).toBeGreaterThanOrEqual(500);
    const css = src("app/globals.css");
    const fallback = css.match(/:root\[data-splash="on"\] \.splash \{\s*animation: splash-fallback \d+ms var\(--ease-out\) ([\d.]+)s forwards;/);
    expect(fallback).not.toBeNull();
    expect(SPLASH_WAIT_CAP_MS).toBeLessThan(Number(fallback![1]) * 1000);
  });

  it("Today says when it is drawn: when its read lands or fails, and when it hands a first run to the room", () => {
    const today = src("app/page.tsx");
    expect(today).toMatch(/useLayoutEffect\(\(\) => \{\s*\/\/[^\n]*\n\s*expectDraw\(\);/);
    expect(today).toMatch(/if \(reps !== null \|\| failed\) markDrawn\(\);/);
    expect(today).toMatch(/router\.replace\("\/welcome"\);[\s\S]{0,120}markDrawn\(\);/);
    const lift = src("components/SplashLift.tsx");
    expect(lift).toMatch(/drawExpected\(\)/);
    expect(lift).toMatch(/after\(SPLASH_WAIT_CAP_MS\)/);
  });
});
