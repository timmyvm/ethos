import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOSS_ANSWER_SECONDS,
  BOSS_RESEARCH_SECONDS,
  bossAnswerLine,
  bossReadLine,
  bossWeekLine,
  daysLeftInWeek,
} from "./boss";
import { resolveRepConfig } from "./rep-config";

/** D30: Practice's stage says what the boss asks, from the boss's own clocks. */
describe("the boss says what it asks", () => {
  it("reads 4 minutes and answers in 90 seconds", () => {
    const plain = (s: string) => s.replace(/\u00a0/g, " ");
    expect(plain(bossReadLine())).toBe("Read for 4 minutes.");
    expect(plain(bossAnswerLine())).toBe("Explain it in 90 seconds.");
    // The number keeps its unit on its line.
    expect(bossAnswerLine()).toContain("90\u00a0seconds");
  });

  it("is the boss recording's real limit", () => {
    expect(resolveRepConfig({ boss: "1" }).maxSeconds).toBe(BOSS_ANSWER_SECONDS);
  });

  it("is the one source for both screens", () => {
    const boss = readFileSync("app/boss/page.tsx", "utf8");
    expect(boss).toContain("BOSS_RESEARCH_SECONDS");
    expect(boss).not.toMatch(/const RESEARCH_SECONDS = \d/);
    const games = readFileSync("app/games/page.tsx", "utf8");
    // /boss's stage is Practice's (E30): the same two lines, the same week line.
    for (const page of [boss, games]) {
      expect(page).toContain("bossReadLine()");
      expect(page).toContain("bossAnswerLine()");
      expect(page).toContain("bossWeekLine(");
      expect(page).toMatch(/<HeroStage\b/);
    }
    expect(BOSS_RESEARCH_SECONDS % 60).toBe(0);
  });
});

/** The week's state at the foot of the boss stage, on Practice and /boss. */
describe("the boss's week line", () => {
  const monday = new Date(2026, 9, 26);
  const day = (n: number, h = 9) => new Date(2026, 9, 26 + n, h).getTime();

  it("counts the days left in the device's week, never under one", () => {
    expect(daysLeftInWeek(monday, day(0))).toBe(7);
    expect(daysLeftInWeek(monday, day(5))).toBe(2);
    expect(daysLeftInWeek(monday, day(6, 23))).toBe(1);
    expect(daysLeftInWeek(monday, day(9))).toBe(1);
  });

  it("says done, the last day, or the days left, and holds its line while unread", () => {
    expect(bossWeekLine(true, 3)).toBe("Done this week");
    expect(bossWeekLine(false, 1)).toBe("Last day");
    expect(bossWeekLine(false, 2)).toBe("2 days left");
    expect(bossWeekLine(null, 2)).toBe("\u00a0");
    expect(bossWeekLine(false, null)).toBe("\u00a0");
  });
});
