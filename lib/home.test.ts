import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSONS, lessonById } from "@/content/lessons";
import { PATH } from "@/content/path";
import { TRAIT, TRAITS, type TraitId } from "@/content/traits";
import type { Challenge } from "./challenge";
import type { RepRow } from "./client-data";
import {
  HOUSE_OBJECT,
  LINE_NAME,
  LINE_WORDS,
  RUN_NAME,
  TACTIC_OBJECT,
  artBox,
  TRAIT_OBJECT,
  TRAIT_OBJECTS,
  dayTurned,
  greetingName,
  heroObject,
  initialOf,
  fmtLine,
  lineFigure,
  objectSrc,
  runFigure,
} from "./home";
import { ART_BOUNDS } from "./lesson-art-bounds";

/*
 * Today, "the object" (#393). The card stands the glass object of the
 * tactic it leads with, every trait and every lesson has one, and every
 * number the foot prints (#500) is one of the person's own or a dash,
 * never a zero for something unknown.
 */
const root = path.resolve(__dirname, "..");

describe("every practice has its object", () => {
  it("each trait's three tactics map to a lesson of its own trait, by what the lesson teaches", () => {
    for (const t of TRAITS) {
      const ids = TACTIC_OBJECT[t.id];
      expect(ids).toHaveLength(t.howTo.length);
      for (const id of ids) expect(lessonById(id)?.trait, id).toBe(t.id);
    }
    // Where a tactic names its lesson, the lesson's object stands beside it.
    expect(TACTIC_OBJECT.pause).toEqual(["inside-or-after", "the-long-one", "the-landing"]);
    expect(TACTIC_OBJECT.repairs).toEqual(["finish-it", "or-rather", "know-the-landing"]);
    expect(TACTIC_OBJECT.range[0]).toBe("name-it-once");
    expect(TACTIC_OBJECT.range[2]).toBe("short-and-concrete");
    // "Stay quiet instead of saying um" (once "Let the gap sit", #483) is
    // a shut mouth holding a silence: the zip, not the overused-word
    // magnifier it once took by its place in the list.
    expect(TRAIT.fillers.howTo[2]).toMatch(/Stay quiet instead of saying "um"/);
    expect(TACTIC_OBJECT.fillers[2]).toBe("closed-mouth");
    expect(TACTIC_OBJECT.fillers).not.toContain("the-crutch");
  });

  it("each trait's own object is one of its lessons, and Pausing's is the hourglass", () => {
    for (const t of TRAITS) {
      expect(lessonById(TRAIT_OBJECT[t.id])?.trait).toBe(t.id);
      // The tile's order is the trait's three lessons, every one of them.
      expect([...TRAIT_OBJECTS[t.id]].sort()).toEqual(
        LESSONS.filter((l) => l.trait === t.id).map((l) => l.id).sort()
      );
    }
    expect(TRAIT_OBJECT.pause).toBe("the-long-one");
    expect(HOUSE_OBJECT).toBe("the-long-one");
  });

  it("every practice on the path resolves to an object of its own trait, its file on disk", () => {
    for (const p of PATH) {
      const id = heroObject(p.trait, p.tips[0]);
      expect(lessonById(id)?.trait, p.id).toBe(p.trait);
      expect(existsSync(path.join(root, "public", objectSrc(id))), id).toBe(true);
    }
  });

  it("the tactic picks the object; an unknown tip falls back to the trait's; no trait is the house's", () => {
    expect(heroObject("pause", TRAIT.pause.howTo[1])).toBe("the-long-one");
    expect(heroObject("pause", TRAIT.pause.howTo[0])).toBe("inside-or-after");
    expect(heroObject("fillers", TRAIT.fillers.howTo[0])).toBe("closed-mouth");
    expect(heroObject("pace", "Say which side you're on in your first sentence.")).toBe(TRAIT_OBJECT.pace);
    expect(heroObject(null)).toBe(HOUSE_OBJECT);
  });

  /* #478, #500: under the card only the games' two marks stand, and
     they are the stat icons' drawings (components/StatIcon.tsx), never a
     lesson's object. The card keeps its own. */
  it("only the card stands a lesson's object: the games' rows wear their stat marks, the foot none", () => {
    const rows = readFileSync(path.join(root, "components", "home", "ModeRows.tsx"), "utf8");
    expect(rows).not.toMatch(/objectSrc|artBox|\/lessons\//);
    expect(rows).toContain("<StatIcon kind={t.id} size={72} />");
    const foot = readFileSync(path.join(root, "components", "home", "TodayFoot.tsx"), "utf8");
    expect(foot).not.toMatch(/<img|StatIcon|objectSrc/);
    for (const gone of ["HomeTiles", "WeekTiles", "ModeTiles"]) {
      expect(existsSync(path.join(root, "components", "home", `${gone}.tsx`)), gone).toBe(false);
    }
    expect(existsSync(path.join(root, "components", "TraitGlyph.tsx"))).toBe(false);
  });

  it("each object is a vector on its own square: the file is an SVG with the 96u viewBox", () => {
    for (const l of LESSONS) {
      const svg = readFileSync(path.join(root, "public", objectSrc(l.id)), "utf8");
      expect(svg, l.id).toMatch(/^<svg [^>]*viewBox="0 0 96 96"/);
    }
  });
});

/*
 * The fix round's object placement: every object is stood by the box
 * its visible pixels fill (lib/lesson-art-bounds.ts), inside the card's
 * object zone (`.home-hero` in app/globals.css). The zone's edges are
 * read from the CSS and evaluated at 320 and 390, and every one of the
 * fifteen must rise out of the card by the same distance, keep 12px or
 * more clear of the words' column, end above the topic and stay inside
 * the card's edge. (The browser check of the same, pixel by pixel, is
 * the fix round's objects.mjs; this holds the numbers it relied on.)
 */
describe("every object stands in the card's zone, by its visible box", () => {
  const css = readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const home = css.slice(css.indexOf("/* the home (#393) */"), css.indexOf("end of the home (#393)"));
  const heroBlock = home.slice(home.indexOf("\n.home-hero {"), home.indexOf("}", home.indexOf("\n.home-hero {")));
  const zone = (name: string) => {
    const m = heroBlock.match(new RegExp(`--zone-${name}:\\s*([^;]+);`));
    if (!m) throw new Error(`no --zone-${name}`);
    return m[1];
  };
  /* calc(), clamp(), max(), px and cqw: all the zones use. */
  const at = (expr: string, content: number, vars: Record<string, number> = {}) =>
    Function(
      "clamp",
      "max",
      `return ${expr
        .replace(/var\(--([\w-]+)(?:, ?([\d.]+)px)?\)/g, (_, n, d) => String(vars[n] ?? d))
        .replace(/calc\(/g, "(")
        .replace(/([\d.]+)cqw/g, (_, n) => `(${n}*${content}/100)`)
        .replace(/([\d.]+)px/g, "$1")};`
    )((lo: number, v: number, hi: number) => Math.min(Math.max(lo, v), hi), Math.max) as number;
  const wordsMin = home.match(/\.home-hero-words \{[^}]*min-height: calc\(var\(--zone-b\) - (\d+)px\)/);
  /* Under 360 (D22) the words take 56% and the zone its own edges. */
  const narrowAt = home.indexOf("@media (max-width: 359px) {\n  .home-hero {");
  const narrow = home.slice(narrowAt, home.indexOf("\n}\n", narrowAt));
  const narrowZone = (name: string) => narrow.match(new RegExp(`--zone-${name}:\\s*([^;]+);`))?.[1] ?? null;
  /* A short phone (320x568, the final pass of 19 Nov): the object 100px tall, the topic a step down. */
  const shortAt = home.indexOf("@media (max-width: 359px) and (max-height: 640px) {");
  const short = home.slice(shortAt, home.indexOf("\n}\n", shortAt));
  const shortZone = (name: string) => short.match(new RegExp(`--zone-${name}:\\s*([^;]+);`))?.[1] ?? null;

  it("reads a box for every lesson, and the card's zone from the CSS", () => {
    expect(Object.keys(ART_BOUNDS).sort()).toEqual(LESSONS.map((l) => l.id).sort());
    for (const b of Object.values(ART_BOUNDS)) {
      expect(b.r).toBeGreaterThan(b.l);
      expect(b.b).toBeGreaterThan(b.t);
    }
    expect(wordsMin).not.toBeNull();
    expect(narrowAt).toBeGreaterThan(0);
    expect(narrowZone("l")).not.toBeNull();
    expect(narrowZone("b")).toBe("calc(var(--zone-t) + 120px)");
    expect(narrow).toMatch(/\.home-hero-words \{\s*max-width: 56%;/);
    expect(artBox("the-long-one")).toEqual({
      "--art-l": ART_BOUNDS["the-long-one"].l,
      "--art-t": ART_BOUNDS["the-long-one"].t,
      "--art-w": Math.round((ART_BOUNDS["the-long-one"].r - ART_BOUNDS["the-long-one"].l) * 10000) / 10000,
      "--art-h": Math.round((ART_BOUNDS["the-long-one"].b - ART_BOUNDS["the-long-one"].t) * 10000) / 10000,
    });
  });

  it("on a short phone the object stands 100px tall and the topic takes the size a step down", () => {
    expect(shortAt).toBeGreaterThan(narrowAt);
    expect(shortZone("b")).toBe("calc(var(--zone-t) + 100px)");
    expect(short).toMatch(/\.home-display \{\s*font-size: 8\.8vw;/);
    expect(short).toMatch(/\.home-display\[data-long\] \{\s*font-size: 7\.4vw;/);
    // The roulette's reel in the same card, a step down too.
    expect(short).toMatch(/\.home-display\.home-reel \{\s*--reel-fs: min\(1\.75rem, 9\.4cqw\);/);
    // A day already spoken: under the trait and the tactic, the topic takes 16, not 24.
    expect(short).toMatch(/\.home-hero\[data-spin="glyph"\] \.home-hero-words:has\(\.tip-glyph\) ~ \.home-display \{\s*padding-top: 16px;/);
    // The sizes are the scale's own steps (34's and 28's at 320), never a new one.
    expect(home).toMatch(/\.home-display\[data-long\] \{\s*font-size: min\(2\.125rem, 8\.8vw\);/);
    expect(home).toMatch(/\.home-display\[data-longer\] \{\s*font-size: min\(1\.75rem, 7\.4vw\);/);
  });

  for (const [width, rise, words, shortPhone] of [
    [320, 22, 0.56, false],
    [320, 22, 0.56, true],
    [390, 48, 0.52, false],
  ] as const) {
    it(`at ${width}${shortPhone ? " on a short phone" : ""}: all fifteen rise ${rise}px, clear the words by 12px, end above the topic, inside the card`, () => {
      const content = width - 40 - 40; // the column's gutters, then the card's padding
      const card = content + 40;
      const small = width < 360;
      const t = at(zone("t"), content);
      const zoneOf = (n: string) =>
        shortPhone && shortZone(n) ? shortZone(n)! : small && narrowZone(n) ? narrowZone(n)! : zone(n);
      const [l, r, b] = ["l", "r", "b"].map((n) => at(zoneOf(n), content, { "zone-t": t }));
      const column = 20 + words * content;
      expect(t).toBeCloseTo(-rise, 0);
      // The topic starts 24px under the words, which hold the zone's height.
      const topic = 20 + (b - Number(wordsMin![1])) + 24;
      for (const id of LESSONS.map((x) => x.id)) {
        const box = artBox(id);
        const s = Math.min((b - t) / box["--art-h"], (r - l) / box["--art-w"]);
        const left = (l + r) / 2 - (s * box["--art-w"]) / 2;
        expect(left - column + 1e-6, `${id} clear of the words`).toBeGreaterThanOrEqual(12);
        expect(left + s * box["--art-w"], `${id} inside the card`).toBeLessThanOrEqual(card - 8);
        expect(t + s * box["--art-h"] - 1e-6, `${id} above the topic`).toBeLessThanOrEqual(topic - 6);
        if (small) expect(s * box["--art-h"], `${id} at ${shortPhone ? 100 : 120}px at most`).toBeLessThanOrEqual((shortPhone ? 100 : 120) + 0.01);
        /* A day already spoken on a short phone: the words hold at least the
           lead (18), the trait's chip (22) and one line of the tactic (18),
           8 apart, and the topic stands 16 under them. */
        if (shortPhone) expect(t + s * box["--art-h"] - 1e-6, `${id} above One more's topic`).toBeLessThanOrEqual(20 + (18 + 8 + 22 + 8 + 18) + 16 - 6);
      }
    });
  }
});

/*
 * Under the card (#500 review). The games' words hang from the row's
 * top: a one-line topic centred in the two lines a row holds stood the
 * name as far from its own topic as from the row above, and the boss's
 * topic is one line nearly every week. And the two expressions that
 * place things against the tab bar count the status bar's inset, since
 * the header starts under it: a bare 734 put the foot half under the
 * glass at 430x932 with a 59 inset, and a bare 160 put Another topic on
 * the bar's edge on an installed SE.
 */
describe("under the card: the rows hang from their top, and the bar's sums count the status bar", () => {
  const css = readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const rule = (sel: string, from = 0) => {
    const at = css.indexOf(`${sel} {`, from);
    expect(at, sel).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("\n}", at));
  };
  it("each row's words, mark and chevron stand from its top, and the subject holds no lines of its own", () => {
    expect(rule("\n.home-mode")).toMatch(/align-items: flex-start;/);
    expect(rule("\n.home-mode")).toMatch(/min-height: 81px;/);
    const subject = rule("\n.home-mode-subject");
    expect(subject).not.toMatch(/min-height|align-items|display: flex/);
    expect(rule(".home-mode > svg:last-child")).toContain("margin-top: calc((var(--mark) - 14px) / 2);");
  });
  it("the foot's --rows-end and the card's short-screen height both take the top inset", () => {
    const ends = [...css.matchAll(/--rows-end: ([^;]+);/g)].map((m) => m[1]);
    expect(ends).toEqual(["calc(734px + env(safe-area-inset-top))", "calc(730px + env(safe-area-inset-top))"]);
    const hero = rule("\n.home-hero");
    const min = hero.slice(hero.indexOf("min-height: min("), hero.indexOf(");\n", hero.indexOf("min-height: min(")));
    expect(min).toContain("376px");
    expect(min).toMatch(/100svh - 160px - env\(safe-area-inset-top\) - var\(--nav-h\)/);
  });
});

/*
 * The foot (#500): the two numbers only Today holds, each a figure over
 * one plain line (#483's two seconds). Timothy could not read "Restarts";
 * "Clean run 46s" and a bare "Today's line 1.0" were the same kind of
 * label.
 */
describe("the foot's words are the traits' own units, split where the number stands", () => {
  it("noun and rate join to the unit Lessons and the results print", () => {
    for (const t of TRAITS) {
      const w = LINE_WORDS[t.id];
      expect(`${w.noun} ${w.rate}`, t.id).toBe(t.unit);
      expect(`${w.noun} ${w.rate}`).not.toMatch(/\/|wpm|per hundred|per minute/);
    }
  });
});

describe("today's line at the foot", () => {
  const line = (over: Partial<Challenge>): Challenge => ({
    trait: "pause",
    line: 1.8,
    direction: "higher",
    value: 0,
    closed: false,
    today: null,
    cleared: { n: 4, of: 5 },
    week: "2026-10-26",
    q: 0.3,
    ...over,
  });

  it("an open line is the number to beat over what to do, in words", () => {
    expect(lineFigure(line({}))).toEqual({
      state: "open",
      figure: "1.8",
      rate: "a minute",
      label: "Today's line: more pauses between sentences",
      said: "Today's line: over 1.8 pauses between sentences a minute.",
    });
    expect(lineFigure(line({ trait: "fillers", direction: "lower", line: 0.9 }))).toMatchObject({
      figure: "0.9",
      rate: "in 100 words",
      label: "Today's line: fewer um or uh",
    });
    expect(lineFigure(line({ trait: "repairs", direction: "lower", line: 1.2 })).label).toBe("Today's line: fewer sentence restarts");
    expect(lineFigure(line({ trait: "range", direction: "higher", line: 62 })).label).toBe(
      "Today's line: more different words"
    );
  });

  it("a day short of it reads the same; a cleared one shows the number that cleared it, and says so", () => {
    expect(lineFigure(line({ today: 0.9 }))).toMatchObject({ state: "open", figure: "1.8" });
    expect(lineFigure(line({ today: 2.6, closed: true, value: 1 }))).toEqual({
      state: "closed",
      figure: "2.6",
      rate: "a minute",
      label: "Today's line, cleared",
      said: "Today's line, cleared with 2.6 pauses between sentences a minute.",
    });
  });

  it("a line of 1.0 prints 1.0, at the line's precision, never 1", () => {
    expect(fmtLine(1)).toBe("1.0");
    expect(fmtLine(0.96)).toBe("1.0");
    expect(fmtLine(1.84)).toBe("1.8");
    expect(fmtLine(9.96)).toBe("10.0");
    expect(fmtLine(145.4)).toBe("145");
    expect(fmtLine(62)).toBe("62");
    expect(lineFigure(line({ line: 1 })).figure).toBe("1.0");
    expect(lineFigure(line({ line: 1, today: 1, closed: true })).figure).toBe("1.0");
  });

  /* Pace's line is a distance from its zone (progress-2, lib/challenge.ts):
     never "Over 104". The figure is the zone; the words name the line. */
  it("a pace line prints the zone and names the line, never over or under one number", () => {
    const pace = (over: Partial<Challenge>) =>
      line({ trait: "pace", direction: "band", line: 100, cleared: { n: 3, of: 4 }, ...over });
    expect(lineFigure(pace({}))).toMatchObject({
      figure: "130 to 160",
      rate: "words a minute",
      label: "Today's line: closer than 100",
    });
    expect(lineFigure(pace({ line: 145 })).label).toBe("Today's line: stay inside it");
    expect(lineFigure(pace({ today: 178, closed: true }))).toMatchObject({ state: "closed", figure: "178" });
    for (const today of [null, 178, 145, 190]) {
      const f = lineFigure(pace({ today, closed: today !== null }));
      expect(`${f.label} ${f.said}`).not.toMatch(/\b(over|under) \d/i);
      expect(`${f.label} ${f.said}`).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("under three readings it is a dash and what sets it, never a zero", () => {
    expect(lineFigure(null)).toEqual({
      state: "none",
      figure: null,
      rate: "",
      label: "Today's line: three recordings set it",
      said: "Today's line: three recordings set it.",
    });
  });

  it("every label is one line of words, no full stop, no em dash, and starts with the line's name", () => {
    const all = [
      lineFigure(null),
      lineFigure(line({})),
      lineFigure(line({ today: 2, closed: true })),
      lineFigure(line({ trait: "pace", direction: "band", line: 100 })),
    ];
    for (const f of all) {
      expect(f.label.startsWith(LINE_NAME)).toBe(true);
      expect(f.label).not.toMatch(/\.$|\u2014/);
      expect(f.said).toMatch(/\.$/);
    }
  });
});

describe("the longest stretch with no filler at the foot", () => {
  /** Enough words to score (`measured`). */
  const SAID =
    "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";
  const rep = (fillers: number[], duration = 60, transcript = SAID): RepRow =>
    ({ fillers: fillers.map((t) => ({ word: "um", t })), duration_s: duration, transcript }) as RepRow;

  it("reads the newest scored recording's longest stretch in whole seconds, and says what it is", () => {
    expect(runFigure([rep([30])])).toEqual({
      state: "open",
      figure: "30",
      rate: "s",
      label: "Longest with no filler, in your last recording",
      said: "Longest with no filler, in your last recording: 30 seconds.",
    });
    expect(runFigure([rep([50]), rep([20], 65)])).toMatchObject({ figure: "45", label: "Longest with no filler, in your last recording" });
    expect(runFigure([rep([20]), rep([])])).toMatchObject({ figure: "60", label: "Longest with no filler, a new best" });
  });

  it("is named for what it is, apart from You's Clean run badge", () => {
    expect(RUN_NAME).toBe("Longest with no filler");
    expect(RUN_NAME).not.toMatch(/run/i);
  });

  /* A one-word 8s take read "Clean run 8s, of 8s". */
  it("skips a take too short to score, and is a dash until one scores", () => {
    const word = rep([], 8.3, "Hello.");
    expect(runFigure([rep([30]), word])).toMatchObject({ figure: "30" });
    expect(runFigure([word])).toMatchObject({ state: "none", figure: null, label: "Longest with no filler: your first recording sets it" });
    expect(runFigure([])).toMatchObject({ state: "none", figure: null });
  });
});

/*
 * Today left open across midnight kept yesterday's date, a lit streak
 * and "One more" (progress-5): a return on a new local day reads again.
 */
describe("the day turning over", () => {
  it("turns at local midnight, and never before the first read", () => {
    const night = new Date(2026, 10, 5, 23, 50);
    expect(dayTurned(night, new Date(2026, 10, 5, 23, 59))).toBe(false);
    expect(dayTurned(night, new Date(2026, 10, 6, 0, 10))).toBe(true);
    expect(dayTurned(new Date(2026, 10, 6, 0, 1), new Date(2026, 10, 6, 8, 20))).toBe(false);
    expect(dayTurned(null, new Date(2026, 10, 6, 0, 10))).toBe(false);
  });
});

describe("the greeting", () => {
  it("greets the first word of the name, and nobody without one", () => {
    expect(greetingName("Timothy")).toBe("Timothy");
    expect(greetingName("  Timothy Mota ")).toBe("Timothy");
    expect(greetingName("")).toBeNull();
    expect(greetingName("   ")).toBeNull();
    expect(greetingName(null)).toBeNull();
  });

  it("the coin takes the initial, or nothing for the neutral glyph", () => {
    expect(initialOf("timothy")).toBe("T");
    expect(initialOf("Émile")).toBe("É");
    expect(initialOf(null)).toBeNull();
  });
});
