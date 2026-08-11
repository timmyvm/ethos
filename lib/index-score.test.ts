import { describe, expect, it } from "vitest";
import {
  dimensionPoints,
  INDEX_WEIGHTS,
  REPAIR_ZERO_AT,
  repairScore,
  countHedges,
  countRestarts,
  ethosIndex,
  fillerScore,
  pauseScore,
  paceScore,
  rangeScore,
} from "./index-score";
import type { Pause, Segment, Word } from "./metrics";

const pre = (t: number, len = 1.2): Pause => ({ t, len, kind: "pre" });
const mid = (t: number, len = 2.0): Pause => ({ t, len, kind: "mid" });

/**
 * These five tests used to assert the 60-point baseline, +8 per
 * pre-sentence gap, and no penalty for a mid-sentence gap under 1.5s.
 * They were encoding the reported bug rather than a requirement: a rep
 * of five slow starts scored the same 100 as a rep of five landed
 * points, because the score asked whether a pause existed and never
 * whether it was earned. Placement lives in `pause-quality.ts` now and
 * is tested there against real word streams; what stays here is the
 * contract the Index depends on.
 */
describe("pauseScore", () => {
  it("does not hand out a baseline for silence that never happened", () => {
    expect(pauseScore([], 60)).toBeLessThan(40);
  });

  it("cannot credit a pause without the words around it", () => {
    // No word stream means no sentence boundaries to land against, so a
    // bare pre-flagged gap earns nothing. Better a low score than a
    // confident one built on an assumption.
    expect(pauseScore([pre(10)], 60, [], [])).toBeLessThan(60);
  });

  it("stays inside 0–100 whatever it is handed", () => {
    const many = [10, 15, 20, 25, 30, 35, 40].map((t) => pre(t));
    const s = pauseScore(many, 60);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(pauseScore([mid(10, 2.0)], 60)).toBeGreaterThanOrEqual(0);
  });
});

describe("fillerScore", () => {
  it("maps the filler curve: 0 → 100, 4 → 50, ≥8 → 0", () => {
    expect(fillerScore(0)).toBe(100);
    expect(fillerScore(4)).toBe(50);
    expect(fillerScore(8)).toBe(0);
    expect(fillerScore(12)).toBe(0);
  });
});

describe("paceScore", () => {
  it("gives in-zone pace the 90 base", () => {
    expect(paceScore(145, [], [])).toBe(90);
  });

  it("penalizes distance from the 130–160 zone", () => {
    expect(paceScore(110, [], [])).toBe(50); // 20 under → −40
    expect(paceScore(180, [], [])).toBe(50); // 20 over → −40
  });

  it("adds the variance bonus for pace that moves", () => {
    // Three segments at meaningfully different rates around 145 wpm.
    const segments: Segment[] = [
      { start: 0, end: 10, text: "a" },
      { start: 10, end: 20, text: "b" },
      { start: 20, end: 30, text: "c" },
    ];
    const words: Word[] = [];
    const put = (seg: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const t = seg * 10 + (i * 10) / count;
        words.push({ word: "w", start: t, end: t + 0.1 });
      }
    };
    put(0, 20); // 120 wpm
    put(1, 25); // 150 wpm
    put(2, 30); // 180 wpm
    expect(paceScore(150, words, segments)).toBe(100);
  });
});

describe("rangeScore", () => {
  const w = (text: string): Word[] =>
    text.split(/\s+/).map((word, i) => ({
      word,
      start: i * 0.3,
      end: i * 0.3 + 0.25,
    }));

  it("scores varied vocabulary high", () => {
    expect(
      rangeScore(
        w(
          "today I want to explain how compound interest quietly builds wealth over decades for patient investors"
        )
      )
    ).toBeGreaterThanOrEqual(95);
  });

  it("punishes repeated phrases and crutch words", () => {
    const repetitive = w(
      "it was really good really good stuff you see it was really good really good stuff you see it was really good really good stuff you see"
    );
    expect(rangeScore(repetitive)).toBeLessThan(45);
  });

  it("returns neutral 50 for reps too short to judge", () => {
    expect(rangeScore(w("too short to judge"))).toBe(50);
  });
});

describe("tier-2 anchors", () => {
  it("counts hedges from the mechanics list", () => {
    expect(
      countHedges("I guess it works. Maybe. I feel like it's sort of done.")
    ).toBe(4);
  });

  it("counts immediate restarts and correction markers", () => {
    const words: Word[] = [
      { word: "I", start: 0, end: 0.1 },
      { word: "I", start: 0.2, end: 0.3 },
      { word: "went", start: 0.4, end: 0.6 },
      { word: "the", start: 0.7, end: 0.8 },
      { word: "the", start: 0.9, end: 1.0 },
      { word: "store", start: 1.1, end: 1.4 },
    ];
    expect(countRestarts(words, "I I went the the store I mean the shop")).toBe(
      3
    );
  });
});

