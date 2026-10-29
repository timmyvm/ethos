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
  TRAIT_OBJECT,
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
import type { TraitReading } from "./trait-readings";

/*
 * Today, "the object" (#393). The card stands the glass object of the
 * tactic it leads with, every trait and every lesson has one, and every
 * number a tile prints is one of the person's own or a dash, never a
 * zero for something unknown.
 */
const root = path.resolve(__dirname, "..");

describe("every practice has its object", () => {
  it("each trait's three tactics map to its own three lessons, all fifteen once", () => {
    const seen: string[] = [];
    for (const t of TRAITS) {
      const ids = TACTIC_OBJECT[t.id];
      expect(ids).toHaveLength(t.howTo.length);
      for (const id of ids) {
        expect(lessonById(id)?.trait, id).toBe(t.id);
        seen.push(id);
      }
    }
    expect([...seen].sort()).toEqual(LESSONS.map((l) => l.id).sort());
  });

  it("each trait's own object is one of its lessons, and Pausing's is the hourglass", () => {
    for (const t of TRAITS) expect(lessonById(TRAIT_OBJECT[t.id])?.trait).toBe(t.id);
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

  it("orders the five weakest first on the practice's own ranking, and the lesson order with none", () => {
    expect(traitOrder([]).map((t) => t.id)).toEqual(TRAITS.map((t) => t.id));
    expect(traitOrder([]).every((t) => t.reading === null)).toBe(true);
    const five = [
      reading("pause", 3.5),
      reading("fillers", 9),
      reading("repairs", 1),
      reading("pace", 150),
      reading("range", 60),
    ];
    const order = traitOrder(five);
    expect(order).toHaveLength(5);
    // Nine filled pauses per hundred words is the weakest of these.
    expect(order[0].id).toBe("fillers");
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
