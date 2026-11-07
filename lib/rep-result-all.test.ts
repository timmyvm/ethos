import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepResult, type ResultView } from "@/components/RepResult";
import type { RepMetrics, Word } from "./metrics";

/*
 * The Log's stored recording (`/rep/[id]`) and an upload render RepResult
 * with section="all". The glance and its sheet (DECISIONS #427) gave the
 * live results their own sections; this holds "all" to the markup it had
 * at e2fd1cd, recorded before the change, so the Log's page is the page
 * it was.
 */
const TRANSCRIPT =
  "So the thing about habits is, um, they compound. You do the small version every day and, like, it builds on its own. Um, the mistake people make is waiting to feel ready. You know, ready is a feeling that shows up after you start.";
const WORDS: Word[] = (() => {
  const raw = TRANSCRIPT.match(/[A-Za-z0-9']+/g) ?? [];
  const spaced = TRANSCRIPT.split(/\s+/);
  let t = 0.4;
  return raw.map((word, i) => {
    const w = { word, start: Math.round(t * 100) / 100, end: Math.round((t + 0.3) * 100) / 100 };
    t += 0.38 + (/[.?!]/.test(spaced[i] ?? "") ? 0.9 : 0);
    return w;
  });
})();
const metrics = {
  durationS: 62,
  wordCount: WORDS.length,
  wpm: 145,
  fillerCount: 4,
  fillersPerMin: 3.9,
  fillers: [
    { word: "um", t: 2.68 },
    { word: "like", t: 7.9 },
    { word: "um", t: 10.6 },
    { word: "you know", t: 15.9 },
  ],
  fillerCounts: { um: 2, like: 1, "you know": 1 },
  topFiller: "um",
  filledPauseCount: 2,
  filledPer100: 4,
  repairCount: 1,
  repairsPerMin: 1,
  unvoicedHesitations: 1,
  disfluenciesPerMin: 4.8,
  pauses: [
    { t: 2.1, len: 1.2, kind: "pre", verdict: "opening" },
    { t: 20, len: 0.9, kind: "mid" },
    { t: 41, len: 1.5, kind: "pre", verdict: "landing" },
    { t: 58, len: 1.1, kind: "pre" },
  ],
  heldPauses: 4,
  composedPauses: 3,
  midSentencePauses: 1,
  stars: 2,
  substance: { wordCount: WORDS.length, distinctRatio: 0.62, repeatShare: 0.05 },
} as unknown as RepMetrics;
const dim = (score: number, citedMoment: string) => ({ score, citedMoment, improve: "Open with the claim, then the example." });
const view: ResultView = {
  transcript: TRANSCRIPT,
  words: WORDS,
  repId: "rep-22",
  metrics,
  tier1: { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 },
  anchors: { hedgeCount: 2, restartCount: 1 },
  coach: {
    focus: "Kill ‘um’. 2 of your 4 fillers.",
    strength: "Held the pause before ‘the mistake people make’.",
    supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
    coachLine: "",
    dimensions: {
      structure: dim(64, '"the mistake people make is waiting to feel ready"'),
      credibility: dim(58, '"ready is a feeling that shows up after you start"'),
      engagement: dim(61, '"the big version arrives on its own"'),
      confidence: dim(66, '"you do the small version every day"'),
    },
  } as unknown as ResultView["coach"],
  ethosIndex: 665,
  previousIndex: 662,
  scorable: true,
  pauseHeadline: "Three silences landed a point; one was searching.",
};

describe("RepResult section=\"all\", the Log's page (#427)", () => {
  it("renders exactly as it did at e2fd1cd", () => {
    expect(renderToStaticMarkup(createElement(RepResult, { result: view, section: "all" }))).toMatchSnapshot();
  });
  it("and a stored recording that could not be scored, likewise", () => {
    const unscored: ResultView = {
      ...view,
      metrics: { ...metrics, substance: { wordCount: 12, distinctRatio: 0.9, repeatShare: 0 }, stars: 1 } as RepMetrics,
      ethosIndex: null,
      coach: null,
      scorable: false,
    };
    expect(renderToStaticMarkup(createElement(RepResult, { result: unscored, section: "all" }))).toMatchSnapshot();
  });
});
