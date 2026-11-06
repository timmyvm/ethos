import { describe, expect, it } from "vitest";
import { GAMES, gameById, gameLevel } from "./games";
import type { LadderRow } from "./ladder";
import type { GameRound } from "./round";
import {
  bestLine,
  chainAt,
  cutInDue,
  firedCutIns,
  gameBestSnapshot,
  levelChoices,
  nextCutIn,
  pickLine,
  planCutIns,
  xpLabel,
  type CutInPlan,
} from "./round-live";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("planCutIns: an aim in the first half of each window (F1)", () => {
  it("draws the aim from [aimLo, aimLo + half the window]", () => {
    const [lo] = planCutIns([[12, 20]], () => 0);
    const [hi] = planCutIns([[12, 20]], () => 0.999999);
    expect(lo).toEqual({ aim: 12, forceBy: 20, at: null, line: null });
    expect(hi.aim).toBeCloseTo(16, 1);
    expect(hi.aim).toBeLessThan(16.0001);
  });

  it("keeps every level's windows in order, one plan each", () => {
    for (const g of GAMES) {
      for (const n of [1, 2, 3] as const) {
        const windows = gameLevel(g, n).cutIns;
        const plans = planCutIns(windows, seq(0.5));
        expect(plans).toHaveLength(windows.length);
        plans.forEach((p, i) => {
          expect(p.aim).toBeGreaterThanOrEqual(windows[i][0]);
          expect(p.aim).toBeLessThanOrEqual((windows[i][0] + windows[i][1]) / 2);
          expect(p.forceBy).toBe(windows[i][1]);
        });
      }
    }
  });

  it("takes a window of one second (the camera's ?cutinAt) as exactly that second", () => {
    expect(planCutIns([[3, 3]], () => 0.7)).toEqual([{ aim: 3, forceBy: 3, at: null, line: null }]);
  });
});

describe("cutInDue: speech-anchored, forced at the window's end", () => {
  const plan: CutInPlan = { aim: 14, forceBy: 20, at: null, line: null };

  it("waits for the aim, then the first voiced frame", () => {
    expect(cutInDue(plan, 13.9, true)).toBe(false);
    expect(cutInDue(plan, 14, false)).toBe(false);
    expect(cutInDue(plan, 17.2, false)).toBe(false);
    expect(cutInDue(plan, 17.3, true)).toBe(true);
  });

  it("cuts in at forceBy into a silence", () => {
    expect(cutInDue(plan, 19.99, false)).toBe(false);
    expect(cutInDue(plan, 20, false)).toBe(true);
  });

  it("never fires twice", () => {
    expect(cutInDue({ ...plan, at: 15 }, 25, true)).toBe(false);
  });

  it("fires the cut-ins in order, never a later one first", () => {
    const plans: CutInPlan[] = [
      { aim: 8, forceBy: 10, at: null, line: null },
      { aim: 30, forceBy: 40, at: null, line: null },
    ];
    expect(nextCutIn(plans, 7, true)).toBeNull();
    expect(nextCutIn(plans, 8.2, true)).toBe(plans[0]);
    plans[0].at = 8.2;
    expect(nextCutIn(plans, 9, true)).toBeNull();
    expect(nextCutIn(plans, 40, false)).toBe(plans[1]);
  });
});

describe("pickLine: never the same line twice in a round", () => {
  const lines = gameById("qa")!.cutInLines;

  it("draws only from the lines not yet said", () => {
    for (let r = 0; r < 1; r += 0.1) {
      expect(pickLine(lines, ["So what?"], () => r)).not.toBe("So what?");
    }
  });

  it("spends the whole pool before any repeat, and never repeats the last", () => {
    const used: string[] = [];
    for (let i = 0; i < lines.length; i++) used.push(pickLine(lines, used, () => 0.3)!);
    expect(new Set(used).size).toBe(lines.length);
    expect(pickLine(lines, used, () => 0.99)).not.toBe(used[used.length - 1]);
  });

  it("has no line for a game that never cuts in", () => {
    expect(pickLine([], [])).toBeNull();
  });

  it("sends only the cut-ins that fired, as { at, line }", () => {
    expect(
      firedCutIns([
        { aim: 8, forceBy: 10, at: 8.43, line: "Says who?" },
        { aim: 30, forceBy: 40, at: null, line: null },
      ])
    ).toEqual([{ at: 8.43, line: "Says who?" }]);
  });
});

