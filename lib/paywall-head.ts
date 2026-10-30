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

/**
 * A short screen (a standalone SE is 667): the ladder is the paywall's
 * argument, and under the shelf's terms (D40) its steps were cut at the
 * bar tops with the month labels hidden. Under this height the sheet
 * tightens its rhythm and stands the Stair at its middle size, so the
 * whole ladder, labels and all, clears the shelf at 375x667. 759: the
 * full rhythm needs 758 to stand the large Stair clear of the shelf (at
 * 390x700 its labels sat 41px under it).
 */
export const PAYWALL_SHORT_MAX_HEIGHT = 759;

export function paywallShort(viewportHeight: number): boolean {
  return viewportHeight <= PAYWALL_SHORT_MAX_HEIGHT;
}

const SHORT_QUERY = `(max-height: ${PAYWALL_SHORT_MAX_HEIGHT}px)`;

function subscribeShort(change: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(SHORT_QUERY);
  mq.addEventListener("change", change);
  return () => mq.removeEventListener("change", change);
}

export function usePaywallShort(): boolean {
  return useSyncExternalStore(
    subscribeShort,
    () => (typeof window === "undefined" || !window.matchMedia ? false : window.matchMedia(SHORT_QUERY).matches),
    () => false
  );
}
