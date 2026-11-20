import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLAT_ICONS, FLAT_KINDS } from "@/components/icons/flat/geometry";

/*
 * The flat icons' drawings name colour roles; components/icons/flat/
 * flat-icons.css gives each variant its values. These hold the two
 * together: no layer may name a role a variant leaves undefined (it
 * would draw black), the unlit streak keeps a grey for every role its
 * layers name in both themes and holds on Today's chip, and B's target
 * stays a clean gold with a dart of another hue (the brown ochre and the
 * bone dart it replaced).
 */

const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "components/icons/flat/flat-icons.css"), "utf8");
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8");

/** The custom properties set in the rule whose selector is exactly `selector`. */
function block(selector: string): Map<string, string> {
  const at = css.indexOf(`${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  const vars = new Map<string, string>();
  for (const m of body.matchAll(/(--fi-[\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  return vars;
}

/** A value as a hex colour, through `var(--color-…)` in app/globals.css where it points there. */
function hex(value: string): string {
  const v = value.match(/^var\((--[\w-]+)\)$/);
  if (!v) return value;
  const m = globals.match(new RegExp(`${v[1]}:\\s*(#[0-9a-fA-F]{6})`));
  expect(m, `${v[1]} is not a hex in app/globals.css`).not.toBeNull();
  return m![1];
}

function hsl(color: string) {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

/** How far a colour is from grey: its largest channel less its smallest, out of 255. */
function chroma(color: string): number {
  const n = parseInt(color.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(...c) - Math.min(...c);
}

/** WCAG relative luminance. */
function luminance(color: string): number {
  const n = parseInt(color.slice(1), 16);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => lin(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Greyscale lightness (0 to 255), as the phone's Greyscale filter reads a colour (lib/stat-icons.test.ts). */
function grey(color: string): number {
  const n = parseInt(color.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

const roles = (kind: keyof typeof FLAT_ICONS) => [...new Set(FLAT_ICONS[kind].layers.map((l) => l.tone))];

describe("flat icon tones", () => {
  it("every role a layer names is set in both variants", () => {
    for (const variant of [".fi-a", ".fi-b"]) {
      const vars = block(variant);
      for (const kind of FLAT_KINDS) {
        for (const tone of roles(kind)) expect(vars.has(`--fi-${kind}-${tone}`), `${variant} --fi-${kind}-${tone}`).toBe(true);
      }
    }
  });

  it("the unlit streak has a grey for every role its layers name, in both variants and both themes", () => {
    const unlit = [
      '.fi-a[data-lit="false"]',
      ':root[data-theme="dark"] .fi-a[data-lit="false"]',
      '.fi-b[data-lit="false"]',
      ':root[data-theme="dark"] .fi-b[data-lit="false"]',
    ];
    for (const selector of unlit) {
      const vars = block(selector);
      for (const tone of roles("streak")) {
        const value = vars.get(`--fi-streak-${tone}`);
        expect(value, `${selector} --fi-streak-${tone}`).toBeDefined();
        expect(chroma(hex(value!)), `${selector} ${tone} is a grey`).toBeLessThanOrEqual(12);
      }
    }
  });

  it("B's target is a saturated gold with a dart of another hue", () => {
    const b = block(".fi-b");
    const base = hsl(hex(b.get("--fi-target-base")!));
    expect(base.s).toBeGreaterThanOrEqual(35);
    expect(base.l).toBeGreaterThanOrEqual(40);
    expect(base.l).toBeLessThanOrEqual(65);
    expect(base.h).toBeGreaterThanOrEqual(35);
    expect(base.h).toBeLessThanOrEqual(55);
    const dart = hsl(hex(b.get("--fi-target-dart")!));
    const apart = Math.min(Math.abs(dart.h - base.h), 360 - Math.abs(dart.h - base.h));
    expect(apart).toBeGreaterThanOrEqual(90);
    // The dark theme keeps the same target: no brown ring, no bone dart.
    const dark = block(':root[data-theme="dark"] .fi-b');
    for (const role of ["ring", "dart", "dart-shade"]) expect(dark.has(`--fi-target-${role}`)).toBe(false);
  });
});

/*
 * Today's chip draws the unlit flame at 20px on the surface step, so its
 * outline is the base (and, at the foot's lower left, the inner tongue).
 * These are the greys that have to hold there.
 */
const CHIP = { light: ["#f4f4f4", "#efedea"], dark: ["#1c1c1c"] };
const UNLIT = [
  { variant: ".fi-a", theme: "light", selector: '.fi-a[data-lit="false"]' },
  { variant: ".fi-a", theme: "dark", selector: ':root[data-theme="dark"] .fi-a[data-lit="false"]' },
  { variant: ".fi-b", theme: "light", selector: '.fi-b[data-lit="false"]' },
  { variant: ".fi-b", theme: "dark", selector: ':root[data-theme="dark"] .fi-b[data-lit="false"]' },
] as const;

/** The tones a selector draws the streak in, falling back to the variant's own (and B's dark lit block). */
function streakTones(selector: string, variant: string, theme: "light" | "dark") {
  const own = block(selector);
  const lit = block(variant);
  const dark = theme === "dark" && variant === ".fi-b" ? block(':root[data-theme="dark"] .fi-b') : new Map<string, string>();
  const pick = (role: string) => {
    const key = `--fi-streak-${role}`;
    const v = own.get(key) ?? dark.get(key) ?? lit.get(key);
    if (v === "var(--streak)") {
      // --streak moves with the theme in app/globals.css: the first value is light, the second dark.
      const all = [...globals.matchAll(/--streak:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1]);
      return theme === "dark" ? all[1] : all[0];
    }
    return hex(v!);
  };
  return { base: pick("base"), shade: pick("shade"), inner: pick("inner"), light: pick("light") };
}

/** The flame's mean Greyscale lightness at 20px (no light): its layers by the share of the silhouette each covers. */
const SHARE = { base: 0.725, shade: 0.162, inner: 0.113 };
const meanGrey = (t: { base: string; shade: string; inner: string }) =>
  SHARE.base * grey(t.base) + SHARE.shade * grey(t.shade) + SHARE.inner * grey(t.inner);

describe("the unlit streak on Today's chip", () => {
  it("holds its shape: the base 3:1 or more on the chip, the inner tongue near it", () => {
    for (const { variant, theme, selector } of UNLIT) {
      const t = streakTones(selector, variant, theme);
      for (const chip of CHIP[theme]) {
        expect(contrast(t.base, chip), `${selector} base on ${chip}`).toBeGreaterThanOrEqual(3);
        expect(contrast(t.inner, chip), `${selector} inner on ${chip}`).toBeGreaterThanOrEqual(2.8);
      }
    }
  });

  it("keeps the method's ramp: shade darker than the base, inner and light lighter, in that order", () => {
    for (const { variant, theme, selector } of UNLIT) {
      const t = streakTones(selector, variant, theme);
      expect(grey(t.shade), selector).toBeLessThan(grey(t.base));
      expect(grey(t.inner), selector).toBeGreaterThan(grey(t.base));
      expect(grey(t.light), selector).toBeGreaterThan(grey(t.inner));
    }
  });

  it("is dimmer than the lit flame in Greyscale, by 30 in the light theme (the app's own unlit rule)", () => {
    for (const { variant, theme, selector } of UNLIT) {
      const lit = streakTones(variant, variant, theme);
      const unlit = streakTones(selector, variant, theme);
      const gap = meanGrey(lit) - meanGrey(unlit);
      expect(gap, `${selector}: lit ${meanGrey(lit).toFixed(0)}, unlit ${meanGrey(unlit).toFixed(0)}`).toBeGreaterThan(0);
      // B is Ethos's own and holds 30 in both themes. A's orange is itself a mid grey, so in the
      // dark theme it can hold 3:1 on the chip or 30 under the lit flame, not both: it keeps the 3:1.
      if (theme === "light" || variant === ".fi-b") expect(gap, selector).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("the streak flame", () => {
  it("is one silhouette with its shade, inner tongue and light clipped inside it", () => {
    const [base, shade, inner, light] = FLAT_ICONS.streak.layers;
    expect(FLAT_ICONS.streak.layers).toHaveLength(4);
    expect(base).toMatchObject({ part: "base", tone: "base" });
    expect(base.shapes).toHaveLength(1);
    expect(shade).toMatchObject({ part: "shade", tone: "shade", clip: ["base"] });
    // The inner tongue is drawn at every size: it is the fire cue, not a detail.
    expect(inner).toMatchObject({ part: "inner", tone: "inner", clip: ["base"] });
    expect(inner.minPx).toBeUndefined();
    expect(light).toMatchObject({ part: "light", tone: "light", clip: ["base"], minPx: 24 });
    // The light is 12u wide, the set's smallest feature.
    expect(light.shapes[0]).toMatchObject({ kind: "pill", w: 12 });
  });

  it("is drawn from arcs only, with tips no rounder than the method allows and none sharper", () => {
    const shape = FLAT_ICONS.streak.layers[0].shapes[0];
    expect(shape.kind).toBe("path");
    const d = (shape as { d: string }).d;
    expect(d, "no straight side").not.toMatch(/[LlHhVvCcQqSsTt]/);
    const radii = [...d.matchAll(/A([\d.]+) /g)].map((m) => Number(m[1]));
    expect(radii.length).toBeGreaterThanOrEqual(12);
    // The main tip may go to 3u; nothing in the outline is rounder-cornered than a 3u tip allows.
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(3);
  });

  it("has a tone for its inner tongue lighter and warmer than the base, darker than the light", () => {
    for (const variant of [".fi-a", ".fi-b"]) {
      const v = block(variant);
      const base = hsl(hex(v.get("--fi-streak-base")!));
      const inner = hsl(hex(v.get("--fi-streak-inner")!));
      const light = hsl(hex(v.get("--fi-streak-light")!));
      expect(inner.l, variant).toBeGreaterThan(base.l);
      expect(inner.l, variant).toBeLessThan(light.l);
      expect(inner.h, `${variant} warmer`).toBeGreaterThan(base.h);
      // An amber, not a lemon yellow.
      expect(inner.h, variant).toBeLessThanOrEqual(45);
    }
  });
});
