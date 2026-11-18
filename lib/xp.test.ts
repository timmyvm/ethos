import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { levelFromXp, xpForLevel } from "./level";
import { computeMetrics, starGoals, type Word } from "./metrics";
import { xpTicksOwed } from "./sound-recipes";
import { XP_PER_RECORDING as ROUND_XP } from "./round-copy";
import {
  XP_PER_RECORDING,
  barLabel,
  bestFlame,
  levelLine,
  reachLine,
  reachLineFor,
  streakFlame,
  xpForTake,
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
  /*
   * #510: a take pays only when it earns a star, and star 1 is "20+
   * words" (the goal the glance draws under it), so the line names it.
   */
  it("names today and what a real answer pays, before today is spoken", () => {
    expect(reachLine(1195, false)).toBe(`Speak 20+ words today for ${XP_PER_RECORDING} XP.`);
  });

  it("names the next recording once a take has paid today", () => {
    expect(reachLine(1195, true)).toBe(`Speak 20+ words again for ${XP_PER_RECORDING} XP.`);
  });

  /*
   * #510 review: You keyed "again" on whether today was spoken, and a day
   * whose only take was too short to score is spoken and paid nothing:
   * "Speak 20+ words again" told someone who said twelve words that they
   * had said twenty. The line reads the XP read alone.
   */
  it("says today, not again, on a day spoken with no star", () => {
    expect(reachLineFor({ total: 1195, today: 0 })).toBe(`Speak 20+ words today for ${XP_PER_RECORDING} XP.`);
    expect(reachLineFor({ total: 1195, today: 10 })).toBe(`Speak 20+ words again for ${XP_PER_RECORDING} XP.`);
    expect(reachLineFor({ total: 45, today: 0 })).toBe("Speak 20+ words today to reach level 2.");
    expect(reachLineFor(null)).toBe(reachLine(0, false));
  });

  it("is drawn on You from the XP read, never from the streak", () => {
    const you = readFileSync("app/you/page.tsx", "utf8");
    expect(you).toMatch(/reachLineFor\(xp\)/);
    expect(you).not.toMatch(/reachLine\([^)]*didToday/);
  });

  it("says when one recording closes the gap", () => {
    expect(reachLine(40, false)).toBe("Speak 20+ words today to reach level 2.");
    expect(reachLine(45, true)).toBe("Speak 20+ words again to reach level 2.");
    expect(reachLine(39, false)).toBe("Speak 20+ words today for 10 XP.");
  });

  it("names star 1's own goal, the words the glance draws under it", () => {
    const goal = starGoals(60)[0];
    for (const line of [reachLine(1195, false), reachLine(1195, true), reachLine(40, false)]) {
      expect(line).toContain(` ${goal} `);
    }
  });

  it("promises the figure the server pays, from one number", () => {
    expect(XP_PER_RECORDING).toBe(10);
    expect(ROUND_XP).toBe(XP_PER_RECORDING);
    expect(xpPaid()).toBe(XP_PER_RECORDING);
    expect(xpPaid(1.5)).toBe(15);
    expect(xpPaid(0)).toBe(XP_PER_RECORDING);
    // The save pays through it, on the measured stars; no second copy of the figure is left in it.
    const db = readFileSync("lib/db.ts", "utf8");
    expect(db).toMatch(/xpForTake\(metrics\.stars, params\.xpMultiplier \?\? 1\)/);
    expect(db).toMatch(/amount: xp,/);
    expect(db).not.toMatch(/XP_PER_REP\b/);
  });

  it("stays one line at 320 wide: no longer than the longest line it replaced", () => {
    // "One more recording gets you to level 8." held one line in You's card at 320.
    const longest = "One more recording gets you to level 8.".length;
    for (const total of [0, 39, 40, 1195, 9620]) {
      for (const spoke of [false, true]) expect(reachLine(total, spoke).length).toBeLessThanOrEqual(longest + 1);
    }
  });

  it("passes the two-second test: a number and its unit, no internal word", () => {
    for (const line of [levelLine(40), reachLine(40, false), reachLine(1195, false), reachLine(1195, true)]) {
      expect(line).toMatch(/\d/);
      expect(line).not.toMatch(/\bof\b \d+ to/);
      expect(line).not.toMatch(/multiplier|xp_|event|rep\b|scorable|substance/i);
      expect(line).not.toMatch(/—/);
    }
  });
});

/*
 * #510, Timothy 18 Nov, on "a recording with no stars still earns 10
 * XP": "drop it". A take that earned no star pays nothing, at any
 * multiplier; one that earned a star pays what it always did.
 */
describe("what one take pays (#510)", () => {
  it("pays nothing for no star, at any multiplier", () => {
    for (const m of [1, 1.5, 2, 3, 0, NaN]) expect(xpForTake(0, m)).toBe(0);
    expect(xpForTake(NaN)).toBe(0);
    expect(xpForTake(-1)).toBe(0);
  });

  it("pays every star count what a recording always paid", () => {
    for (const stars of [1, 2, 3]) {
      expect(xpForTake(stars)).toBe(XP_PER_RECORDING);
      expect(xpForTake(stars, 1.5)).toBe(15);
      expect(xpForTake(stars, 2)).toBe(20);
    }
  });

  it("agrees with the star rule: a take too thin to score pays nothing", () => {
    const thin = computeMetrics(words("so um yes I think that is it"), 9);
    expect(thin.stars).toBe(0);
    expect(xpForTake(thin.stars)).toBe(0);
    const real = computeMetrics(
      words(
        "I moved here for the work and stayed for the people because the city is small enough that you see the same faces every morning on the train"
      ),
      30
    );
    expect(real.stars).toBeGreaterThan(0);
    expect(xpForTake(real.stars)).toBe(XP_PER_RECORDING);
  });
});

/** Words a second apart, as Whisper times them. */
function words(text: string): Word[] {
  return text.split(" ").map((word, i) => ({ word, start: i, end: i + 0.8 }));
}

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

  /*
   * #510: a take with no star writes no XP row, so You's XP today stands
   * where it was and its tick and sound are not owed (`xpTicksOwed`).
   */
  it("does not climb, or tick, for a take that earned no star", () => {
    const day = "2026-11-16";
    const morning = [{ amount: xpForTake(2), created_at: new Date(2026, 10, 16, 9, 0).toISOString() }];
    const heard = { day, xp: xpToday(morning, now) };
    // The no-star take at 17:00 pays nothing, so it adds no row.
    const paid = xpForTake(0);
    const after = paid > 0 ? [...morning, { amount: paid, created_at: new Date(2026, 10, 16, 17, 0).toISOString() }] : morning;
    expect(xpToday(after, now)).toBe(10);
    expect(xpTicksOwed(xpToday(after, now), day, heard)).toBe(false);
    // A first take of the day with no star leaves XP today at 0: nothing to tick.
    expect(xpTicksOwed(xpToday([], now), day, null)).toBe(false);
    // One with a star ticks, as before.
    expect(xpTicksOwed(xpToday(morning, now), day, null)).toBe(true);
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
