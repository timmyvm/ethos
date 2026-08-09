import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  detectFillers,
  detectPauses,
  normalizeWord,
  starsForFillerRate,
  type Segment,
  type Word,
} from "./metrics";

/** Build a Word[] from "text|start|end" tuples for readable fixtures. */
function w(...tuples: [string, number, number][]): Word[] {
  return tuples.map(([word, start, end]) => ({ word, start, end }));
}

/** Evenly spaced words, 0.3s each, no gaps — for filler-only tests. */
function flow(text: string): Word[] {
  return text.split(/\s+/).map((word, i) => ({
    word,
    start: i * 0.3,
    end: i * 0.3 + 0.28,
  }));
}

describe("normalizeWord", () => {
  it("strips whisper's leading spaces and punctuation", () => {
    expect(normalizeWord(" Hello,")).toBe("hello");
    expect(normalizeWord(" Um,")).toBe("um");
    expect(normalizeWord("world.")).toBe("world");
    expect(normalizeWord("don't")).toBe("don't");
  });
});

describe("detectFillers", () => {
  it("counts simple fillers with positions", () => {
    const words = w(["So", 0, 0.2], [" um,", 0.3, 0.5], [" my", 0.6, 0.7], [" um", 0.9, 1.0]);
    const { fillers, fillerCounts } = detectFillers(words);
    expect(fillerCounts["um"]).toBe(2);
    expect(fillers.map((f) => f.t)).toEqual([0.3, 0.9]);
  });

  it("matches multi-word fillers once, not as singles", () => {
    const { fillers, fillerCounts } = detectFillers(
      flow("it was you know pretty hard sort of difficult kind of weird")
    );
    expect(fillerCounts["you know"]).toBe(1);
    expect(fillerCounts["sort of"]).toBe(1);
    expect(fillerCounts["kind of"]).toBe(1);
    expect(fillers).toHaveLength(3);
  });

  it("counts hedge/emphasis fillers", () => {
    const { fillerCounts } = detectFillers(
      flow("it was basically literally actually fine")
    );
    expect(fillerCounts["basically"]).toBe(1);
    expect(fillerCounts["literally"]).toBe(1);
    expect(fillerCounts["actually"]).toBe(1);
  });

  it("counts bare filler 'like'", () => {
    const { fillerCounts } = detectFillers(
      flow("it was like so hard and I like couldn't even")
    );
    expect(fillerCounts["like"]).toBe(2);
  });

  it("skips comparison 'like' followed by a noun phrase", () => {
    const { fillerCounts } = detectFillers(
      flow("an app like a gym for speaking")
    );
    expect(fillerCounts["like"]).toBeUndefined();
  });

  it("skips perception-verb 'like' (feels like, looks like)", () => {
    const { fillerCounts } = detectFillers(
      flow("it feels like home and looks like rain")
    );
    expect(fillerCounts["like"]).toBeUndefined();
  });

  it("skips verb 'like to'", () => {
    const { fillerCounts } = detectFillers(flow("I would like to explain"));
    expect(fillerCounts["like"]).toBeUndefined();
  });

  it("still counts 'like' after a sentence boundary", () => {
    // "...I froze. Like, it was bad." — prev word "froze." ends a sentence,
    // so there is no comparison reading even though 'froze' isn't a skip word.
    const words = w(
      ["I", 0, 0.2],
      [" froze.", 0.3, 0.6],
      [" Like,", 0.8, 1.0],
      [" it", 1.1, 1.2],
      [" was", 1.3, 1.4],
      [" bad.", 1.5, 1.8]
    );
    const { fillerCounts } = detectFillers(words);
    expect(fillerCounts["like"]).toBe(1);
  });
});

describe("detectPauses", () => {
  it("ignores gaps under 0.3s", () => {
    const words = w(["a", 0, 0.2], ["b", 0.4, 0.6], ["c", 0.85, 1.0]);
    expect(detectPauses(words)).toHaveLength(0);
  });

  it("classifies 0.3–0.8s gaps as beats", () => {
    const words = w(["a", 0, 0.2], ["b", 0.7, 0.9]);
    const pauses = detectPauses(words);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]).toMatchObject({ kind: "beat", t: 0.2, len: 0.5 });
  });

  it("classifies a held pause after sentence-final punctuation as pre", () => {
    const words = w(["done.", 0, 0.4], [" Next", 1.5, 1.8]);
    const pauses = detectPauses(words);
    expect(pauses[0].kind).toBe("pre");
    expect(pauses[0].len).toBe(1.1);
  });

  it("classifies a held pause inside a sentence as mid", () => {
    const words = w(["the", 0, 0.2], [" thing", 1.2, 1.5]);
    const pauses = detectPauses(words);
    expect(pauses[0].kind).toBe("mid");
  });

  it("uses segment starts when punctuation is missing", () => {
    const words = w(["done", 0, 0.4], [" next", 1.5, 1.8]);
    const segments: Segment[] = [
      { start: 0, end: 0.4, text: "done" },
      { start: 1.5, end: 1.8, text: "next" },
    ];
    const pauses = detectPauses(words, segments);
    expect(pauses[0].kind).toBe("pre");
  });
});

