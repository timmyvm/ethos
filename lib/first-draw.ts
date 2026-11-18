/**
 * The first screen's own numbers are on it (#508, the speed audit's fixes
 * 3, 6 and 12).
 *
 * Three things wait for that moment rather than for the page's `load`:
 * the splash lifts onto a drawn screen instead of a skeleton
 * (components/SplashLift.tsx), the service worker's install leaves the
 * link to the reads until they have landed (components/ServiceWorker.tsx),
 * and the reads another tab will want are made once there is nothing left
 * to wait for (Today warming You's, lib/warm-you.ts).
 *
 * A screen that will say so calls `expectDraw()` in a layout effect (so
 * it is known before any effect asks) and `markDrawn()` once its data, or
 * its failure, is on screen. A screen that never says so is taken as
 * drawn when the page has loaded, as before.
 */

type Waiter = () => void;

let expected = false;
let drawn = false;
const waiters = new Set<Waiter>();

/** This screen will say when its numbers are drawn. */
export function expectDraw(): void {
  expected = true;
}

/** Whether the screen on show said it would. */
export function drawExpected(): boolean {
  return expected;
}

/** The screen's numbers (or its failure) are on screen: everything waiting may go. */
export function markDrawn(): void {
  if (drawn) return;
  drawn = true;
  for (const w of [...waiters]) {
    waiters.delete(w);
    try {
      w();
    } catch {
      /* One waiter's failure is its own. */
    }
  }
}

export function isDrawn(): boolean {
  return drawn;
}

/** Runs `fn` once the first screen is drawn (at once if it was). Returns a cancel. */
export function onDrawn(fn: Waiter): () => void {
  if (drawn) {
    fn();
    return () => {};
  }
  waiters.add(fn);
  return () => {
    waiters.delete(fn);
  };
}

/**
 * Runs `fn` when the browser is idle, or after `timeout` ms at the
 * latest; Safari has no requestIdleCallback and gets a short timer.
 * Returns a cancel.
 */
export function whenIdle(fn: () => void, timeout = 2000): () => void {
  const w = typeof window === "undefined" ? undefined : (window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  });
  if (w?.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, Math.min(timeout, 300));
  return () => clearTimeout(id);
}

/**
 * Runs `fn` once the first screen is drawn and the phone is idle: what
 * can wait for the screen (#508, the speed audit's fix 11), the tab
 * swipe's neighbours, Demos's idle clip. A screen that never said it
 * would announce its draw counts as drawn, so this only ever waits on
 * one that did. Returns a cancel.
 */
export function afterFirstScreen(fn: () => void, timeout = 2000): () => void {
  let cancelIdle = () => {};
  const go = () => {
    cancelIdle = whenIdle(fn, timeout);
  };
  if (!expected || drawn) {
    go();
    return () => cancelIdle();
  }
  const stop = onDrawn(go);
  return () => {
    stop();
    cancelIdle();
  };
}

/** Tests only. */
export function resetDrawn(): void {
  expected = false;
  drawn = false;
  waiters.clear();
}
