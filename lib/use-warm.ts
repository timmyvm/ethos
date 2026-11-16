"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * Whether this mount may draw from what the visit holds (lib/held.ts,
 * #433). False while React hydrates the server's page, whose markup was
 * made without any of it, and true on every mount after: a screen opened
 * by moving through the app. Read during render and used only in a
 * state's first value, so the hydrated page and the server's always
 * agree, whatever landed in the store meanwhile.
 */
export function useWarm(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false
  );
}

/**
 * A screen drawn from what was held is simply there. `.arrive` and the
 * `.stagger` ladder are how content lands over its skeleton, and a tab
 * that opens with its numbers has nothing landing: before the first
 * paint, the arrivals already in the page are stilled. Anything that
 * mounts later (a slot that was not held, a fresh row) lands as it
 * always did. `seeded` is read once, at mount.
 */
export function useStill(seeded: boolean): void {
  useLayoutEffect(() => {
    if (!seeded) return;
    document.querySelectorAll<HTMLElement>("main .arrive, main .stagger > *").forEach((el) => {
      el.style.animation = "none";
    });
    // Mount only: what lands after the first frame keeps its arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
