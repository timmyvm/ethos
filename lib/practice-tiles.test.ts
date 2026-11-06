import { describe, expect, it } from "vitest";
import { dayKey } from "./challenge";
import { askedIdsFrom, gameById, gameOfTheDay, type Game } from "./games";
import type { LadderRow } from "./ladder";
import {
  bestLine,
  dayState,
  freeAgainLine,
  hostileUsedThisWeek,
  lessonIdsNewestFirst,
  nextFreeDay,
  PREMIUM_DEPTH,
  tileLadder,
  tomorrowLine,
} from "./practice-tiles";
import type { GameRound } from "./round";

/** Noon on day `d` of November 2026, on the device's calendar. Fri 6 Nov is Interview's day. */
const on = (d: number, h = 12) => new Date(2026, 10, d, h);
const NOW = on(6, 18);
const game = (id: string) => gameById(id) as Game;

function round(gameId: GameRound["game"], level: 1 | 2 | 3, over: Record<string, unknown> = {}): GameRound {
  const base = {
    v: 1 as const, level, cap: 90, durationS: 40, stoppedBy: "you" as const, lastWord: 39.5,
    stars: 3, scorable: true, counted: true, best: null,
  };
  if (gameId === "qa") return { ...base, game: "qa", cutIns: [], best: 31, ...over } as GameRound;
  if (gameId === "rush") return { ...base, game: "rush", cap: 45, spare: 2, landed: true, ...over } as GameRound;
  return { ...base, game: "interview", firstWord: 1, inWindow: true, numberAtEnd: null, cutIns: [], best: 712, ...over } as GameRound;
}
const row = (day: number, r: GameRound | null, lesson?: string): LadderRow => ({
  created_at: on(day).toISOString(),
  lesson_id: lesson ?? (r ? `game:${r.game}:q${day}` : "game:qa:qa1"),
  stars: r?.stars ?? 3,
  ethos_index: 640,
  round: r,
});

describe("a tile's ladder (M6)", () => {
  it("a game never played reads Level 1 with two empty pips and no best", () => {
    expect(tileLadder([], "qa", NOW)).toEqual({ level: 1, counted: 0, of: 2, mastered: false, best: null });
  });

  it("level 2 with one pip and the best at level 2", () => {
    const rows = [row(1, round("qa", 1, { best: 22 })), row(2, round("qa", 1, { best: 26 })), row(4, round("qa", 2))];
    expect(tileLadder(rows, "qa", NOW)).toEqual({ level: 2, counted: 1, of: 2, mastered: false, best: "Best 31s clean" });
  });

  it("level 3 counts three pips toward mastery, then reads Mastered", () => {
    const climb = [1, 2].map((d) => row(d, round("rush", 1))).concat([3, 4].map((d) => row(d, round("rush", 2))));
    const one = tileLadder([...climb, row(5, round("rush", 3))], "rush", NOW);
    expect(one).toMatchObject({ level: 3, counted: 1, of: 3, mastered: false });
    const all = tileLadder([...climb, ...[5, 6, 7, 8].map((d) => row(d, round("rush", 3)))], "rush", on(9));
    expect(all).toMatchObject({ level: 3, of: 3, mastered: true, best: "Best 4 in a row" });
  });

  it("a level just opened has no best of its own yet", () => {
    const rows = [row(1, round("interview", 1)), row(2, round("interview", 1))];
    expect(tileLadder(rows, "interview", NOW)).toMatchObject({ level: 2, counted: 0, best: null });
  });
});

describe("the best, in the tile's words (M4)", () => {
  it("says each game's own number", () => {
    expect(bestLine("qa", 31.4)).toBe("Best 31s clean");
    expect(bestLine("rush", 4)).toBe("Best 4 in a row");
    expect(bestLine("interview", 712)).toBe("Best 712");
  });

  it("says nothing without a number worth saying", () => {
    expect(bestLine("qa", null)).toBeNull();
    expect(bestLine("qa", 0.2)).toBeNull();
    expect(bestLine("rush", 0)).toBeNull();
    expect(bestLine("interview", Number.NaN)).toBeNull();
    expect(bestLine("hostile", 70)).toBeNull();
  });
});

