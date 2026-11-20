import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLAT_ICONS, FLAT_KINDS } from "@/components/icons/flat/geometry";

/*
 * The flat icons' drawings name colour roles; components/icons/flat/
 * flat-icons.css gives each variant its values. These hold the two
 * together: no layer may name a role a variant leaves undefined (it
 * would draw black), the unlit streak keeps a grey for every role its
 * layers name in both themes, and B's target stays a clean gold with a
 * dart of another hue (the brown ochre and the bone dart it replaced).
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

describe("the streak flame", () => {
  it("is one silhouette with its shade and light clipped inside it", () => {
    const [base, shade, light] = FLAT_ICONS.streak.layers;
    expect(base).toMatchObject({ part: "base", tone: "base" });
    expect(base.shapes).toHaveLength(1);
    expect(shade).toMatchObject({ part: "shade", tone: "shade", clip: ["base"] });
    expect(light).toMatchObject({ part: "light", tone: "light", clip: ["base"], minPx: 24 });
    // The light is 12u wide, the set's smallest feature.
    expect(light.shapes[0]).toMatchObject({ kind: "pill", w: 12 });
  });
});
