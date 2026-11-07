import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEEP_NOTE,
  KEEP_NOTES,
  WORDS_VERSION,
  WORD_LIMITS,
  cleanAnswer,
  cleanWordAsk,
  replacesPhrase,
  sentenceAround,
  sentenceHash,
  wordCacheKey,
  type WordAsk,
} from "./words";

/**
 * The word sheet's ask and answer (#411, rebuilt in #428). Timothy, 7
 * Nov: "the try instead words are shittt", over "things" in "I think
 * today's the day I switch things up." (offered points, ideas, parts)
 * and "dollar" in the child labour sentence (offered buck, cent, euro).
 * An answer is now a verdict on the word in its sentence: swap, with
 * what it replaces and one to three options, or keep, with one fixed
 * line. These hold what the phone and the route both accept.
 *
 * Moved here from lib/thesaurus.test.ts, with the expectations the new
 * behaviour changes named where they are: an ask now carries `at`, the
 * cut returns the word's new place, the key carries the version and the
 * place, and "a failed answer under three" became "under one" (one
 * right row is a full answer, and keep has none at all).
 */

const THINGS: WordAsk = {
  word: "things",
  sentence: "I think today's the day I switch things up.",
  at: 33,
};
const DOLLAR_SENTENCE =
  "You know, I love to contribute to the billion dollar corporations that pay one dollar per hour for child labor.";
const DOLLAR: WordAsk = { word: "dollar", sentence: DOLLAR_SENTENCE, at: DOLLAR_SENTENCE.indexOf("dollar") };

