import { describe, expect, it } from "vitest";
import {
  FIRST_PRICE_CENTS,
  FLOOR_MONTH,
  FLOOR_PRICE_CENTS,
  LADDER_CENTS,
  LOOKUP_KEYS,
  formatAud,
  formatBare,
  lookupKeyForMonth,
  monthForLookupKey,
  priceForMonth,
  rungIndex,
  totalForMonths,
} from "./pricing";

describe("the price ladder (#377)", () => {
  it("is Timothy's middle ladder: A$12.99 down a dollar a month to A$6.99", () => {
    expect([...LADDER_CENTS]).toEqual([1299, 1199, 1099, 999, 899, 799, 699]);
    expect(FIRST_PRICE_CENTS).toBe(1299);
    expect(FLOOR_PRICE_CENTS).toBe(699);
    expect(FLOOR_MONTH).toBe(7);
  });

  it("only ever goes down, a month at a time", () => {
    for (let m = 2; m <= 24; m++) {
      expect(priceForMonth(m)).toBeLessThanOrEqual(priceForMonth(m - 1));
    }
  });

  it("holds the floor from month 7 on", () => {
    for (const m of [7, 8, 12, 36, 1000]) expect(priceForMonth(m)).toBe(699);
  });

  it("starts at the start when it cannot tell how long a plan has run", () => {
    for (const m of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(rungIndex(m)).toBe(0);
      expect(priceForMonth(m)).toBe(1299);
    }
    // Infinity is not a month either: never hand out the floor by accident.
    expect(priceForMonth(Number.POSITIVE_INFINITY)).toBe(1299);
  });

  it("names a Stripe price per rung, and reads it back", () => {
    expect(LOOKUP_KEYS).toHaveLength(7);
    expect(lookupKeyForMonth(1)).toBe("ethos_ladder_m1");
    expect(lookupKeyForMonth(7)).toBe("ethos_ladder_m7");
    expect(lookupKeyForMonth(20)).toBe("ethos_ladder_m7");
    for (let m = 1; m <= 7; m++) expect(monthForLookupKey(lookupKeyForMonth(m))).toBe(m);
    expect(monthForLookupKey("price_somebody_else")).toBeNull();
    expect(monthForLookupKey(null)).toBeNull();
  });

  it("costs A$104.88 over an unbroken first year", () => {
    expect(totalForMonths(6)).toBe(6294);
    expect(totalForMonths(12)).toBe(10488);
    expect(totalForMonths(0)).toBe(0);
  });

  it("writes prices the way the paywall says them", () => {
    expect(formatAud(1299)).toBe("A$12.99");
    expect(formatAud(699)).toBe("A$6.99");
    expect(formatAud(10488)).toBe("A$104.88");
    expect(formatAud(5)).toBe("A$0.05");
    expect(formatBare(999)).toBe("9.99");
  });
});
