import { describe, expect, it } from "vitest";
import {
  balance,
  COIN_PER_STREAK_DAY,
  earnedToday,
  FIRST_SHOP_ITEM_PRICE,
  towardFirstItem,
  unpaidDays,
  type CoinRow,
} from "./coins";

function earn(day: string, id = day): CoinRow {
  return {
    id,
    kind: "earned",
    amount: 1,
    reason: "streak_day",
    earned_on: day,
    created_at: `${day}T09:00:00.000Z`,
  };
}

describe("balance", () => {
  it("is earned minus spent", () => {
    const ledger: CoinRow[] = [
      earn("2026-08-09"),
      earn("2026-08-10"),
      {
        id: "s1",
        kind: "spent",
        amount: 14,
        reason: "shop",
        earned_on: null,
        created_at: "2026-08-10T10:00:00.000Z",
      },
    ];
    expect(balance(ledger)).toBe(-12);
  });

  it("is zero on an empty ledger, not null or NaN", () => {
    expect(balance([])).toBe(0);
  });
});

describe("what earns a coin", () => {
  it("pays one per day spoken, not one per rep", () => {
    const reps = [
      new Date(2026, 7, 11, 9),
      new Date(2026, 7, 11, 19),
      new Date(2026, 7, 11, 21),
    ];
    expect(unpaidDays(reps, [])).toEqual(["2026-08-11"]);
  });

  it("never pays the same day twice", () => {
    const reps = [new Date(2026, 7, 11, 9)];
    expect(unpaidDays(reps, [earn("2026-08-11")])).toEqual([]);
  });

  it("backfills days that were missed by a dropped write", () => {
    const reps = [
      new Date(2026, 7, 9),
      new Date(2026, 7, 10),
      new Date(2026, 7, 11),
    ];
    expect(unpaidDays(reps, [earn("2026-08-10")])).toEqual([
      "2026-08-09",
      "2026-08-11",
    ]);
  });

  it("pays nothing for a day with no rep in it — freezes don't earn", () => {
    expect(unpaidDays([], [])).toEqual([]);
  });
});

describe("the price anchor", () => {
  /**
   * The whole point of deciding the price before the shop: at one coin
   * per day, the first item costs about two weeks of practice. If either
   * constant drifts, the economy silently inflates.
   */
  it("keeps the first item at roughly two weeks of practice", () => {
    expect(FIRST_SHOP_ITEM_PRICE / COIN_PER_STREAK_DAY).toBe(14);
  });

  it("counts down to it", () => {
    const t = towardFirstItem(5);
    expect(t.toGo).toBe(9);
    expect(t.fraction).toBeCloseTo(5 / 14);
  });

  it("clamps once you can afford it", () => {
    const t = towardFirstItem(30);
    expect(t.toGo).toBe(0);
    expect(t.fraction).toBe(1);
  });
});

describe("today", () => {
  it("knows whether today already paid", () => {
    const now = new Date(2026, 7, 11, 20);
    expect(earnedToday([earn("2026-08-11")], now)).toBe(true);
    expect(earnedToday([earn("2026-08-10")], now)).toBe(false);
  });
});
