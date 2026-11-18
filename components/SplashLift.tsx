"use client";

import { useEffect } from "react";
import { drawExpected, onDrawn } from "@/lib/first-draw";
import { SPLASH_FLOOR_MS, SPLASH_WAIT_CAP_MS } from "@/lib/splash-timing";

/** The lift, matching `.splash` in globals.css. */
const LIFT_MS = 360;

/**
 * Lifts the app-open screen (components/Splash.tsx) once React has
 * hydrated, the fonts are in, SPLASH_FLOOR_MS has passed since
 * navigation start and, on a screen that says when its numbers are drawn
 * (Today, lib/first-draw.ts), once they are: the splash lands on a drawn
 * Today rather than its skeleton (#508). That wait is capped at
 * SPLASH_WAIT_CAP_MS from navigation start, so a slow read never holds
 * the brand moment past it. Does nothing on an open the head script
 * skipped.
 */
export function SplashLift() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-splash") !== "on") return;
    let done = false;
    const timers: number[] = [];
    const after = (ms: number) =>
      new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, Math.max(0, ms - performance.now()))));
    let stopWaiting = () => {};
    const drawnOrCap = drawExpected()
      ? Promise.race([
          new Promise<void>((resolve) => {
            stopWaiting = onDrawn(resolve);
          }),
          after(SPLASH_WAIT_CAP_MS),
        ])
      : Promise.resolve();
    const fonts = document.fonts?.ready ?? Promise.resolve();
    void Promise.all([after(SPLASH_FLOOR_MS), fonts, drawnOrCap]).then(() => {
      if (done) return;
      root.setAttribute("data-splash", "out");
      timers.push(window.setTimeout(() => root.removeAttribute("data-splash"), LIFT_MS));
    });
    return () => {
      done = true;
      stopWaiting();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);
  return null;
}
