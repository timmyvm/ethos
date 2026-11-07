import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepResult, type GlanceView, type ResultView } from "@/components/RepResult";
import { countWords, fitGlance, glanceLine, sheetSections } from "./glance";
import { computeMetrics, type RepMetrics } from "./metrics";

/*
 * The glance and its sheet (DECISIONS #427), rendered: what goes on the
 * first screen and what is behind the door, in order.
 */
const metrics: RepMetrics = {
  ...computeMetrics([], 62),
  durationS: 62,
  wpm: 145,
  fillerCount: 4,
  fillersPerMin: 3.9,
  fillers: [
    { word: "um", t: 2.68 },
    { word: "like", t: 7.9 },
    { word: "um", t: 10.6 },
    { word: "you know", t: 15.9 },
  ],
  topFiller: "um",
  stars: 2,
  substance: { wordCount: 121, distinctRatio: 0.62, repeatShare: 0.05 },
};
const dim = (score: number) => ({ score, citedMoment: '"a moment"', improve: "Open with the claim." });
const result: ResultView = {
  transcript: "So the thing about habits is, um, they compound.",
  words: null,
  metrics,
  tier1: { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 },
  anchors: { hedgeCount: 2, restartCount: 1 },
  coach: {
    focus: "x",
    strength: "Held the pause before ‘the mistake people make’.",
    supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
    coachLine: "4 fillers in 62s. Tomorrow: kill ‘um’.",
    dimensions: { structure: dim(64), credibility: dim(58), engagement: dim(61), confidence: dim(66) },
  } as unknown as ResultView["coach"],
  ethosIndex: 665,
  previousIndex: 662,
  scorable: true,
  pauseHeadline: "Three silences landed a point; one was searching.",
};
const g = glanceLine({ trait: "fillers", metrics, lead: "Practice 2:" });
const view: GlanceView = { parts: g.parts, moment: g.moment, cue: g.cue, earned: null };
/** Visible text: the markup without its tags and its screen-reader copies. */
const visible = (html: string) =>
  html
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

describe("the glance", () => {
  const html = renderToStaticMarkup(createElement(RepResult, { result, section: "glance", glance: view }));
  /* The #427 review: a bare "▲ 3" said nothing about what it was against;
     its words are on the screen again, paid for by "first ▶0:02". */
  it("holds the score, the delta with its words, Demos's line with its moment and the cue, nothing else", () => {
    expect(visible(html)).toBe("665 /1000 ▲ 3 since last time 4 fillers, first 0:02 Practice 2: under 4.");
    expect(html).not.toContain("sr-only\">Up 3");
  });
  it("binds the word before the chip to it, and leaves no stop floating after it", () => {
    expect(html).toMatch(/<span class="whitespace-nowrap">first\u00a0<span data-glance-chip/);
    expect(visible(html)).not.toMatch(/0:02 \./);
  });
  it("sets Demos's line at his introduction's 20px", () => {
    expect(html).toContain("text-lead");
  });
  it("says nothing the coach wrote, so no caption, and no trait-gain line", () => {
    expect(html).not.toContain("AI-generated feedback");
    expect(html).not.toContain("leveled");
    expect(html).not.toContain("4 fillers in 62s");
  });
  it("draws the moment as text, never a dead button, when nothing can play it", () => {
    expect(html).toContain("data-glance-chip");
    expect(html).not.toMatch(/<button[^>]*data-glance-chip/);
  });
  it("fits the budget with the header, the door and the tap, the delta's words counted", () => {
    const fixed = ["The cold open", "+1", "665", "/1000", "▲ 3 since last time", "Every number", "Practice 2 of 3", "Retake"];
    const fit = fitGlance({ fixed, line: g.sentence, cue: g.cue, earned: null });
    expect(fit.words).toBe(25);
    expect(countWords([...fixed, visible(html).replace("665 /1000 ▲ 3 since last time ", "")].join(" "))).toBeLessThanOrEqual(25);
  });
  it("on an unscored take: one star with its label, the title, and the reason in Demos's words", () => {
    const unscored = { ...result, ethosIndex: null, scorable: false, coach: null, metrics: { ...metrics, substance: { wordCount: 12, distinctRatio: 0.9, repeatShare: 0 } } };
    const u = glanceLine({ trait: "fillers", metrics: unscored.metrics, scorable: false, lead: "Practice 2:" });
    const out = renderToStaticMarkup(
      createElement(RepResult, { result: unscored, section: "glance", glance: { parts: u.parts, moment: null, cue: null, earned: null } })
    );
    /* The review: a gold star over "Not enough to score." was an earned
       glyph with no label. */
    expect(visible(out)).toBe("1 star for showing up Not scored. 12 words. Give it 60 to 90 seconds.");
    expect(out).not.toContain("nothing measured");
  });
});

