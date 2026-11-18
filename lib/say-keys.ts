/**
 * This phone's copy of Say it better's test (#507), apart from
 * lib/say-store.ts so that signing out (lib/auth.ts, lib/account-settings.ts)
 * can forget it without pulling the store into the sign-in screens, as
 * lib/cue-keys.ts does for the carried cue.
 */

/** `{ uid, states }`: where each swap stands in the spaced test, by the account that wrote it. */
export const SAY_KEY = "ethos.say.v1";

/**
 * Signing out (the final pass of 18 Nov): the copy is keyed by account,
 * so the next one never read it, but it holds this person's swaps (their
 * ids) and the days each was tested, and a shared phone keeps nothing of
 * an account that left it.
 */
export function forgetSayCopy() {
  try {
    localStorage.removeItem(SAY_KEY);
  } catch {}
}
