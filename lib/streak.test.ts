import { describe, expect, it } from "vitest";
import {
  computeStreak,
  freezeBalance,
  freezesEarned,
  keptDays,
  MAX_EQUIPPED_FREEZES,
  REPAIR_FROM,
  repairAfterTake,
  repairState,
  rescuableDays,
  type RepairTake,
} from "./streak";
import { levelFromXp, weekStart, xpForLevel } from "./level";

const d = (y: number, m: number, day: number, h = 12) =>
  new Date(y, m - 1, day, h);

describe("computeStreak", () => {
  it("is zero with no reps", () => {
    expect(computeStreak([], d(2026, 8, 9))).toEqual({
      current: 0,
      longest: 0,
      atRisk: false,
      didToday: false,
      frozenInRun: 0,
    });
  });

  it("counts consecutive days including today", () => {
    const s = computeStreak(
      [d(2026, 8, 7), d(2026, 8, 8), d(2026, 8, 9)],
      d(2026, 8, 9, 20)
    );
    expect(s.current).toBe(3);
    expect(s.didToday).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it("keeps yesterday's streak alive but at risk before today's rep", () => {
    const s = computeStreak([d(2026, 8, 7), d(2026, 8, 8)], d(2026, 8, 9, 8));
    expect(s.current).toBe(2);
    expect(s.atRisk).toBe(true);
    expect(s.didToday).toBe(false);
  });

  it("breaks after a missed day", () => {
    const s = computeStreak([d(2026, 8, 6), d(2026, 8, 7)], d(2026, 8, 9));
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
  });

  it("counts multiple reps in one day once", () => {
    const s = computeStreak(
      [d(2026, 8, 9, 8), d(2026, 8, 9, 21)],
      d(2026, 8, 9, 22)
    );
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
  });

  it("tracks the longest run separately from the current one", () => {
    const s = computeStreak(
      [d(2026, 8, 1), d(2026, 8, 2), d(2026, 8, 3), d(2026, 8, 4), d(2026, 8, 8), d(2026, 8, 9)],
      d(2026, 8, 9)
    );
    expect(s.longest).toBe(4);
    expect(s.current).toBe(2);
  });
});

describe("freezes", () => {
  it("bridges a missed day without counting it", () => {
    // Reps Mon/Tue/Thu, Wednesday frozen.
    const s = computeStreak(
      [d(2026, 8, 3), d(2026, 8, 4), d(2026, 8, 6)],
      d(2026, 8, 6, 20),
      [d(2026, 8, 5)]
    );
    expect(s.current).toBe(3); // three days SPOKEN
    expect(s.frozenInRun).toBe(1);
    expect(s.didToday).toBe(true);
  });

  it("does not let a freeze alone claim today", () => {
    const s = computeStreak(
      [d(2026, 8, 3), d(2026, 8, 4)],
      d(2026, 8, 5, 20),
      [d(2026, 8, 5)]
    );
    expect(s.didToday).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  it("still breaks when the gap is wider than the freezes held", () => {
    const s = computeStreak(
      [d(2026, 8, 3), d(2026, 8, 4)],
      d(2026, 8, 9),
      [d(2026, 8, 5)]
    );
    expect(s.current).toBe(0);
  });

  it("offers yesterday to a freeze, never today", () => {
    // Last rep Friday, now Sunday → Saturday is rescuable.
    const days = rescuableDays([d(2026, 8, 7)], [], 2, d(2026, 8, 9, 10));
    expect(days).toHaveLength(1);
    expect(days[0].getDate()).toBe(8);
  });

  it("refuses to half-bridge a gap it cannot close", () => {
    // Three days missed, one freeze — spending it would waste it.
    expect(rescuableDays([d(2026, 8, 4)], [], 1, d(2026, 8, 8))).toEqual([]);
  });

  it("has nothing to rescue while the streak is merely at risk", () => {
    expect(rescuableDays([d(2026, 8, 8)], [], 2, d(2026, 8, 9))).toEqual([]);
  });

  it("earns one freeze per full week, capped at two", () => {
    expect(freezesEarned(6)).toBe(0);
    expect(freezesEarned(7)).toBe(1);
    expect(freezesEarned(20)).toBe(2);
    // Capped at the equip maximum (3 since 27 Aug), however long the run.
    expect(freezesEarned(200)).toBe(3);
  });

  it("derives the balance from earned minus spent", () => {
    expect(freezeBalance(14, 0)).toBe(2);
    expect(freezeBalance(14, 1)).toBe(1);
    expect(freezeBalance(7, 3)).toBe(0);
  });

  it("counts bought freezes alongside earned ones", () => {
    // A bought freeze has to survive the next sync, which recomputes the
    // balance from scratch — so it joins the derivation rather than
    // incrementing a counter the derivation would overwrite.
    expect(freezeBalance(0, 0, 1)).toBe(1);
    expect(freezeBalance(7, 0, 1)).toBe(2);
    expect(freezeBalance(7, 1, 1)).toBe(1);
  });

  it("still caps at the maximum however they were acquired", () => {
    expect(freezeBalance(21, 0, 3)).toBe(MAX_EQUIPPED_FREEZES);
  });
});

describe("level curve", () => {
  it("spaces levels 50 XP apart, growing", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(3)).toBe(150);
    expect(xpForLevel(4)).toBe(300);
  });

  it("maps XP to level with progress", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(49).level).toBe(1);
    expect(levelFromXp(50)).toEqual({ level: 2, intoLevel: 0, forNext: 100 });
    expect(levelFromXp(200).level).toBe(3);
  });
});

