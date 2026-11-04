/**
 * A take the mic barely heard (#406).
 *
 * On 2 November a tester's phone handed over 0.36 seconds of audio for a
 * take he spoke into, and Whisper filled it with 266 invented words ("Like,
 * I don't know, I don't know, ..."). Ethos did not score it (no substance),
 * but it showed him the invented transcript and spent one of his hourly
 * slots on it, so three dead takes and a working one locked him out for an
 * hour. A take this short, or with more words than anyone can say in its
 * length, is the mic, not the speaker: nothing is stored, the slot is given
 * back, and the phone says to check the mic.
 */

/** Below this much audio there is nothing to score. */
export const MIN_HEARD_S = 1.5;

/**
 * Faster than anyone speaks. A fast talker runs at about 4 words a second
 * (240 a minute); Whisper's invented text on silence runs far past it.
 */
export const MAX_WORDS_PER_S = 6;

/** Too short to have been heard, or more words than its length can hold. */
export function unheard(durationS: number, words: number): boolean {
  if (!Number.isFinite(durationS)) return false;
  if (durationS < MIN_HEARD_S) return true;
  return words / durationS > MAX_WORDS_PER_S;
}

/** What the phone shows instead of a score. */
export const UNHEARD_COPY =
  "Ethos couldn't hear you. Check the mic isn't muted or in use by another app, then record again.";

/** A take stopped before this much time has passed is not sent at all. */
export const MIN_TAKE_MS = 1500;

export const TOO_SHORT_COPY = "Too short to hear anything. Record again when you're ready.";
