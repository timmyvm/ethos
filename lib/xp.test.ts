import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { levelFromXp, xpForLevel } from "./level";
import { XP_PER_RECORDING as ROUND_XP } from "./round-copy";
import {
  XP_PER_RECORDING,
  barLabel,
  bestFlame,
  levelLine,
  reachLine,
  streakFlame,
  xpPaid,
  xpStanding,
  xpToday,
} from "./xp";

/*
 * You's card (#485). Timothy, 16 Nov, on "40 of 50 to level 2": "level
 * should be 10xp from level 2. Do this to reach it." The line says the
 * distance in XP, and the line under it what reaches it, from what the
 * server actually pays.
 */
describe("the distance to the next level", () => {
  it("says Timothy's 40 XP as 10 XP to level 2", () => {
    expect(levelLine(40)).toBe("10 XP to level 2");
    expect(xpStanding(40)).toMatchObject({ level: 1, toNext: 10, next: 2, into: 40, span: 50 });
    expect(xpStanding(40).fraction).toBeCloseTo(0.8);
  });

  it("is the whole next span on the first XP of a level, and never zero", () => {
    expect(levelLine(0)).toBe("50 XP to level 2");
    expect(levelLine(50)).toBe("100 XP to level 3");
    expect(levelLine(149)).toBe("1 XP to level 3");
    for (let xp = 0; xp < 3000; xp += 7) expect(xpStanding(xp).toNext).toBeGreaterThan(0);
  });

  it("agrees with the level curve everywhere", () => {
    for (const xp of [0, 1, 49, 50, 51, 299, 300, 1195, 9620]) {
      const { level, intoLevel, forNext } = levelFromXp(xp);
      const s = xpStanding(xp);
      expect(s.level).toBe(level);
      expect(s.toNext).toBe(forNext - intoLevel);
      expect(xp + s.toNext).toBe(xpForLevel(level + 1));
    }
  });

  it("reads a high level's numbers whole", () => {
    // The fixtures' long road: 9620 XP is level 20, 880 short of 21.
    expect(levelLine(9620)).toBe("880 XP to level 21");
    expect(barLabel(9620)).toBe("Level 20, 120 of 1000 XP. 880 XP to level 21.");
  });

  it("treats a missing, negative or broken total as none", () => {
    for (const bad of [NaN, -5, Number.POSITIVE_INFINITY]) expect(levelLine(bad)).toBe("50 XP to level 2");
  });
});

describe("what reaches it", () => {
  it("names today's practice and what it pays, before today is spoken", () => {
    expect(reachLine(1195, false)).toBe(`Today's practice pays ${XP_PER_RECORDING} XP.`);
  });

  it("names the next recording once today is spoken", () => {
    expect(reachLine(1195, true)).toBe(`One more recording pays ${XP_PER_RECORDING} XP.`);
  });

  it("says when one recording closes the gap", () => {
    expect(reachLine(40, false)).toBe("Today's practice gets you to level 2.");
    expect(reachLine(45, true)).toBe("One more recording gets you to level 2.");
    expect(reachLine(39, false)).toBe("Today's practice pays 10 XP.");
  });

  it("promises the figure the server pays, from one number", () => {
    expect(XP_PER_RECORDING).toBe(10);
    expect(ROUND_XP).toBe(XP_PER_RECORDING);
    expect(xpPaid()).toBe(XP_PER_RECORDING);
    expect(xpPaid(1.5)).toBe(15);
    expect(xpPaid(0)).toBe(XP_PER_RECORDING);
    // The save pays through it; no second copy of the figure is left in it.
    const db = readFileSync("lib/db.ts", "utf8");
    expect(db).toMatch(/amount: xpPaid\(params\.xpMultiplier \?\? 1\)/);
    expect(db).not.toMatch(/XP_PER_REP\b/);
  });

  it("passes the two-second test: a number and its unit, no internal word", () => {
    for (const line of [levelLine(40), reachLine(40, false), reachLine(1195, false), reachLine(1195, true)]) {
      expect(line).toMatch(/\d/);
      expect(line).not.toMatch(/\bof\b \d+ to/);
      expect(line).not.toMatch(/multiplier|xp_|event|rep\b/i);
      expect(line).not.toMatch(/—/);
    }
  });
});

describe("XP today", () => {
  const now = new Date(2026, 10, 16, 18, 0);
  it("adds what was paid since this morning's midnight, on the phone's calendar", () => {
    const rows = [
      { amount: 10, created_at: new Date(2026, 10, 16, 0, 5).toISOString() },
      { amount: 15, created_at: new Date(2026, 10, 16, 9, 0).toISOString() },
      { amount: 40, created_at: new Date(2026, 10, 15, 23, 59).toISOString() },
    ];
    expect(xpToday(rows, now)).toBe(25);
    expect(xpToday([], now)).toBe(0);
  });
});

describe("the flames (Timothy: 'current streak, greyed out fire, max streak orange fire')", () => {
  it("greys the current streak's flame until today is spoken, then lights it", () => {
    expect(streakFlame(6, false)).toBe("grey");
    expect(streakFlame(7, true)).toBe("lit");
    expect(streakFlame(0, false)).toBe("grey");
  });

  it("lights the best streak's flame once there is one", () => {
    expect(bestFlame(1)).toBe("lit");
    expect(bestFlame(0)).toBe("grey");
  });
});
