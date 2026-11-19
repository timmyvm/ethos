import { describe, expect, it } from "vitest";
import {
  accrue,
  claimRead,
  CLAIM_TRIES,
  DAILY_GRANT,
  dateKey,
  giveBackRead,
  localDate,
  MAX_BALANCE,
  meter,
  meterStatus,
  type MeterState,
  type MeterStore,
  type MeterSwap,
} from "./metering";
import { spokenAt } from "./spoken-at";

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

/**
 * The stored row as lib/db.ts swapMeterState keeps it: a swap lands only
 * on the balance and day it was read at.
 */
function memoryStore(start: MeterState) {
  let row = start;
  let swaps = 0;
  const store: MeterStore = {
    read: async () => row,
    swap: async (from, to): Promise<MeterSwap> => {
      swaps++;
      if (from.balance !== row.balance || from.accruedOn !== row.accruedOn) return "moved";
      row = to;
      return "swapped";
    },
  };
  return { store, row: () => row, swaps: () => swaps };
}

/*
 * #514 review, the scale audit's M6: the meter is claimed in the store
 * before Demos reads, so takes sent at once can never share a read.
 */
describe("claiming a read (#514 review)", () => {
  const now = at(2026, 11, 20, 9);

  it("spends one from the row it read", async () => {
    const m = memoryStore({ balance: 0, accruedOn: "2026-11-19", usedAt: null });
    const c = await claimRead({ state: m.row(), now, store: m.store });
    expect(c).toMatchObject({ claimed: true, decision: { allowed: true, remaining: 2 } });
    expect(m.row()).toMatchObject({ balance: 2, accruedOn: "2026-11-20" });
  });

  it("gives takes that all read the same row at once exactly the day's 3", async () => {
    for (const n of [2, 3, 5, 10]) {
      const m = memoryStore({ balance: 1, accruedOn: "2026-11-19", usedAt: null });
      const seen = m.row();
      // Every take read the row before any of them claimed (the race).
      const claims = await Promise.all(Array.from({ length: n }, () => claimRead({ state: seen, now, store: m.store })));
      const won = claims.filter((c) => c.claimed && c.decision.allowed);
      expect(won, `${n} at once`).toHaveLength(Math.min(n, DAILY_GRANT));
      // Every take that lost is refused, never let through unclaimed.
      expect(claims.filter((c) => c.decision.allowed && !c.claimed)).toHaveLength(0);
      expect(m.row()).toMatchObject({ balance: Math.max(0, DAILY_GRANT - n), accruedOn: "2026-11-20" });
    }
  });

  it("reads again and meters what is left after losing the row", async () => {
    const m = memoryStore({ balance: 1, accruedOn: "2026-11-20", usedAt: null });
    const stale: MeterState = { balance: 2, accruedOn: "2026-11-20", usedAt: null };
    const c = await claimRead({ state: stale, now, store: m.store });
    expect(c).toMatchObject({ claimed: true, decision: { remaining: 0 } });
    expect(m.row().balance).toBe(0);
  });

  it("refuses a take that loses the row every time, and never spends past 0", async () => {
    let n = 0;
    const store: MeterStore = {
      read: async () => ({ balance: 3, accruedOn: "2026-11-20", usedAt: `${n++}` }),
      swap: async () => "moved",
    };
    const c = await claimRead({ state: { balance: 3, accruedOn: "2026-11-20", usedAt: null }, now, store });
    expect(c).toMatchObject({ claimed: false, decision: { allowed: false, remaining: 0 } });
    expect(n).toBe(CLAIM_TRIES);
  });

  it("degrades open when the store does not answer, as an unread meter does", async () => {
    const store: MeterStore = { read: async () => null, swap: async () => "unavailable" };
    const c = await claimRead({ state: { balance: 2, accruedOn: "2026-11-20", usedAt: null }, now, store });
    expect(c).toMatchObject({ claimed: false, decision: { allowed: true } });
    const threw: MeterStore = { read: async () => null, swap: () => Promise.reject(new Error("down")) };
    expect((await claimRead({ state: { balance: 2, accruedOn: "2026-11-20", usedAt: null }, now, store: threw })).decision.allowed).toBe(true);
  });

  it("never touches the store for a spent day", async () => {
    const m = memoryStore({ balance: 0, accruedOn: "2026-11-20", usedAt: null });
    const c = await claimRead({ state: m.row(), now, store: m.store });
    expect(c).toMatchObject({ claimed: false, decision: { allowed: false } });
    expect(m.swaps()).toBe(0);
  });
});

