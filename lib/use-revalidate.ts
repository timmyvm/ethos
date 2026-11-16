"use client";

import { useEffect, useRef } from "react";

/**
 * How long a read stands before a return to the app asks again. Coming
 * back from the lock screen or another app inside this is the same
 * visit, and reads nothing.
 */
export const REVALIDATE_GAP_MS = 30_000;

/**
 * Whether a return to the app should read again: the page is on screen,
 * and either the network just came back (a read that failed offline is
 * owed its retry at once) or the last read is older than the gap.
 */
export function revalidateDue(input: {
  visible: boolean;
  online: boolean;
  lastAt: number;
  now: number;
  gapMs?: number;
}): boolean {
  if (!input.visible) return false;
  if (input.online) return true;
  return input.now - input.lastAt >= (input.gapMs ?? REVALIDATE_GAP_MS);
}

/**
 * The other half of stale-while-revalidate (lib/held.ts, #433): a screen
 * left open reads again, behind what it shows, when the app is looked at
 * again after a while and when the network comes back. `read` is the
 * screen's own quiet read: it never puts a skeleton over what is drawn.
 */
export function useRevalidate(read: () => void, gapMs: number = REVALIDATE_GAP_MS): void {
  const fn = useRef(read);
  // The newest read is the one a return runs: kept in step after every render.
  useEffect(() => {
    fn.current = read;
  });
  useEffect(() => {
    let lastAt = Date.now();
    const ask = (online: boolean) => {
      const now = Date.now();
      if (!revalidateDue({ visible: document.visibilityState === "visible", online, lastAt, now, gapMs })) return;
      lastAt = now;
      fn.current();
    };
    const onShown = () => ask(false);
    const onOnline = () => ask(true);
    document.addEventListener("visibilitychange", onShown);
    window.addEventListener("focus", onShown);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener("focus", onShown);
      window.removeEventListener("online", onOnline);
    };
  }, [gapMs]);
}
