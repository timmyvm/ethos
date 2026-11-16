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
  /* Five traits, each walking its own twelve of the first sixty and
     then every topic since at its tier (#481): 165 at tier 1, 164 at
     tier 2. */
  it("is 1,645", () => {
    expect(PATH.length).toBe(1645);
  });

  it("gives every trait 165 at tier 1 and 164 at tier 2", () => {
    for (const t of TRAITS) {
      for (const [tier, want] of [[1, 165], [2, 164]] as const) {
        const n = PATH.filter((p) => p.trait === t.id && p.tier === tier).length;
        expect([t.id, tier, n]).toEqual([t.id, tier, want]);
      }
    }
  });

  it("has no two items sharing an id", () => {
    expect(new Set(PATH.map((p) => p.id)).size).toBe(PATH.length);
  });

  /*
   * The guard that makes the path affordable honest: nothing here is new
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

  /* Twelve angles a trait, taken in turn: no angle twice inside twelve
     days, and never the same angle on the same topic. */
  it("never repeats a title inside twelve days of one trait", () => {
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) {
        const items = PATH.filter((p) => p.trait === t.id && p.tier === tier);
        for (let i = 0; i + 12 <= items.length; i++) {
          const titles = items.slice(i, i + 12).map((p) => p.title);
          expect([t.id, tier, i, new Set(titles).size]).toEqual([t.id, tier, i, 12]);
        }
        const pairs = items.map((p) => `${p.title}|${p.topicId}`);
        expect(new Set(pairs).size).toBe(items.length);
      }
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
    const a = choosePractice(rs, new Date(2026, 8, 14, 1));
    const b = choosePractice(rs, new Date(2026, 8, 14, 22));
    const c = choosePractice(rs, new Date(2026, 8, 15, 9));
    expect(a?.item.id).toBe(b?.item.id);
    expect(a?.item.id).not.toBe(c?.item.id);
  });

  /*
   * The card rotates on the person's own calendar day (#77), as
   * todaysDrill does. It rotated at UTC midnight: 11:00 in Sydney, 20:00
   * in New York, so the floor card changed topic partway through the day.
   */
  it("keeps one practice for the whole local day, east and west of UTC", () => {
    const rs = [reading("fillers", 9), reading("pace", 150)];
    const tz = process.env.TZ;
    try {
      for (const zone of ["Australia/Sydney", "America/New_York", "America/Los_Angeles"]) {
        process.env.TZ = zone;
        const early = choosePractice(rs, new Date(2026, 9, 26, 0, 1))?.item.id;
        for (const h of [10, 11, 17, 20, 23]) {
          expect(choosePractice(rs, new Date(2026, 9, 26, h, 59))?.item.id, `${zone} ${h}:59`).toBe(early);
        }
      }
    } finally {
      process.env.TZ = tz;
    }
  });

  /* "it kept cycling over the same ones" (#473, #481): the card used to
     come round again after twelve days. A trait whose number holds now
     meets a new topic every day for 165 days. */
  it("gives a trait that stays weakest a new topic every day for its whole walk", () => {
    for (const [rs, n] of [
      [[reading("fillers", 20)], 165],
      [[reading("pace", 148)], 164],
    ] as const) {
      const seen: string[] = [];
      for (let d = 0; d < n + 1; d++) {
        seen.push(choosePractice([...rs], new Date(2026, 10, 16 + d, 12))!.item.topicId);
      }
      expect(new Set(seen.slice(0, n)).size).toBe(n);
      expect(seen[n]).toBe(seen[0]);
    }
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
