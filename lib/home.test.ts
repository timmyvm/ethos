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
  LINE_MARK,
  SHORT_UNIT,
  TACTIC_OBJECT,
  UNIT_EM,
  artBox,
  numEm,
  TRAIT_OBJECT,
  TRAIT_OBJECTS,
  cleanRunTile,
  greetingName,
  heroObject,
  initialOf,
  lineTile,
  objectSrc,
  signed,
  tileObject,
  traitOrder,
  weekView,
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
    // "Let the gap sit" is a shut mouth holding a silence: the zip, not
    // the crutch-word magnifier it once took by its place in the list.
    expect(TRAIT.fillers.howTo[2]).toMatch(/^Let the gap sit/);
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

  it("all 120 practices resolve to an object of their own trait, cut at both sizes", () => {
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
    expect(heroObject("pace", "Say your position in the first sentence.")).toBe(TRAIT_OBJECT.pace);
    expect(heroObject(null)).toBe(HOUSE_OBJECT);
  });

  it("a tile never repeats the card's object", () => {
    for (const t of TRAITS) {
      for (const hero of [...TACTIC_OBJECT[t.id], HOUSE_OBJECT, null]) {
        const tile = tileObject(t.id, hero);
        expect(tile).not.toBe(hero);
        expect(lessonById(tile)?.trait).toBe(t.id);
      }
    }
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
  /* calc(), clamp(), px and cqw: all the zone uses. */
  const at = (expr: string, content: number) =>
    Function(
      "clamp",
      `return ${expr
        .replace(/calc\(/g, "(")
        .replace(/([\d.]+)cqw/g, (_, n) => `(${n}*${content}/100)`)
        .replace(/([\d.]+)px/g, "$1")};`
    )((lo: number, v: number, hi: number) => Math.min(Math.max(lo, v), hi)) as number;
  const wordsMin = home.match(/\.home-hero-words \{[^}]*min-height: calc\(var\(--zone-b\) - (\d+)px\)/);

  it("reads a box for every lesson, and the card's zone from the CSS", () => {
    expect(Object.keys(ART_BOUNDS).sort()).toEqual(LESSONS.map((l) => l.id).sort());
    for (const b of Object.values(ART_BOUNDS)) {
      expect(b.r).toBeGreaterThan(b.l);
      expect(b.b).toBeGreaterThan(b.t);
    }
    expect(wordsMin).not.toBeNull();
    expect(artBox("the-long-one")).toEqual({
      "--art-l": ART_BOUNDS["the-long-one"].l,
      "--art-t": ART_BOUNDS["the-long-one"].t,
      "--art-w": Math.round((ART_BOUNDS["the-long-one"].r - ART_BOUNDS["the-long-one"].l) * 10000) / 10000,
      "--art-h": Math.round((ART_BOUNDS["the-long-one"].b - ART_BOUNDS["the-long-one"].t) * 10000) / 10000,
    });
  });

  for (const [width, rise] of [
    [320, 22],
    [390, 48],
  ] as const) {
    it(`at ${width}: all fifteen rise ${rise}px, clear the words by 12px, end above the topic, inside the card`, () => {
      const content = width - 40 - 40; // the column's gutters, then the card's padding
      const card = content + 40;
      const [l, r, t, b] = ["l", "r", "t", "b"].map((n) => at(zone(n), content));
      const column = 20 + 0.52 * content;
      expect(t).toBeCloseTo(-rise, 0);
      // The topic starts 24px under the words, which hold the zone's height.
      const topic = 20 + (b - Number(wordsMin![1])) + 24;
      for (const id of LESSONS.map((x) => x.id)) {
        const box = artBox(id);
        const s = Math.min((b - t) / box["--art-h"], (r - l) / box["--art-w"]);
        const left = (l + r) / 2 - (s * box["--art-w"]) / 2;
        expect(left - column, `${id} clear of the words`).toBeGreaterThanOrEqual(12);
        expect(left + s * box["--art-w"], `${id} inside the card`).toBeLessThanOrEqual(card - 8);
        expect(t + s * box["--art-h"], `${id} above the topic`).toBeLessThanOrEqual(topic - 6);
      }
    });
  }
});

describe("a number and its unit share a line", () => {
  it("every short unit has a measured width, and the printed numbers count their digits", () => {
    for (const u of Object.values(SHORT_UNIT)) expect(UNIT_EM[u], u).toBeGreaterThan(0);
    expect(UNIT_EM.s).toBeGreaterThan(0);
    expect(numEm("155")).toBeCloseTo(1.74, 2);
    expect(numEm("9.8")).toBeCloseTo(1.44, 2);
    expect(numEm("9.8")).toBeLessThan(numEm("155"));
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
  it("every trait has a short unit", () => {
    for (const t of TRAITS) expect(SHORT_UNIT[t.id].length).toBeGreaterThan(0);
  });

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

  it("an open line prints the line, an empty bar and how often it was cleared", () => {
    const t = lineTile(line({}));
    expect(t).toMatchObject({ shown: 1.8, state: "open", fill: 0, mark: LINE_MARK });
    expect(t.caption).toBe("Over it on 4 of your last 5.");
  });

  it("a closed line prints today and fills to the mark or past it", () => {
    const t = lineTile(line({ today: 2.6, closed: true, value: 1 }));
    expect(t.state).toBe("closed");
    expect(t.shown).toBe(2.6);
    expect(t.fill).toBeGreaterThanOrEqual(LINE_MARK);
    expect(t.caption).toBe("Over your line of 1.8.");
    expect(lineTile(line({ today: 1.8, closed: true })).caption).toBe("On your line.");
  });

  it("a day short of the line stops before the mark and names the line", () => {
    const t = lineTile(line({ today: 0.9, closed: false }));
    expect(t.state).toBe("short");
    expect(t.fill).toBeLessThan(LINE_MARK);
    expect(t.caption).toBe("Your line is 1.8.");
  });

  it("fewer-is-better fills the same way", () => {
    const fewer = lineTile(line({ trait: "fillers", direction: "lower", line: 4, today: 2, closed: true }));
    expect(fewer.fill).toBeGreaterThanOrEqual(LINE_MARK);
    expect(fewer.caption).toBe("Under your line of 4.");
  });

  const rep = (fillers: number[], duration = 60): RepRow =>
    ({ fillers: fillers.map((t) => ({ word: "um", t })), duration_s: duration }) as RepRow;

  it("the clean run reads the newest recording against its own length and the best before it", () => {
    expect(cleanRunTile([])).toBeNull();
    const first = cleanRunTile([rep([30])]);
    expect(first).toMatchObject({ s: 30, of: 60, best: null, newBest: false, caption: "Of 60s." });
    const short = cleanRunTile([rep([50]), rep([20], 65)]);
    expect(short).toMatchObject({ s: 45, of: 65, best: 50, newBest: false, caption: "Of 65s. Best 50s." });
    const best = cleanRunTile([rep([20]), rep([])]);
    expect(best).toMatchObject({ s: 60, best: 40, newBest: true, caption: "Of 60s. A new best." });
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
