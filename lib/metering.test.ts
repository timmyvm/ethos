import { describe, expect, it } from "vitest";
import {
  accrue,
  dateKey,
  localDate,
  MAX_BALANCE,
  meter,
  meterStatus,
  type MeterState,
} from "./metering";

const FRESH: MeterState = { balance: 1, accruedOn: null, usedAt: null };

function at(y: number, m: number, d: number, h = 12): Date {
  return new Date(y, m - 1, d, h);
}

describe("accrual", () => {
  it("grants exactly one on the first ever rep", () => {
    expect(accrue(FRESH, "2026-08-11").balance).toBe(1);
  });

  it("grants nothing twice in the same day", () => {
    const day1 = accrue(FRESH, "2026-08-11");
    const spent = { ...day1, balance: 0 };
    expect(accrue(spent, "2026-08-11").balance).toBe(0);
  });

  it("tops up one per elapsed day", () => {
    const state: MeterState = { balance: 0, accruedOn: "2026-08-11", usedAt: null };
    expect(accrue(state, "2026-08-12").balance).toBe(1);
    expect(accrue(state, "2026-08-13").balance).toBe(2);
  });

  it("caps the rollover at 3 however long you were away", () => {
    const state: MeterState = { balance: 0, accruedOn: "2026-08-01", usedAt: null };
    expect(accrue(state, "2026-09-01").balance).toBe(MAX_BALANCE);
  });

  it("never goes backwards when the clock does", () => {
    const state: MeterState = { balance: 2, accruedOn: "2026-08-11", usedAt: null };
    expect(accrue(state, "2026-08-09").balance).toBe(2);
  });
});

describe("metering a rep", () => {
  it("spends one and reports what is left", () => {
    const d = meter({ state: FRESH, now: at(2026, 8, 11), premium: false });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(0);
    expect(d.state.usedAt).not.toBeNull();
  });

  it("refuses the second judged analysis of the day", () => {
    const first = meter({ state: FRESH, now: at(2026, 8, 11), premium: false });
    const second = meter({
      state: first.state,
      now: at(2026, 8, 11, 13),
      premium: false,
    });
    expect(second.allowed).toBe(false);
    expect(second.remaining).toBe(0);
  });

  it("hands the analysis back tomorrow", () => {
    const first = meter({ state: FRESH, now: at(2026, 8, 11), premium: false });
    const next = meter({
      state: first.state,
      now: at(2026, 8, 12),
      premium: false,
    });
    expect(next.allowed).toBe(true);
  });

  /**
   * The Saturday guardrail: three reps in one day after three days off
   * must all be judged. A hard practitioner is never worse off than a
   * daily one.
   */
  it("lets a banked user judge three reps in one sitting", () => {
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
  });
});

describe("status, without spending", () => {
  it("reads the balance without consuming it", () => {
    const s = meterStatus({ state: FRESH, now: at(2026, 8, 11), premium: false });
    expect(s.available).toBe(1);
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
