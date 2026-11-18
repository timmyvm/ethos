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
 *
 * `expectDraw()` hands back the screen's leaving, which the layout effect
 * returns as its cleanup: a screen left before its numbers landed (a tab
 * tapped while Today still read) never says it drew, and without that
 * everything waiting on it (Demos's clip, the tab neighbours, the
 * paywall's code, You's warm reads) would wait for the rest of the visit.
 */

type Waiter = () => void;

let expected = false;
let drawn = false;
const waiters = new Set<Waiter>();

/** This screen will say when its numbers are drawn. Returns its leaving: what waited goes then. */
export function expectDraw(): () => void {
  expected = true;
  return () => {
    if (!drawn) markDrawn();
  };
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
 * swipe's neighbours, Demos's idle clip, the paywall's code. A screen that
 * never said it would announce its draw counts as drawn, so this only
 * ever waits on one that did. Returns a cancel.
 *
 * Whether the screen will say so is read once the phone is idle, not when
 * this is asked (the review of the final pass, 18 Nov). A module that asks
 * as it loads (components/LazyPaywall.tsx) runs while React renders the
 * page, before the screen's layout effect has called `expectDraw`; read
 * then, Today was taken as drawn and the paywall's code left beside its
 * own reads. And a screen that has still not said by then, on a page not
 * yet loaded, is asked again once it has: by then its effects have run.
 */
export function afterFirstScreen(fn: () => void, timeout = 2000): () => void {
  let off = false;
  let cancel = () => {};
  const go = () => {
    if (!off) cancel = whenIdle(fn, timeout);
  };
  const decide = (loaded: boolean) => {
    if (off) return;
    if (expected && !drawn) {
      cancel = onDrawn(go);
      return;
    }
    if (expected || loaded || typeof document === "undefined" || document.readyState === "complete") {
      fn();
      return;
    }
    const onLoad = () => {
      if (!off) cancel = whenIdle(() => decide(true), timeout);
    };
    window.addEventListener("load", onLoad, { once: true });
    cancel = () => window.removeEventListener("load", onLoad);
  };
  cancel = whenIdle(() => decide(false), timeout);
  return () => {
    off = true;
    cancel();
  };
}

/** Tests only. */
export function resetDrawn(): void {
  expected = false;
  drawn = false;
  waiters.clear();
}