describe("weekStart", () => {
  it("returns the local Monday", () => {
    // 9 Aug 2026 is a Sunday → week started Mon 3 Aug
    expect(weekStart(d(2026, 8, 9)).getDate()).toBe(3);
    // Monday maps to itself
    expect(weekStart(d(2026, 8, 10)).getDate()).toBe(10);
  });
});

describe("a streak read from every recording", () => {
  it("counts forty days at three recordings a day as forty", () => {
    const now = new Date(2026, 9, 26, 8);
    const dates: Date[] = [];
    for (let ago = 40; ago >= 1; ago--)
      for (const h of [9, 13, 19]) dates.push(new Date(2026, 9, 26 - ago, h));
    expect(computeStreak(dates, now).current).toBe(40);
    // The newest 90 of them, which is what the screens used to read.
    expect(computeStreak(dates.slice(-90), now).current).toBe(30);
  });
});

/*
 * One missed day, kept by speaking twice (closure.md row 14, #282). The
 * week of Monday 30 November 2026, after REPAIR_FROM: spoke Thursday 26
 * to Monday 30, missed Tuesday 1 December, and Wednesday is the repair.
 */
describe("a missed day two recordings keep", () => {
  /** A recording at local h:00 on 2026-mm-dd, scorable unless said. */
  const take = (m: number, day: number, h = 18, scorable: boolean | null | undefined = true): RepairTake =>
    scorable === undefined
      ? { created_at: new Date(2026, m - 1, day, h).toISOString() }
      : { created_at: new Date(2026, m - 1, day, h).toISOString(), scorable };
  /** One recording a day on each of these days of Nov/Dec 2026 (day > 20 is November). */
  const spoke = (...days: number[]) => days.map((n) => (n > 20 ? take(11, n) : take(12, n)));
  const TUE = new Date(2026, 11, 1);
  const WED_NIGHT = new Date(2026, 11, 2, 21);
  const keys = (ds: Date[]) => ds.map((x) => x.toDateString());
  /** Spoke Thursday to Monday (a run of five), missed Tuesday, and Wednesday's takes. */
  const fiveThen = (...wednesday: RepairTake[]) => [...spoke(26, 27, 28, 29, 30), ...wednesday];

  it("ships with the day it ships on: nothing before it is ever kept", () => {
    expect(REPAIR_FROM).toBe("2026-11-27");
  });

  it("keeps the day for a run of two and for a run of six", () => {
    const two = [...spoke(29, 30), take(12, 2, 9), take(12, 2, 19)];
    expect(keys(keptDays(two, [], WED_NIGHT))).toEqual(keys([TUE]));
    const six = [...spoke(25, 26, 27, 28, 29, 30), take(12, 2, 9), take(12, 2, 19)];
    expect(keys(keptDays(six, [], WED_NIGHT))).toEqual(keys([TUE]));
  });

  it("keeps nothing for a run of one, or of seven, which earns freezes (#174)", () => {
    expect(keptDays([...spoke(30), take(12, 2, 9), take(12, 2, 19)], [], WED_NIGHT)).toEqual([]);
    const seven = [...spoke(24, 25, 26, 27, 28, 29, 30), take(12, 2, 9), take(12, 2, 19)];
    expect(keptDays(seven, [], WED_NIGHT)).toEqual([]);
  });

  it("keeps nothing across a two-day gap", () => {
    const takes = [...spoke(25, 26, 27, 28, 29), take(12, 2, 9), take(12, 2, 19)];
    expect(keptDays(takes, [], WED_NIGHT)).toEqual([]);
  });

  it("keeps nothing a freeze already covered: the freeze is spent first (#39)", () => {
    const takes = fiveThen(take(12, 2, 9), take(12, 2, 19));
    expect(keptDays(takes, [new Date(2026, 11, 1)], WED_NIGHT)).toEqual([]);
  });

  it("needs two recordings of 20+ words the next day", () => {
    expect(keptDays(fiveThen(take(12, 2, 9)), [], WED_NIGHT)).toEqual([]);
    // Two recordings, one of them under 20 words.
    expect(keptDays(fiveThen(take(12, 2, 9), take(12, 2, 19, false)), [], WED_NIGHT)).toEqual([]);
    // A row the server never filled counts for nothing.
    expect(keptDays(fiveThen(take(12, 2, 9), take(12, 2, 19, null)), [], WED_NIGHT)).toEqual([]);
  });

  it("counts a capped fourth take: it is scorable, it only has no Ethos score", () => {
    const capped = { ...take(12, 2, 20), ethos_index: null, stars: 0 };
    const takes = fiveThen(take(12, 2, 9, false), take(12, 2, 10, false), take(12, 2, 11), capped);
    expect(keys(keptDays(takes, [], WED_NIGHT))).toEqual(keys([TUE]));
  });

  it("keeps once in seven days: a second miss inside them ends the run", () => {
    // Run of two, Tuesday 1 kept, then Wednesday to Friday spoken: a run
    // of five, and Saturday 5 missed only four days after.
    const takes = [...spoke(29, 30), take(12, 2, 9), take(12, 2, 19), ...spoke(3, 4), take(12, 6, 9), take(12, 6, 19)];
    expect(keys(keptDays(takes, [], new Date(2026, 11, 6, 21)))).toEqual(keys([TUE]));
    // Seven days after the kept one, still not; eight, kept again.
    const week = (miss: number) => [
      ...spoke(29, 30),
      take(12, 2, 9),
      take(12, 2, 19),
      ...spoke(miss - 2, miss - 1),
      take(12, miss + 1, 9),
      take(12, miss + 1, 19),
    ];
    expect(keys(keptDays(week(8), [], new Date(2026, 11, 9, 21)))).toEqual(keys([TUE]));
    expect(keys(keptDays(week(9), [], new Date(2026, 11, 10, 21)))).toEqual(keys([TUE, new Date(2026, 11, 9)]));
  });

  it("never keeps a day before REPAIR_FROM, so the deploy moves nobody's history", () => {
    // Spoke 20 to 25 November, missed the 26th, two takes on the 27th.
    const takes = [take(11, 21), take(11, 22), take(11, 23), take(11, 24), take(11, 25), take(11, 27, 9), take(11, 27, 19)];
    expect(keptDays(takes, [], new Date(2026, 10, 27, 21))).toEqual([]);
    // The same days, with the rule shipped earlier: kept.
    expect(keptDays(takes, [], new Date(2026, 10, 27, 21), "2026-11-20")).toHaveLength(1);
  });

  it("keeps nothing when the database has no scorable column (before 0037)", () => {
    const takes = fiveThen(take(12, 2, 9), take(12, 2, 19)).map(({ created_at }) => ({ created_at }));
    expect(keptDays(takes, [], WED_NIGHT)).toEqual([]);
    expect(repairState(takes, [], new Date(2026, 11, 2, 8))).toBeNull();
  });

  it("bridges like a freeze: 5 then 6, the kept day adding nothing to current or longest", () => {
    const takes = fiveThen(take(12, 2, 9), take(12, 2, 19));
    const dates = takes.map((t) => new Date(t.created_at));
    const plain = computeStreak(dates, WED_NIGHT);
    expect(plain.current).toBe(1);
    const kept = keptDays(takes, [], WED_NIGHT);
    const s = computeStreak(dates, WED_NIGHT, kept);
    expect(s.current).toBe(6);
    expect(s.longest).toBe(6);
    expect(s.didToday).toBe(true);
  });
});