/* ---------------------------------------------------------------- bests */

const at = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString();

function rushRow(day: number, level: 1 | 2 | 3, counted: boolean, scorable = true): LadderRow {
  const round = {
    v: 1,
    game: "rush",
    level,
    cap: 30,
    durationS: 28,
    stoppedBy: "you",
    lastWord: 27,
    stars: 3,
    scorable,
    counted,
    best: null,
    spare: 3,
    landed: counted,
  } as GameRound;
  return { created_at: at(day), lesson_id: "game:rush:ru1", stars: 3, ethos_index: 600, round };
}

function qaRow(day: number, level: 1 | 2 | 3, best: number | null): LadderRow {
  const round = {
    v: 1,
    game: "qa",
    level,
    cap: 90,
    durationS: 60,
    stoppedBy: "you",
    lastWord: 59,
    stars: 3,
    scorable: true,
    counted: best !== null,
    best,
    cutIns: [],
  } as GameRound;
  return { created_at: at(day), lesson_id: "game:qa:qa1", stars: 3, ethos_index: 600, round };
}

describe("the best before Record (M4)", () => {
  it("reads Speed rush's run at the level on screen, a miss ending it", () => {
    const rows = [
      rushRow(1, 2, true),
      rushRow(2, 2, true),
      rushRow(3, 2, true),
      rushRow(4, 2, false),
      rushRow(5, 2, false, false), // unscorable: skipped
      rushRow(6, 2, true),
      rushRow(7, 2, true),
      rushRow(8, 1, false), // another level: not this run
    ];
    expect(chainAt(rows, "rush", 2)).toBe(2);
    expect(gameBestSnapshot(rows, "rush", 2)).toEqual({ game: "rush", level: 2, best: 3, chain: 2 });
  });

  it("says each game's best in its own unit", () => {
    expect(bestLine({ game: "qa", level: 2, best: 31.4, chain: 0 })).toBe(
      "Your best at level 2: 31s clean after the cut-in."
    );
    expect(bestLine({ game: "qa", level: 1, best: 4.24, chain: 0 })).toBe(
      "Your best at level 1: 4.2s clean after the cut-in."
    );
    expect(bestLine({ game: "rush", level: 2, best: 4, chain: 2 })).toBe(
      "Your best at level 2: 4 landed in a row. You're on 2."
    );
    expect(bestLine({ game: "rush", level: 3, best: 4, chain: 0 })).toBe(
      "Your best at level 3: 4 landed in a row."
    );
    expect(bestLine({ game: "interview", level: 2, best: 712, chain: 0 })).toBe(
      "Your best at level 2: 712."
    );
  });

  it("says nothing until a best exists at this level", () => {
    const rows = [qaRow(1, 1, 22), qaRow(2, 1, null)];
    expect(bestLine(gameBestSnapshot(rows, "qa", 2))).toBeNull();
    expect(bestLine(gameBestSnapshot(rows, "qa", 1))).toBe(
      "Your best at level 1: 22s clean after the cut-in."
    );
    expect(bestLine(null)).toBeNull();
  });

  it("keeps the house copy rules: no em dash, no banned words", () => {
    const lines = [
      bestLine({ game: "qa", level: 2, best: 31, chain: 0 }),
      bestLine({ game: "rush", level: 2, best: 4, chain: 2 }),
      bestLine({ game: "interview", level: 2, best: 712, chain: 0 }),
    ];
    for (const l of lines) {
      expect(l).not.toMatch(/—/);
      expect(l).not.toMatch(/\b(gym|workout|drill|reps?|training)\b/i);
    }
  });
});

describe("the level control", () => {
  it("draws the opened levels only", () => {
    expect(levelChoices(1)).toEqual([1]);
    expect(levelChoices(2)).toEqual([1, 2]);
    expect(levelChoices(3)).toEqual([1, 2, 3]);
  });

  it("names the XP a level pays, and nothing at x1", () => {
    expect(xpLabel(2.5)).toBe("×2.5 XP");
    expect(xpLabel(1.88)).toBe("×1.88 XP");
    expect(xpLabel(1)).toBeNull();
  });
});
