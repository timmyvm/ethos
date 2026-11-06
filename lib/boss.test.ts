import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOSS_ANSWER_SECONDS,
  BOSS_RESEARCH_SECONDS,
  BOSS_WEEKS,
  bossAnswerLine,
  bossReadLine,
  bossWeekLine,
  bossWeeks,
  bossXpMultiplier,
  daysLeftInWeek,
  lastBossWeek,
  mondayLabel,
  takeThisWeek,
  type BossTakeRow,
} from "./boss";
import { BOSS_XP_BASE, resolveRepConfig } from "./rep-config";

/** D30: Practice's stage says what the boss asks, from the boss's own clocks. */
describe("the boss says what it asks", () => {
  /* The games plan, item 16: 90 seconds to read (it was 4 minutes over
     about 50 words), then 90 to explain. */
  it("reads for 90 seconds and answers in 90 seconds", () => {
    const plain = (s: string) => s.replace(/\u00a0/g, " ");
    expect(BOSS_RESEARCH_SECONDS).toBe(90);
    expect(plain(bossReadLine())).toBe("Read for 90 seconds.");
    expect(plain(bossAnswerLine())).toBe("Explain it in 90 seconds.");
    // The number keeps its unit on its line.
    expect(bossReadLine()).toContain("90\u00a0seconds");
    expect(bossAnswerLine()).toContain("90\u00a0seconds");
  });

  it("says whole minutes as minutes and anything else in seconds", () => {
    const plain = (s: string) => s.replace(/\u00a0/g, " ");
    expect(plain(bossReadLine(240))).toBe("Read for 4 minutes.");
    expect(plain(bossReadLine(60))).toBe("Read for 1 minute.");
    expect(plain(bossReadLine(45))).toBe("Read for 45 seconds.");
    expect(plain(bossReadLine(150))).toBe("Read for 150 seconds.");
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

/** The boss's XP: a scored take pays the boss's, an unscored one what any unscored take pays. */
describe("what a boss take pays", () => {
  it("pays the boss's ×1.5 only for a take the engine scored", () => {
    expect(bossXpMultiplier(true)).toBe(BOSS_XP_BASE);
    expect(bossXpMultiplier(false)).toBe(1);
  });
});

/** The lobby's record: the last six weeks, each week's first boss Index (the games plan, item 16). */
describe("the last six weeks", () => {
  // Friday 6 Nov 2026, 10:00 on the device's clock: this week's Monday is 2 Nov.
  const NOW = new Date(2026, 10, 6, 10);
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();
  const boss = (created_at: string, ethos_index: number | null, id?: string): BossTakeRow => ({
    id,
    created_at,
    lesson_id: "boss:crispr",
    ethos_index,
  });
  const plain = (s: string) => s.replace(/\u00a0/g, " ");

  it("draws six weeks, oldest first, with this week last and Monday's date under each", () => {
    const weeks = bossWeeks([], NOW);
    expect(weeks).toHaveLength(BOSS_WEEKS);
    expect(weeks.map((w) => plain(w.label))).toEqual([
      "28 Sep",
      "5 Oct",
      "12 Oct",
      "19 Oct",
      "26 Oct",
      "2 Nov",
    ]);
    expect(weeks.map((w) => w.current)).toEqual([false, false, false, false, false, true]);
    expect(weeks.every((w) => w.monday.getDay() === 1 && w.monday.getHours() === 0)).toBe(true);
    // Nothing taken: every slot empty, none a zero.
    expect(weeks.every((w) => !w.taken && w.index === null)).toBe(true);
  });

  it("holds each week's first scored Index, leaves a missed week empty, and reads only bosses", () => {
    const weeks = bossWeeks(
      [
        boss(at(2026, 9, 29), 640), // 26 Oct week, Thursday
        boss(at(2026, 9, 27), 648), // 26 Oct week, Tuesday: the first
        boss(at(2026, 9, 13), null), // 12 Oct week: too short to score
        boss(at(2026, 9, 14), 621), // 12 Oct week: scored after it
        boss(at(2026, 9, 6), null), // 5 Oct week: only an unscored take
        { created_at: at(2026, 9, 20), lesson_id: "topic:t1", ethos_index: 700 }, // a daily take
        { created_at: at(2026, 9, 21), lesson_id: null, ethos_index: 701 },
        boss(at(2026, 8, 20), 590), // before the six weeks
      ],
      NOW
    );
    expect(weeks.map((w) => w.index)).toEqual([null, null, 621, null, 648, null]);
    expect(weeks.map((w) => w.taken)).toEqual([false, true, true, false, true, false]);
  });

  it("files a take by the device's week: Monday 00:00 starts the next, Sunday night is the last", () => {
    const weeks = bossWeeks(
      [boss(new Date(2026, 10, 1, 23, 59).toISOString(), 650), boss(new Date(2026, 10, 2, 0, 0).toISOString(), 684)],
      NOW
    );
    expect(weeks[4].index).toBe(650);
    expect(weeks[5].index).toBe(684);
  });

  it("finds this week's take, the scored one first, for See your take", () => {
    expect(takeThisWeek([boss(at(2026, 9, 27), 648, "last")], NOW)).toBeNull();
    expect(
      takeThisWeek(
        [boss(at(2026, 10, 3), null, "short"), boss(at(2026, 10, 4), 684, "scored"), boss(at(2026, 10, 5), 690, "later")],
        NOW
      )?.id
    ).toBe("scored");
    expect(takeThisWeek([boss(at(2026, 10, 3), null, "short")], NOW)?.id).toBe("short");
  });

  it("says a date as the caption does, three letters, never Sept", () => {
    expect(plain(mondayLabel(new Date(2026, 8, 28)))).toBe("28 Sep");
    expect(mondayLabel(new Date(2026, 10, 2))).toBe("2\u00a0Nov");
  });
});

/** The server's last week, for the delta "on last week's boss", in the speaker's own week. */
describe("last week, on the server", () => {
  it("is Monday to Monday on the speaker's clock", () => {
    // Melbourne (UTC+11, getTimezoneOffset -660): Friday 6 Nov 10:00 local
    // is Thursday 23:00 UTC. Its week began Monday 2 Nov 00:00 local,
    // which is Sunday 1 Nov 13:00 UTC.
    const w = lastBossWeek(new Date("2026-11-05T23:00:00Z"), -660);
    expect(w.to.toISOString()).toBe("2026-11-01T13:00:00.000Z");
    expect(w.from.toISOString()).toBe("2026-10-25T13:00:00.000Z");
  });

  it("puts Monday morning in Melbourne in the new week, where UTC still says Sunday", () => {
    // Monday 2 Nov 08:00 local is Sunday 1 Nov 21:00 UTC.
    const w = lastBossWeek(new Date("2026-11-01T21:00:00Z"), -660);
    expect(w.to.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });

  it("falls back to UTC's week with no offset, and west of UTC too", () => {
    const utc = lastBossWeek(new Date("2026-11-04T12:00:00Z"), null);
    expect(utc.to.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(utc.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    // New York (UTC-5, offset 300): Sunday 1 Nov 22:00 local is Monday 03:00 UTC.
    const ny = lastBossWeek(new Date("2026-11-02T03:00:00Z"), 300);
    expect(ny.to.toISOString()).toBe("2026-10-26T05:00:00.000Z");
  });
});
