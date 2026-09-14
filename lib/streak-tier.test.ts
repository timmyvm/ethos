import { describe, expect, it } from "vitest";
import { crossed, standing, STREAK_TIERS } from "./streak-tier";

/**
 * The tiers are the streak's only bounded remainder (#253), so the
 * boundaries are walked rather than eyeballed: an off-by-one here is a
 * ring that reads 100% on the day before it closes.
 */
describe("streak tiers", () => {
  it("covers every day from one with no gaps and no overlaps", () => {
    for (let d = 1; d <= 200; d++) {
      const hits = STREAK_TIERS.filter((t) => d >= t.from && (t.to === null || d <= t.to));
      expect([d, hits.length]).toEqual([d, 1]);
    }
  });

  it("is nothing at all before the first day", () => {
    expect(standing(0)).toBeNull();
    expect(standing(-3)).toBeNull();
    expect(standing(Number.NaN)).toBeNull();
  });

  it("fills its tier and empties into the next one", () => {
    // Day one of a nine-day tier is one ninth done, not zero: the day
    // you are standing in counts, or every ring opens empty forever.
    expect(standing(1)!.progress).toBeCloseTo(1 / 9);
    expect(standing(9)!.progress).toBe(1);
    expect(standing(9)!.toGo).toBe(1);
    expect(standing(10)!.tier.id).toBe("flame");
    expect(standing(10)!.progress).toBeCloseTo(1 / 21);
    expect(standing(30)!.progress).toBe(1);
    expect(standing(31)!.tier.id).toBe("torch");
    expect(standing(75)!.progress).toBe(1);
  });

  /** A habit with a ceiling is a reason to stop, so the top has none. */
  it("has no remainder at the top", () => {
    const top = standing(400)!;
    expect(top.tier.id).toBe("beacon");
    expect(top.progress).toBe(1);
    expect(top.toGo).toBeNull();
    expect(top.next).toBeNull();
  });

  it("names the crossing, and only on the day it happens", () => {
    expect(crossed(9, 10)?.id).toBe("flame");
    expect(crossed(30, 31)?.id).toBe("torch");
    expect(crossed(75, 76)?.id).toBe("beacon");
    expect(crossed(10, 11)).toBeNull();
    expect(crossed(0, 1)?.id).toBe("spark");
    expect(crossed(200, 201)).toBeNull();
  });
});
