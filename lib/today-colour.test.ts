import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Today's colour pass (globals.css, "today (colour pass)"): a trait's
 * ring is its tone's arc on a trough mixed from the tone and its wash.
 * The ring is a measurement, so the arc holds the 3:1 a graphic needs
 * against that trough, for all five tones in both themes. The ochre in
 * light failed at 2.1:1 and takes its own arc and a fainter trough.
 */
const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const between = (a: string, b: string) => css.slice(css.indexOf(a), css.indexOf(b));
const lessons = between("lessons (trait tones) =====", "end of lessons (trait tones)");
const today = between("today (colour pass) =====", "end of today (colour pass)");

const tones = (dark: boolean) => {
  const out: Record<string, Record<string, string>> = {};
  const re = dark
    ? /:root\[data-theme="dark"\] \[data-trait="(\w+)"\] \{([^}]*)\}/g
    : /(?:^|\n)\[data-trait="(\w+)"\] \{([^}]*)\}/g;
  for (const [, trait, body] of lessons.matchAll(re)) {
    out[trait] = Object.fromEntries(
      [...body.matchAll(/--(tone(?:-wash|-ink)?):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]])
    );
  }
  return out;
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/* `color-mix(in srgb, a p%, b)`: a per-channel mix of the encoded values. */
const mix = (a: string, b: string, p: number) => {
  const [x, y] = [rgb(a), rgb(b)];
  return "#" + x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, "0")).join("");
};
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
const troughPct = (body: string) => {
  const m = body.match(/--today-trough:\s*color-mix\(in srgb, var\(--tone\) (\d+)%, var\(--tone-wash\)\)/);
  if (!m) throw new Error("no --today-trough");
  return Number(m[1]) / 100;
};
const base = troughPct(today.slice(today.indexOf(".today-line {")));
const ochre = today.slice(today.indexOf('[data-trait="repairs"]'));
const ochreArc = ochre.match(/--ring-arc:\s*(#[0-9a-f]{6})/i)?.[1];
const ochreTrough = troughPct(ochre);

describe("Today's trait rings still measure", () => {
  const light = tones(false);
  const dark = tones(true);

  it("reads all five tones and the ochre's light override", () => {
    expect(Object.keys(light)).toHaveLength(5);
    expect(Object.keys(dark)).toHaveLength(5);
    expect(ochreArc).toBeDefined();
  });

  for (const [trait, t] of Object.entries(light)) {
    it(`${trait}, light: the arc on its trough at 3:1 or better`, () => {
      const arc = trait === "repairs" ? ochreArc! : t.tone;
      const trough = mix(t.tone, t["tone-wash"], trait === "repairs" ? ochreTrough : base);
      expect(ratio(arc, trough)).toBeGreaterThanOrEqual(3);
    });
  }
  for (const [trait, t] of Object.entries(dark)) {
    it(`${trait}, dark: the arc on its trough at 3:1 or better`, () => {
      expect(ratio(t.tone, mix(t.tone, t["tone-wash"], base))).toBeGreaterThanOrEqual(3);
    });
  }
});
