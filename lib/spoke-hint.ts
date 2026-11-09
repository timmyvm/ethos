/**
 * The local day this device last saw a recording land (#431), so Today
 * draws the right card before its history read answers: an open day's
 * card (Start across the card, "Another topic" under it) is a row taller
 * than a spoken day's, and a return after a break is greeted "Welcome
 * back". Read before the first paint; the read, when it lands, decides,
 * and writes what it found. A hint, never a number on screen: a cleared
 * or shared device reads as no hint, an open day's card.
 */

export const SPOKE_HINT_KEY = "ethos.spoke";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readSpokeHint(): string | null {
  try {
    const v = localStorage.getItem(SPOKE_HINT_KEY);
    return v && DAY.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeSpokeHint(day: string | null): void {
  try {
    if (day && DAY.test(day)) localStorage.setItem(SPOKE_HINT_KEY, day);
    else localStorage.removeItem(SPOKE_HINT_KEY);
  } catch {
    /* No storage: Today waits for its read, as it always did. */
  }
}