describe("the draw's memory from the ladder's rows", () => {
  it("hands drawFresh the asked ids newest first", () => {
    const rows = [row(1, null, "game:qa:qa3"), row(2, null, "game:qa:qa7"), row(3, null, "game:rush:ru1")];
    expect(askedIdsFrom(lessonIdsNewestFirst(rows), game("qa"))).toEqual(["qa7", "qa3"]);
  });
});

describe("the game of the day on Practice (plan 12)", () => {
  it("is Interview on Friday 6 November and Speed rush tomorrow", () => {
    expect(gameOfTheDay(dayKey(NOW))).toBe("interview");
    expect(tomorrowLine(NOW)).toBe("Speed rush is free tomorrow.");
    expect(tomorrowLine(on(7))).toBe("Interview is free tomorrow.");
  });

  it("is open until today's round is taken, then says when it is free again", () => {
    const iv = game("interview");
    const today = dayKey(NOW);
    expect(dayState(iv, { dayKey: today, rows: [], now: NOW })).toBe("open");
    const played = [row(6, round("interview", 1))];
    expect(dayState(iv, { dayKey: today, rows: played, now: NOW })).toBe("spent");
    // A round not measured still spends it: the lesson id is the record.
    expect(dayState(iv, { dayKey: today, rows: [row(6, null, "game:interview:iv2")], now: NOW })).toBe("spent");
    expect(nextFreeDay("interview", NOW)?.getDate()).toBe(8);
    expect(freeAgainLine("interview", NOW)).toBe("Free again Sunday");
  });

  it("names tomorrow when tomorrow is the day", () => {
    expect(freeAgainLine("rush", NOW)).toBe("Free again tomorrow");
    expect(freeAgainLine("qa", NOW)).toBeNull();
  });

  it("is unknown until the day and the rounds are read, and a failed read opens it", () => {
    const iv = game("interview");
    expect(dayState(iv, { dayKey: null, rows: [], now: NOW })).toBe("unknown");
    expect(dayState(iv, { dayKey: dayKey(NOW), rows: null, now: NOW })).toBe("unknown");
    expect(dayState(iv, { dayKey: dayKey(NOW), rows: "failed", now: NOW })).toBe("open");
  });

  it("a game that is not today's is never open to a free account", () => {
    expect(dayState(game("rush"), { dayKey: dayKey(NOW), rows: [], now: NOW })).toBe("spent");
  });
});

describe("Hostile Q&A's free week (plan 15)", () => {
  const take = (d: number) => ({ lesson_id: "hostile-take", created_at: on(d).toISOString() });
  it("is used by a take since Monday on this calendar, and unknown when unread", () => {
    expect(hostileUsedThisWeek([take(2)], NOW)).toBe(true); // Monday 2 Nov
    expect(hostileUsedThisWeek([take(1)], NOW)).toBe(false); // the Sunday before
    expect(hostileUsedThisWeek([{ lesson_id: "game:qa:qa1", created_at: on(5).toISOString() }], NOW)).toBe(false);
    expect(hostileUsedThisWeek(null, NOW)).toBeNull();
  });
});

describe("Practice's copy (COPY-RULES)", () => {
  const lines = [
    ...Object.values(PREMIUM_DEPTH),
    tomorrowLine(NOW),
    freeAgainLine("interview", NOW) ?? "",
    bestLine("qa", 31) ?? "",
    bestLine("rush", 4) ?? "",
  ];
  it("keeps the depth lines the plan wrote", () => {
    expect(PREMIUM_DEPTH).toEqual({
      rush: "45, 30, then 20 seconds.",
      interview: "Three levels, the last with a follow-up.",
    });
  });
  it("has no em dash and no banned word", () => {
    for (const l of lines) {
      expect(l).not.toMatch(/—/);
      expect(l).not.toMatch(/\b(reps?|gym|workout|drill|training)\b/i);
    }
  });
});
