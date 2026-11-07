import { describe, expect, it } from "vitest";
import { fillerSpans } from "./metrics";
import { SET_PHRASES, STOPWORDS, VAGUE, VAGUE_SET, fillerWhy, isStopword, wordKey } from "./thesaurus";

/**
 * The word lists behind the word sheet (#411, #428). The curated map of
 * alternatives is gone (#428: it could not read the sentence, so "switch
 * things up" got "points"), and with it the tests of its shape; what to
 * say instead is the server's answer now (lib/words.test.ts,
 * lib/words-route.test.ts). The vague underline and the small words stay.
 */
describe("the vague words", () => {
  it("never underlines as vague a word the engine counts as a filler", () => {
    // The engine's own detector, on each vague word alone and in a
    // sentence: a counted filler is underlined as the filler it is.
    for (const v of VAGUE) {
      const words = `I said ${v} there`.split(" ").map((word) => ({ word }));
      const spans = fillerSpans(words).filter((s) => s.index >= 2 && s.index < 2 + v.split(" ").length);
      expect(spans, v).toEqual([]);
    }
  });

  it("keeps the small words out of the vague list", () => {
    for (const v of VAGUE) expect(STOPWORDS.has(v), v).toBe(false);
    expect(isStopword("The")).toBe(true);
    expect(isStopword("discipline")).toBe(false);
  });

  it("names set phrases that each hold a vague word, as the transcript keys them", () => {
    for (const phrase of SET_PHRASES) {
      expect(phrase, phrase).toBe(wordKey(phrase));
      const words = phrase.split(" ");
      const vague = words.some((w, i) => VAGUE_SET.has(w) || VAGUE_SET.has(`${w} ${words[i + 1] ?? ""}`));
      expect(vague, phrase).toBe(true);
    }
  });
});

describe("why a filler gets a pause", () => {
  it("says one sentence for every filler the engine counts", () => {
    for (const label of ["um", "uh", "erm", "like", "you know", "kind of", "sort of", "basically", "actually", "literally"]) {
      const line = fillerWhy(label);
      expect(line, label).toMatch(/^[A-Z][^.]*\.$/);
      expect(line).not.toMatch(/[—]/);
    }
  });
});
