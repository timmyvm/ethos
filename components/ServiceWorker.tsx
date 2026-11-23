"use client";

import { useEffect } from "react";
import { drawExpected, onDrawn, whenIdle } from "@/lib/first-draw";

/**
 * Registers the offline shell. Silent when unsupported.
 *
 * After the first screen, never beside it (#508): the install pre-caches
 * the shell (public/sw.js), and on a first open it used to start on the
 * page's `load` and share the link with Today's reads and its art. It now
 * waits for the screen's numbers to be drawn (Today says so,
 * lib/first-draw.ts; any other screen counts as drawn at `load`) and
 * then for the browser to be idle. A phone that already has the worker
 * loses nothing: registering again is a no-op, and the worker already
 * serves the page.
 */
/** The longest the install waits on a screen that said it would be drawn, from `load`. */
const LATEST_MS = 10_000;

/**
 * Hands the worker the build files this page loaded before it was there
 * (#516 review): the screen's stylesheet, fonts and scripts came before
 * the install and never passed through it, so offline after one visit the
 * pages drew with no CSS or JS. Once the worker is active it keeps them
 * (public/sw.js, `keep-static`). A page the worker already serves posts
 * the same list and the worker finds every file held.
 */
export function keepStatic(): Promise<void> {
  return navigator.serviceWorker.ready.then((reg) => {
    const urls = performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .filter((u) => u.startsWith(`${location.origin}/_next/static/`));
    if (urls.length > 0) reg.active?.postMessage({ type: "keep-static", urls });
  });
}

export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    let cancelIdle = () => {};
    let stopDraw = () => {};
    let latest = 0;
    let asked = false;
    const register = () => {
      if (asked) return;
      asked = true;
      window.clearTimeout(latest);
      cancelIdle = whenIdle(() => {
        navigator.serviceWorker.register("/sw.js").then(keepStatic).catch(() => {});
      }, 3000);
    };
    const onLoad = () => {
      if (!drawExpected()) return register();
      stopDraw = onDrawn(register);
      // A screen left before its numbers landed never says so: the shell still installs.
      latest = window.setTimeout(register, LATEST_MS);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      window.clearTimeout(latest);
      stopDraw();
      cancelIdle();
    };
  }, []);
  return null;
}
