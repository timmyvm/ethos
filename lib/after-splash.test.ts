import { describe, expect, it } from "vitest";
import { afterSplash, SPLASH_CAP_MS, type SplashEnv } from "./after-splash";

/** <html> with or without its splash, a watcher and a clock, all by hand. */
function fake(splash: string | null) {
  const attrs = new Map<string, string>();
  if (splash !== null) attrs.set("data-splash", splash);
  const watchers = new Set<() => void>();
  const timers = new Map<number, () => void>();
  let next = 1;
  const env: SplashEnv = {
    root: { hasAttribute: (n) => attrs.has(n) },
    observe: (cb) => {
      watchers.add(cb);
      return () => watchers.delete(cb);
    },
    setTimer: (fn) => {
      const id = next++;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (id) => timers.delete(id as number),
  };
  return {
    env,
    set(value: string | null) {
      if (value === null) attrs.delete("data-splash");
      else attrs.set("data-splash", value);
      for (const w of [...watchers]) w();
    },
    runTimers() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    watching: () => watchers.size,
    pending: () => timers.size,
  };
}

describe("a count-up waits for the splash to leave (E60)", () => {
  it("starts at once when there is no splash", () => {
    const f = fake(null);
    let runs = 0;
    afterSplash(() => runs++, f.env);
    expect(runs).toBe(1);
    expect(f.watching()).toBe(0);
    expect(f.pending()).toBe(0);
  });

  it("holds while the splash is on and while it lifts, and starts when it has gone", () => {
    const f = fake("on");
    let runs = 0;
    afterSplash(() => runs++, f.env);
    expect(runs).toBe(0);
    f.set("out");
    expect(runs).toBe(0);
    f.set(null);
    expect(runs).toBe(1);
    expect(f.watching()).toBe(0);
    expect(f.pending()).toBe(0);
  });

  it("starts anyway at the cap when the splash never lifts, once", () => {
    const f = fake("on");
    let runs = 0;
    afterSplash(() => runs++, f.env);
    f.runTimers();
    expect(runs).toBe(1);
    f.set(null);
    expect(runs).toBe(1);
    expect(SPLASH_CAP_MS).toBeGreaterThan(2900);
  });

  it("does nothing after it is cancelled", () => {
    const f = fake("on");
    let runs = 0;
    const cancel = afterSplash(() => runs++, f.env);
    cancel();
    f.set(null);
    f.runTimers();
    expect(runs).toBe(0);
    expect(f.watching()).toBe(0);
  });
});
