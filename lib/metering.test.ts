import { describe, expect, it } from "vitest";
import {
  accrue,
  DAILY_GRANT,
  dateKey,
  localDate,
  MAX_BALANCE,
  meter,
  meterStatus,
  type MeterState,
} from "./metering";

const FRESH: MeterState = { balance: 3, accruedOn: null, usedAt: null };

function at(y: number, m: number, d: number, h = 12): Date {
  return new Date(y, m - 1, d, h);
}

/* #514, Timothy 19 Nov: "Nah give them a few recordings yo". A free
   account gets 3 scored recordings a day, fresh each day, never more. */
describe("the rate", () => {
  it("is 3 a day, and the ceiling is the day's 3", () => {
    expect(DAILY_GRANT).toBe(3);
    expect(MAX_BALANCE).toBe(3);
  });
});

describe("accrual", () => {
  it("starts a first-ever account at 3", () => {
    expect(accrue(FRESH, "2026-08-11").balance).toBe(3);
    // Whatever the row held before its first recording (0004's default is 1).
    expect(accrue({ balance: 1, accruedOn: null, usedAt: null }, "2026-08-11").balance).toBe(3);
    expect(accrue({ balance: 0, accruedOn: null, usedAt: null }, "2026-08-11").balance).toBe(3);
  });

  it("grants nothing twice in the same day", () => {
    const day1 = accrue(FRESH, "2026-08-11");
    const spent = { ...day1, balance: 0 };
    expect(accrue(spent, "2026-08-11").balance).toBe(0);
    expect(accrue({ ...day1, balance: 2 }, "2026-08-11").balance).toBe(2);
  });

  it("tops a new day back up to 3, never past it", () => {
    for (const balance of [0, 1, 2, 3]) {
      const state: MeterState = { balance, accruedOn: "2026-08-11", usedAt: null };
      expect(accrue(state, "2026-08-12")).toMatchObject({ balance: 3, accruedOn: "2026-08-12" });
    }
  });

  it("banks nothing however long you were away", () => {
    const state: MeterState = { balance: 0, accruedOn: "2026-08-01", usedAt: null };
    expect(accrue(state, "2026-08-04").balance).toBe(3);
    expect(accrue(state, "2026-09-01").balance).toBe(MAX_BALANCE);
  });

  it("tops an account carrying the old rule's balance of 1 up to 3 on its next day", () => {
    // Accrued today under one a day, with today's one left: today stays as it was.
    const carried: MeterState = { balance: 1, accruedOn: "2026-11-19", usedAt: null };
    expect(accrue(carried, "2026-11-19").balance).toBe(1);
    expect(accrue(carried, "2026-11-20")).toMatchObject({ balance: 3, accruedOn: "2026-11-20" });
  });

  it("never goes backwards when the clock does", () => {
    const state: MeterState = { balance: 2, accruedOn: "2026-08-11", usedAt: null };
    expect(accrue(state, "2026-08-09").balance).toBe(2);
  });
});

