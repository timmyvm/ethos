import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconSwap } from "@/components/ui/IconSwap";

/**
 * The polish pass (#474), two of the reel's ten rules held in the source.
 *
 * An icon beside words is drawn at their stem. The stems are the faces'
 * own, measured in the page by `scripts/look-polish.mjs stems` (ink
 * across the middle of an "l" drawn at 400px): Outfit 600 0.131em, 700
 * 0.153em; Figtree 600 0.112em. An icon's weight is on the 24 grid, so
 * the line it draws is weight times size over 24.
 *
 * An icon swap blurs the mark leaving as it fades (`IconSwap`).
 */
const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const block = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no ${selector}`);
  return css.slice(at, css.indexOf("}", at) + 1);
};
const weight = (selector: string) => {
  const m = block(selector).match(/stroke-width:\s*([\d.]+);/);
  if (!m) throw new Error(`no stroke-width on ${selector}`);
  return Number(m[1]);
};
const STEM = { outfit600: 0.131, outfit700: 0.153, figtree600: 0.112 };

describe("an icon beside words draws their stem (#474)", () => {
  const cases: [string, string, number, number, number][] = [
    // selector, the words, icon px, words px, stem per em
    [".screen-bar-back > svg", "the back's word, Figtree 600 at 16", 22, 16, STEM.figtree600],
    ["  .tap-arrow-disc > svg", "the tap's word, Outfit 700 at 15", 16, 15, STEM.outfit700],
    // The foot's marks (#500): the flag and the check at 13, the wave at 14, beside Outfit 600 at 13.
    [".home-fig-mark > svg", "the foot's line, Outfit 600 at 13", 13, 13, STEM.outfit600],
    ['.home-fig-mark[data-mark="wave"] > svg', "the foot's line, Outfit 600 at 13", 14, 13, STEM.outfit600],
  ];
  for (const [selector, words, size, px, stem] of cases) {
    it(`${selector.trim()} within 5% of ${words}`, () => {
      const line = (weight(selector) * size) / 24;
      expect(Math.abs(line / (stem * px) - 1)).toBeLessThan(0.05);
    });
  }

  /* The sizes above are the ones drawn: an icon resized or a word
     restyled in its component would leave the weights right on paper
     and wrong on the screen (#474 review). */
  it("measures the icons and words the screens draw", () => {
    expect(read("components/ui/TapArrow.tsx")).toContain("<IconOnward size={16} />");
    const foot = read("components/home/TodayFoot.tsx");
    expect(foot).toContain("<IconFlag size={13} />");
    expect(foot).toContain("<IconCheck size={13} />");
    expect(foot).toContain("<IconWave size={14} />");
    const label = block(".home-fig-label");
    expect(label).toContain("font-size: 0.8125rem;");
    expect(label).toContain("font-weight: 600;");
    expect(foot).toContain('className="home-fig-label font-display"');

    const back = block(".screen-bar-back");
    expect(back).toContain("font-size: 16px;");
    expect(back).toContain("font-weight: 600;");
    expect(back, "the back's word is the body's Figtree").not.toContain("font-family");
    expect(block("\nbody")).toContain("font-family: var(--font-figtree)");

    const eyebrow = block("  .eyebrow");
    expect(eyebrow).toContain("font-family: var(--font-display-face)");
    expect(eyebrow).toContain("font-size: 0.8125rem;");
    expect(eyebrow).toContain("font-weight: 600;");

    const ui = read("lib/ui.ts");
    const arrow = ui.slice(ui.indexOf("export const ACTION_ARROW_CLASS"), ui.indexOf(";", ui.indexOf("export const ACTION_ARROW_CLASS")));
    for (const c of ["font-display", "text-body", "font-bold"]) expect(arrow).toContain(c);
    expect(css).toContain("--text-body: 0.9375rem;");
  });

  /* Every 22px back in the app, wherever it is drawn, is the first child
     of the element that wears `.screen-bar-back`, so the `> svg` rule
     reaches it. A back wrapped in a span, or a new back without the
     class, would keep the set's 2.75 beside a 1.79px word. */
  it("every back chevron is the direct child of the class that sets it", () => {
    const walk = (dir: string): string[] =>
      readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    let backs = 0;
    for (const file of [...walk("app"), ...walk("components")]) {
      const src = read(file);
      for (const m of src.matchAll(/<IconBack size=\{22\} \/>/g)) {
        backs++;
        const before = src.slice(0, m.index);
        expect(before, `${file}: the chevron is the element's first child`).toMatch(/>\s*$/);
        expect(before.slice(before.lastIndexOf("<")), `${file}: its element wears screen-bar-back`).toContain("screen-bar-back");
      }
    }
    // ScreenHeader's bar and BackLink, LessonScreen's two, Today's, the recorder's.
    expect(backs).toBeGreaterThanOrEqual(6);
  });
});

describe("an icon swap blurs the mark leaving (#474)", () => {
  const html = (swapped: boolean) =>
    renderToStaticMarkup(createElement(IconSwap, { swapped, from: createElement("i", null, "a"), to: createElement("i", null, "b") }));

  it("draws both marks, hides the one not showing, and is a picture", () => {
    expect(html(false)).toBe('<span aria-hidden="true" class="icon-swap"><span><i>a</i></span><span data-off=""><i>b</i></span></span>');
    expect(html(true)).toBe('<span aria-hidden="true" class="icon-swap"><span data-off=""><i>a</i></span><span><i>b</i></span></span>');
  });

  it("fades, blurs and shrinks the mark leaving, on the tokens", () => {
    expect(block(".icon-swap > span")).toMatch(/opacity var\(--duration-base\)[\s\S]*filter var\(--duration-base\)[\s\S]*transform var\(--duration-base\)/);
    const off = block(".icon-swap > [data-off]");
    expect(off).toContain("opacity: 0;");
    expect(off).toMatch(/filter: blur\(\d+px\);/);
    expect(off).toMatch(/transform: scale\(0\.\d+\);/);
  });

  it("keeps only the fade under reduced motion, and no blur in lite graphics", () => {
    expect(block(':root[data-motion="reduce"] .icon-swap > span')).toContain("transition: opacity");
    expect(block(':root[data-motion="reduce"] .icon-swap > [data-off]')).toMatch(/filter: none;[\s\S]*transform: none;/);
    expect(block(':root[data-graphics="lite"] .icon-swap > [data-off]')).toContain("filter: none;");
  });

  it("Hear it back's key and a word's Save swap through it", () => {
    expect(read("components/AudioScrubber.tsx")).toContain("<IconSwap swapped={playing} from={<IconPlay size={16} />} to={<IconPauseSm size={16} />} />");
    expect(read("components/WordSheet.tsx")).toContain("<IconSwap swapped={!!s} from={<IconPlus size={15} />} to={<IconCheck size={15} />} />");
  });
});
