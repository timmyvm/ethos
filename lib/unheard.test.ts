import { describe, expect, it } from "vitest";
import { MAX_WORDS_PER_S, MIN_HEARD_S, TOO_SHORT_COPY, UNHEARD_COPY, unheard } from "./unheard";

describe("a take the mic barely heard (#406)", () => {
  it("is the tester's 0.36 seconds holding 266 invented words", () => {
    expect(unheard(0.36, 266)).toBe(true);
    expect(unheard(0.41, 266)).toBe(true);
    expect(unheard(0.95, 1)).toBe(true);
  });

  it("is anything under a second and a half", () => {
    expect(unheard(MIN_HEARD_S - 0.01, 0)).toBe(true);
    expect(unheard(MIN_HEARD_S, 0)).toBe(false);
  });

  it("is more words than anyone can say in its length", () => {
    expect(unheard(10, 10 * MAX_WORDS_PER_S + 1)).toBe(true);
    expect(unheard(10, 10 * MAX_WORDS_PER_S)).toBe(false);
  });

  it("is not a real take, fast, slow or quiet", () => {
    expect(unheard(38.11, 70)).toBe(false); // 110 a minute
    expect(unheard(44.53, 125)).toBe(false); // 170 a minute
    expect(unheard(30, 120)).toBe(false); // 240 a minute, a fast talker
    expect(unheard(6.49, 3)).toBe(false); // "Hello? Hello? Hello?"
    expect(unheard(8.31, 1)).toBe(false); // "Okay.": too thin to score, but heard
  });

  it("does not judge a length it was never told", () => {
    expect(unheard(Number.NaN, 300)).toBe(false);
  });

  it("speaks plainly", () => {
    for (const s of [UNHEARD_COPY, TOO_SHORT_COPY]) {
      expect(s).not.toMatch(/—|–/);
      expect(s).not.toMatch(/\b(gym|workout|drill|rep|training)\b/i);
    }
  });
});
