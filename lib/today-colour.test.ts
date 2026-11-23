import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSON_FAMILIES } from "@/components/icons/flat/lesson-drawings";

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
 * needs against that trough, for all five tones in both themes (the
 * ochre in light was 1.9:1 there and wore its own deeper arc until D05
 * made the tone itself #b06f00). The name and the percentile are text in
 * `tone-ink` on the card or the ground, so they hold 4.5:1 there.
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
const flat = readFileSync(path.resolve(__dirname, "../components/icons/flat/flat-icons.css"), "utf8");
/* Each family's disc under Today's object: its wash in light, its dark stage in dark. */
const DISC: Record<string, { light: string; dark: string }> = {
  pause: { light: "#e6edff", dark: "#283a63" },
  fillers: { light: "#ffe6ee", dark: "#5c2935" },
  repairs: { light: "#fff1d1", dark: "#533401" },
  pace: { light: "#dcf7eb", dark: "#09472e" },
  range: { light: "#efe9ff", dark: "#3a3460" },
};

const tones = (dark: boolean) => {
  const out: Record<string, Record<string, string>> = {};
  const re = dark
    ? /:root\[data-theme="dark"\] \[data-trait="(\w+)"\] \{([^}]*)\}/g
    : /(?:^|\n)\[data-trait="(\w+)"\] \{([^}]*)\}/g;
  for (const [, trait, body] of lessons.matchAll(re)) {
    // Merged: a trait's dark stage (D13) is a rule of its own.
    out[trait] = {
      ...out[trait],
      ...Object.fromEntries(
        [...body.matchAll(/--(tone(?:-wash|-ink)?):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]])
      ),
    };
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

const light = {
  sand: token(css, "sand"),
  raised: token(css, "raised"),
  ground: token(css, "ground"),
  surface: token(css, "surface"),
};
const dark = {
  sand: token(darkRoot, "sand"),
  raised: token(darkRoot, "raised"),
  ground: token(darkRoot, "ground"),
  surface: token(darkRoot, "surface"),
};
/* The dark card's sheen: raised plus 3% white at its top edge. */
const sheen = mix("#ffffff", dark.raised, 0.03);

describe("Today's trait rings still measure", () => {
  const l = tones(false);
  const d = tones(true);

  it("reads all five tones and the neutral tokens, and no tone wears a second arc", () => {
    expect(Object.keys(l)).toHaveLength(5);
    expect(Object.keys(d)).toHaveLength(5);
    expect(light.sand).not.toBe(dark.sand);
    expect(today).not.toMatch(/--ring-arc:/);
  });

  for (const [trait, t] of Object.entries(l)) {
    it(`${trait}, light: the arc on sand at 3:1 or better`, () => {
      expect(ratio(t.tone, light.sand)).toBeGreaterThanOrEqual(3);
    });
  }
  for (const [trait, t] of Object.entries(d)) {
    it(`${trait}, dark: the arc on sand at 3:1 or better`, () => {
      expect(ratio(t.tone, dark.sand)).toBeGreaterThanOrEqual(3);
    });
  }
});

/*
 * The closing note's number (#423): the last results step sets the number
 * a trait's closing measured ("3 composed pauses") in the trait's tone, at
 * 24/800 on the ground, so the tone holds the 3:1 large type needs there,
 * for all five tones in both themes.
 */
