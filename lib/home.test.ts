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
  RUN_FIRST,
  RUN_NAME,
  TACTIC_OBJECT,
  artBox,
  tileUnit,
  TRAIT_OBJECT,
  TRAIT_OBJECTS,
  cleanRunTile,
  dayTurned,
  greetingName,
  heroObject,
  initialOf,
  fmtLine,
  objectSrc,
  signed,
  traitOrder,
  weekView,
  wideLine,
} from "./home";
import { ART_BOUNDS } from "./lesson-art-bounds";
import type { TraitReading } from "./trait-readings";

/*
 * Today, "the object" (#393). The card stands the glass object of the
 * tactic it leads with, every trait and every lesson has one, and every
 * number a tile prints is one of the person's own or a dash, never a
 * zero for something unknown.
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

  it("every practice on the path resolves to an object of its own trait, cut at both sizes", () => {
    for (const p of PATH) {
      const id = heroObject(p.trait, p.tips[0]);
      expect(lessonById(id)?.trait, p.id).toBe(p.trait);
      for (const large of [false, true]) {
        expect(existsSync(path.join(root, "public", objectSrc(id, large))), `${id} ${large}`).toBe(true);
      }
    }
  });

  it("the tactic picks the object; an unknown tip falls back to the trait's; no trait is the house's", () => {
    expect(heroObject("pause", TRAIT.pause.howTo[1])).toBe("the-long-one");
    expect(heroObject("pause", TRAIT.pause.howTo[0])).toBe("inside-or-after");
    expect(heroObject("fillers", TRAIT.fillers.howTo[0])).toBe("closed-mouth");
    expect(heroObject("pace", "Say which side you're on in your first sentence.")).toBe(TRAIT_OBJECT.pace);
    expect(heroObject(null)).toBe(HOUSE_OBJECT);
  });

  /* #478: the tiles under the card stand no object. The emblems were each
     trait's first lesson object (D22); the card keeps its own. */
  it("only the card stands an object: the tiles draw a flat glyph each, every one its own", () => {
    const tiles = readFileSync(path.join(root, "components", "home", "HomeTiles.tsx"), "utf8");
    expect(tiles).not.toMatch(/<img|objectSrc|tileObject|artBox/);
    const glyphs = readFileSync(path.join(root, "components", "TraitGlyph.tsx"), "utf8");
    const icons = TRAITS.map((t) => glyphs.match(new RegExp(`\\n  ${t.id}: \\(s\\) => <(Icon\\w+) size=\\{s\\} />`))?.[1]);
    expect(icons.every(Boolean), JSON.stringify(icons)).toBe(true);
    expect(new Set(icons).size).toBe(TRAITS.length);
  });

  it("the large cut carries transparency like the thumbnails", () => {
    for (const l of LESSONS) {
      const head = readFileSync(path.join(root, "public", objectSrc(l.id, true))).subarray(0, 64);
      expect(head.toString("ascii", 12, 16), l.id).toBe("VP8X");
      expect(head[20] & 0x10, l.id).toBe(0x10);
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

  for (const [width, rise, words] of [
    [320, 22, 0.56],
    [390, 48, 0.52],
  ] as const) {
    it(`at ${width}: all fifteen rise ${rise}px, clear the words by 12px, end above the topic, inside the card`, () => {
      const content = width - 40 - 40; // the column's gutters, then the card's padding
      const card = content + 40;
      const small = width < 360;
      const t = at(zone("t"), content);
      const zoneOf = (n: string) => (small && narrowZone(n) ? narrowZone(n)! : zone(n));
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
        if (small) expect(s * box["--art-h"], `${id} at 120px at most`).toBeLessThanOrEqual(120.01);
      }
    });
  }
});

describe("a tile's unit is the trait's own, in words (#495)", () => {
  it("is the unit the trait page and Lessons print, never a short form", () => {
    for (const t of TRAITS) {
      expect(tileUnit(t.id, "2.4")).toBe(t.unit);
      expect(tileUnit(t.id, "1")).toBe(t.unitOne);
      expect(tileUnit(t.id, "2.4")).not.toMatch(/\/|wpm|per hundred|per minute/);
    }
    expect(tileUnit("fillers", "0.7")).toBe("um or uh in 100 words");
    expect(tileUnit("pace", "155")).toBe("words a minute");
    expect(tileUnit("pause", "1.8")).toBe("pauses between sentences a minute");
  });
});

const reading = (id: TraitId, raw: number, percentile = 50): TraitReading => ({
  id,
  raw,
  percentile,
  fraction: percentile / 100,
  quality: "provisional",
});

