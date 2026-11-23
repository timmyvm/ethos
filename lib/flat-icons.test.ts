import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/lessons";
import {
  FLAT_ICONS,
  FLAT_KINDS,
  LESSON_FAMILIES,
  LESSON_FLAT_KINDS,
  LESSON_ICONS,
  LESSON_OBJECT_KIND,
  STAT_FLAT_KINDS,
  STAT_ICONS,
  type FlatKind,
} from "@/components/icons/flat/geometry";

/*
 * The flat icons' drawings name colour roles; components/icons/flat/
 * flat-icons.css gives each role its value. These hold the two together:
 * no layer may name a role the tone block leaves undefined (it would draw
 * black), no tone may outlive its layer, every stat keeps a grey for every
 * role it names in both themes (the unlit streak holding on Today's chip),
 * the lessons' objects keep their families' tones, and the client never
 * imports the lessons' drawings.
 */

const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "components/icons/flat/flat-icons.css"), "utf8");

const LIT = ".fi";
const UNLIT = '.fi[data-lit="false"]';
const UNLIT_DARK = ':root[data-theme="dark"] .fi[data-lit="false"]';

/** The custom properties set in the rule whose selector is exactly `selector`. */
function block(selector: string): Map<string, string> {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  const vars = new Map<string, string>();
  for (const m of body.matchAll(/(--fi-[\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  return vars;
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

const roles = (kind: FlatKind) => [...new Set(FLAT_ICONS[kind].layers.map((l) => l.tone))];
const tone = (vars: Map<string, string>, kind: string, role: string) => vars.get(`--fi-${kind}-${role}`)!;

describe("the flat set", () => {
  it("is the six stats and the fifteen lessons' objects, each drawn once", () => {
    expect(STAT_FLAT_KINDS).toEqual(["streak", "xp", "best", "freeze", "hostile", "boss"]);
    expect(LESSON_FLAT_KINDS).toHaveLength(15);
    expect(FLAT_KINDS).toHaveLength(21);
    for (const k of STAT_FLAT_KINDS) expect(k in LESSON_ICONS, k).toBe(false);
  });

  it("names each layer once and clips only to parts it draws", () => {
    for (const kind of FLAT_KINDS) {
      const parts = FLAT_ICONS[kind].layers.map((l) => l.part);
      expect(new Set(parts).size, `${kind} parts`).toBe(parts.length);
      for (const l of FLAT_ICONS[kind].layers) for (const c of l.clip ?? []) expect(parts, `${kind} ${l.part} clips to ${c}`).toContain(c);
    }
  });

  it("is one look: no variant B, no variant prop", () => {
    expect(css).not.toMatch(/\.fi-[ab]\b/);
    for (const file of ["FlatIcon.tsx", "FlatDrawing.tsx", "FlatLessonIcon.tsx"]) {
      const src = readFileSync(path.join(root, "components/icons/flat", file), "utf8");
      expect(src, file).not.toMatch(/\bvariant\??\s*:|variant=\{/);
    }
  });
});

describe("flat icon tones", () => {
  it("every role a layer names is set in the tone block", () => {
    const vars = block(LIT);
    for (const kind of FLAT_KINDS) {
      for (const role of roles(kind)) expect(vars.has(`--fi-${kind}-${role}`), `--fi-${kind}-${role}`).toBe(true);
    }
  });

  it("every tone in the block is one a layer names", () => {
    const named = new Set(FLAT_KINDS.flatMap((kind) => roles(kind).map((role) => `--fi-${kind}-${role}`)));
    for (const key of block(LIT).keys()) expect(named.has(key), `${key} is drawn by no layer`).toBe(true);
  });

  it("every stat has a grey for every role it names, in both themes; the lessons' objects are never unlit", () => {
    for (const selector of [UNLIT, UNLIT_DARK]) {
      const vars = block(selector);
      for (const kind of STAT_FLAT_KINDS) {
        for (const role of roles(kind)) {
          const value = vars.get(`--fi-${kind}-${role}`);
          expect(value, `${selector} --fi-${kind}-${role}`).toBeDefined();
          expect(chroma(value!), `${selector} ${kind} ${role} is a grey`).toBeLessThanOrEqual(12);
        }
      }
      for (const kind of LESSON_FLAT_KINDS) {
        for (const key of vars.keys()) expect(key.startsWith(`--fi-${kind}-`), `${selector} ${key}`).toBe(false);
      }
    }
  });

  it("every unlit stat keeps the method's ramp: shade under the base, light over it", () => {
    for (const selector of [UNLIT, UNLIT_DARK]) {
      const vars = block(selector);
      for (const kind of STAT_FLAT_KINDS) {
        expect(grey(tone(vars, kind, "shade")), `${selector} ${kind}`).toBeLessThan(grey(tone(vars, kind, "base")));
        if (roles(kind).includes("light")) expect(grey(tone(vars, kind, "light")), `${selector} ${kind}`).toBeGreaterThan(grey(tone(vars, kind, "base")));
      }
    }
  });
});

describe("the lessons' objects", () => {
  it("each lesson has its object, in its own trait's family", () => {
    expect(Object.keys(LESSON_OBJECT_KIND).sort()).toEqual(LESSONS.map((l) => l.id).sort());
    for (const lesson of LESSONS) {
      const kind = LESSON_OBJECT_KIND[lesson.id];
      const family = LESSON_FAMILIES.find((f) => f.kinds.includes(kind));
      expect(family?.trait, `${lesson.id} -> ${kind}`).toBe(lesson.trait);
    }
    expect(new Set(Object.values(LESSON_OBJECT_KIND)).size).toBe(15);
    expect(LESSON_FAMILIES.flatMap((f) => f.kinds).sort()).toEqual([...LESSON_FLAT_KINDS].sort());
  });

  it("share one tone set per family, every object in it", () => {
    const vars = block(LIT);
    for (const { trait, kinds } of LESSON_FAMILIES) {
      const bases = new Set(kinds.map((k) => tone(vars, k, "base")));
      expect(bases.size, `${trait}: ${[...bases].join(", ")}`).toBe(1);
      const shades = new Set(kinds.map((k) => tone(vars, k, "shade")));
      expect(shades.size, `${trait} shades`).toBe(1);
    }
  });

  /* Every other tone an object takes is its family's own hue (a light, a
     tint, a deep interior), white, or the set's one gold: never a second
     hue of its own. The target kept the stat board's red with a navy dart,
     and the gauge that red for its needle, until the #516 review. */
  it("take no colour but their family's hue, white and the set's one gold", () => {
    const vars = block(LIT);
    const GOLD = ["#ffb914", "#eb9c00"];
    for (const { trait, kinds } of LESSON_FAMILIES) {
      for (const kind of kinds) {
        const familyHue = hsl(tone(vars, kind, "base")).h;
        for (const role of roles(kind)) {
          const value = tone(vars, kind, role);
          const c = hsl(value);
          const apart = Math.min(Math.abs(c.h - familyHue), 360 - Math.abs(c.h - familyHue));
          const ok = GOLD.includes(value) || c.l >= 97 || apart <= 15;
          expect(ok, `${trait} ${kind} ${role} ${value} (hue ${Math.round(c.h)} against ${Math.round(familyHue)})`).toBe(true);
        }
      }
    }
  });

  it("take the set's one gold wherever a gold appears", () => {
    const vars = block(LIT);
    for (const kind of LESSON_FLAT_KINDS) {
      for (const role of roles(kind)) {
        const c = hsl(tone(vars, kind, role));
        const gold = c.h >= 36 && c.h <= 52 && c.s >= 80 && c.l >= 40 && c.l <= 62;
        if (gold) expect(["#ffb914", "#eb9c00"], `${kind} ${role}`).toContain(tone(vars, kind, role));
      }
    }
  });

  it("stay out of the client: FlatIcon's imports never reach the lessons' drawings", () => {
    /** Every file a source file imports, transitively, through relative and @/ paths. */
    function graph(file: string, seen = new Set<string>()): Set<string> {
      if (seen.has(file)) return seen;
      seen.add(file);
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s(?:[^"']*?\sfrom\s)?["']([^"']+)["']/g)) {
        const spec = m[1];
        if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
        const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(file), spec);
        const hit = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((p) => existsSync(p) && !p.endsWith("/"));
        if (hit && /\.tsx?$/.test(hit)) graph(hit, seen);
      }
      return seen;
    }
    const flat = path.join(root, "components/icons/flat");
    const reached = [...graph(path.join(flat, "FlatIcon.tsx"))].map((f) => path.relative(flat, f));
    expect(reached).toContain("stat-drawings.ts");
    expect(reached).not.toContain("lesson-drawings.ts");
    expect(reached).not.toContain("geometry.ts");
    // And the test can see an import when there is one.
    expect([...graph(path.join(flat, "FlatLessonIcon.tsx"))].map((f) => path.relative(flat, f))).toContain("lesson-drawings.ts");
  });
});

/*
 * Today's chip draws the unlit flame at 20px on the surface step, so its
 * outline is the base (and, at the foot's lower left, the inner tongue).
 * These are the greys that have to hold there.
 */
const CHIP = { light: ["#f4f4f4", "#efedea"], dark: ["#1c1c1c"] };
const THEMES = [
  { theme: "light", selector: UNLIT },
  { theme: "dark", selector: UNLIT_DARK },
] as const;

const flameTones = (vars: Map<string, string>) => ({
  base: tone(vars, "streak", "base"),
  shade: tone(vars, "streak", "shade"),
  inner: tone(vars, "streak", "inner"),
  light: tone(vars, "streak", "light"),
});

/** The flame's mean Greyscale lightness at 20px (no light): its layers by the share of the silhouette each covers. */
const SHARE = { base: 0.725, shade: 0.162, inner: 0.113 };
const meanGrey = (t: { base: string; shade: string; inner: string }) =>
  SHARE.base * grey(t.base) + SHARE.shade * grey(t.shade) + SHARE.inner * grey(t.inner);

describe("the unlit streak on Today's chip", () => {
  it("holds its shape: the base 3:1 or more on the chip, the inner tongue near it", () => {
    for (const { theme, selector } of THEMES) {
      const t = flameTones(block(selector));
      for (const chip of CHIP[theme]) {
        expect(contrast(t.base, chip), `${selector} base on ${chip}`).toBeGreaterThanOrEqual(3);
        expect(contrast(t.inner, chip), `${selector} inner on ${chip}`).toBeGreaterThanOrEqual(2.8);
      }
    }
  });

  it("keeps the method's ramp: shade darker than the base, inner and light lighter, in that order", () => {
    for (const { selector } of THEMES) {
      const t = flameTones(block(selector));
      expect(grey(t.shade), selector).toBeLessThan(grey(t.base));
      expect(grey(t.inner), selector).toBeGreaterThan(grey(t.base));
      expect(grey(t.light), selector).toBeGreaterThan(grey(t.inner));
    }
  });

  it("is dimmer than the lit flame in Greyscale, by 30 in the light theme (the app's own unlit rule)", () => {
    const lit = flameTones(block(LIT));
    for (const { theme, selector } of THEMES) {
      const unlit = flameTones(block(selector));
      const gap = meanGrey(lit) - meanGrey(unlit);
      expect(gap, `${selector}: lit ${meanGrey(lit).toFixed(0)}, unlit ${meanGrey(unlit).toFixed(0)}`).toBeGreaterThan(0);
      // The orange is itself a mid grey, so in the dark theme the flame can hold 3:1 on
      // the chip or 30 under the lit flame, not both: it keeps the 3:1.
      if (theme === "light") expect(gap, selector).toBeGreaterThanOrEqual(30);
    }
  });

  it("the unlit cup (You's best) is dimmer than the lit one by 30 in the light theme", () => {
    const lit = block(LIT);
    const unlit = block(UNLIT);
    expect(grey(tone(lit, "best", "base")) - grey(tone(unlit, "best", "base"))).toBeGreaterThanOrEqual(30);
  });
});

describe("the streak flame", () => {
  it("is one silhouette with its shade, inner tongue and light clipped inside it", () => {
    const [base, shade, inner, light] = STAT_ICONS.streak.layers;
    expect(STAT_ICONS.streak.layers).toHaveLength(4);
    expect(base).toMatchObject({ part: "base", tone: "base" });
    expect(base.shapes).toHaveLength(1);
    expect(shade).toMatchObject({ part: "shade", tone: "shade", clip: ["base"] });
    // The inner tongue is drawn at every size: it is the fire cue, not a detail.
    expect(inner).toMatchObject({ part: "inner", tone: "inner", clip: ["base"] });
    expect(inner.minPx).toBeUndefined();
    expect(light).toMatchObject({ part: "light", tone: "light", clip: ["base"], minPx: 24 });
    // The light is a slim streak, 8 by 19, as slim as the cup's and the bolt's.
    expect(light.shapes[0]).toMatchObject({ kind: "pill", w: 8, h: 19 });
  });

  it("is drawn from arcs only, with tips no rounder than the method allows and none sharper", () => {
    const shape = STAT_ICONS.streak.layers[0].shapes[0];
    expect(shape.kind).toBe("path");
    const d = (shape as { d: string }).d;
    expect(d, "no straight side").not.toMatch(/[LlHhVvCcQqSsTt]/);
    const radii = [...d.matchAll(/A([\d.]+) /g)].map((m) => Number(m[1]));
    expect(radii.length).toBeGreaterThanOrEqual(12);
    // The main tip may go to 3u; nothing in the outline is rounder-cornered than a 3u tip allows.
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(3);
  });

  /* The tongue is the heat inside the flame at 380 (the streak moment):
     an orange a step lighter than the base (#ff9e3d, 1.4:1 on it) left the
     flame one orange blob there. It is the flame's one second colour, the
     set's gold, so the flame keeps the set's rule (three tones of its hue
     and one second colour). Lighter and darker are luminance, as the eye
     reads them: HSL lightness calls the gold (L 54) darker than the
     orange (L 55). */
  it("has the set's gold for its inner tongue: clearly lighter than the base, under the light, never a lemon", () => {
    const v = block(LIT);
    const inner = tone(v, "streak", "inner");
    expect(inner).toBe("#ffb914");
    expect(contrast(inner, tone(v, "streak", "base")), "the tongue on the base").toBeGreaterThanOrEqual(1.6);
    expect(luminance(inner)).toBeLessThan(luminance(tone(v, "streak", "light")));
    expect(hsl(inner).h, "warmer than the base").toBeGreaterThan(hsl(tone(v, "streak", "base")).h);
    // A gold, not a lemon yellow.
    expect(hsl(inner).h).toBeLessThanOrEqual(45);
  });
});

/*
 * The streak moment's first frame draws the unlit flame at up to 380pt.
 * The chip's light greys (L 38, #515) stood there as a charcoal mass, so
 * the moment alone takes a lighter step of the same ramp in the light
 * theme: still 3:1 on the ground, the steps round it the same. The chips,
 * You's numbers and the Active rows keep theirs; dark and Increase
 * Contrast keep theirs.
 */
describe("the unlit flame on the streak moment", () => {
  const MOMENT = ':root:not([data-theme="dark"]) .streak-flame .fi[data-lit="false"]';
  const WRAP = "@media not all and (prefers-contrast: more) {";

  it("is scoped to the moment's flame, the light theme, and not under Increase Contrast", () => {
    const at = css.indexOf(`  ${MOMENT} {`);
    expect(at, "the moment's block").toBeGreaterThan(0);
    const wrap = css.lastIndexOf(WRAP, at);
    expect(wrap, "inside a media query that skips Increase Contrast").toBeGreaterThan(0);
    // Nothing closes the media query between its opening and the rule.
    expect(css.slice(wrap + WRAP.length, at).trim()).toBe("");
    // The chip's light greys are the first unlit rule still (stat-tones.ts reads them).
    expect(css.indexOf(`\n${UNLIT} {`)).toBeLessThan(at);
  });

  it("holds 3:1 on the ground, lighter than the chip's greys, in the same ramp, the streak's roles only", () => {
    const body = css.slice(css.indexOf("{", css.indexOf(`  ${MOMENT} {`)) + 1);
    const vars = new Map([...body.slice(0, body.indexOf("}")).matchAll(/(--fi-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    expect([...vars.keys()].sort()).toEqual(roles("streak").map((r) => `--fi-streak-${r}`).sort());
    const t = flameTones(vars);
    const chip = flameTones(block(UNLIT));
    for (const v of Object.values(t)) expect(chroma(v), v).toBeLessThanOrEqual(12);
    expect(contrast(t.base, "#ffffff"), "base on the ground").toBeGreaterThanOrEqual(3);
    expect(grey(t.base), "lighter than the chip's").toBeGreaterThan(grey(chip.base));
    expect(grey(t.shade)).toBeLessThan(grey(t.base));
    expect(grey(t.inner)).toBeGreaterThan(grey(t.base));
    expect(grey(t.light)).toBeGreaterThan(grey(t.inner));
  });
});

/*
 * The hourglass's glass stands on Pausing's disc and stage, the wash
 * #e6edff in light and #283a63 in dark. At #cce4ff it was 1.1:1 on the
 * wash and the hourglass read as two caps and sand. A light tone of the
 * family's blue, dark enough to hold its edge on the wash and light
 * enough to read as glass on the dark stage, with the glint still white
 * on it.
 */
describe("the hourglass's glass", () => {
  it("reads on Pausing's wash and dark stage, a light tone of the family's blue", () => {
    const v = block(LIT);
    const glass = tone(v, "hourglass", "glass");
    expect(contrast(glass, "#e6edff"), "on the wash").toBeGreaterThanOrEqual(1.6);
    expect(contrast(glass, "#283a63"), "on the dark stage").toBeGreaterThanOrEqual(4.5);
    expect(contrast(glass, tone(v, "hourglass", "light")), "the white glint on it").toBeGreaterThanOrEqual(1.8);
    expect(contrast(glass, tone(v, "hourglass", "base")), "the caps on it").toBeGreaterThanOrEqual(2);
    const c = hsl(glass);
    expect(Math.abs(c.h - hsl(tone(v, "hourglass", "base")).h), "the family's hue").toBeLessThanOrEqual(5);
    expect(c.l, "a light tone").toBeGreaterThanOrEqual(75);
  });
});
