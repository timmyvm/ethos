import { describe, expect, it } from "vitest";
import { SHAPED_TAKE, whisperTake } from "./__fixtures__/whisper-take";
import type { Segment, Word } from "./metrics";
import { gapEndsSentence, sentenceEnds } from "./sentence-ends";

/** Words said back to back, 0.3s each, as Whisper's list writes them: no punctuation. */
function said(text: string, from = 0): Word[] {
  return text.split(" ").map((word, i) => ({ word, start: from + i * 0.4, end: from + i * 0.4 + 0.3 }));
}

/** Which words a sentence ends after, as "word." in the list. */
function marked(words: Word[], stops: (boolean | null)[]): string {
  return words.map((w, i) => (stops[i] === null ? `${w.word}?` : stops[i] ? `${w.word}.` : w.word)).join(" ");
}

describe("a sentence end, from the segment text", () => {
  it("puts each full stop, question mark and exclamation after its word", () => {
    const words = said("I timed it Did anyone leave No one did");
    const segments: Segment[] = [{ start: 0, end: 4, text: " I timed it. Did anyone leave? No one did!" }];
    const { marks, aligned } = sentenceEnds(words, segments);
    expect(aligned).toBe(1);
    expect(marked(words, marks)).toBe("I timed it. Did anyone leave. No one did.");
  });

  it("ignores the \"...\" Whisper writes where you hesitate", () => {
    const words = said("I was thinking like the point");
    const segments: Segment[] = [{ start: 0, end: 3, text: " I was thinking... like, the point…" }];
    expect(marked(words, sentenceEnds(words, segments).marks)).toBe("I was thinking like the point");
    // "...?" is still a question.
    const asked = said("Was it right");
    expect(
      marked(asked, sentenceEnds(asked, [{ start: 0, end: 2, text: " Was it...?" }, { start: 0.7, end: 1.2, text: " Right." }]).marks)
    ).toBe("Was it. right.");
  });

  it("reads contractions, numbers and split words by their letters", () => {
    const words = said("I've timed 3.5 seconds in 2019 it's five minute work");
    const segments: Segment[] = [{ start: 0, end: 5, text: " I've timed 3.5 seconds in 2019. It's five-minute work." }];
    const { marks, aligned } = sentenceEnds(words, segments);
    expect(aligned).toBe(1);
    expect(marked(words, marks)).toBe("I've timed 3.5 seconds in 2019. it's five minute work.");
  });

  it("does not end a sentence inside a number the list split", () => {
    const words = said("about 3 5 seconds");
    const segments: Segment[] = [{ start: 0, end: 2, text: " about 3.5 seconds." }];
    expect(marked(words, sentenceEnds(words, segments).marks)).toBe("about 3 5 seconds.");
    expect(gapEndsSentence(".", "3", "5")).toBe(false);
    expect(gapEndsSentence(". ", "2019", "5")).toBe(true);
  });

  it("does not take a segment's end for a sentence's end", () => {
    const words = [...said("and then I", 0), ...said("forgot the rest", 3)];
    const segments: Segment[] = [
      { start: 0, end: 1.1, text: " and then I" },
      { start: 3, end: 4.1, text: " forgot the rest." },
    ];
    const { marks, stops } = sentenceEnds(words, segments);
    expect(marked(words, marks)).toBe("and then I forgot the rest.");
    expect(stops[2]).toBe(false);
  });

  it("lines a segment up with its words when Whisper times them a little apart", () => {
    // The segment starts where the last one ended, 0.9s before its first word.
    const words = [...said("We stopped", 0), ...said("Then we started again", 1.9)];
    const segments: Segment[] = [
      { start: 0, end: 0.8, text: " We stopped." },
      { start: 0.8, end: 3.4, text: " Then we started again." },
    ];
    const { marks, aligned } = sentenceEnds(words, segments);
    expect(aligned).toBe(2);
    expect(marked(words, marks)).toBe("We stopped. Then we started again.");
  });

  it("aligns a repeated segment to the copy nearest its start", () => {
    const words = [...said("Yes", 0), ...said("yes", 0.6), ...said("we did", 1.2)];
    const segments: Segment[] = [
      { start: 0, end: 0.3, text: " Yes," },
      { start: 0.6, end: 0.9, text: " yes." },
      { start: 1.2, end: 2, text: " we did" },
    ];
    expect(marked(words, sentenceEnds(words, segments).marks)).toBe("Yes yes. we did");
  });
});

