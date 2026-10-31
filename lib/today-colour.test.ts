import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The trait rings (round 2, M02, M12): wherever a ring is drawn in its
 * trait's tone (the trait page's ring, the lesson stages), it is that
 * tone's arc on the app's `sand` trough and the only colour in it, so
 * the arc holds 3:1 there. Since the home round (#393) Today's trait
 * colour under its card is its 8px mark and its percentile bar's fill on
 * sand (the cohesion pass drew a ring's thin arc there), and the tones
 * have to measure there. The dark tones are
 * muted (lower chroma, the same hue and lightness) and still clear every
 * floor here. The ring is a measurement, so the arc holds the 3:1 a graphic
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

/*
 * What Today is built from, since the home round (#393, direction B,
 * "the object"; it replaced the cohesion pass's stage, rows and rings).
 * The card is the practice in its trait's own colour family, with white
 * type on it; under it nothing is lifted and nothing wears a wash. The
 * tiles are the surface step; a trait's colour is its 8px mark, its
 * bar's fill on sand and the light behind its object; what is earned
 * (clearing your line, a clean stretch, a day spoken) fills in the
 * ring's own measured sage.
 */
const home = between("/* the home (#393) */", "end of the home (#393)");
const block = (selector: string) => {
  const at = home.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no ${selector}`);
  return home.slice(at, home.indexOf("}", at));
};
const hexOf = (body: string, name: string) => {
  const m = body.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`no --${name}`);
  return m[1];
};

describe("Today's card holds white type in every family", () => {
  for (const f of ["pause", "fillers", "repairs", "pace", "range"]) {
    it(`${f}: white on the card's lit top at 4.5:1 or better, light and dark`, () => {
      const lightTop = hexOf(block(`.home-hero[data-family="${f}"]`), "home-a");
      const darkTop = hexOf(block(`:root[data-theme="dark"] .home-hero[data-family="${f}"]`), "home-a");
      expect(ratio("#ffffff", lightTop)).toBeGreaterThanOrEqual(4.5);
      expect(ratio("#ffffff", darkTop)).toBeGreaterThanOrEqual(4.5);
    });
    /*
     * The lit corner (the first radial in `.home-hero::before`) is laid
     * over the top colour, and the critic's round measured 4.12:1 under
     * "Today's practice" in light at 390 and 3.65 at 320: the light ran
     * into the words' column. So the test lays the light over the top
     * colour across the whole column (the left 52% of the content box,
     * from the lead down through the tactic) on the card at 320 and 390,
     * and holds white to 4.5:1 at the brightest point.
     */
    it(`${f}: white over the lit corner across the words' column at 320 and 390, light and dark`, () => {
      const before = block(".home-hero::before");
      const g = before.match(
        /radial-gradient\((\d+)% (\d+)% at (\d+)% (\d+)%, var\(--home-lit\) 0%, transparent (\d+)%\)/
      );
      expect(g, "the lit corner's gradient").not.toBeNull();
      const [rx, ry, cx, cy, stop] = g!.slice(1).map(Number);
      for (const sel of [`.home-hero[data-family="${f}"]`, `:root[data-theme="dark"] .home-hero[data-family="${f}"]`]) {
        const body = block(sel);
        const top = hexOf(body, "home-a");
        const lit = body.match(/--home-lit:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/);
        expect(lit, `${sel} --home-lit`).not.toBeNull();
        const [lr, lg, lb, la] = lit!.slice(1).map(Number);
        for (const width of [280, 350]) {
          const height = 376;
          const column = 20 + 0.52 * (width - 40);
          let worst = Infinity;
          for (let y = 20; y <= 120; y += 2) {
            for (let x = 20; x <= column; x += 2) {
              const t = Math.hypot((x - (cx / 100) * width) / ((rx / 100) * width), (y - (cy / 100) * height) / ((ry / 100) * height));
              const a = la * Math.max(0, 1 - t / (stop / 100));
              const [br, bg, bb] = rgb(top);
              const over = "#" + [lr * a + br * (1 - a), lg * a + bg * (1 - a), lb * a + bb * (1 - a)]
                .map((v) => Math.round(v).toString(16).padStart(2, "0"))
                .join("");
              worst = Math.min(worst, ratio("#ffffff", over));
            }
          }
          expect(worst, `${sel} at ${width}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`${f}: the chip's name in the card's deep ink on white at 4.5:1 or better`, () => {
      for (const sel of [`.home-hero[data-family="${f}"]`, `:root[data-theme="dark"] .home-hero[data-family="${f}"]`]) {
        expect(ratio(hexOf(block(sel), "home-b"), "#f8f8f8")).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe("Today's materials", () => {
  const tiles = src("components/home/HomeTiles.tsx");
  const week = src("components/home/WeekTiles.tsx");
  const hero = src("components/home/HomeHero.tsx");

  it("the traits are tiles on the surface: the trait's mark, its bar on sand, its name in ink", () => {
    expect(tiles).toMatch(/className=\{`home-tile today-trait press/);
    expect(tiles).not.toMatch(/tone-wash|tone-ink|tone-fill|className=\{`card|className="card/);
    expect(tiles).toContain('className="trait-dot"');
    expect(block(".home-bar")).toContain("background: var(--color-sand);");
    // The fill is the trait's arc: the tone, or the ochre's deeper arc in
    // light, which `.today-trait` carries (held on sand above).
    expect(block(".home-bar > i")).toContain("background: var(--ring-arc, var(--tone));");
  });

  it("the light behind an object is the tone at 22% at most, never the tile's ground", () => {
    for (const glow of home.matchAll(/\.home-tile-glow \{([^}]*)\}/g)) {
      const pct = [...glow[1].matchAll(/var\(--tone\) (\d+)%/g)].map((m) => Number(m[1]));
      for (const p of pct) expect(p).toBeLessThanOrEqual(22);
    }
    expect(block("\n.home-tile")).not.toMatch(/--tone/);
  });

  it("what is earned fills in the measured sage, 3:1 on sand in both themes", () => {
    expect(tiles.match(/home-bar home-bar-earned/g)?.length).toBe(2);
    expect(block(".home-bar-earned > i")).toContain("var(--color-sage-600)");
    expect(block(".home-day[data-on]")).toContain("var(--color-sage-600)");
    expect(week).toContain("bg-sage-600");
    expect(ratio(token(css, "sage-600"), light.sand)).toBeGreaterThanOrEqual(3);
    expect(ratio(token(darkRoot, "sage-600"), dark.sand)).toBeGreaterThanOrEqual(3);
  });

  it("the card holds the one tap, 48px, and spin and difficulty as 48px glyphs", () => {
    expect(block(".home-start")).toMatch(/min-height: 48px;/);
    expect(block(".home-start")).toContain("background: var(--color-terracotta-500);");
    expect(block(".home-glyph")).toMatch(/width: 48px;\s*height: 48px;/);
    expect(hero).toContain('aria-label="Spin a new topic"');
    // Nothing else on Today is terracotta-filled.
    for (const file of [tiles, week, src("app/page.tsx")]) {
      expect(file).not.toMatch(/bg-terracotta-500|ACTION_CLASS/);
    }
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

/* The tester's mark (#402): "Tester" on its mint chip clears body
   contrast in both themes, ink on the light mint and the mint ink on the
   dark one. */
describe("the tester chip reads", () => {
  const pop = (block: string, name: string) => {
    const m = block.match(new RegExp(`--pop-${name}:\\s*(#[0-9a-f]{6})`, "i"));
    if (!m) throw new Error(`no --pop-${name}`);
    return m[1];
  };
  const lightPop = css.slice(css.indexOf("--pop-sun:"));
  const darkPop = css.slice(css.indexOf(':root[data-theme="dark"] {\n  /* Gold, not mustard'));
  const chip = css.slice(css.indexOf("/* tester presence (#402) */"));

  it("is drawn in those colours", () => {
    expect(chip).toMatch(/\.tester-chip \{[^}]*background: var\(--pop-mint\);[^}]*color: var\(--color-ink\);/);
    expect(chip).toMatch(/:root\[data-theme="dark"\] \.tester-chip \{\s*color: var\(--pop-mint-ink\);/);
  });
  it("clears 4.5:1 in light", () => {
    expect(ratio(token(css, "ink"), pop(lightPop, "mint"))).toBeGreaterThanOrEqual(4.5);
  });
  it("clears 4.5:1 in dark", () => {
    expect(ratio(pop(darkPop, "mint-ink"), pop(darkPop, "mint"))).toBeGreaterThanOrEqual(4.5);
  });
});