describe("ethosIndex", () => {
  it("weights every dimension to /1000", () => {
    const tier1 = { pause: 100, fillers: 100, repairs: 100, pace: 100, range: 100 };
    const tier2 = {
      structure: 100,
      credibility: 100,
      engagement: 100,
      confidence: 100,
    };
    expect(ethosIndex(tier1, tier2)).toBe(1000);
    expect(
      ethosIndex(
        { pause: 50, fillers: 50, repairs: 50, pace: 50, range: 50 },
        { structure: 50, credibility: 50, engagement: 50, confidence: 50 }
      )
    ).toBe(500);
  });

  it("applies the published weights", () => {
    // Only pause at 100, everything else 0 → 150/1000.
    expect(
      ethosIndex(
        { pause: 100, fillers: 0, repairs: 0, pace: 0, range: 0 },
        { structure: 0, credibility: 0, engagement: 0, confidence: 0 }
      )
    ).toBe(150);
  });

  it("returns null without judged scores — no partial index", () => {
    expect(
      ethosIndex(
        { pause: 100, fillers: 100, repairs: 100, pace: 100, range: 100 },
        null
      )
    ).toBeNull();
  });
});

/**
 * The results screen lists each dimension against its own denominator so
 * the breakdown visibly adds up to the Index. If the two round
 * differently the user sees eight numbers that miss the total — the
 * exact "800 should be the max, why doesn't this add up" problem the
 * breakdown exists to answer.
 */
describe("the parts add up to the whole", () => {
  it("matches the sum of the per-dimension points exactly", () => {
    const tier1 = { pause: 83, fillers: 67, repairs: 50, pace: 86, range: 95 };
    const tier2 = {
      structure: 72,
      credibility: 71,
      engagement: 72,
      confidence: 73,
    };
    const total = ethosIndex(tier1, tier2);
    const parts =
      dimensionPoints(tier1.pause, INDEX_WEIGHTS.pause) +
      dimensionPoints(tier1.fillers, INDEX_WEIGHTS.fillers) +
      dimensionPoints(tier1.repairs, INDEX_WEIGHTS.repairs) +
      dimensionPoints(tier1.pace, INDEX_WEIGHTS.pace) +
      dimensionPoints(tier1.range, INDEX_WEIGHTS.range) +
      dimensionPoints(tier2.structure, INDEX_WEIGHTS.structure) +
      dimensionPoints(tier2.credibility, INDEX_WEIGHTS.credibility) +
      dimensionPoints(tier2.engagement, INDEX_WEIGHTS.engagement) +
      dimensionPoints(tier2.confidence, INDEX_WEIGHTS.confidence);
    expect(total).toBe(parts);
  });

  it("holds on awkward scores that round in different directions", () => {
    const tier1 = { pause: 33, fillers: 67, repairs: 33, pace: 1, range: 99 };
    const tier2 = {
      structure: 33,
      credibility: 67,
      engagement: 1,
      confidence: 99,
    };
    const parts = Object.entries(INDEX_WEIGHTS).reduce((sum, [dim, w]) => {
      const all: Record<string, number> = { ...tier1, ...tier2 };
      return sum + dimensionPoints(all[dim], w);
    }, 0);
    expect(ethosIndex(tier1, tier2)).toBe(parts);
  });

  it("still tops out at 1000 with every dimension perfect", () => {
    expect(
      ethosIndex(
        { pause: 100, fillers: 100, repairs: 100, pace: 100, range: 100 },
        { structure: 100, credibility: 100, engagement: 100, confidence: 100 }
      )
    ).toBe(1000);
  });
});

/**
 * Fillers and self-corrections were briefly one blended score. They are
 * different problems with different fixes — an "um" is a gap you filled,
 * a repair is a sentence you abandoned — so they are scored apart, and
 * the 150 they used to share is split rather than grown.
 */
describe("fillers and repairs are scored apart", () => {
  it("splits the old 150 without changing the total", () => {
    expect(INDEX_WEIGHTS.fillers + INDEX_WEIGHTS.repairs).toBe(150);
    const total = Object.values(INDEX_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
  });

  it("runs the repair scale out at 3/min, not 8", () => {
    expect(repairScore(0)).toBe(100);
    expect(repairScore(1)).toBe(67);
    expect(repairScore(REPAIR_ZERO_AT)).toBe(0);
    expect(repairScore(9)).toBe(0);
  });

  it("costs a repair more per occurrence than a filler", () => {
    const fillerLoss =
      dimensionPoints(fillerScore(0), INDEX_WEIGHTS.fillers) -
      dimensionPoints(fillerScore(1), INDEX_WEIGHTS.fillers);
    const repairLoss =
      dimensionPoints(repairScore(0), INDEX_WEIGHTS.repairs) -
      dimensionPoints(repairScore(1), INDEX_WEIGHTS.repairs);
    expect(repairLoss).toBeGreaterThan(fillerLoss);
  });

  it("lets a clean-of-fillers rep still lose points for restarting", () => {
    const clean = { pause: 80, fillers: 100, repairs: 100, pace: 80, range: 80 };
    const restarting = { ...clean, repairs: repairScore(2) };
    const judged = {
      structure: 70,
      credibility: 70,
      engagement: 70,
      confidence: 70,
    };
    expect(ethosIndex(restarting, judged)!).toBeLessThan(
      ethosIndex(clean, judged)!
    );
  });

  it("returns null for a rep stored before the split rather than guessing", () => {
    expect(
      ethosIndex(
        { pause: 80, fillers: 80, pace: 80, range: 80 },
        { structure: 70, credibility: 70, engagement: 70, confidence: 70 }
      )
    ).toBeNull();
  });
});
