import { describe, expect, it } from "vitest";
import { PATH, pathItemById, walkFor } from "@/content/path";
import { TRAITS, type TraitId } from "@/content/traits";
import { topicById, TOPICS } from "./topics";
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

/*
 * The pool (#489). An under-18's card could stand a topic the school
 * pool drops (t10, t11, t18, all about a job), because the filter was
 * handed a topic with no `not` and nobody passed one. The walk keeps
 * its length and its places for every pool, and the place that held a
 * dropped topic takes another trait's topic at the same place.
 */
const JOB = ["t10", "t11", "t18"];
const ALL_POOLS = ["all", "school", "work", "social", "online"] as const;
const dayAt = (d: number) => new Date(2026, 0, 1 + d, 12);
const placeOn = (at: Date, length: number) =>
  Math.floor(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) / 86400000) % length;
/** A date whose place in a walk of `length` is `place`. */
function dateAtPlace(place: number, length: number): Date {
  for (let d = 0; d < length; d++) if (placeOn(dayAt(d), length) === place) return dayAt(d);
  throw new Error("no such day");
}
/** One reading that makes `trait` the weakest at `tier`. */
function weakAt(trait: TraitId, tier: 1 | 2): TraitReading[] {
  const raws = [0, 0.05, 0.2, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 20, 40, 60, 80, 100, 120, 145, 150, 170, 200, 260];
  const raw = raws.find((r) => (tier === 1 ? standing(trait, r) < 0.5 : standing(trait, r) >= 0.5));
  if (raw === undefined) throw new Error(`no raw puts ${trait} at tier ${tier}`);
  return [reading(trait, raw)];
}
/** The selector as it was before #489, with no pool: the trait's walk at the day's place. */
function before(trait: TraitId, tier: 1 | 2, at: Date): string {
  const walk = PATH.filter((p) => p.trait === trait && p.tier === tier);
  return walk[placeOn(at, walk.length)].id;
}

describe("the pool (#489)", () => {
  it("keeps every trait at both tiers reachable", () => {
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) expect(choosePractice(weakAt(t.id, tier))?.item.tier).toBe(tier);
    }
  });

  it("stands another topic on the day an under-18's walk held a job prompt", () => {
    const at = dateAtPlace(9, 165); // pause-1-10, "The worst job you've ever done"
    const rs = weakAt("pause", 1);
    const all = choosePractice(rs, at, "all")!;
    expect([all.item.id, all.item.topicId]).toEqual(["pause-1-10", "t10"]);
    const school = choosePractice(rs, at, "school")!;
    expect(school.item.id).toBe("pause-1-10-school");
    expect(JOB).not.toContain(school.item.topicId);
    // The same trait, the same angle, the same tactic: only the topic moves.
    expect(school.trait).toBe(all.trait);
    expect(school.item.title).toBe(all.item.title);
    expect(school.item.tips.slice(0, 2)).toEqual(all.item.tips.slice(0, 2));
    expect(school.item.prompt).toBe(topicById(school.item.topicId)!.prompt);
    // A link that carries it opens it (the recorder heads with its angle).
    expect(pathItemById(school.item.id)).toEqual(school.item);
  });

  it("never gives a school pool a job prompt, on any day of a year, for any trait or tier", () => {
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) {
        const rs = weakAt(t.id, tier);
        for (let d = 0; d < 366; d++) {
          const c = choosePractice(rs, dayAt(d), "school")!;
          expect([t.id, tier, d, JOB.includes(c.item.topicId)]).toEqual([t.id, tier, d, false]);
        }
      }
    }
  });

  it("gives every other pool exactly what the card gave before, day by day", () => {
    for (const pool of ALL_POOLS.filter((p) => p !== "school")) {
      for (const t of TRAITS) {
        for (const tier of [1, 2] as const) {
          const rs = weakAt(t.id, tier);
          for (let d = 0; d < 366; d++) {
            const id = choosePractice(rs, dayAt(d), pool)!.item.id;
            expect([pool, t.id, tier, d, id]).toEqual([pool, t.id, tier, d, before(t.id, tier, dayAt(d))]);
          }
        }
      }
    }
    // And with no pool at all, as lib/challenge.ts calls it.
    const rs = weakAt("pace", 1);
    expect(choosePractice(rs, dayAt(3))!.item.id).toBe(before("pace", 1, dayAt(3)));
  });

  it("changes a school walk only where it held a job prompt", () => {
    let changed = 0;
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) {
        const base = walkFor(t.id, tier, "all");
        const school = walkFor(t.id, tier, "school");
        expect(school.length).toBe(base.length);
        school.forEach((p, i) => {
          const job = JOB.includes(base[i].topicId);
          expect([t.id, tier, i, p === base[i]]).toEqual([t.id, tier, i, !job]);
          if (job) changed++;
        });
      }
    }
    // pause-1-10, pace-1-4, pause-2-5, repairs-2-4, repairs-2-11, range-2-10.
    expect(changed).toBe(6);
  });

  /* #481's walk, kept: a trait that stays weakest meets every topic of its
     walk before one comes round again, in every pool. */
  it("gives a school trait that stays weakest a new topic every day of its walk", () => {
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) {
        const walk = walkFor(t.id, tier, "school");
        expect([t.id, tier, new Set(walk.map((p) => p.topicId)).size]).toEqual([t.id, tier, walk.length]);
        const titles = walk.map((p) => `${p.title}|${p.topicId}`);
        expect(new Set(titles).size).toBe(walk.length);
      }
    }
  });

  /* A change of weakest trait or of pool moves the person to another walk
     at the SAME place. A topic can only come back early across that move
     if it stands at a place in one walk it did not stand at in another, so
     a stand-in takes only a topic that already stood at its place. */
  it("stands no topic at a place it did not already hold, so no change brings one back early", () => {
    for (const tier of [1, 2] as const) {
      const placesIn = (pool: "all" | "school") => {
        const at = new Map<string, Set<number>>();
        for (const t of TRAITS) {
          walkFor(t.id, tier, pool).forEach((p, i) => at.set(p.topicId, (at.get(p.topicId) ?? new Set()).add(i)));
        }
        return at;
      };
      const all = placesIn("all");
      for (const [topic, places] of placesIn("school")) {
        for (const i of places) expect([tier, topic, i, all.get(topic)?.has(i)]).toEqual([tier, topic, i, true]);
      }
      // From the thirteenth place on, every trait and every pool stand one topic.
      for (const pool of ALL_POOLS) {
        const walks = TRAITS.map((t) => walkFor(t.id, tier, pool).slice(12).map((p) => p.topicId));
        for (const w of walks) expect(w).toEqual(walks[0]);
      }
    }
  });

  it("brings nothing back inside a walk when the pool changes partway through it", () => {
    for (const t of TRAITS) {
      for (const tier of [1, 2] as const) {
        const rs = weakAt(t.id, tier);
        const length = walkFor(t.id, tier).length;
        const start = dateAtPlace(0, length);
        for (const [from, to] of [["all", "school"], ["school", "all"]] as const) {
          for (const turn of [1, 4, 5, 10, 12, 100]) {
            const seen: string[] = [];
            for (let d = 0; d < length; d++) {
              const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d, 12);
              seen.push(choosePractice(rs, at, d < turn ? from : to)!.item.topicId);
            }
            expect([t.id, tier, from, turn, new Set(seen).size]).toEqual([t.id, tier, from, turn, length]);
          }
        }
      }
    }
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
