import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSS_ANSWER_SECONDS, BOSS_RESEARCH_SECONDS, bossAnswerLine, bossLobbyLine, bossReadLine } from "./boss";
import { resolveRepConfig } from "./rep-config";

/** D30: Practice's stage says what the boss asks, from the boss's own clocks. */
describe("the boss says what it asks", () => {
  it("reads 4 minutes and answers in 90 seconds", () => {
    const plain = (s: string) => s.replace(/\u00a0/g, " ");
    expect(plain(bossReadLine())).toBe("Read for 4 minutes.");
    expect(plain(bossAnswerLine())).toBe("Explain it in 90 seconds.");
    expect(plain(bossLobbyLine())).toBe("Read for 4 minutes, then explain it from memory in 90 seconds.");
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
    expect(boss).toContain("bossLobbyLine()");
    const games = readFileSync("app/games/page.tsx", "utf8");
    expect(games).toContain("bossReadLine()");
    expect(games).toContain("bossAnswerLine()");
    expect(BOSS_RESEARCH_SECONDS % 60).toBe(0);
  });
});
