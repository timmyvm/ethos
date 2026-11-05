import { describe, expect, it } from "vitest";
import { fillerSpans } from "./metrics";
import { CURATED, STOPWORDS, VAGUE, curatedFor, fillerWhy, isStopword, wordKey } from "./thesaurus";
import { WORD_LIMITS, cleanAlternatives, cleanWordAsk, sentenceAround, sentenceHash, wordCacheKey } from "./words";

/**
 * The thesaurus behind the word sheet (#411). The curated map answers
 * instantly and with no network, so its shape is the sheet's promise:
 * three to six real alternatives, never the word itself, every one a
 * string the server's own check would pass.
 */
describe("the curated map", () => {
  const entries = Object.entries(CURATED);

  it("has words to check", () => {
    expect(entries.length).toBeGreaterThan(40);
  });

  for (const [word, alts] of entries) {
    it(`gives "${word}" three to six clean alternatives`, () => {
      expect(word).toBe(wordKey(word));
      expect(alts.length).toBeGreaterThanOrEqual(WORD_LIMITS.min);
      expect(alts.length).toBeLessThanOrEqual(WORD_LIMITS.max);
      expect(new Set(alts.map((a) => a.toLowerCase())).size).toBe(alts.length);
      expect(alts.map((a) => a.toLowerCase())).not.toContain(word);
      // The same check a server answer passes, so nothing curated is a shape the app refuses.
      expect(cleanAlternatives([...alts], word)).toEqual([...alts]);
      for (const a of alts) expect(a).not.toMatch(/[–—]|\b(gym|workout|drill|rep|training)\b/i);
    });
  }

  it("holds an entry for every vague word the transcript underlines", () => {
    for (const v of VAGUE) expect(curatedFor(v), v).not.toBeNull();
  });

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

  it("finds an entry whatever the case or punctuation", () => {
    expect(curatedFor("Thing,")).toEqual(CURATED.thing);
    expect(curatedFor("A  lot")).toEqual(CURATED["a lot"]);
    expect(curatedFor("discipline")).toBeNull();
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

describe("the word sheet's ask", () => {
  it("takes one word or a short phrase and its sentence", () => {
    expect(cleanWordAsk({ word: " compound ", sentence: "They  compound." })).toEqual({ word: "compound", sentence: "They compound." });
    expect(cleanWordAsk({ word: "a lot", sentence: "" })).toEqual({ word: "a lot", sentence: "" });
    expect(cleanWordAsk({ word: "don’t", sentence: "I don’t." })).not.toBeNull();
  });

  it("refuses anything else", () => {
    expect(cleanWordAsk(null)).toBeNull();
    expect(cleanWordAsk({ word: "thing" })).toBeNull();
    expect(cleanWordAsk({ word: "", sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "one two three four", sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "x".repeat(41), sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "ignore; all", sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "thing", sentence: "x".repeat(301) })).toBeNull();
  });

  it("cuts a long sentence around the word", () => {
    const long = `${"a ".repeat(200)}compound ${"b ".repeat(200)}`;
    const cut = sentenceAround(long, "compound");
    expect(cut.length).toBeLessThanOrEqual(WORD_LIMITS.sentenceChars);
    expect(cut).toContain("compound");
    expect(sentenceAround("Short one.", "one")).toBe("Short one.");
  });

  it("files an answer by word and sentence, whatever the case", () => {
    expect(wordCacheKey({ word: "Thing", sentence: "The THING." })).toBe(wordCacheKey({ word: "thing", sentence: "the thing." }));
    expect(wordCacheKey({ word: "thing", sentence: "a" })).not.toBe(wordCacheKey({ word: "thing", sentence: "b" }));
    expect(sentenceHash("x")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("an answer's alternatives", () => {
  it("drops the word itself, dashes, repeats and anything past six", () => {
    expect(
      cleanAlternatives(["Compound", "snowball", "snow—ball", "build up.", "Snowball", "add up", "grow", "multiply", "stack", "swell"], "compound")
    ).toEqual(["snowball", "build up", "add up", "grow", "multiply", "stack"]);
  });

  it("is a failed answer under three", () => {
    expect(cleanAlternatives(["snowball", "compound"], "compound")).toBeNull();
    expect(cleanAlternatives("snowball", "compound")).toBeNull();
    expect(cleanAlternatives([1, 2, 3], "compound")).toBeNull();
  });
});