describe("metering a recording", () => {
  it("spends one and reports what is left", () => {
    const d = meter({ state: FRESH, now: at(2026, 8, 11), premium: false });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(2);
    expect(d.state.usedAt).not.toBeNull();
  });

  it("scores three takes on one day, then measures a fourth without judging it", () => {
    let state: MeterState = FRESH;
    const takes = [9, 10, 11, 12].map((h) => {
      const d = meter({ state, now: at(2026, 8, 11, h), premium: false });
      state = d.state;
      return { allowed: d.allowed, remaining: d.remaining };
    });
    expect(takes).toEqual([
      { allowed: true, remaining: 2 },
      { allowed: true, remaining: 1 },
      { allowed: true, remaining: 0 },
      { allowed: false, remaining: 0 },
    ]);
    // The refused fourth spends nothing and moves no date.
    expect(state).toMatchObject({ balance: 0, accruedOn: "2026-08-11" });
  });

  it("is back to 3 the next day", () => {
    let state: MeterState = FRESH;
    for (const h of [9, 10, 11]) state = meter({ state, now: at(2026, 8, 11, h), premium: false }).state;
    expect(meter({ state, now: at(2026, 8, 11, 23), premium: false }).allowed).toBe(false);
    expect(meterStatus({ state, now: at(2026, 8, 12, 0), premium: false }).available).toBe(3);
    const next = meter({ state, now: at(2026, 8, 12, 7), premium: false });
    expect(next).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("scores an old-rule account's carried 1 today, then 3 tomorrow", () => {
    let state: MeterState = { balance: 1, accruedOn: "2026-11-19", usedAt: null };
    const today = [9, 10].map((h) => {
      const d = meter({ state, now: at(2026, 11, 19, h), premium: false });
      state = d.state;
      return d.allowed;
    });
    expect(today).toEqual([true, false]);
    const tomorrow = [9, 10, 11, 12].map((h) => {
      const d = meter({ state, now: at(2026, 11, 20, h), premium: false });
      state = d.state;
      return d.allowed;
    });
    expect(tomorrow).toEqual([true, true, true, false]);
  });

  /**
   * The Saturday guardrail: three takes in one day after three days off
   * are all judged. A hard practitioner is never worse off than a daily
   * one, and the days off bank nothing more.
   */
  it("judges three takes in one sitting after days away, and no more", () => {
    let state: MeterState = { balance: 0, accruedOn: "2026-08-08", usedAt: null };
    const results = [0, 1, 2].map((i) => {
      const d = meter({ state, now: at(2026, 8, 11, 10 + i), premium: false });
      state = d.state;
      return d.allowed;
    });
    expect(results).toEqual([true, true, true]);
    expect(
      meter({ state, now: at(2026, 8, 11, 14), premium: false }).allowed
    ).toBe(false);
  });

  it("never meters premium and never touches its balance", () => {
    const d = meter({ state: FRESH, now: at(2026, 8, 11), premium: true });
    expect(d.allowed).toBe(true);
    expect(d.unlimited).toBe(true);
    expect(d.state).toEqual(FRESH);
    const spent: MeterState = { balance: 0, accruedOn: "2026-08-11", usedAt: null };
    for (const h of [9, 10, 11, 12, 13]) {
      expect(meter({ state: spent, now: at(2026, 8, 11, h), premium: true })).toMatchObject({ allowed: true, state: spent });
    }
  });
});

describe("status, without spending", () => {
  it("reads the balance without consuming it", () => {
    const s = meterStatus({ state: FRESH, now: at(2026, 8, 11), premium: false });
    expect(s.available).toBe(3);
    expect(
      meter({ state: FRESH, now: at(2026, 8, 11), premium: false }).allowed
    ).toBe(true);
  });

  it("counts the hours to the next grant", () => {
    const s = meterStatus({
      state: FRESH,
      now: at(2026, 8, 11, 22),
      premium: false,
    });
    expect(s.nextGrantInHours).toBe(2);
  });
});

describe("local dates", () => {
  it("resolves the user's own calendar day, not UTC's", () => {
    // 2026-08-11 23:00 in UTC+10 is still the 11th locally, the 12th nowhere.
    const utc = new Date(Date.UTC(2026, 7, 11, 13, 0));
    expect(dateKey(localDate(utc, -600))).toBe("2026-08-11");
  });

  it("clamps an absurd offset instead of trusting it", () => {
    const utc = new Date(Date.UTC(2026, 7, 11, 12, 0));
    const far = localDate(utc, -60 * 999);
    const clamped = localDate(utc, -14 * 60);
    expect(far.getTime()).toBe(clamped.getTime());
  });

  /**
   * A forged offset can shift the boundary; it cannot mint analyses.
   * Claiming to be a day behind produces an earlier date, and accrual is
   * floored at zero elapsed days.
   */
  it("gives a backwards-forged offset nothing", () => {
    const state: MeterState = { balance: 0, accruedOn: "2026-08-11", usedAt: null };
    expect(accrue(state, "2026-08-10").balance).toBe(0);
  });
});
