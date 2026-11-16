import { TAB_HREFS } from "./tabs";

/**
 * The numbers a tab has already counted up this visit (#467).
 *
 * A count-up is an arrival, and a number arrives once. Swiping back to a
 * tab remounts it, and every figure on it climbed again from 82% of
 * itself: the same streak, the same Index, counted for the fifth time in
 * a minute. Kept here, in memory, by the tab and the value, so a return
 * shows the number where it landed and a number that changed (a new
 * recording moved it) still counts. By value, not by place: React's ids
 * are new on every client mount. Two figures on one tab that read the
 * same both count the first time and both stand still after.
 *
 * Tabs only. Off the bar (a recording's result) a number is a moment
 * that is earned each time, and it always counts.
 */
const counted = new Map<string, number>();
const TABS: readonly string[] = TAB_HREFS;

function onTab(place: string): boolean {
  return TABS.includes(place.slice(0, place.indexOf("#")));
}

/** This place on a tab already counted up to exactly this value. */
export function countedBefore(place: string, value: number): boolean {
  return onTab(place) && counted.get(place) === value;
}

/** The count at this place has started: a return shows it landed. */
export function rememberCounted(place: string, value: number): void {
  if (onTab(place)) counted.set(place, value);
}

/** Tests only. */
export function resetCounted(): void {
  counted.clear();
}
