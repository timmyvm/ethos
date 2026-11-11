import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepResult, type ResultView } from "@/components/RepResult";
import type { RepMetrics, Word } from "./metrics";

/*
 * The Log's stored recording (`/rep/[id]`) and an upload render RepResult
 * with section="all". The glance and its sheet (DECISIONS #427) gave the
 * live results their own sections; this holds "all" to its markup, so a
 * change meant for the live results never moves the Log's page.
 *
 * The baseline moved once, on purpose (Timothy, 12 Nov, #436): the pause
 * map and the three stat tiles went, their numbers became one line under
 * "Every dimension", and a stored line that names a tomorrow is drawn in
 * two parts. The tests under the snapshots say those three in words.
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
  it("renders exactly as it did at #436", () => {
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

  /* Timothy, 12 Nov (#436), each in his words. */
  const html = (v: ResultView) => renderToStaticMarkup(createElement(RepResult, { result: v, section: "all" }));
  const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

  it("draws no pause map (\"the recording lines. get rid of it\")", () => {
    const h = html(view);
    // The map's own key, a swatch and a word each, is nowhere on the page.
    expect(h).not.toMatch(/>\s*searching\s*</);
    expect(h).not.toMatch(/>\s*landed a point\s*</);
    // The sentence that read off the map went from under it; the Pausing
    // row still opens on it, once.
    expect(text(h).split("Three silences landed a point; one was searching.").length - 1).toBe(1);
  });

  it("says length, pace and held pauses once, as a line, where three tiles stood", () => {
    const h = html(view);
    expect(h).not.toContain("label-micro whitespace-nowrap");
    expect(h).not.toContain(">WPM<");
    expect(h).not.toContain(">Held pauses<");
    const line = /<p data-take-line="true"[^>]*>([^<]+)<\/p>/.exec(h)?.[1];
    expect(line).toBe(`${Math.round(metrics.durationS)} seconds at ${Math.round(metrics.wpm)} words a minute, with ${metrics.heldPauses} held pause${metrics.heldPauses === 1 ? "" : "s"}.`);
  });

  it("draws a stored line's tomorrow as its own statement, under its own label", () => {
    const told: ResultView = {
      ...view,
      coach: {
        ...(view.coach as object),
        focus: "7 mid-sentence pauses against 1 composed pause. Tomorrow: finish each sentence in one breath, then pause.",
      } as unknown as ResultView["coach"],
    };
    const h = html(told);
    expect(h).toContain('<p class="text-balance">7 mid-sentence pauses against 1 composed pause.</p>');
    expect(h).toContain('<span class="eyebrow block">Tomorrow</span>');
    expect(h).toContain('<span class="mt-0.5 block font-semibold text-balance">Finish each sentence in one breath, then pause.</span>');
    // The word is the label now, so the line does not say it twice.
    expect(text(h)).not.toContain("Tomorrow:");
  });

  it("leaves a line that names no tomorrow as one paragraph", () => {
    const h = html(view);
    expect(h).not.toContain(">Tomorrow<");
    expect(text(h)).toContain("Kill ‘um’. 2 of your 4 fillers.");
  });
});
