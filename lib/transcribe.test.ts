import { describe, expect, it } from "vitest";
import { DISFLUENCY_PROMPT } from "./transcribe";

/**
 * A guard, not a unit test. Measured against generated speech carrying a
 * known 3 "um" and 2 "uh" on 11 Aug:
 *
 *   no prompt   → um 0, uh 0
 *   this prompt → um 3, uh 2
 *
 * Whisper deletes non-lexical fillers unless primed. The filler count is
 * the product's core number, so this string is load-bearing and a tidy-up
 * that "cleaned" it would silently gut the engine.
 */
describe("the disfluency prompt", () => {
  it("primes Whisper with the fillers it most wants to drop", () => {
    for (const filler of ["um", "uh", "like", "you know", "kind of"]) {
      expect(DISFLUENCY_PROMPT.toLowerCase()).toContain(filler);
    }
  });

  /**
   * A longer prompt recovered no more fillers and hallucinated "Thank you
   * for watching." onto six seconds of near-silence, where this one
   * returned nothing. More priming gives Whisper more to fall back on
   * when there is no signal, and an invented sentence would pass the
   * substance gate as a real rep.
   */
  it("stays short enough not to hallucinate over silence", () => {
    expect(DISFLUENCY_PROMPT.length).toBeLessThan(120);
  });
});
