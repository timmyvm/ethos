import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconFlame, IconStar } from "@/components/Icon";
import { Stars } from "@/components/Stars";
import { HeaderCount } from "@/components/ui/HeaderCount";

/*
 * Today's earned chips and every star (D03, D25). A star is one colour
 * everywhere, gold (`.earned-lit`); a chip at zero is an unlit zero, not
 * a gold star beside a 0, and keeps its footprint; a running streak on
 * an open day greys only its flame.
 */
const chip = (props: Partial<Parameters<typeof HeaderCount>[0]>) =>
  renderToStaticMarkup(
    createElement(HeaderCount, {
      variant: "chip",
      glyph: createElement(IconStar),
      value: 0,
      label: "0 stars",
      ...props,
    })
  );

describe("HeaderCount's chip", () => {
  it("at zero is unlit as a whole: no gold, the empty hook for the surface fill", () => {
    const html = chip({ empty: true });
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('data-open="true"');
    expect(html).not.toContain("earned-lit");
    expect(html).not.toContain("arrive");
  });

  it("with a count lights its glyph gold and keeps the wash", () => {
    const html = chip({ value: 12, label: "12 stars" });
    expect(html).toContain("earned-lit");
    expect(html).not.toContain("data-empty");
    expect(html).not.toContain("data-open");
    // A chip never seen empty does not re-arrive: the row already lands.
    expect(html).not.toMatch(/today-earned arrive/);
  });

  it("on an open day greys only the flame, the wash stays", () => {
    const html = chip({ glyph: createElement(IconFlame), value: 6, unlit: true, label: "Streak 6" });
    expect(html).toContain('data-open="true"');
    expect(html).not.toContain("data-empty");
    expect(html).not.toContain("earned-lit");
  });

  it("says the words to a screen reader in every state", () => {
    for (const html of [chip({ empty: true }), chip({ value: 3, label: "3 stars" })]) {
      expect(html).toMatch(/<span class="sr-only">\d+ stars<\/span>/);
    }
  });
});

describe("Stars", () => {
  it("earned stars are gold, the rest a stone outline, in one image", () => {
    const html = renderToStaticMarkup(createElement(Stars, { n: 2 }));
    expect(html.match(/earned-lit/g)?.length).toBe(2);
    expect(html.match(/text-stone-400/g)?.length).toBe(1);
    expect(html).toContain('aria-label="2 of 3 stars"');
    expect(html).not.toMatch(/text-sage/);
  });
});

describe("the gold and the sage", () => {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const hex = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))![1];

  it("the earned glyph is the amber, with a rim that holds 3:1 on white in light", () => {
    expect(css).toMatch(/--earned-gold: var\(--color-amber\);/);
    expect(hex("color-amber").toLowerCase()).toBe("#e0a800");
    expect(ratio(hex("earned-rim"), "#ffffff")).toBeGreaterThanOrEqual(3);
    // And on the grounds a lit glyph actually sits on: Today's chip and surface.
    expect(ratio(hex("earned-rim"), hex("color-sage-100"))).toBeGreaterThanOrEqual(3);
    expect(ratio(hex("earned-rim"), hex("color-surface"))).toBeGreaterThanOrEqual(3);
  });

  it("You's streak flame follows Today's chip: unlit until today's recording lands", () => {
    const you = readFileSync(path.resolve(__dirname, "../app/you/page.tsx"), "utf8");
    expect(you).toMatch(/lit=\{!streak\.atRisk\}/);
    expect(you).toMatch(/lit \? "earned-lit" : "text-stone-400"/);
  });

  it("no component draws a star or a fill on sand in sage-500, which is 2.9:1 there", () => {
    expect(ratio(hex("color-sage-600"), hex("color-sand"))).toBeGreaterThanOrEqual(3);
    const read = (f: string) => readFileSync(path.resolve(__dirname, "..", f), "utf8");
    for (const f of [
      "components/Stars.tsx",
      "components/ui/SegmentBar.tsx",
      "components/DimensionList.tsx",
      "app/shop/page.tsx",
      "app/you/page.tsx",
    ]) {
      expect(read(f), f).not.toMatch(/\bbg-sage-500\b|\btext-sage-500\b/);
    }
  });
});