describe("the tiles", () => {
  it("puts the card's trait wide and the other four lowest percentile first; the lesson order with none", () => {
    expect(traitOrder([]).map((t) => t.id)).toEqual(TRAITS.map((t) => t.id));
    expect(traitOrder([]).every((t) => t.reading === null)).toBe(true);
    expect(traitOrder([], "pace").map((t) => t.id)).toEqual(["pace", "pause", "fillers", "repairs", "range"]);
    const five = [
      reading("pause", 1.8, 18),
      reading("fillers", 0.7, 93),
      reading("repairs", 0.8, 93),
      reading("pace", 155, 72),
      reading("range", 62, 68),
    ];
    // The fixture's morning: Pace's 155wpm is inside its band, so the
    // practice's own ranking called it best, but the tile prints 72nd.
    const order = traitOrder(five, "pause");
    expect(order.map((t) => t.id)).toEqual(["pause", "range", "pace", "fillers", "repairs"]);
    expect(order.map((t) => t.reading?.percentile)).toEqual([18, 68, 72, 93, 93]);
    // After a recording today the newest row's weakest can differ from
    // the card's trait; the card's trait still takes the wide tile.
    const today = traitOrder([...five.slice(0, 1), reading("fillers", 9.8, 12), ...five.slice(2)], "pause");
    expect(today[0].id).toBe("pause");
    expect(today[1]).toMatchObject({ id: "fillers", reading: { percentile: 12 } });
    // No focus: the lowest percentile is wide.
    expect(traitOrder(five)[0].id).toBe("pause");
    // A trait without a reading keeps its place and prints a dash, last.
    const four = traitOrder(five.slice(1), "pause");
    expect(four[0]).toEqual({ id: "pause", reading: null });
    expect(four.map((t) => t.id)).toEqual(["pause", "range", "pace", "fillers", "repairs"]);
  });

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

  /* #495, the morning tour: the wide tile carried the trait's number, the
     line's number with its unit, a caption about the last six and a bare
     ordinal. Today's line is one sentence now, under its head. */
  it("an open line is one sentence saying what clears it, and nothing about the last six", () => {
    expect(wideLine(line({}))).toEqual({ state: "open", sentence: "Over 1.8 clears it." });
    expect(wideLine(line({ trait: "fillers", direction: "lower", line: 0.9 }))).toEqual({
      state: "open",
      sentence: "Under 0.9 clears it.",
    });
    expect(wideLine(line({})).sentence).not.toMatch(/last|of your/);
  });

  it("a day short of the line says the same, and a closed one says what cleared it", () => {
    expect(wideLine(line({ today: 0.9 }))).toEqual({ state: "short", sentence: "Over 1.8 clears it." });
    expect(wideLine(line({ today: 2.6, closed: true, value: 1 }))).toEqual({
      state: "closed",
      sentence: "Cleared with 2.6 today.",
    });
  });

  it("a line of 1.0 prints 1.0, at the tile's precision, never 1", () => {
    expect(fmtLine(1)).toBe("1.0");
    expect(fmtLine(0.96)).toBe("1.0");
    expect(fmtLine(1.84)).toBe("1.8");
    expect(fmtLine(9.96)).toBe("10.0");
    // From 10 up the tile prints whole numbers, so the line does too.
    expect(fmtLine(145.4)).toBe("145");
    expect(fmtLine(62)).toBe("62");
    expect(wideLine(line({ line: 1 })).sentence).toBe("Over 1.0 clears it.");
    expect(wideLine(line({ line: 1, today: 1, closed: true })).sentence).toBe("Cleared with 1.0 today.");
  });

  /** Enough words to score (`measured`). */
  const SAID =
    "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";
  const rep = (fillers: number[], duration = 60, transcript = SAID): RepRow =>
    ({ fillers: fillers.map((t) => ({ word: "um", t })), duration_s: duration, transcript }) as RepRow;

  /* #495: "46 s" over "Of 65s. Best 53s." was a number and two
     fragments, and what the number was showed only on day zero. */
  it("the run reads the newest recording's longest stretch, in one sentence with the best before it", () => {
    expect(cleanRunTile([])).toBeNull();
    const first = cleanRunTile([rep([30])]);
    expect(first).toMatchObject({ s: 30, of: 60, best: null, newBest: false, caption: "Longest in your last recording." });
    const short = cleanRunTile([rep([50]), rep([20], 65)]);
    expect(short).toMatchObject({ s: 45, best: 50, newBest: false, caption: "Longest in your last recording. Best 50s." });
    const best = cleanRunTile([rep([20]), rep([])]);
    expect(best).toMatchObject({ s: 60, best: 40, newBest: true, caption: "Longest in your last recording, a new best." });
    for (const t of [first, short, best]) expect(t!.caption).not.toMatch(/^Of /);
  });

  it("is named apart from You's Clean run badge, which counts fillers a minute", () => {
    expect(RUN_NAME).toBe("No-filler run");
    expect(RUN_NAME).not.toBe("Clean run");
    expect(RUN_FIRST).toBe("Your first recording sets it.");
  });

  /* A one-word 8s take read "Clean run 8s, of 8s". */
  it("the clean run skips a take too short to score", () => {
    const word = rep([], 8.3, "Hello.");
    expect(cleanRunTile([rep([30]), word])).toMatchObject({ s: 30, of: 60, best: null });
    expect(cleanRunTile([word])).toBeNull();
  });

  /*
   * Pace's line is a distance from its zone (progress-2): "Inside it on
   * 3 of your last 4" and "Inside your line of 100" said nothing true.
   */
  it("a pace line names the zone, never inside one number", () => {
    const pace = (over: Partial<Challenge>) =>
      line({ trait: "pace", direction: "band", line: 100, cleared: { n: 3, of: 4 }, ...over });
    expect(wideLine(pace({})).sentence).toBe("Nearer 130 to 160 than 100 clears it.");
    expect(wideLine(pace({ line: 145 })).sentence).toBe("Inside 130 to 160 clears it.");
    expect(wideLine(pace({ today: 178, closed: true })).sentence).toBe("Cleared with 178 today.");
    for (const today of [null, 178, 145, 190]) {
      const sentence = wideLine(pace({ today, closed: today !== null })).sentence;
      expect(sentence).not.toMatch(/inside (it|your line|\d+\.)|over \d/i);
      expect(sentence).not.toMatch(/[\u2013\u2014]/);
    }
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

describe("this week", () => {
  // Thursday 29 October 2026, 20:00 local; the week starts Monday the 26th.
  const now = new Date(2026, 9, 29, 20, 0);
  const at = (y: number, m: number, d: number, index: number | null = null, h = 18) => ({
    created_at: new Date(y, m, d, h).toISOString(),
    ethos_index: index,
  });

  it("an empty account has no days, no weeks and no Index, never zeros dressed as readings", () => {
    const w = weekView([], now);
    expect(w.days.map((d) => d.label).join("")).toBe("MTWTFSS");
    expect(w.days.filter((d) => d.on)).toHaveLength(0);
    expect(w.days.find((d) => d.today)?.label).toBe("T");
    expect(w).toMatchObject({ spoken: 0, thisWeek: 0, total: 0, daysAll: 0, weeks: [], index: null });
  });

  it("counts the week's days and recordings, and the weeks since day one", () => {
    const spine = [
      at(2026, 9, 12, 600), // two weeks before, a Monday
      at(2026, 9, 20, 620), // last week, Tuesday
      at(2026, 9, 26, 630), // Monday
      at(2026, 9, 26, null, 19), // Monday again, unscored
      at(2026, 9, 28, 641), // Wednesday
      at(2026, 9, 30, 700), // tomorrow: not yet
    ];
    const w = weekView(spine, now);
    expect(w.days.map((d) => (d.on ? 1 : 0))).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(w.spoken).toBe(2);
    expect(w.thisWeek).toBe(3);
    expect(w.total).toBe(5);
    expect(w.daysAll).toBe(4);
    expect(w.weeks).toEqual([1, 1, 3]);
    expect(w.index).toEqual({ now: 641, week: 21, since: 41, series: [600, 620, 630, 641] });
  });

  it("says nothing about this week's Index when nothing scored this week", () => {
    const w = weekView([at(2026, 9, 12, 600), at(2026, 9, 20, 620)], now);
    expect(w.index?.week).toBeNull();
    expect(w.index?.since).toBe(20);
    expect(w.thisWeek).toBe(0);
  });

  it("caps the columns at six weeks", () => {
    const w = weekView([at(2026, 6, 1, 500), at(2026, 9, 27, 600)], now);
    expect(w.weeks).toHaveLength(6);
    expect(w.weeks[5]).toBe(1);
  });

  it("signs a movement with a real minus", () => {
    expect(signed(10)).toBe("+10");
    expect(signed(-4)).toBe("−4");
    expect(signed(0)).toBe("0");
  });
});