describe("the word sheet's ask", () => {
  it("takes one word or a short phrase and its sentence, with where the word stands", () => {
    // Changed in #428: the ask carries `at`, the word's place in the sentence.
    expect(cleanWordAsk({ word: " compound ", sentence: "They  compound." })).toEqual({ word: "compound", sentence: "They compound.", at: 5 });
    expect(cleanWordAsk({ word: "a lot", sentence: "" })).toEqual({ word: "a lot", sentence: "", at: 0 });
    expect(cleanWordAsk({ word: "don’t", sentence: "I don’t." })).not.toBeNull();
  });

  it("keeps the place it was sent, and finds the first one for an old client", () => {
    const second = DOLLAR_SENTENCE.lastIndexOf("dollar");
    expect(cleanWordAsk({ word: "dollar", sentence: DOLLAR_SENTENCE, at: second })?.at).toBe(second);
    expect(cleanWordAsk({ word: "dollar", sentence: DOLLAR_SENTENCE })?.at).toBe(DOLLAR_SENTENCE.indexOf("dollar"));
    // A place that does not hold the word is not trusted.
    expect(cleanWordAsk({ word: "dollar", sentence: DOLLAR_SENTENCE, at: 3 })?.at).toBe(DOLLAR_SENTENCE.indexOf("dollar"));
    // Whole words first: "a lot" is not the start of "a lottery".
    expect(cleanWordAsk({ word: "a lot", sentence: "I won a lottery, a lot of money." })?.at).toBe(17);
  });

  it("refuses anything else", () => {
    expect(cleanWordAsk(null)).toBeNull();
    expect(cleanWordAsk({ word: "thing" })).toBeNull();
    expect(cleanWordAsk({ word: "", sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "one two three four", sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "x".repeat(41), sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "ignore; all", sentence: "x" })).toBeNull();
    expect(cleanWordAsk({ word: "thing", sentence: "x".repeat(301) })).toBeNull();
    // New in #428: a word that is not in its sentence is no ask.
    expect(cleanWordAsk({ word: "dollar", sentence: "Nothing about money." })).toBeNull();
  });

  it("cuts a long sentence around the word, and says where the word now starts", () => {
    // Changed in #428: the cut works from the word's place and returns it.
    const long = `${"a ".repeat(200)}compound ${"b ".repeat(200)}`;
    const cut = sentenceAround(long, 400, "compound");
    expect(cut.sentence.length).toBeLessThanOrEqual(WORD_LIMITS.sentenceChars);
    expect(cut.sentence.slice(cut.at, cut.at + "compound".length)).toBe("compound");
    expect(sentenceAround("Short one.", 6, "one")).toEqual({ sentence: "Short one.", at: 6 });
  });

  it("keeps the tapped place when whitespace collapses or the word comes twice", () => {
    const s = "That  was   that.";
    const second = s.lastIndexOf("that");
    expect(sentenceAround(s, second, "that")).toEqual({ sentence: "That was that.", at: 9 });
    // A place that does not hold the word falls back to its first place.
    expect(sentenceAround("I said that.", 0, "that")).toEqual({ sentence: "I said that.", at: 7 });
  });

  it("files an answer by version, word, place and sentence, whatever the case", () => {
    // Changed in #428: the version and the place are in the key.
    expect(wordCacheKey({ word: "Thing", sentence: "The THING.", at: 4 })).toBe(wordCacheKey({ word: "thing", sentence: "the thing.", at: 4 }));
    expect(wordCacheKey({ word: "thing", sentence: "a", at: 0 })).not.toBe(wordCacheKey({ word: "thing", sentence: "b", at: 0 }));
    const second = { ...DOLLAR, at: DOLLAR_SENTENCE.lastIndexOf("dollar") };
    expect(wordCacheKey(DOLLAR)).not.toBe(wordCacheKey(second));
    expect(wordCacheKey(DOLLAR).startsWith(`v${WORDS_VERSION}|`)).toBe(true);
    expect(WORDS_VERSION).toBe(2);
    expect(sentenceHash("x")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("an answer, cleaned", () => {
  it("swaps the idiom around a word, as the sentence spells it", () => {
    expect(
      cleanAnswer({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up", "try something new"], note: "" }, THINGS)
    ).toEqual({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up", "try something new"], note: "" });
  });

  it("keeps a word that is already right, with an empty list and a fixed line", () => {
    expect(cleanAnswer({ verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly." }, DOLLAR)).toEqual({
      verdict: "keep",
      replaces: "dollar",
      alternatives: [],
      note: "A currency says it exactly.",
    });
  });

  it("empties a keep's list whatever came with it, and gives an off-list note the default", () => {
    const kept = cleanAnswer({ verdict: "keep", replaces: "dollar", alternatives: ["euro", "buck"], note: "Already precise." }, DOLLAR);
    expect(kept?.alternatives).toEqual([]);
    expect(kept?.note).toBe(DEFAULT_KEEP_NOTE);
    expect(cleanAnswer({ verdict: "keep", replaces: "dollar", alternatives: [], note: "" }, DOLLAR)?.note).toBe(DEFAULT_KEEP_NOTE);
  });

  it("forces a swap's note empty", () => {
    expect(cleanAnswer({ verdict: "swap", replaces: "things", alternatives: ["plans"], note: "It names exactly what you meant." }, THINGS)?.note).toBe("");
  });

  it("holds a swap to one to three options", () => {
    const one = cleanAnswer({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up"], note: "" }, THINGS);
    expect(one?.alternatives).toEqual(["shake things up"]);
    const many = cleanAnswer(
      { verdict: "swap", replaces: "switch things up", alternatives: ["shake things up", "try something new", "start fresh", "change course"], note: "" },
      THINGS
    );
    expect(many?.alternatives).toEqual(["shake things up", "try something new", "start fresh"]);
    expect(WORD_LIMITS.altMin).toBe(1);
    expect(WORD_LIMITS.altMax).toBe(3);
  });

  it("is a failed answer when no option survives, or the verdict or list is not one", () => {
    // Changed in #428: under one is a failure (it was under three).
    expect(cleanAnswer({ verdict: "swap", replaces: "things", alternatives: [], note: "" }, THINGS)).toBeNull();
    expect(cleanAnswer({ verdict: "swap", replaces: "things", alternatives: "plans", note: "" }, THINGS)).toBeNull();
    expect(cleanAnswer({ verdict: "swap", replaces: "things", alternatives: [1, 2, 3], note: "" }, THINGS)).toBeNull();
    expect(cleanAnswer({ verdict: "maybe", replaces: "things", alternatives: ["plans"], note: "" }, THINGS)).toBeNull();
    expect(cleanAnswer({ alternatives: ["points", "ideas", "parts"] }, THINGS)).toBeNull(); // a v1 answer
    expect(cleanAnswer(null, THINGS)).toBeNull();
    expect(cleanAnswer(["plans"], THINGS)).toBeNull();
  });

  it("drops the replaced words, the word itself, dashes, repeats, too-long options and anything vague", () => {
    const cleaned = cleanAnswer(
      {
        verdict: "swap",
        replaces: "switch things up",
        alternatives: [
          "Switch things up",
          "things",
          "shake—things up",
          "shake things up.",
          "Shake things up",
          "do something really new",
          "change loads of stuff",
          "basically start over",
          "like",
          "one two three four five six",
          "x".repeat(41),
          "start fresh",
        ],
        note: "",
      },
      THINGS
    );
    expect(cleaned?.alternatives).toEqual(["shake things up", "start fresh"]);
  });

  it("keeps a vague word the replaced phrase already held, and drops one it brings in", () => {
    const ask: WordAsk = { word: "good", sentence: "The plan was good.", at: 13 };
    expect(cleanAnswer({ verdict: "swap", replaces: "good", alternatives: ["really strong", "sound"], note: "" }, ask)?.alternatives).toEqual(["sound"]);
    // "things" stays in "shake things up": "switch things up" held it.
    expect(cleanAnswer({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up"], note: "" }, THINGS)?.alternatives).toEqual([
      "shake things up",
    ]);
  });

  it("never offers the banned register the sentence did not use", () => {
    const ask: WordAsk = { word: "practice", sentence: "I need more practice.", at: 12 };
    expect(cleanAnswer({ verdict: "swap", replaces: "practice", alternatives: ["training", "workouts", "rehearsal"], note: "" }, ask)?.alternatives).toEqual([
      "rehearsal",
    ]);
  });

  it("keeps a keep for the word when replaces is not in the sentence over it", () => {
    // Not in the sentence at all: a keep is kept for the word.
    expect(cleanAnswer({ verdict: "keep", replaces: "one dollar per hour wage", alternatives: [], note: "A currency says it exactly." }, DOLLAR)?.replaces).toBe(
      "dollar"
    );
    // In the sentence but not over the tapped word: the second "dollar" is not the first.
    const second = { ...DOLLAR, at: DOLLAR_SENTENCE.lastIndexOf("dollar") };
    expect(cleanAnswer({ verdict: "keep", replaces: "billion dollar", alternatives: [], note: "" }, second)?.replaces).toBe("dollar");
    expect(cleanAnswer({ verdict: "keep", alternatives: [], note: "" }, DOLLAR)?.replaces).toBe("dollar");
  });

  it("fails a swap whose replaces is not in the sentence over the word, rather than pin its options on the word", () => {
    // Changed in the #428 review (design §2.3: "swap returns null"). It
    // fell back to the word and kept the options one word long, so
    // "plans", written for a phrase the sentence does not hold, stood in
    // for "things": "I switch plans up", Timothy's screenshot again.
    expect(cleanAnswer({ verdict: "swap", replaces: "switch thing up", alternatives: ["shake things up", "plans"], note: "" }, THINGS)).toBeNull();
    // Half a word is not words of the sentence.
    expect(cleanAnswer({ verdict: "swap", replaces: "witch things", alternatives: ["plans"], note: "" }, THINGS)).toBeNull();
    // Another word of the sentence, or the other "dollar", is not the one tapped.
    expect(cleanAnswer({ verdict: "swap", replaces: "today's", alternatives: ["now"], note: "" }, THINGS)).toBeNull();
    const second = { ...DOLLAR, at: DOLLAR_SENTENCE.lastIndexOf("dollar") };
    expect(cleanAnswer({ verdict: "swap", replaces: "billion dollar", alternatives: ["billion-pound"], note: "" }, second)).toBeNull();
    // Past six words or forty characters, or no replaces at all.
    const sentence = "We went to the shops and then we went to the beach and then home.";
    const beach: WordAsk = { word: "beach", sentence, at: sentence.indexOf("beach") };
    expect(cleanAnswer({ verdict: "swap", replaces: "we went to the beach and then home", alternatives: ["coast"], note: "" }, beach)).toBeNull();
    expect(cleanAnswer({ verdict: "swap", alternatives: ["plans"], note: "" }, THINGS)).toBeNull();
    // The same options for words the sentence does hold over the tap are an answer.
    expect(cleanAnswer({ verdict: "swap", replaces: "Things", alternatives: ["plans"], note: "" }, THINGS)).toEqual({
      verdict: "swap",
      replaces: "things",
      alternatives: ["plans"],
      note: "",
    });
  });

  it("matches replaces whatever its case, quotes or apostrophes, and returns the sentence's own spelling", () => {
    const ask: WordAsk = { word: "thing", sentence: "The thing is, I never had time.", at: 4 };
    expect(cleanAnswer({ verdict: "swap", replaces: "“the thing is,”", alternatives: ["The trouble is"], note: "" }, ask)?.replaces).toBe("The thing is");
    const curly: WordAsk = { word: "things", sentence: "Today’s the day I switch things up.", at: 25 };
    expect(cleanAnswer({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up"], note: "" }, curly)?.replaces).toBe(
      "switch things up"
    );
  });

  it("holds replaces to forty characters and six words", () => {
    const sentence = "We went to the shops and then we went to the beach and then home.";
    const ask: WordAsk = { word: "beach", sentence, at: sentence.indexOf("beach") };
    const long = cleanAnswer({ verdict: "keep", replaces: "we went to the beach and then home", alternatives: [], note: "" }, ask);
    expect(long?.replaces).toBe("beach");
  });

  it("knows when a swap replaces more than the word", () => {
    expect(replacesPhrase({ verdict: "swap", replaces: "switch things up", alternatives: ["shake things up"], note: "" }, "things")).toBe(true);
    expect(replacesPhrase({ verdict: "swap", replaces: "Thing", alternatives: ["Problem"], note: "" }, "thing")).toBe(false);
  });
});

describe("the keep lines", () => {
  it("are full sentences that pass COPY-RULES", () => {
    for (const note of KEEP_NOTES) {
      expect(note, note).toMatch(/^[A-Z][^.!?]*\.$/);
      expect(note).not.toMatch(/[–—]/);
      expect(note).not.toMatch(/\b(gyms?|workouts?|drills?|training|reps?|train)\b/i);
      expect(note).not.toMatch(/\bnot\b/i);
    }
    expect(KEEP_NOTES).toContain(DEFAULT_KEEP_NOTE);
  });
});
