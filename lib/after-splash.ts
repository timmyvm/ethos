/**
 * Runs `go` once the app-open splash has left the screen (E60): at once
 * when there is none, or when `data-splash` leaves <html>
 * (components/SplashLift.tsx removes it once the lift has finished).
 *
 * A count-up that runs under the splash is spent where nobody sees it:
 * on a cold open of Today the stars and the tiles counted from 345 to
 * 575ms while the splash held until 911 (docs/look/debate2/splash/), so
 * the lift uncovered finished numbers. Waiting hands the climb to the
 * moment it can be seen.
 *
 * `capMs` is the floor under a splash that never lifts (its CSS fallback
 * fades it by 2.9s and leaves the attribute): past it, `go` runs anyway,
 * so a number never stays short of its value.
 *
 * Returns a cancel, for an effect's cleanup. The environment is passed
 * in so the rule can be tested without a DOM (lib/after-splash.test.ts).
 */
export type SplashEnv = {
  root: { hasAttribute(name: string): boolean };
  observe: (onChange: () => void) => () => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (id: unknown) => void;
};

export const SPLASH_CAP_MS = 3000;

export function afterSplash(go: () => void, env: SplashEnv, capMs = SPLASH_CAP_MS): () => void {
  if (!env.root.hasAttribute("data-splash")) {
    go();
    return () => {};
  }
  let done = false;
  let stop = () => {};
  const fire = () => {
    if (done) return;
    done = true;
    stop();
    env.clearTimer(timer);
    go();
  };
  stop = env.observe(() => {
    if (!env.root.hasAttribute("data-splash")) fire();
  });
  const timer = env.setTimer(fire, capMs);
  return () => {
    done = true;
    stop();
    env.clearTimer(timer);
  };
}

/** The browser's environment: <html>, watched for its data-splash. */
export function browserSplashEnv(): SplashEnv {
  const root = document.documentElement;
  return {
    root,
    observe: (onChange) => {
      const m = new MutationObserver(onChange);
      m.observe(root, { attributes: true, attributeFilter: ["data-splash"] });
      return () => m.disconnect();
    },
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (id) => window.clearTimeout(id as number),
  };
}
