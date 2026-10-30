import { useSyncExternalStore } from "react";

/**
 * Where the paywall's head stands (notes1, round 2). Put above the
 * scroll, the mark, the reason and the headline always drag the sheet,
 * as an iOS sheet's bar does; but on a short screen that head is a third
 * of the glass, and the ladder under it had about 200px to scroll in.
 * Under this height the head scrolls with the body and only the
 * grabber's strip stays put. 667 (a standalone SE) keeps it; 568 and a
 * browser tab on an SE (about 553) do not.
 */
export const PAYWALL_HEAD_STAYS_MIN_HEIGHT = 640;

export function paywallHeadStays(viewportHeight: number): boolean {
  return viewportHeight >= PAYWALL_HEAD_STAYS_MIN_HEIGHT;
}

const QUERY = `(min-height: ${PAYWALL_HEAD_STAYS_MIN_HEIGHT}px)`;

function subscribe(change: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", change);
  return () => mq.removeEventListener("change", change);
}

/** The screen's answer, live through a rotation or a resize. */
export function usePaywallHeadStays(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia(QUERY).matches),
    () => true
  );
}
