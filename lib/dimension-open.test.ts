import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DimensionList, hedgeWords } from "@/components/DimensionList";
import { computeMetrics, UNVOICED_MAX_S, UNVOICED_MIN_S, type RepMetrics } from "./metrics";

/* "The whole recording" opens the practice's own trait row (#427). */
const metrics: RepMetrics = { ...computeMetrics([], 62), fillerCount: 4, fillersPerMin: 3.9, topFiller: "um", wpm: 145 };
const tier1 = { pause: 72, fillers: 55, repairs: 66, pace: 93, range: 66 };
const render = (open?: "fillers" | "pause" | "pace") =>
  renderToStaticMarkup(
    createElement(DimensionList, { tier1, anchors: { hedgeCount: 2, restartCount: 1 }, metrics, coach: null, open })
  );
const openRows = (html: string) => [...html.matchAll(/<details open=""[^>]*>[\s\S]*?<\/details>/g)].map((m) => m[0]);

describe("DimensionList open", () => {
  it("opens the Fillers row and no other", () => {
    const rows = openRows(render("fillers"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('data-trait="fillers"');
    expect(rows[0]).toContain("3.9 (4 in all, about one every 15 seconds)");
  });
  it("opens the Pause row for Pausing, the Pace row for Pace", () => {
    expect(openRows(render("pause"))[0]).toContain('data-trait="pause"');
    expect(openRows(render("pace"))[0]).toContain("145 words a minute");
  });
  it("opens nothing without it, as the Log draws it", () => {
    expect(openRows(render())).toHaveLength(0);
  });
});

/*
 * The review of #490: each opened row's words say what its count counts,
 * no more. Steadiness's count is every hedge countHedges finds ("sort
 * of" and "I feel like" too), so two of them are examples, never the
 * list; the Pause row's short gaps are metrics.ts's 0.3 to 1.2 seconds,
 * not "under a second", and not placed mid-sentence.
 */
describe("the opened rows say what the counts count (the review of #490)", () => {
  const coach = {
    dimensions: Object.fromEntries(
      (["structure", "credibility", "engagement", "confidence"] as const).map((k) => [
        k,
        { score: 60, citedMoment: "“I guess it sort of works”", improve: "Say it once." },
      ])
    ),
  } as never;
  const steadiness = (hedgeCount: number) => {
    const html = renderToStaticMarkup(
      createElement(DimensionList, { tier1, anchors: { hedgeCount, restartCount: 1 }, metrics, coach })
    );
    return html.slice(html.indexOf("Steadiness")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  };

  it("gives the hedges as examples, so “sort of” twice is never called “maybe”", () => {
    expect(hedgeWords(0)).toBe("no phrases like “maybe” or “I guess”");
    expect(hedgeWords(1)).toBe("1 phrase like “maybe” or “I guess”");
    expect(hedgeWords(2)).toBe("2 phrases like “maybe” or “I guess”");
    expect(steadiness(2)).toContain("(2 phrases like “maybe” or “I guess”, 1 restart.)");
    expect(steadiness(2)).not.toMatch(/“I guess” (once|twice|\d+ times)/);
  });

  it("says the short gaps' own range, not under a second, and not where they fell", () => {
    const gaps = { ...metrics, unvoicedHesitations: 4 };
    const html = renderToStaticMarkup(
      createElement(DimensionList, { tier1, anchors: { hedgeCount: 0, restartCount: 0 }, metrics: gaps, coach: null, open: "pause" })
    );
    expect(html).toContain("Plus 4 short gaps of 0.3 to 1.2 seconds.");
    expect(html).not.toMatch(/under a second|shorter stops mid-sentence/);
    expect([UNVOICED_MIN_S, UNVOICED_MAX_S]).toEqual([0.3, 1.2]);
  });
});

/* #493, the morning tour (docs/look/tour/06-every-number-pause-*.png): the
   rows drew a 3x14 tick of their own where the Log, You and Lessons draw
   the trait's 8px square. One swatch; the four untaught rows keep the
   same 8px slot, blank, so the nine names share one left edge. */
describe("DimensionList's swatch", () => {
  it("is the shared 8px square on a trait's row and a blank slot on the rest", () => {
    const dim = (score: number) => ({ score, citedMoment: '"ready is a feeling"', improve: "Name one number." });
    const coach = {
      coachLine: "",
      dimensions: { structure: dim(64), credibility: dim(58), engagement: dim(61), confidence: dim(66) },
    } as unknown as Parameters<typeof DimensionList>[0]["coach"];
    const html = renderToStaticMarkup(
      createElement(DimensionList, { tier1, anchors: { hedgeCount: 2, restartCount: 1 }, metrics, coach })
    );
    const rows = [...html.matchAll(/<summary[^>]*>[\s\S]*?<\/summary>/g)].map((m) => m[0]);
    expect(rows.length).toBeGreaterThanOrEqual(9);
    for (const row of rows) {
      const slot = /<span aria-hidden="true" class="([^"]*size-2[^"]*)"><\/span>/.exec(row)?.[1] ?? "";
      expect(slot, row.slice(0, 80)).toMatch(/size-2 shrink-0/);
      if (/data-trait="/.test(row)) expect(slot).toContain("trait-dot");
      else expect(slot).not.toContain("trait-dot");
      expect(row).not.toMatch(/w-\[3px\]|tone-fill/);
    }
    expect(rows.filter((r) => /trait-dot/.test(r))).toHaveLength(5);
  });
});
