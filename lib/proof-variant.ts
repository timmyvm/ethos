/**
 * TEMPORARY (18 Nov, the proof line's three designs): which of Say it
 * better's proof designs the glance draws, so all three render from one
 * build for the judges. Only the camera sets it
 * (scripts/look-proof-variants.mjs, `ethos.look.proof` in this phone's
 * storage); with nothing set the glance is the live one (#507's
 * fitGlanceProof). The builder keeps the winner, makes it the glance's
 * only proof, and deletes this file with the losers.
 *
 *   a  an earned moment, like a level-up: its own word allowance
 *      (GLANCE_WORDS_PROOF), never waits, shown whole.
 *   b  a visual piece under the score, outside the word budget, a door
 *      to the swap's sheet in Say it better.
 *   c  Demos says it in the carried cue's place, celebrating; the cue
 *      for tomorrow waits a day.
 */
export type ProofVariant = "live" | "a" | "b" | "c";

export const PROOF_VARIANT_KEY = "ethos.look.proof";

export function readProofVariant(): ProofVariant {
  try {
    const v = typeof localStorage === "undefined" ? null : localStorage.getItem(PROOF_VARIANT_KEY);
    return v === "a" || v === "b" || v === "c" ? v : "live";
  } catch {
    return "live";
  }
}
