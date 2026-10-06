import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Today's materials since round 2 (M02, M12): a trait's tile is the
 * neutral `.card` and today's line sits on the ground, so a trait ring
 * is its tone's arc on the app's `sand` trough and the only colour in
 * it. The ring is a measurement, so the arc holds the 3:1 a graphic
 * needs against that trough, for all five tones in both themes; the
 * ochre in light is 1.9:1 there and takes its own deeper arc
 * (`.today-trait[data-trait="repairs"]`, `--ring-arc`). The name and the
 * percentile are text in `tone-ink` on the card or the ground, so they
 * hold 4.5:1 there.
 */
const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
/* A source file without its comments, so a comment naming the old
   material does not count as using it. */
const src = (file: string) =>
  readFileSync(path.resolve(__dirname, "..", file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const between = (a: string, b: string) => css.slice(css.indexOf(a), css.indexOf(b));
const lessons = between("lessons (trait tones) =====", "end of lessons (trait tones)");
const today = between("today (colour pass) =====", "end of today (colour pass)");
const darkRoot = css.slice(css.indexOf(':root[data-theme="dark"] {'));

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
const token = (block: string, name: string) => {
  const m = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`no --color-${name}`);
  return m[1];
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
const ochre = today.slice(today.indexOf('.today-trait[data-trait="repairs"]'));
const ochreArc = ochre.match(/--ring-arc:\s*(#[0-9a-f]{6})/i)?.[1];

const light = {
  sand: token(css, "sand"),
  raised: token(css, "raised"),
  ground: token(css, "ground"),
};
const dark = {
  sand: token(darkRoot, "sand"),
  raised: token(darkRoot, "raised"),
  ground: token(darkRoot, "ground"),
};
/* The dark card's sheen: raised plus 4.6% white at its top edge. */
const sheen = mix("#ffffff", dark.raised, 0.046);

describe("Today's trait rings still measure", () => {
  const l = tones(false);
  const d = tones(true);

  it("reads all five tones, the neutral tokens and the ochre's light arc", () => {
    expect(Object.keys(l)).toHaveLength(5);
    expect(Object.keys(d)).toHaveLength(5);
    expect(ochreArc).toBeDefined();
    expect(light.sand).not.toBe(dark.sand);
  });

  for (const [trait, t] of Object.entries(l)) {
    it(`${trait}, light: the arc on sand at 3:1 or better`, () => {
      const arc = trait === "repairs" ? ochreArc! : t.tone;
      expect(ratio(arc, light.sand)).toBeGreaterThanOrEqual(3);
    });
  }
  for (const [trait, t] of Object.entries(d)) {
    it(`${trait}, dark: the arc on sand at 3:1 or better`, () => {
      expect(ratio(t.tone, dark.sand)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("Today's trait names in their ink", () => {
  for (const [trait, t] of Object.entries(tones(false))) {
    it(`${trait}, light: 4.5:1 or better on the card and the ground`, () => {
      expect(ratio(t["tone-ink"], light.raised)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["tone-ink"], light.ground)).toBeGreaterThanOrEqual(4.5);
    });
  }
  for (const [trait, t] of Object.entries(tones(true))) {
    it(`${trait}, dark: 4.5:1 or better on the card, its sheen and the ground`, () => {
      for (const on of [dark.raised, sheen, dark.ground]) {
        expect(ratio(t["tone-ink"], on)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

/*
 * What Today is built from (round 2). The tiles and today's line wear
 * no wash, the clean run is the neutral card rather than the deep sage
 * (which stays the Log's), and Start has the floor card's width to
 * itself with spin and difficulty as bare glyphs on the eyebrow row.
 */
describe("Today's materials", () => {
  const strip = src("components/home/TraitStrip.tsx");
  const line = src("components/home/ChallengeCard.tsx");
  const shell = src("components/home/HomeCards.tsx");
  const run = src("components/home/CleanRunCard.tsx");
  const trail = src("components/DayTrail.tsx");
  const floor = src("components/home/FloorCard.tsx");

  it("the trait tiles are neutral cards, one wide over an even 2x2", () => {
    expect(strip).toMatch(/className=\{`card press today-trait/);
    expect(strip).not.toMatch(/tone-wash|today-tile|--today-trough/);
    expect(strip).toContain('track="var(--color-sand)"');
    expect(strip).toContain("grid grid-cols-2");
    expect(strip).toContain("wide={i === 0}");
  });

  it("today's line has no card and no wash", () => {
    expect(line).not.toMatch(/tone-wash|today-line|rounded-card p-4/);
    expect(line).toContain('track="var(--color-sand)"');
  });

  it("the clean run on Today is the neutral card, sage only where earned", () => {
    for (const file of [shell, run, trail]) {
      expect(file).not.toMatch(/card-score|text-cream|sage-mist|sage-lit|cream\//);
    }
    expect(shell).toMatch(/className="card press block p-4"/);
    expect(run).toContain('tone="measured"');
  });

  it("Start has the floor card's width; spin and difficulty are bare glyphs", () => {
    expect(floor).not.toContain("floor-side");
    expect(floor).toMatch(/\$\{ACTION_CLASS\} mt-5 w-full/);
    expect(floor).toContain('aria-label="Spin a new topic"');
    expect(floor).toContain("size-11");
  });
});

/*
 * The trait chip (M11, components/TraitChip.tsx): the label is the
 * tone's own ink (`.tone-on`) on the solid tone (`.tone-fill`), at
 * 12.5 and 13px, so it holds text contrast, 4.5:1, for all five traits
 * in both themes. Light is white on the tone except Restarts, whose
 * ochre takes the dark ink; dark is the dark ink on every lighter tone.
 */
describe("the trait chip's label on its tone", () => {
  const ink = (selector: RegExp) => {
    const m = css.match(selector);
    if (!m) throw new Error(`no colour for ${selector}`);
    return m[1];
  };
  const white = ink(/\n\.tone-on \{\s*color:\s*(#[0-9a-f]{6})/i);
  const dark = ink(/\[data-trait="repairs"\] \.tone-on,\s*:root\[data-theme="dark"\] \.tone-on \{\s*color:\s*(#[0-9a-f]{6})/i);
  const light = tones(false);
  const darkTones = tones(true);

  it("reads both inks from globals.css", () => {
    expect(white.toLowerCase()).toBe("#ffffff");
    expect(dark).toMatch(/^#[0-9a-f]{6}$/i);
  });

  for (const [trait, t] of Object.entries(light)) {
    it(`${trait}, light: 4.5:1 or better`, () => {
      const on = trait === "repairs" ? dark : white;
      expect(ratio(on, t.tone)).toBeGreaterThanOrEqual(4.5);
    });
  }
  for (const [trait, t] of Object.entries(darkTones)) {
    it(`${trait}, dark: 4.5:1 or better`, () => {
      expect(ratio(dark, t.tone)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