describe("the closing note's number reads on the ground", () => {
  for (const [theme, set, ground] of [
    ["light", tones(false), light.ground],
    ["dark", tones(true), dark.ground],
  ] as const) {
    for (const [trait, t] of Object.entries(set)) {
      it(`${trait}, ${theme}: the tone at 3:1 or better on the ground`, () => {
        expect(ratio(t.tone, ground)).toBeGreaterThanOrEqual(3);
      });
    }
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
     * The lesson object on the card is drawn in its family's own hue, so
     * on the family's card it vanished (Pausing's blue on Pausing's blue,
     * 1.05:1). It stands on a solid disc instead (`.home-hero-art`): the
     * family's wash in light, its dark stage in dark, and the blurred lit
     * corner that stood behind the 3D object is gone from the card's fill
     * (it read as a smudge under a flat object). The family's base tone
     * (components/icons/flat/flat-icons.css) holds 2:1 or more on its
     * disc in both themes (it was 1.05 to 2.35 on the card itself).
     */
    it(`${f}: the object's base stands on its disc at 2:1 or better, light and dark`, () => {
      expect(block(".home-hero::before")).not.toMatch(/--home-lit|radial-gradient\(46% 42% at 84% 6%/);
      const kinds = LESSON_FAMILIES.find((x) => x.trait === f)!.kinds.filter((k) => k !== "target");
      const base = flat.match(new RegExp(`--fi-${kinds[0]}-base:\\s*(#[0-9a-f]{6})`))![1];
      for (const [sel, disc] of [
        [`.home-hero[data-family="${f}"]`, DISC[f].light],
        [`:root[data-theme="dark"] .home-hero[data-family="${f}"]`, DISC[f].dark],
      ] as const) {
        const body = block(sel);
        expect(hexOf(body, "home-disc"), sel).toBe(disc);
        expect(ratio(base, disc), `${sel} base on its disc`).toBeGreaterThanOrEqual(2);
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
  const rows = src("components/home/ModeRows.tsx");
  const foot = src("components/home/TodayFoot.tsx");
  const hero = src("components/home/HomeHero.tsx");

  /* #500, Timothy 18 Nov: "I don't fuck with all the cards on the
     homepage", and of the two tinted tiles, "it doesn't look that
     good". The games are rows on the ground, each led by its 3D mark,
     its name in its picture tone: the colour is in the mark and the
     name, never in a ground. */
  it("the games are rows on the ground: no fill, each led by its 3D mark, its name in its tone", () => {
    expect(rows).toContain("<StatIcon kind={t.id} size={72} />");
    expect(rows).toMatch(/tone-coral/);
    expect(rows).toMatch(/tone-sky/);
    expect(rows).not.toMatch(/elev-|className="card|home-tile/);
    expect(block("\n.home-mode")).not.toMatch(/background|box-shadow|filter/);
    expect(block(".home-mode-name")).toContain("color: var(--tone-ink);");
    // Their press is a wash that lights the row, never a fill at rest.
    expect(block(".home-mode::before")).toContain("opacity: 0;");
    expect(block(".home-mode:active::before")).toContain("opacity: 1;");
  });

  /* The tone's name is text on the page's ground: 4.5:1 in both themes. */
  it("each game's name in its tone's ink holds 4.5:1 on the ground in both themes", () => {
    const pop = (name: string) => {
      const all = [...css.matchAll(new RegExp(`--pop-${name}:\\s*(#[0-9a-f]{6})`, "gi"))].map((m) => m[1]);
      expect(all.length, name).toBe(2);
      return { light: all[0], dark: all[1] };
    };
    for (const tone of ["coral", "sky"]) {
      const ink = pop(`${tone}-ink`);
      expect(ratio(ink.light, light.ground), `${tone} light`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ink.dark, dark.ground), `${tone} dark`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the foot is type on the ground: no tile, no object, the numbers in ink", () => {
    expect(foot).not.toMatch(/<img|StatIcon|objectSrc|elev-|className="card|home-tile/);
    expect(block("\n.home-foot")).not.toMatch(/background|box-shadow|border/);
    expect(block(".home-fig-value")).toContain("font-weight: 800;");
    expect(block(".home-fig-value")).toContain("font-size: 1.5rem;");
    expect(block(".home-fig-label")).toContain("color: var(--color-stone-600);");
  });

  it("what is earned is sage: the cleared line's check, the run's wave, the Weekly boss done this week", () => {
    expect(block('.home-fig-mark[data-mark="check"],\n.home-fig-mark[data-mark="wave"]')).toContain("var(--color-sage-600)");
    expect(css).toContain(':root[data-theme="dark"] .home-fig-mark[data-mark="wave"] {\n  color: var(--color-sage-700);');
    expect(block(".home-mode-line[data-done]")).toContain("var(--color-sage-700)");
    expect(ratio(token(css, "sage-600"), light.ground)).toBeGreaterThanOrEqual(3);
    expect(ratio(token(darkRoot, "sage-700"), dark.ground)).toBeGreaterThanOrEqual(3);
    expect(block(".home-day[data-on]")).toContain("var(--color-sage-600)");
  });

  it("the card holds the one tap, 48px, and spin and difficulty as 48px glyphs", () => {
    expect(block(".home-start")).toMatch(/min-height: 48px;/);
    // Cut from the card since #459 (lib/tap.test.ts holds its colours):
    // the family's tint and its deep tone, white and ink with no colour yet.
    expect(block(".home-start")).toContain("background: var(--tap-tint, #ffffff);");
    expect(block(".home-start")).toContain("color: var(--tap-tint-ink, #201e1d);");
    expect(block(".home-start")).not.toContain("terracotta");
    expect(block(".home-glyph")).toMatch(/width: 48px;\s*height: 48px;/);
    expect(hero).toContain('aria-label="Spin a new topic"');
    // Nothing else on Today is terracotta-filled.
    for (const file of [rows, foot, src("app/page.tsx")]) {
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

/*
 * Start stands out on every day's card (D21). Start's row starts 82% of
 * the way down the 376px card (308px, measured at 390x844 and at 320),
 * so the card's gradient lands on its foot colour above that row and
 * every family's foot holds the 3:1 a control's edge needs against
 * Start's terracotta, in both themes. The foot used to land at 100%, so
 * Start stood on the gradient's middle at 2.1 to 3.0:1, under 3 on
 * Fillers and Restarts days. scripts/check-colour.mjs samples the
 * rendered pixels around the row as well.
 */
describe("Start stands on the card's foot", () => {
  const START_ROW = 308 / 376;
  const terracotta = token(css, "terracotta-500");

  it("the gradient lands on its foot at or above Start's row", () => {
    const g = block(".home-hero::before").match(/linear-gradient\(\d+deg, var\(--home-a\) 0%, var\(--home-b\) (\d+)%\)/);
    expect(g, "the card's linear gradient").not.toBeNull();
    expect(Number(g![1]) / 100).toBeLessThanOrEqual(START_ROW);
  });

  it("on a day not yet spoken the card holds 376, its object zone's foot 40px higher (#430 review)", () => {
    // 416 put a tester's road under the nav at 390x844 and 393x852.
    expect(css).not.toMatch(/\.home-hero\[data-spin="link"\]\s*\{\s*min-height:\s*416px/);
    expect(block(".home-hero")).toContain("--zone-b: clamp(140px, calc(71.4px + 28.57cqw), 160px);");
    expect(css).toMatch(/\.home-hero\[data-spin="link"\]\s*\{\s*--zone-b: clamp\(100px, calc\(31\.4px \+ 28\.57cqw\), 120px\);/);
  });

  it("on a day not yet spoken, where Start stands 40px higher, the foot comes sooner (#430 review)", () => {
    // 376 tall, Start's row then "Another topic" (40) and the padding (20) under it.
    const OPEN_START_ROW = (376 - 20 - 40 - 48) / 376;
    const g = block('.home-hero[data-spin="link"]::before').match(
      /linear-gradient\(\d+deg, var\(--home-a\) 0%, var\(--home-b\) (\d+)%\)/
    );
    expect(g, "the open-day card's linear gradient").not.toBeNull();
    expect(Number(g![1]) / 100).toBeLessThanOrEqual(OPEN_START_ROW);
  });
  for (const f of ["pause", "fillers", "repairs", "pace", "range"]) {
    it(`${f}: the foot holds Start at 3:1 or better, light and dark`, () => {
      for (const sel of [`.home-hero[data-family="${f}"]`, `:root[data-theme="dark"] .home-hero[data-family="${f}"]`]) {
        expect(ratio(hexOf(block(sel), "home-b"), terracotta), sel).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

/*
 * Where a trait's tone may be read (D05). A tone is a mark, a
 * measurement or a named ground, never a fill that happens to be handy:
 * the lesson page's next square in the solid tone and the Log's coloured
 * underlines were leaks. Every rule in globals.css that reads `--tone` or
 * `--tone-stage`, and every component that does (`tone-fill`,
 * `var(--tone)`, `(--tone-stage)`), names its form here, and anything
 * else fails. The introduction's pop tones (`--pop-*` on `.tone-sun` and
 * its siblings) share the variable but are never a trait.
 */
describe("a trait's tone is only ever one of its forms", () => {
  const FORMS = {
    mark: "an 8px square or dot beside a trait's name, a 3px tick on a track, or the underline under a word the transcript counted",
    measure: "a ring's arc, a bar on sand, the live waveform's stroke, or the closing note's number (#423)",
    chip: "TraitChip",
    ground: "a named ground: Today's card, the lesson stage, the trait stage, the recording's topic card, Say it better's stage (#507)",
    pop: "the introduction's pop tones, never a trait",
  } as const;
  type Form = keyof typeof FORMS;
  const RULES: Record<string, Form> = {
    ".intro-stage": "pop",
    ':root[data-theme="dark"] .intro-stage': "pop",
    ".demos-halo[data-solid]": "pop",
    ".game-tile": "pop",
    ':root[data-theme="dark"] .game-tile': "pop",
    // The utility; the components that use it are held below.
    ".tone-fill": "chip",
    // The dark stage of any trait outside the five (the five set their own).
    ':root[data-theme="dark"] [data-trait]': "ground",
    ".trait-dot": "mark",
    // The Log's line (#506): the ring and the dot cut from the stage's own
    // sky, so the line runs into them rather than through them.
    ".log-ring": "pop",
    ".log-dot": "pop",
    // The recording screen's live waveform (S08, D51).
    ".rec-wave": "measure",
    ':root[data-theme="dark"] .rec-wave': "measure",
    // The transcript's counted words and the word sheet's word (#411):
    // the Fillers tone under a filler, Variety's under a vague or
    // repeated word, and the key's scrap of each line.
    ".tw[data-word-mark]": "mark",
    ".tw-key": "mark",
    '.tw-key[data-word-mark="repeat"]': "mark",
    ".word-sheet-word[data-word-mark]": "mark",
    ".word-in-sentence[data-word-mark]": "mark",
    // The scoring wait's words (#472): the same bar under a counted filler.
    ".wait-filler": "mark",
    // The closing note over a trait's reading (#423): its short rule, a
    // tick, and the number the take measured.
    '.closing-note[data-ink="trait"] .closing-note-mark': "mark",
    '.closing-note[data-ink="trait"] .closing-note-value': "measure",
    // The warm-up's pause mark (#477): where the pause goes in the sentence, in Pausing's tone.
    ".pause-mark > i": "mark",
    // Say it better (#507): the weak phrase you said under Variety's wave
    // (the transcript's own mark for a vague phrase), the better one under
    // a solid line where it goes, and the stage the page and the test stand on.
    ".say-weak": "mark",
    ".say-answer": "mark",
    ".say-stage": "ground",
  };
  const FILES: Record<string, Form> = {
    "app/lessons/[id]/page.tsx": "ground",
    "app/practice/[trait]/page.tsx": "ground",
    "components/LessonScreen.tsx": "ground",
    "components/Ring.tsx": "measure",
    "components/AudioScrubber.tsx": "mark",
    "components/DimensionList.tsx": "mark",
    "components/TraitChip.tsx": "chip",
  };
  const READS = /var\(--tone(?:-stage)?[,)]/;

  it("every stylesheet rule that reads a tone is one of the forms", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const stray: string[] = [];
    for (const [, sel, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const name = sel.trim().replace(/\s+/g, " ");
      if (READS.test(body) && !(name in RULES)) stray.push(name);
    }
    expect(stray).toEqual([]);
  });

  it("every component that reads a tone is one of the forms", async () => {
    const { globSync } = await import("node:fs");
    const files = [
      ...globSync("app/**/*.tsx", { cwd: path.resolve(__dirname, "..") }),
      ...globSync("components/**/*.tsx", { cwd: path.resolve(__dirname, "..") }),
    ].filter((f) => !f.startsWith("app/workbench/"));
    const stray = files.filter(
      (f) => /\btone-fill\b|var\(--tone(?:-stage)?[,)]|\(--tone(?:-stage)?\)/.test(src(f)) && !(f in FILES)
    );
    expect(stray).toEqual([]);
  });

  it("the lesson page's next square is ink, not the trait's solid", () => {
    const page = src("app/lessons/[id]/page.tsx");
    expect(page).not.toMatch(/\btone-fill\b|\btone-on\b/);
    expect(page).toContain('"bg-ink text-ground"');
  });
});

/*
 * Today's colour under the card is measured in the browser
 * (scripts/check-colour.mjs): the share of chromatic pixels between the
 * card's foot and the tab bar at 390x844. Its pin is the figure measured
 * after the home round (#393), with 10% headroom and no more, so a
 * looser ceiling is a change somebody has to make here.
 */
describe("Today's colour under the card is pinned", () => {
  const gate = readFileSync(path.resolve(__dirname, "../scripts/check-colour.mjs"), "utf8");
  it("the gate carries a measured pin for both themes and 10% headroom", () => {
    const pin = gate.match(/const TODAY_COLOUR_PIN = \{ light: ([\d.]+), dark: ([\d.]+) \};/);
    expect(pin, "TODAY_COLOUR_PIN").not.toBeNull();
    for (const v of pin!.slice(1).map(Number)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(5);
    }
    expect(gate).toMatch(/const HEADROOM = 1\.1;/);
  });
});

/*
 * The neutral and semantic tokens S05 moved (D01, D12, D13, D39).
 */
describe("the tokens the colour round moved", () => {
  const stages = (theme: "dark") =>
    Object.fromEntries(
      [...lessons.matchAll(/:root\[data-theme="dark"\] \[data-trait="(\w+)"\] \{\s*--tone-stage:\s*(#[0-9a-f]{6});\s*\}/gi)].map(
        (m) => [m[1], m[2]]
      )
    ) as Record<string, string>;

  it("dark cards separate from the ground by their fill, 1.3:1 or better", () => {
    expect(ratio(dark.raised, dark.ground)).toBeGreaterThanOrEqual(1.3);
  });
  it("each trait has its own dark stage that carries white at 10:1", () => {
    const s = stages("dark");
    expect(Object.keys(s).sort()).toEqual(["fillers", "pace", "pause", "range", "repairs"]);
    for (const [trait, hex] of Object.entries(s)) {
      expect(ratio("#ffffff", hex), trait).toBeGreaterThanOrEqual(10);
      expect(ratio(hex, dark.ground), trait).toBeGreaterThanOrEqual(1.5);
    }
  });
  it("destructive red reads as text on every card and row it sits on", () => {
    const red = token(css, "destructive");
    const redDark = token(darkRoot, "destructive");
    expect(ratio(red, light.raised)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(red, token(css, "surface"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(redDark, dark.raised)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(redDark, token(darkRoot, "surface"))).toBeGreaterThanOrEqual(4.5);
    expect(red).not.toBe(token(css, "terracotta-600"));
  });
  it("the segmented trough sits under its thumb, and only the segmented controls use it", () => {
    // Translucent ink in light, so it is a step under whatever row holds it.
    const m = css.match(/--color-trough:\s*rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
    expect(m, "--color-trough").not.toBeNull();
    const [r, g, b, a] = m!.slice(1).map(Number);
    const over = (ground: string) =>
      "#" + rgb(ground).map((v, i) => Math.round([r, g, b][i] * a + v * (1 - a)).toString(16).padStart(2, "0")).join("");
    expect(over(light.ground)).toBe("#ececec");
    expect(ratio(light.raised, over(light.ground))).toBeGreaterThanOrEqual(1.15);
    expect(ratio(light.raised, over(token(css, "surface")))).toBeGreaterThanOrEqual(1.25);
    expect(darkRoot).toMatch(/--color-trough: var\(--color-surface\);/);
    const users = [...css.matchAll(/([^{}]+)\{[^{}]*var\(--color-trough\)[^{}]*\}/g)].map((m) =>
      m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim()
    );
    expect(users.sort()).toEqual([".segmented"]);
  });
  it("a light card's shadow is one tight layer beside its edge", () => {
    const shadow = css.match(/:root \{[^}]*--shadow-1:\s*([^;]+);/);
    expect(shadow?.[1].trim()).toBe("0 1px 2px rgba(0, 0, 0, 0.06)");
  });
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

/*
 * Hear it back's pause bands on the track's sand (#425, Timothy: a
 * well-held pause barely showed beside the filler ticks). The track is
 * `sand`, and its marks are graphics: a pause that landed a point is the
 * pause map's solid sage-600, which holds the 3:1 a mark needs on sand
 * in both themes, as the filler ticks do; a searching pause stays the
 * quiet stone it was before #425, told from the sand at 1.4 to 2:1 and
 * well under the landed band (its review: at /35 and 4px a long take's
 * ten searching pauses were a fifth of the track, so it is /30 again,
 * drawn to scale); and the playhead, crossing a landed band, holds 3:1
 * against the sage (the dark theme's light ink is 2.25:1 there, so it
 * takes the ground's near-black). Not a trait's tone: sage is earned,
 * and the classes are read from the component, so changing one without
 * measuring it fails here.
 */
describe("Hear it back's pause bands read on the track (#425)", async () => {
  const { PAUSE_MARK, PLAYHEAD_ON_LANDED } = await import("@/components/AudioScrubber");
  const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"] {'));
  const lightBlock = css.slice(0, css.indexOf(':root[data-theme="dark"] {'));
  /** A `bg-<token>[/<pct>]` class as an opaque colour over `under`. */
  const fill = (block: string, cls: string, under: string) => {
    const m = cls.match(/^bg-([a-z]+(?:-\d+)?)(?:\/(\d+))?$/);
    if (!m) throw new Error(`not a token fill: ${cls}`);
    const v = block.match(new RegExp(`--color-${m[1]}:\\s*([^;]+);`))?.[1].trim();
    if (!v) throw new Error(`no --color-${m[1]}`);
    const opacity = m[2] ? Number(m[2]) / 100 : 1;
    const rgba = v.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
    const [c, a] = rgba ? [[1, 2, 3].map((i) => Number(rgba[i])), Number(rgba[4]) * opacity] : [rgb(v), opacity];
    const u = rgb(under);
    return "#" + c.map((x, i) => Math.round(x * a + u[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
  };
  const themes = [
    ["light", lightBlock, light.sand],
    ["dark", darkBlock, dark.sand],
  ] as const;

  it("stands its marks on sand", () => {
    expect(src("components/AudioScrubber.tsx")).toContain('className="relative h-8 overflow-hidden bg-sand"');
    expect(PAUSE_MARK.landed).toBe("bg-sage-600");
    expect(PAUSE_MARK.searching).toBe("bg-stone-400/30");
  });
  for (const [theme, block, sand] of themes) {
    const landed = ratio(fill(block, PAUSE_MARK.landed, sand), sand);
    const quiet = ratio(fill(block, PAUSE_MARK.searching, sand), sand);
    it(`${theme}: a landed band at 3:1 or better on the sand`, () => {
      expect(landed).toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: a searching band quiet, 1.4 to 2:1 on the sand, under half the landed band's weight`, () => {
      expect(quiet).toBeGreaterThanOrEqual(1.4);
      expect(quiet).toBeLessThanOrEqual(2);
      expect(landed / quiet).toBeGreaterThanOrEqual(2);
    });
    it(`${theme}: the playhead at 3:1 or better over a landed band`, () => {
      const [base, darkOnly] = PLAYHEAD_ON_LANDED.split(" ");
      const head = theme === "dark" && darkOnly ? darkOnly.replace(/^dark:/, "") : base;
      expect(ratio(fill(block, head, sand), fill(block, PAUSE_MARK.landed, sand))).toBeGreaterThanOrEqual(3);
    });
  }
  it("measures what the comment and the log say: 3.65 and 5.02 landed, 1.48 and 1.69 searching", () => {
    const at = (theme: number, cls: string) => ratio(fill(themes[theme][1], cls, themes[theme][2]), themes[theme][2]).toFixed(2);
    expect([at(0, PAUSE_MARK.landed), at(1, PAUSE_MARK.landed), at(0, PAUSE_MARK.searching), at(1, PAUSE_MARK.searching)]).toEqual(["3.65", "5.02", "1.48", "1.69"]);
  });
});