describe("the repair still open today", () => {
  const take = (m: number, day: number, h = 18, scorable: boolean | null = true): RepairTake => ({
    created_at: new Date(2026, m - 1, day, h).toISOString(),
    scorable,
  });
  const five = [take(11, 26), take(11, 27), take(11, 28), take(11, 29), take(11, 30)];
  const WED = (h: number) => new Date(2026, 11, 2, h);

  it("names the run and counts the day's takes of 20+ words: 0, then 1, then closed", () => {
    expect(repairState(five, [], WED(8))).toEqual({ run: 5, missed: new Date(2026, 11, 1), counted: 0 });
    expect(repairState([...five, take(12, 2, 9)], [], WED(10))?.counted).toBe(1);
    expect(repairState([...five, take(12, 2, 9), take(12, 2, 10)], [], WED(11))).toBeNull();
  });

  it("is not moved by a take under 20 words: a too-short take changes nothing", () => {
    expect(repairState([...five, take(12, 2, 9, false)], [], WED(10))?.counted).toBe(0);
  });

  it("is never offered when a freeze covered the day, on a two-day gap, or for a run past six", () => {
    expect(repairState(five, [new Date(2026, 11, 1)], WED(8))).toBeNull();
    expect(repairState(five, [], new Date(2026, 11, 3, 8))).toBeNull();
    const seven = [take(11, 24), take(11, 25), ...five];
    expect(repairState(seven, [], WED(8))).toBeNull();
    expect(repairState([take(11, 30)], [], WED(8))).toBeNull();
  });

  it("is never offered inside seven days of a day already kept", () => {
    // Kept Tuesday 1; then Wednesday to Friday spoken, Saturday missed.
    const takes = [take(11, 29), take(11, 30), take(12, 2, 9), take(12, 2, 10), take(12, 3), take(12, 4)];
    expect(repairState(takes, [], new Date(2026, 11, 6, 8))).toBeNull();
  });

  it("predicts the glance's first frame from the take's own answer, and closes on the second", () => {
    const open = repairState(five, [], WED(8))!;
    const at = WED(9);
    const one = repairAfterTake(open, { scorable: true, stored: true, at });
    expect(one).toEqual({ ...open, counted: 1 });
    expect(repairAfterTake(open, { scorable: false, stored: true, at })).toEqual(open);
    expect(repairAfterTake(open, { scorable: true, stored: false, at })).toEqual(open);
    expect(repairAfterTake(one, { scorable: true, stored: true, at })).toBeNull();
    // A take that lands past midnight: the repair's day is over.
    expect(repairAfterTake(open, { scorable: true, stored: true, at: new Date(2026, 11, 3, 0, 1) })).toBeNull();
    expect(repairAfterTake(null, { scorable: true, stored: true, at })).toBeNull();
  });
});
