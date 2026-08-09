import { describe, expect, it } from "vitest";
import {
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

describe("pauseScore", () => {
  it("starts at the 60 baseline with no held pauses", () => {
    expect(pauseScore([], 60)).toBe(60);
  });

  it("rewards composed pauses at +8 each, capped at 5", () => {
    expect(pauseScore([pre(10)], 60)).toBe(68);
    const seven = [10, 15, 20, 25, 30, 35, 40].map((t) => pre(t));
    expect(pauseScore(seven, 60)).toBe(100); // 60 + 40, clamped
  });

  it("punishes long mid-sentence gaps at -10", () => {
    expect(pauseScore([mid(10, 2.0)], 60)).toBe(50);
    expect(pauseScore([mid(10, 1.2)], 60)).toBe(60); // ≤1.5s mid gap: no hit
  });

  it("bonuses a composed pause that lands the ending", () => {
    expect(pauseScore([pre(55)], 60)).toBe(73); // 60 + 8 + 5 (t ≥ 80% of 60)
  });

  it("ignores held pauses beyond 2.5s for the composed reward", () => {
    expect(pauseScore([pre(10, 3.0)], 60)).toBe(60);
  });
});

describe("fillerScore", () => {
  it("maps the fpm curve: 0 → 100, 4 → 50, ≥8 → 0", () => {
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
  it("weights all eight dimensions to /1000", () => {
    const tier1 = { pause: 100, fillers: 100, pace: 100, range: 100 };
    const tier2 = {
      structure: 100,
      credibility: 100,
      engagement: 100,
      confidence: 100,
    };
    expect(ethosIndex(tier1, tier2)).toBe(1000);
    expect(
      ethosIndex(
        { pause: 50, fillers: 50, pace: 50, range: 50 },
        { structure: 50, credibility: 50, engagement: 50, confidence: 50 }
      )
    ).toBe(500);
  });

  it("applies the published weights", () => {
    // Only pause at 100, everything else 0 → 150/1000.
    expect(
      ethosIndex(
        { pause: 100, fillers: 0, pace: 0, range: 0 },
        { structure: 0, credibility: 0, engagement: 0, confidence: 0 }
      )
    ).toBe(150);
  });

  it("returns null without judged scores — no partial index", () => {
    expect(
      ethosIndex({ pause: 100, fillers: 100, pace: 100, range: 100 }, null)
    ).toBeNull();
  });
});
