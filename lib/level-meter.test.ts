import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LevelMeter } from "@/components/ui/LevelMeter";

/*
 * A trait's level as You's rows and its sheet draw it (#482): "Level 6"
 * with a small bar beside it, one progressbar for a screen reader.
 */
const draw = (level: number, percent: number, size: "row" | "sheet" = "row") =>
  renderToStaticMarkup(createElement(LevelMeter, { name: "Filler control", level, percent, size }));

describe("LevelMeter", () => {
  it("draws the level in words and the bar filled as far into it", () => {
    const html = draw(6, 40);
    expect(html).toContain(">Level 6</span>");
    expect(html).toContain('style="width:40%"');
    expect(html).toContain('class="level-fill fill"');
  });

  it("is one progressbar, named for the trait, its value the sentence", () => {
    const html = draw(6, 40);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Filler control"');
    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuetext="Level 6, 40% of the way to level 7"');
    // The track is drawn, never read.
    expect(html).toContain('aria-hidden="true" class="level-track"');
  });

  it("keeps the track and no fill when a level has just landed", () => {
    const html = draw(1, 0);
    expect(html).toContain('class="level-track"');
    expect(html).not.toContain("level-fill");
    expect(html).toContain('aria-valuetext="Level 1, 0% of the way to level 2"');
  });

  it("says Not yet, quiet and with no bar, at level 0 with nothing toward 1", () => {
    const html = draw(0, 0);
    expect(html).toContain(">Not yet</span>");
    expect(html).toContain("text-stone-400");
    expect(html).not.toContain("level-track");
    expect(html).not.toContain('role="progressbar"');
  });

  it("says level 0, quiet, where a try has come part of the way", () => {
    const html = draw(0, 62);
    expect(html).toContain('class="level-value text-stone-400"');
    expect(html).toContain('style="width:62%"');
  });

  it("is the same grammar on a trait's sheet, a step larger", () => {
    const html = draw(6, 40, "sheet");
    expect(html).toContain('data-size="sheet"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('style="width:40%"');
  });
});
