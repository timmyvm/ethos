/**
 * One switch for the whole paywall.
 *
 * OFF as of 27 Aug (Timothy's call — premium is live, unlocked by code
 * while there's no payment processor). The 11 Aug everything-free period
 * (DECISIONS #96) is over; the tiers in DECISIONS #31, #73 and #75 were
 * implemented and tested throughout, so this flip re-arms them without
 * rebuilding anything.
 *
 * Every premium gate in the app reads `isUnlocked()` or `limit()`.
 */
export const EVERYTHING_FREE = false;

/**
 * Is this account entitled to premium surfaces? The stored flag
 * (`profiles.premium`) is the account's answer; `EVERYTHING_FREE`
 * overrides it for a free-for-all period.
 */
export function isUnlocked(storedPremium: boolean): boolean {
  return EVERYTHING_FREE || storedPremium;
}

/**
 * Free-tier limits. `null` means no limit — callers slice with it
 * directly rather than branching. Takes the account's entitlement:
 * a premium account is never capped, whatever the global switch says.
 */
export function limit(freeCap: number, premium = false): number | null {
  return isUnlocked(premium) ? null : freeCap;
}