describe("handing a read back (#514 review)", () => {
  it("puts the read back on the day it came from", async () => {
    const m = memoryStore({ balance: 1, accruedOn: "2026-11-20", usedAt: null });
    expect(await giveBackRead({ spent: m.row(), store: m.store })).toBe(true);
    expect(m.row().balance).toBe(2);
  });

  it("puts it back on top of what other takes spent since", async () => {
    const spent: MeterState = { balance: 2, accruedOn: "2026-11-20", usedAt: null };
    const m = memoryStore({ balance: 0, accruedOn: "2026-11-20", usedAt: null });
    expect(await giveBackRead({ spent, store: m.store })).toBe(true);
    expect(m.row().balance).toBe(1);
  });

  it("gives nothing back to a day a newer one has already topped up", async () => {
    const spent: MeterState = { balance: 0, accruedOn: "2026-11-19", usedAt: null };
    const m = memoryStore({ balance: 3, accruedOn: "2026-11-20", usedAt: null });
    expect(await giveBackRead({ spent, store: m.store })).toBe(false);
    expect(m.row()).toMatchObject({ balance: 3, accruedOn: "2026-11-20" });
  });

  it("never banks past the day's 3", async () => {
    const m = memoryStore({ balance: 3, accruedOn: "2026-11-20", usedAt: null });
    await giveBackRead({ spent: m.row(), store: m.store });
    expect(m.row().balance).toBe(MAX_BALANCE);
  });
});

/*
 * The offset and the spoken time are the client's word (clamped to 14
 * hours and to 72 hours back, never ahead). Whatever a client claims, in
 * whatever order, no day the meter keeps ever scores more than 3, and a
 * forged offset pulls at most one day's 3 early.
 */
describe("what a forged clock can do (#514 review)", () => {
  it("never scores more than 3 on any meter day, whatever offsets and spoken times arrive", () => {
    let seed = 514;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 200; run++) {
      let state: MeterState = run % 2 ? FRESH : { balance: 1, accruedOn: "2026-11-15", usedAt: null };
      const perDay = new Map<string, number>();
      let real = Date.UTC(2026, 10, 19, 0);
      for (let take = 0; take < 60; take++) {
        real += Math.floor(rand() * 4 * 3_600_000);
        const said = spokenAt(String(real - Math.floor(rand() * 100 * 3_600_000)), real)!;
        const offset = Math.round((rand() * 2 - 1) * 20 * 60);
        const d = meter({ state, now: localDate(said, offset), premium: false });
        if (d.allowed) {
          const day = d.state.accruedOn!;
          perDay.set(day, (perDay.get(day) ?? 0) + 1);
        }
        state = d.state;
      }
      for (const [day, n] of perDay) expect(n, `run ${run}, ${day}`).toBeLessThanOrEqual(DAILY_GRANT);
    }
  });

  it("lets a forward offset pull tomorrow's 3 early once, and then nothing until the day after", () => {
    // UTC noon on the 19th; a claim of UTC+14 reads 02:00 on the 20th.
    const noon = new Date(Date.UTC(2026, 10, 19, 12));
    let state: MeterState = { balance: 0, accruedOn: dateKey(localDate(noon, 0)), usedAt: null };
    const early = [0, 1, 2, 3].map(() => {
      const d = meter({ state, now: localDate(noon, -14 * 60), premium: false });
      state = d.state;
      return d.allowed;
    });
    expect(early).toEqual([true, true, true, false]);
    // The real 20th then has nothing left: the day was already spent.
    const next = new Date(Date.UTC(2026, 10, 20, 9));
    expect(meter({ state, now: localDate(next, 0), premium: false }).allowed).toBe(false);
  });
});
