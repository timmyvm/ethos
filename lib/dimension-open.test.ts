import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DimensionList } from "@/components/DimensionList";
import { computeMetrics, type RepMetrics } from "./metrics";

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
    expect(rows[0]).toContain("3.9 (4 in all)");
  });
  it("opens the Pause row for Pausing, the Pace row for Pace", () => {
    expect(openRows(render("pause"))[0]).toContain('data-trait="pause"');
    expect(openRows(render("pace"))[0]).toContain("145 words a minute");
  });
  it("opens nothing without it, as the Log draws it", () => {
    expect(openRows(render())).toHaveLength(0);
  });
});
