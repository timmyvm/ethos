"use client";

import { useEffect } from "react";

/** The shortest the splash shows, from navigation start. */
const MIN_MS = 900;
/** The lift, matching `.splash` in globals.css. */
const LIFT_MS = 360;

/**
 * Lifts the app-open screen (components/Splash.tsx) once React has
 * hydrated, the fonts are in and MIN_MS has passed since navigation
 * start. Does nothing on an open the head script skipped.
 */
export function SplashLift() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-splash") !== "on") return;
    let done = false;
    const timers: number[] = [];
    const floor = new Promise<void>((resolve) =>
      timers.push(
        window.setTimeout(resolve, Math.max(0, MIN_MS - performance.now()))
      )
    );
    const fonts = document.fonts?.ready ?? Promise.resolve();
    void Promise.all([floor, fonts]).then(() => {
      if (done) return;
      root.setAttribute("data-splash", "out");
      timers.push(
        window.setTimeout(() => root.removeAttribute("data-splash"), LIFT_MS)
      );
    });
    return () => {
      done = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);
  return null;
}
