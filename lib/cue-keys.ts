/**
 * This phone's keys for the carried cue (#477), apart from lib/cue-store.ts
 * so that signing out (lib/auth.ts) can forget them without pulling the
 * cue's whole engine into the sign-in screens.
 */

/** This phone's copy: `{ uid, state }`. */
export const CUE_KEY = "ethos.cue";
/** The day the warm-up was skipped on this phone: it stays away until tomorrow. */
export const WARMUP_SKIPPED_KEY = "ethos.cue.skipped";

/**
 * Signing out (the #477 review): the next account on this phone is
 * someone else's, and the copy holds a sentence of this person's own words.
 */
export function forgetCarriedCue() {
  try {
    localStorage.removeItem(CUE_KEY);
    localStorage.removeItem(WARMUP_SKIPPED_KEY);
  } catch {}
}