describe("more of Whisper's spellings", () => {
  it("reads money, thousands, times and a curly apostrophe without a false stop", () => {
    const words = said("it’s 1,000 people at $20 by 9:30");
    const segments: Segment[] = [{ start: 0, end: 4, text: " It’s 1,000 people at $20 by 9:30." }];
    expect(marked(words, sentenceEnds(words, segments).marks)).toBe("it’s 1,000 people at $20 by 9:30.");
  });

  it("takes ?! and a quoted question as ends, and a dash only the text has as nothing", () => {
    const words = said("Why she asked we stopped then we went");
    const segments: Segment[] = [{ start: 0, end: 4, text: ' "Why?" she asked. We stopped?! Then — we went…' }];
    const { marks, aligned } = sentenceEnds(words, segments);
    expect(aligned).toBe(1);
    // "…" at the end of the segment is a trail-off, not a full stop.
    expect(marked(words, marks)).toBe("Why. she asked. we stopped. then we went");
  });

  it("lines up a segment only within a second of its first word, and otherwise keeps the rule before", () => {
    const words = said("we stopped then we went");
    const text = " We stopped. Then we went.";
    expect(sentenceEnds(words, [{ start: 0.9, end: 2, text }]).aligned).toBe(1);
    const late = sentenceEnds(words, [{ start: 1.2, end: 2, text }]);
    expect(late.aligned).toBe(0);
    expect(marked(words, late.marks)).toBe("we? stopped? then? we? went?");
  });

  it("skips a segment with no text, and a segment Whisper repeats whole aligns once more to the same words", () => {
    const words = said("we stopped okay");
    const segments: Segment[] = [
      { start: 0, end: 0.7, text: " We stopped." },
      { start: 0, end: 0.7, text: " We stopped." },
      { start: 0.8, end: 1.1, text: "" },
    ];
    const { marks, aligned } = sentenceEnds(words, segments);
    expect(aligned).toBe(2);
    expect(marked(words, marks)).toBe("we stopped. okay?");
  });

  it("reads an abbreviation's full stop as a sentence end: the known miss, pinned so a fix is a decision", () => {
    const words = said("in the U.S. we stopped");
    const segments: Segment[] = [{ start: 0, end: 3, text: " In the U.S. we stopped." }];
    expect(marked(words, sentenceEnds(words, segments).marks)).toBe("in the U.S.. we stopped.");
  });
});

describe("a segment whose text and words disagree", () => {
  const words = [...said("we had", 0), ...said("20 people stayed", 1.5), ...said("and then", 3.5)];
  const segments: Segment[] = [
    { start: 0, end: 0.7, text: " We had" },
    { start: 1.5, end: 2.6, text: " Twenty people stayed." },
    { start: 3.5, end: 4.2, text: " And then." },
  ];

  it("aligns nothing in it, and only it", () => {
    const { marks, aligned } = sentenceEnds(words, segments);
    expect(aligned).toBe(2);
    expect(marked(words, marks)).toBe("we had 20? people? stayed? and then.");
  });

  it("keeps the rule used before: the next word starting a segment", () => {
    const { stops } = sentenceEnds(words, segments);
    // "stayed" is followed by "and", which starts a segment.
    expect(stops.map((s, i) => (s ? words[i].word : "")).filter(Boolean)).toEqual(["stayed", "then"]);
  });
});

describe("with no segments", () => {
  it("reads a word's own punctuation, as before", () => {
    const words: Word[] = [
      { word: "Done.", start: 0, end: 0.4 },
      { word: " next", start: 1.5, end: 1.8 },
    ];
    expect(sentenceEnds(words).stops).toEqual([true, false]);
    expect(sentenceEnds(words).marks).toEqual([null, null]);
  });
});

describe("the shaped take", () => {
  it("knows where each of its sentences ends", () => {
    const take = whisperTake(SHAPED_TAKE);
    const { marks, stops, aligned, segments } = sentenceEnds(take.words, take.segments);
    expect([aligned, segments]).toEqual([6, 7]);
    const ends = take.words.flatMap((w, i) => (stops[i] ? [w.word] : []));
    // "say..." is not one; "thing" ends the segment that did not align and
    // keeps the segment-start rule; "them" closes the last segment.
    expect(ends).toEqual(["talk", "losing", "left", "thing", "them", "lands", "them"]);
    expect(marks[take.words.findIndex((w) => w.word === "thing")]).toBeNull();
    expect(marks[take.words.findIndex((w) => w.word === "say")]).toBe(false);
  });
});
