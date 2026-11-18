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

  /* #508 review: a tab tapped while Today still read left everything that
     waited on its draw (Demos's clip, the tab neighbours, the paywall's
     code, You's warm reads) waiting for the rest of the visit. */
  it("a screen left before its numbers landed lets what waited go", async () => {
    const leave = expectDraw();
    const waited = vi.fn();
    onDrawn(waited);
    const { afterFirstScreen } = await import("./first-draw");
    const clip = vi.fn();
    vi.useFakeTimers();
    try {
      afterFirstScreen(clip, 100);
      vi.advanceTimersByTime(5000);
      expect(clip).not.toHaveBeenCalled();
      leave();
      expect(waited).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(400);
      expect(clip).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaving after the draw changes nothing", () => {
    const leave = expectDraw();
    const waited = vi.fn();
    onDrawn(waited);
    markDrawn();
    leave();
    expect(waited).toHaveBeenCalledTimes(1);
    expect(isDrawn()).toBe(true);
  });

  it("Today and Practice hand their leaving to React as the layout effect's cleanup", () => {
    const today = src("app/page.tsx");
    expect(today).toMatch(/const leave = expectDraw\(\);/);
    expect(today).toMatch(/if \(!coldOpen\.current \|\| !restoreHeld\(\)\) return leave;/);
    expect(today).toMatch(/if \(plan !== null\) setPremium\(plan\);\s*return leave;\s*\}, \[\]\);/);
    expect(src("app/games/page.tsx")).toMatch(/useLayoutEffect\(\(\) => expectDraw\(\), \[\]\);/);
    // Nobody else announces a draw without handing back its leaving.
    for (const f of ["app/page.tsx", "app/games/page.tsx"]) expect(src(f)).not.toMatch(/^\s*expectDraw\(\);/m);
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

  it("Today says when it is drawn: when its read lands and its streak settles, or the read fails, and when it hands a first run to the room", () => {
    const today = src("app/page.tsx");
    expect(today).toMatch(/useLayoutEffect\(\(\) => \{\s*(\/\/[^\n]*\n\s*)+const leave = expectDraw\(\);/);
    // Drawn once the read has landed and the freezes have settled the streak (or the read failed).
    expect(today).toMatch(/if \(!failed && \(reps === null \|\| !streakSettled\)\) return;\s*markDrawn\(\);/);
    expect(today).toMatch(/if \(!sync\.ok\) \{\s*setStreakSettled\(true\);\s*return;\s*\}\s*setStreak\(sync\.data\.streak\);\s*setStreakSettled\(true\);/);
    // A streak kept reconciled from the last open (lib/held.ts rule 4) is settled at once.
    expect(today).toMatch(/streakKept\.current = kept !== null;[\s\S]{0,200}if \(kept !== null\) setStreakSettled\(true\);/);
    expect(today).toMatch(/router\.replace\("\/welcome"\);[\s\S]{0,120}markDrawn\(\);/);
    const lift = src("components/SplashLift.tsx");
    expect(lift).toMatch(/drawExpected\(\)/);
    expect(lift).toMatch(/after\(SPLASH_WAIT_CAP_MS\)/);
  });
});

describe("what waits for the first screen (fix 11)", () => {
  beforeEach(resetDrawn);

  it("waits for a screen that said it would be drawn, then for idle", async () => {
    const { afterFirstScreen } = await import("./first-draw");
    const fn = vi.fn();
    expectDraw();
    afterFirstScreen(fn, 10);
    await new Promise((r) => setTimeout(r, 30));
    expect(fn).not.toHaveBeenCalled();
    markDrawn();
    await new Promise((r) => setTimeout(r, 30));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs on idle for a screen that never said, and can be called off", async () => {
    const { afterFirstScreen } = await import("./first-draw");
    const fn = vi.fn();
    afterFirstScreen(fn, 10);
    await new Promise((r) => setTimeout(r, 30));
    expect(fn).toHaveBeenCalledTimes(1);
    const off = vi.fn();
    expectDraw();
    afterFirstScreen(off, 10)();
    markDrawn();
    await new Promise((r) => setTimeout(r, 30));
    expect(off).not.toHaveBeenCalled();
  });

  it("Today's rows to Hostile and the boss are not fetched beside its reads; the clip and the neighbours wait", () => {
    expect(src("components/home/ModeRows.tsx")).toMatch(/prefetch=\{false\}/);
    expect(src("components/home/HomeHero.tsx")).not.toMatch(/prefetch=\{false\}/);
    expect(src("components/TabSwipe.tsx")).toMatch(/return afterFirstScreen\(ask, 2500\);/);
    expect(src("components/DemosClip.tsx")).toMatch(/cancelLoad = afterFirstScreen\(attach\);/);
    const games = src("app/games/page.tsx");
    expect(games).toMatch(/useLayoutEffect\(\(\) => expectDraw\(\), \[\]\);/);
    expect(games).toMatch(/if \(rounds !== null\) markDrawn\(\);/);
  });
});
