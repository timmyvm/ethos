import { readFileSync } from "node:fs";
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
    expect(html).toContain('>Not yet<span class="sr-only"> at level 1</span></span>');
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

/*
 * You's trait rows (#496, the morning tour: a level 0 row's name stood
 * in muted stone and read as a disabled row, though its bar had fill).
 * The name is ink at every level; only the meter's "Level 0" is quiet.
 */
describe("You's trait rows", () => {
  const you = readFileSync("app/you/page.tsx", "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const row = you.slice(you.indexOf("const rows = ranked.map("), you.indexOf("<LevelMeter", you.indexOf("const rows = ranked.map(")));

  it("set the trait's name in ink whatever its level", () => {
    const name = row.match(/<span className="([^"]*)">\{name\}<\/span>/);
    expect(name, "the name's span").not.toBeNull();
    expect(name![1]).not.toMatch(/stone-\d+/);
    expect(row).not.toMatch(/t\.level > 0 \? "" : "text-stone/);
  });

  it("leave the quiet to the meter's own Level 0", () => {
    expect(draw(0, 62)).toContain('class="level-value text-stone-400"');
    expect(draw(1, 10)).toContain('class="level-value"');
  });
});
