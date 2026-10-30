import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDED_MARK, SEARCHING_MARK, SPEECH_MARK } from "@/components/PauseBar";

/*
 * The pause map on the numbers step (D52) is a raised `.card` that
 * follows the theme, where it used to be the one black card in the
 * light theme. Its marks are a graphic, so each holds 3:1 against the
 * card it sits on, in both themes: the speech ticks in stone-400, the
 * pauses that landed a point in sage-600, and the searching ones as an
 * ink outline. The tokens are read from app/globals.css, so a token
 * change that drops one under 3:1 fails here.
 */
const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const light = css.slice(0, css.indexOf(':root[data-theme="dark"] {'));
const dark = css.slice(css.indexOf(':root[data-theme="dark"] {'));

type RGB = [number, number, number];
/** A token's value as an opaque colour over `under` (rgba composited). */
const token = (block: string, name: string, under?: RGB): RGB => {
  const m = block.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no --color-${name}`);
  const v = m[1].trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
  const rgba = v.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (!rgba || !under) throw new Error(`--color-${name} is ${v}`);
  const a = Number(rgba[4]);
  return [1, 2, 3].map((i, k) => Math.round(Number(rgba[i]) * a + under[k] * (1 - a))) as RGB;
};
const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("the pause map's marks on the raised card (D52)", () => {
  it("draws each mark in the token this test measures", () => {
    expect(SPEECH_MARK).toContain("bg-stone-400");
    expect(LANDED_MARK).toContain("bg-sage-600");
    expect(SEARCHING_MARK).toMatch(/border-\[1\.5px\]/);
    expect(SEARCHING_MARK).toContain("border-ink");
    const src = readFileSync(path.resolve(__dirname, "../components/PauseBar.tsx"), "utf8");
    expect(src).toMatch(/className="card /);
    expect(src).not.toMatch(/card-stage|cream/);
  });

  for (const [theme, block] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`holds 3:1 against the card in ${theme}`, () => {
      const card = token(block, "raised");
      const marks = {
        speech: token(block, "stone-400", card),
        landed: token(block, "sage-600"),
        searching: token(block, "ink"),
      };
      for (const [name, colour] of Object.entries(marks)) {
        expect(ratio(colour, card), `${name} in ${theme}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
