/**
 * One switch for the whole paywall.
 *
 * Timothy's call, 11 Aug: everything is free right now. Not a tier
 * change and not a rethink of the economics — the product needs people
 * using all of it and telling him what's wrong more than it needs a
 * conversion rate at zero users.
 *
 * Every premium gate in the app reads `isUnlocked()`. That means turning
 * the paywall back on is this constant and nothing else: the tiers in
 * DECISIONS #31, #73 and #75 are all still implemented, still tested,
 * and just answering "yes" for now.
 */
export const EVERYTHING_FREE = true;

/**
 * Is this account entitled to premium surfaces? While `EVERYTHING_FREE`
 * is set, the stored flag is ignored rather than deleted — nobody's
 * `profiles.premium` row changes, so flipping back loses nothing.
 */
export function isUnlocked(storedPremium: boolean): boolean {
  return EVERYTHING_FREE || storedPremium;
}

/**
 * Free-tier limits, applied only when the paywall is on. `null` means
 * no limit — callers slice with it directly rather than branching.
 */
export function limit(freeCap: number): number | null {
  return EVERYTHING_FREE ? null : freeCap;
}
