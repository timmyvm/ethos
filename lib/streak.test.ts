import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";
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
