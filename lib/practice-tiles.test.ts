import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dayKey } from "./challenge";
import { askedIdsFrom, gameById, gameOfTheDay, type Game } from "./games";
import type { LadderRow } from "./ladder";
import {
  bestLine,
  dayState,
  freeAgainLine,
  lessonIdsNewestFirst,
  nextFreeDay,
  PREMIUM_DEPTH,
  tileBest,
  tileLadder,
  tomorrowLine,
} from "./practice-tiles";
import { hostileTile } from "./home-modes";
import { HOSTILE_TAKE_ID } from "./hostile";
import { bestParts, secondsLabel } from "./round-live";
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
    expect(tileLadder([], "qa", NOW)).toEqual({ level: 1, counted: 0, of: 2, mastered: false, best: null, bestParts: null });
  });

  it("level 2 with one pip and the best at level 2", () => {
    const rows = [row(1, round("qa", 1, { best: 22 })), row(2, round("qa", 1, { best: 26 })), row(4, round("qa", 2))];
    expect(tileLadder(rows, "qa", NOW)).toEqual({
      level: 2,
      counted: 1,
      of: 2,
      mastered: false,
      best: "Best 31s clean",
      bestParts: { value: "31s", rest: "clean" },
    });
  });

  it("level 3 counts three pips toward mastery, then reads Mastered", () => {
    const climb = [1, 2].map((d) => row(d, round("rush", 1))).concat([3, 4].map((d) => row(d, round("rush", 2))));
    const one = tileLadder([...climb, row(5, round("rush", 3))], "rush", NOW);
    expect(one).toMatchObject({ level: 3, counted: 1, of: 3, mastered: false });
    const all = tileLadder([...climb, ...[5, 6, 7, 8].map((d) => row(d, round("rush", 3)))], "rush", on(9));
    expect(all).toMatchObject({ level: 3, of: 3, mastered: true, best: "Best 4 in a row", bestParts: { value: "4", rest: "in a row" } });
  });

  it("a level just opened has no best of its own yet", () => {
    const rows = [row(1, round("interview", 1)), row(2, round("interview", 1))];
    expect(tileLadder(rows, "interview", NOW)).toMatchObject({ level: 2, counted: 0, best: null, bestParts: null });
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

describe("the best, for the eye (the plaque's grammar on a tile)", () => {
  it("sets the number apart from the rest of its words", () => {
    expect(tileBest("qa", 31.4)).toEqual({ value: "31s", rest: "clean" });
    expect(tileBest("rush", 4)).toEqual({ value: "4", rest: "in a row" });
    expect(tileBest("interview", 712.4)).toEqual({ value: "712", rest: "Index" });
  });

  it("says the seconds the way the plaque before Record says them", () => {
    expect(tileBest("qa", 8.46)?.value).toBe(secondsLabel(8.46));
    expect(tileBest("qa", 8.46)?.value).toBe("8.5s");
    expect(bestLine("qa", 8.46)).toBe("Best 8.5s clean");
    const plaque = bestParts({ game: "qa", level: 2, best: 31.4, chain: 0 });
    expect(tileBest("qa", 31.4)?.value).toBe(plaque?.value);
  });

  it("draws nothing where the sentence says nothing", () => {
    for (const [g, v] of [["qa", null], ["qa", 0.2], ["rush", 0], ["interview", Number.NaN], ["hostile", 70]] as const) {
      expect(tileBest(g, v)).toBeNull();
      expect(bestLine(g, v)).toBeNull();
    }
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

describe("Practice's copy (COPY-RULES)", () => {
  const lines = [
    ...Object.values(PREMIUM_DEPTH),
    tomorrowLine(NOW),
    freeAgainLine("interview", NOW) ?? "",
    bestLine("qa", 31) ?? "",
    bestLine("rush", 4) ?? "",
    ...(["qa", "rush", "interview"] as const).flatMap((g) => Object.values(tileBest(g, 31) ?? {})),
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

/*
 * #494, the morning tour (docs/look/tour/08-practice-390-light.png):
 * Hostile Q&A's tile had nothing under its name, the Q&A ladder's two
 * pale outlined squares read as a font's missing-glyph boxes, and the
 * "Premium" head stood over a PREMIUM chip.
 */
describe("Practice's tiles say what they hold (#494)", () => {
  const page = readFileSync("app/games/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  it("gives Hostile Q&A's tile the allowance Today's tile says", () => {
    const tile = page.slice(page.indexOf('name="Hostile Q&A"'), page.indexOf("<WideTile"));
    expect(page).toContain("const hostile = hostileTile({ now, premium, rows });");
    expect(tile).toContain("note={hostile.line}");
    // What the line says, in each state, comes from the one function.
    const now = on(6, 18);
    const take = (h: number) => ({ lesson_id: HOSTILE_TAKE_ID, created_at: on(6, h).toISOString() });
    expect(hostileTile({ now, premium: false, rows: [] }).line).toBe("3 free today");
    expect(hostileTile({ now, premium: false, rows: [take(9), take(10), take(11)] }).line).toMatch(/^Next in about /);
    expect(hostileTile({ now, premium: true, rows: [] }).line).toBe("Argue either side");
    // Unknown is a no-break space at the line's height, never a zero.
    expect(hostileTile({ now: null, premium: null, rows: null }).line).toBe("\u00a0");
    // At the cap the line is a date, not a door: stone, as a spent game's is.
    expect(tile).toContain('noteQuiet={hostile.line.startsWith("Next in")}');
  });

  it("draws the ladder as round dots, sage counted and sand not yet, never outlined squares", () => {
    const ladder = page.slice(page.indexOf("function LadderLines"), page.indexOf("function WideTile"));
    expect(ladder).toContain('`ladder-dot ${i < ladder.counted ? "bg-sage-600" : "bg-sand"}`');
    expect(ladder).not.toMatch(/rounded-\[2px\]|shadow-\[inset_0_0_0_1px/);
    const rule = css.slice(css.indexOf(".ladder-dot {"), css.indexOf("}", css.indexOf(".ladder-dot {")));
    expect(rule).toContain("width: 6px");
    expect(rule).toContain("height: 6px");
    expect(rule).toContain("border-radius: 9999px");
  });

  it("names the tier once: the chip keeps the tier, the head says what is in it", () => {
    expect(page).toContain('<h2 className="section-head">More games</h2>');
    expect(page).not.toContain('<h2 className="section-head">Premium</h2>');
    expect(page.match(/<PremiumMark variant="chip" \/>/g)).toHaveLength(1);
  });
});
