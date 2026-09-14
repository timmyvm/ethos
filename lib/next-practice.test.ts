import { describe, expect, it } from "vitest";
import { PATH, pathItemById } from "@/content/path";
import { TRAITS, type TraitId } from "@/content/traits";
import { TOPICS } from "./topics";
import { because, choosePractice, standing } from "./next-practice";
import type { TraitReading } from "./trait-readings";

const reading = (id: TraitId, raw: number, over: Partial<TraitReading> = {}): TraitReading => ({
  id,
  raw,
  percentile: 50,
  fraction: 0.5,
  quality: "provisional",
  ...over,
});

describe("the path", () => {
  it("is 120", () => {
    expect(PATH.length).toBe(120);
  });

  it("gives every trait twelve at each tier", () => {
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) {
        const n = PATH.filter((p) => p.trait === t.id && p.tier === tier).length;
        expect([t.id, tier, n]).toEqual([t.id, tier, 12]);
      }
    }
  });

  it("has no two items sharing an id", () => {
    expect(new Set(PATH.map((p) => p.id)).size).toBe(PATH.length);
  });

  /*
   * The guard that makes 120 affordable honest: nothing here is new
   * copy at the sentence level. Every prompt is a topic that already
   * shipped and was already reviewed.
   */
  it("takes every prompt from a topic that already existed", () => {
    for (const p of PATH) {
      const topic = TOPICS.find((t) => t.id === p.topicId);
      expect([p.id, topic?.prompt]).toEqual([p.id, p.prompt]);
    }
  });

  it("gives every item three tips and a title", () => {
    for (const p of PATH) {
      expect([p.id, p.tips.length]).toEqual([p.id, 3]);
      expect([p.id, p.tips.every((t) => t.trim().length > 0)]).toEqual([p.id, true]);
      expect([p.id, p.title.trim().length > 0]).toEqual([p.id, true]);
    }
  });

  it("never repeats a title inside one trait", () => {
    for (const t of TRAITS) {
      const titles = PATH.filter((p) => p.trait === t.id && p.tier === 1).map((p) => p.title);
      expect([t.id, new Set(titles).size]).toEqual([t.id, titles.length]);
    }
  });

  it("finds one by id", () => {
    expect(pathItemById(PATH[7].id)?.title).toBe(PATH[7].title);
    expect(pathItemById("nope")).toBeNull();
  });
});

describe("choosePractice", () => {
  /* The bug this whole file exists for: the card named one trait in its
     title and a different one in its reason, because two selectors. */
  it("always returns a practice for the trait it names", () => {
    const c = choosePractice([
      reading("pause", 0.2),
      reading("fillers", 12),
      reading("pace", 148),
    ]);
    expect(c?.item.trait).toBe(c?.trait);
  });

  it("picks the weakest trait, not the first", () => {
    const c = choosePractice([
      reading("pace", 148), // dead on the band
      reading("fillers", 14), // far above a median of 3
      reading("pause", 3.5),
    ]);
    expect(c?.trait).toBe("fillers");
  });

  it("holds still across a day and moves across days", () => {
    const rs = [reading("fillers", 9), reading("pace", 150)];
    const a = choosePractice(rs, new Date("2026-09-14T01:00:00Z"));
    const b = choosePractice(rs, new Date("2026-09-14T22:00:00Z"));
    const c = choosePractice(rs, new Date("2026-09-15T09:00:00Z"));
    expect(a?.item.id).toBe(b?.item.id);
    expect(a?.item.id).not.toBe(c?.item.id);
  });

  it("starts somebody weak on the lower tier", () => {
    const c = choosePractice([reading("fillers", 20)]);
    expect(c?.item.tier).toBe(1);
  });

  it("has nothing to say with no readings", () => {
    expect(choosePractice([])).toBeNull();
  });
});

describe("standing", () => {
  it("puts the population median in the middle", () => {
    expect(standing("fillers", 3)).toBeCloseTo(0.5, 1);
  });

  it("scores inside the pace band as clear", () => {
    expect(standing("pace", 145)).toBe(1);
    expect(standing("pace", 60)).toBeLessThan(0.5);
  });

  it("reads fewer fillers as better and more as worse", () => {
    expect(standing("fillers", 1)).toBeGreaterThan(standing("fillers", 6));
  });

  it("never leaves 0 to 1, whatever it is handed", () => {
    for (const t of TRAITS) {
      for (const raw of [0, 0.001, 1, 50, 5000, NaN, Infinity]) {
        const s = standing(t.id, raw);
        expect([t.id, raw, s >= 0 && s <= 1]).toEqual([t.id, raw, true]);
      }
    }
  });
});

describe("because", () => {
  it("quotes the measurement while the scale is provisional", () => {
    expect(because(reading("fillers", 2.3))).toBe(
      "2.3 um or uh per hundred words. Your weakest number right now."
    );
  });

  it("adds the position once the scale is real", () => {
    expect(because(reading("fillers", 2.3, { quality: "good", percentile: 61 }))).toContain("61st");
  });

  it("takes the singular from the printed value", () => {
    expect(because(reading("repairs", 0.997))).toContain("1 restart per hundred words");
  });
});