describe("starsForFillerRate", () => {
  it("applies BUILD-PLAN thresholds", () => {
    expect(starsForFillerRate(0)).toBe(3);
    expect(starsForFillerRate(2.99)).toBe(3);
    expect(starsForFillerRate(3)).toBe(2);
    expect(starsForFillerRate(5.99)).toBe(2);
    expect(starsForFillerRate(6)).toBe(1);
    expect(starsForFillerRate(20)).toBe(1);
  });
});

describe("computeMetrics", () => {
  it("computes wpm from word count and duration", () => {
    const words = flow("one two three four five six seven eight nine ten");
    const m = computeMetrics(words, 60);
    expect(m.wpm).toBe(10);
    expect(m.wordCount).toBe(10);
  });

  it("hand-count parity: the BUILD-PLAN demo transcript", () => {
    // 60s rep, 8 fillers by hand: um x3, like x2 (bare), basically,
    // kind of, you know. "like building" counts (no skip cue);
    // "like a gym" does not.
    const text =
      "so um my name is tim and i'm like building an app called ethos " +
      "which is um basically like a gym for speaking you know it um " +
      "kind of measures your fillers";
    const m = computeMetrics(flow(text), 60);
    expect(m.fillerCounts).toEqual({
      um: 3,
      like: 1,
      basically: 1,
      "kind of": 1,
      "you know": 1,
    });
    expect(m.fillerCount).toBe(7);
    expect(m.fillersPerMin).toBe(7);
    expect(m.stars).toBe(1);
    expect(m.topFiller).toBe("um");
  });

  it("a clean rep earns 3 stars", () => {
    const m = computeMetrics(
      flow("today I want to explain how compound interest works over time"),
      60
    );
    expect(m.fillerCount).toBe(0);
    expect(m.stars).toBe(3);
    expect(m.topFiller).toBeNull();
  });

  it("counts held pauses by kind", () => {
    const words = w(
      ["First.", 0, 0.5],
      [" Then", 1.6, 1.9], // 1.1s after "First." → pre
      [" the", 2.0, 2.1],
      [" point", 3.3, 3.6], // 1.2s inside sentence → mid
      [" lands.", 3.7, 4.0]
    );
    const m = computeMetrics(words, 30);
    expect(m.heldPauses).toBe(2);
    expect(m.composedPauses).toBe(1);
    expect(m.midSentencePauses).toBe(1);
  });

  it("survives an empty transcript", () => {
    const m = computeMetrics([], 0);
    expect(m.wpm).toBe(0);
    expect(m.fillerCount).toBe(0);
    expect(m.stars).toBe(3); // 0 fillers/min — thresholds stay objective
  });

  it("falls back to last word end when duration is missing", () => {
    const words = w(["a", 0, 0.2], ["b", 0.4, 30]);
    const m = computeMetrics(words, 0);
    expect(m.durationS).toBe(30);
    expect(m.wpm).toBe(4);
  });

  it("handles whisper-shaped input: unpunctuated words + segments", () => {
    // whisper-1 word timestamps often strip punctuation entirely; sentence
    // structure then comes only from segments. Two sentences, a held pause
    // between them (pre), a held pause inside the second one (mid), and a
    // filler whisper kept verbatim.
    const words = w(
      ["My", 0.0, 0.2],
      ["name", 0.25, 0.5],
      ["is", 0.55, 0.7],
      ["Tim", 0.75, 1.1],
      // 1.3s held pause across the sentence boundary
      ["um", 2.4, 2.6],
      ["I", 2.7, 2.8],
      ["build", 2.85, 3.2],
      // 0.9s held pause mid-sentence
      ["apps", 4.1, 4.5]
    );
    const segments: Segment[] = [
      { start: 0.0, end: 1.1, text: " My name is Tim." },
      { start: 2.4, end: 4.5, text: " um I build apps" },
    ];
    const m = computeMetrics(words, 4.5, segments);
    expect(m.fillerCounts).toEqual({ um: 1 });
    expect(m.composedPauses).toBe(1);
    expect(m.midSentencePauses).toBe(1);
    expect(m.pauses.map((p) => p.kind)).toEqual(["pre", "mid"]);
  });
});
