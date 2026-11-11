/**
 * Where each tab was left this visit (#443).
 *
 * On an iPhone a tab keeps its place: look at a row half way down the
 * Log, glance at Today, come back, and the Log is where it was. Ethos's
 * tabs are pages, and every switch landed at the top. Since #433 a tab
 * opened again is drawn whole in its first frame, so it can be put back
 * where it was left.
 *
 * Memory only, one place per tab. Tapping the tab you are on is the
 * other half of the convention: it goes to the top, and forgets.
 */

import { TAB_HREFS } from "./tabs";

const places = new Map<string, number>();

const isTab = (path: string): boolean => (TAB_HREFS as readonly string[]).includes(path);

/** Remember how far down a tab was when it was left. Anything that is not a tab's own screen is ignored. */
export function leaveTab(path: string, scrollY: number): void {
  if (!isTab(path)) return;
  if (scrollY > 0 && Number.isFinite(scrollY)) places.set(path, Math.round(scrollY));
  else places.delete(path);
}

/**
 * Where to put a tab that is being opened: where it was left, as far as
 * the page as drawn can scroll (a tab still loading is short, and lands
 * at its top rather than part way down a skeleton). 0 for anything else.
 */
export function tabPlace(path: string, canScrollTo: number = Number.POSITIVE_INFINITY): number {
  const y = places.get(path) ?? 0;
  return y > 0 && y <= canScrollTo + 1 ? y : 0;
}

/** The tab was sent to its top (a tap on the tab you are on): it has no place to come back to. */
export function forgetTab(path: string): void {
  places.delete(path);
}

/** Tests only. */
export function resetTabPlaces(): void {
  places.clear();
}