describe("the sheet's body, in order", () => {
  it("draws every section it is given, in the order given, the closing note last", () => {
    const sections = sheetSections({
      bests: 1, accuracy: false, round: false, audio: false, fillers: 4,
      coach: true, capped: false, presence: false, closing: true, ladder: false,
    });
    const html = renderToStaticMarkup(
      createElement(RepResult, {
        result,
        section: "detail",
        sheet: { sections, open: "fillers", slots: { records: createElement("p", null, "Records broken"), closing: createElement("p", null, "3 landed pauses") } },
      })
    );
    const order = [...html.matchAll(/data-sheet-section="([a-z-]+)"/g)].map((m) => m[1]);
    /* The #427 review: the sheet opens on the coach, one head over both
       halves and the caption under it, so it covers both. */
    expect(order).toEqual(["coach", "records", "fillers", "dimensions", "words", "closing"]);
    expect(html.match(/AI-generated feedback/g)).toHaveLength(1);
    expect(html).toContain('<h2 class="section-head">Demos&#x27;s read</h2>');
    expect(html).not.toContain("Kept:");
    expect(html.indexOf("AI-generated feedback")).toBeLessThan(html.indexOf(">Kept<"));
    expect(html.indexOf(">Kept<")).toBeLessThan(html.indexOf("Say this instead"));
    expect(html).toContain('<h2 class="section-head">Every dimension</h2>');
    expect(html).toContain('<details open=""');
  });

  it("names the take's length under the dimensions, and says what the take did, not the scoring rule", () => {
    const html = renderToStaticMarkup(
      createElement(RepResult, { result, section: "detail", sheet: { sections: ["dimensions"], open: "fillers" } })
    );
    expect(visible(html)).toContain("Length 62s, target 60 to 90s");
    expect(visible(html)).toContain("4 in all, most were “um”.");
    expect(html).toContain("↳ Replace it with silence");
    expect(html).not.toContain("scores 100");
    const rush = renderToStaticMarkup(
      createElement(RepResult, { result, section: "detail", lengthNote: "of 30s", sheet: { sections: ["dimensions"] } })
    );
    expect(visible(rush)).toContain("Length 62s of 30s");
  });

  it("puts #160's line in the row it leveled, never under the list's head", () => {
    /* repTraitGain re-runs the substance gate on the transcript, so the
       take needs one a gate would score. */
    const strong = {
      ...result,
      transcript:
        "So the thing about habits is that they compound. You do the small version every day and it builds on its own. The mistake people make is waiting to feel ready. Ready is a feeling that shows up after you start. What changed was making the habit small enough that missing it felt stupid. Five minutes, standing in a kitchen.",
      tier1: { ...result.tier1, pace: 96 },
    };
    const html = renderToStaticMarkup(
      createElement(RepResult, { result: strong, section: "detail", sheet: { sections: ["dimensions"], open: "pace" } })
    );
    const head = html.slice(0, html.indexOf("<details"));
    expect(head).not.toMatch(/leveled/i);
    expect(html).toMatch(/Leveled (twice|up)/);
  });

  it("a capped take says the read is back tomorrow and that it still counted", () => {
    const html = renderToStaticMarkup(createElement(RepResult, { result, section: "detail", sheet: { sections: ["capped"] } }));
    expect(visible(html)).toBe("Demos's full read is back tomorrow. It still counted toward your streak.");
  });
});
