import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_ARROW_CLASS, ACTION_CLASS, ACTION_TONAL_CLASS, DISABLED_CLASS } from "./ui";

/**
 * The tap (#437). Timothy, 12 Nov, on the flat orange button beside the
 * cards' 3D objects: "8 for home and 10 for feedback", Tonal and Arrow
 * of the ten directions in docs/look/buttons. A tap has no colour of
 * its own any more: ink on the page, cut from the card on a coloured
 * card, and an arrow where it moves you on.
 *
 * These hold the three in the source and measure their colours from the
 * stylesheet's own values. `scripts/check-colour.mjs` measures Today's
 * Start on the card in a browser, and `scripts/look-taps.mjs` shoots
 * every state.
 */
const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
/* A source file without its comments, so a comment naming the old fill
   does not count as using it. */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const block = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no ${selector}`);
  return css.slice(at, css.indexOf("}", at) + 1);
};
const darkRoot = css.slice(css.indexOf(':root[data-theme="dark"] {'));
const token = (from: string, name: string) => {
  const m = from.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`no --color-${name}`);
  return m[1];
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, p: number) =>
  "#" +
  rgb(a)
    .map((v, i) => Math.round(v * p + rgb(b)[i] * (1 - p)).toString(16).padStart(2, "0"))
    .join("");
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("the tap on the page is ink", () => {
  it("wears .tap and names no colour of its own", () => {
    expect(ACTION_CLASS.split(" ")).toContain("tap");
    for (const cls of [ACTION_CLASS, ACTION_TONAL_CLASS, ACTION_ARROW_CLASS]) {
      expect(cls).not.toMatch(/terracotta|on-accent|\bbg-|\btext-(?!body|center|left)/);
      // A pill, 48px, the press, and the 200ms a waiting tap lights up in.
      expect(cls).toMatch(/\bpress\b.*\bmin-h-12\b.*\brounded-tap\b/);
      expect(cls).toContain("transition-colors duration-200 ease-out");
    }
  });

  it("is ink with the ground's colour for its word, in both themes", () => {
    expect(block("  .tap")).toContain("background-color: var(--color-ink);");
    expect(block("  .tap")).toContain("color: var(--color-ground);");
    expect(ratio(token(css, "ink"), token(css, "ground"))).toBeGreaterThanOrEqual(7);
    expect(ratio(token(darkRoot, "ink"), token(darkRoot, "ground"))).toBeGreaterThanOrEqual(7);
  });

  it("draws a press that shows on its own fill", () => {
    // The page's veil is ink at 5%, which says nothing on ink: light
    // lifts it with white, dark sets it down with the ground.
    expect(block("  .tap")).toContain("--press-veil: rgb(255 255 255 / 0.16);");
    expect(block('  :root[data-theme="dark"] .tap')).toContain("--press-veil: rgb(18 18 18 / 0.1);");
  });

  it("still steps back to the one waiting look", () => {
    expect(DISABLED_CLASS).toContain("disabled:!bg-surface");
    expect(DISABLED_CLASS).toContain("aria-disabled:!text-stone-400");
  });

  it("leaves no terracotta fill on any screen but Stop's", () => {
    const files = [
      "app/rep/page.tsx",
      "components/Paywall.tsx",
      "components/home/HomeHero.tsx",
      "components/LessonScreen.tsx",
      "components/lessons/LessonCard.tsx",
      "components/AuthForm.tsx",
      "app/games/page.tsx",
      "app/you/page.tsx",
      "app/lessons/[id]/page.tsx",
    ];
    for (const file of files) expect(code(file), file).not.toMatch(/bg-terracotta-500/);
    const recording = code("app/rep/page.tsx");
    // Record is ink; the take in progress keeps its red.
    expect(recording).toMatch(/\? "bg-terracotta-600 text-cream"\s*: "rec-wait tap"/);
    expect(recording.match(/bg-terracotta-600/g)).toHaveLength(1);
  });
});

describe("the tap on a coloured card is cut from the card", () => {
  it("reads its two colours from the card, white and ink where there is none", () => {
    expect(ACTION_TONAL_CLASS.split(" ")).toContain("tap-tonal");
    expect(ACTION_TONAL_CLASS.split(" ")).not.toContain("tap");
    for (const selector of ["  .tap-tonal", ".home-start"]) {
      expect(block(selector)).toMatch(/background(-color)?: var\(--tap-tint, #ffffff\);/);
      expect(block(selector)).toContain("color: var(--tap-tint-ink, #201e1d);");
    }
  });

  it("is a pale tint of each family with the family's deep tone for its word, 4.5:1 or better", () => {
    expect(css).toMatch(
      /\.family-fill:not\(\[data-family="none"\]\),\s*\.home-hero:not\(\[data-family="none"\]\) \{\s*--tap-tint: color-mix\(in srgb, var\(--home-a\) 16%, #ffffff\);\s*--tap-tint-ink: var\(--home-b\);/
    );
    const families = (dark: boolean) => {
      const re = dark
        ? /:root\[data-theme="dark"\] \.home-hero\[data-family="(\w+)"\] \{\s*--home-a: (#[0-9a-f]{6});\s*--home-b: (#[0-9a-f]{6});/g
        : /\n\.home-hero\[data-family="(\w+)"\] \{\s*--home-a: (#[0-9a-f]{6});\s*--home-b: (#[0-9a-f]{6});/g;
      return [...css.matchAll(re)].map(([, family, a, b]) => ({ family, a, b }));
    };
    for (const dark of [false, true]) {
      const all = families(dark);
      expect(all.map((f) => f.family).sort()).toEqual(["fillers", "pace", "pause", "range", "repairs"]);
      for (const { family, a, b } of all) {
        const tint = mix(a, "#ffffff", 0.16);
        const name = `${dark ? "dark" : "light"} ${family}`;
        // The word on the pill, and the pill on the foot it stands on.
        expect(ratio(b, tint), `${name}: word on tint`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(tint, b), `${name}: tint on the foot`).toBeGreaterThanOrEqual(3);
        // Pale, and still the family's colour.
        expect(Math.min(...rgb(tint)), `${name}: pale`).toBeGreaterThan(200);
      }
    }
  });

  it("is cut from the plum on the paywall", () => {
    const sheet = block(".card-premium");
    const tint = sheet.match(/--tap-tint: (#[0-9a-f]{6});/)?.[1];
    const ink = sheet.match(/--tap-tint-ink: (#[0-9a-f]{6});/)?.[1];
    const plum = sheet.match(/background: (#[0-9a-f]{6});/)?.[1];
    expect(tint && ink && plum).toBeTruthy();
    expect(ink).toBe(plum);
    expect(tint).toBe(mix(token(css, "plum-500"), "#ffffff", 0.16));
    expect(ratio(ink!, tint!)).toBeGreaterThanOrEqual(7);
    const paywall = code("components/Paywall.tsx");
    expect(paywall).not.toMatch(/\bACTION_CLASS\b/);
    expect(paywall.match(/ACTION_TONAL_CLASS\}/g)).toHaveLength(2);
    // The code's Unlock is the same tap at its own width.
    expect(paywall).toMatch(/className="press font-display tap-tonal min-h-12 shrink-0 rounded-tap/);
  });

  it("is Today's Start, twice, and nothing else on Today", () => {
    const hero = code("components/home/HomeHero.tsx");
    expect(hero.match(/className="home-start press"/g)).toHaveLength(2);
    expect(hero).not.toMatch(/ACTION_CLASS|bg-terracotta/);
  });
});

describe("the tap that moves you on carries its arrow", () => {
  it("starts its words at the left and keeps 48px around a 36px disc", () => {
    const cls = ACTION_ARROW_CLASS.split(" ");
    for (const c of ["tap", "flex", "items-center", "justify-between", "text-left", "min-h-12", "py-1.5", "pr-1.5", "pl-5.5"]) {
      expect(cls, c).toContain(c);
    }
    expect(cls).not.toContain("text-center");
    expect(block("  .tap-arrow-disc")).toMatch(/width: 36px;\s*height: 36px;\s*border-radius: 999px;/);
    // 6 + 36 + 6.
    expect(1.5 * 4 * 2 + 36).toBe(48);
  });

  it("draws the disc in the word's colour and the arrow in the fill's, so it turns with the theme", () => {
    expect(block("  .tap-arrow-disc")).toContain("background-color: currentColor;");
    expect(block("  .tap-arrow-disc > svg")).toContain("color: var(--color-ink);");
    expect(block("  .tap-tonal .tap-arrow-disc > svg")).toContain("color: var(--tap-tint, #ffffff);");
  });

  it("leans on a press, and not under reduced motion", () => {
    expect(block("  .press:active .tap-arrow-disc > svg")).toContain("transform: translateX(2px);");
    expect(block('  :root[data-motion="reduce"] .press:active .tap-arrow-disc > svg')).toContain("transform: none;");
  });

  it("is hidden from a screen reader and is not a second target", () => {
    const arrow = read("components/ui/TapArrow.tsx");
    expect(arrow).toMatch(/<span aria-hidden className="tap-arrow-disc">\s*<IconOnward size=\{16\} \/>\s*<\/span>/);
    expect(arrow).not.toMatch(/"use client"|onClick|<button|<a /);
  });

  it("is the results' way on, on the glance and at the sheet's foot", () => {
    const results = code("app/rep/page.tsx");
    const primary = results.slice(results.indexOf("const primary = (where"), results.indexOf("if (gateTo !== null"));
    expect(primary).toContain("className={ACTION_ARROW_CLASS}");
    expect(primary).toMatch(/<span className="min-w-0 py-1 text-balance">\{primaryLabel\}<\/span>\s*<TapArrow \/>/);
    expect(results.match(/<TapArrow \/>/g)).toHaveLength(1);
    expect(results).toMatch(/primary\("shelf"\)/);
    expect(results).toMatch(/primary\("sheet"\)/);
  });
});
