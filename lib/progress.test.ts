import { describe, expect, it } from "vitest";
import type { Achievement } from "./achievements";
import type { RepRow } from "./client-data";
import { nextMilestones, type ProgressInput } from "./progress";
import * as progress from "./progress";
import { MAX_EQUIPPED_FREEZES, type StreakState } from "./streak";

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
  ...over,
});

const badge = (over: Partial<Achievement> = {}): Achievement => ({
  id: "b",
  name: "Seven straight",
  requirement: "7-day streak",
  earned: false,
  progress: 0.5,
  href: "/rep",
  icon: "flame",
  ...over,
});

const input = (over: Partial<ProgressInput> = {}): ProgressInput => ({
  reps: [],
  starMap: {},
  streak: streak(),
  xp: 0,
  freezesEquipped: 0,
  achievements: [],
  ...over,
});

describe("nextMilestones", () => {
  it("orders by proximity — goal-gradient is the whole point", () => {
    const ms = nextMilestones(
      input({
        starMap: { f1: 3, f2: 2 },
        streak: streak({ current: 6, longest: 6 }),
        xp: 40,
        achievements: [badge({ progress: 0.86 })],
      })
    );
    const progresses = ms.map((m) => m.progress);
    expect(progresses).toEqual([...progresses].sort((a, b) => b - a));
  });

  it("never shows a milestone already reached", () => {
    const ms = nextMilestones(input({ streak: streak({ current: 3 }) }));
    expect(ms.find((m) => m.id === "streak-3")).toBeUndefined();
    expect(ms.find((m) => m.id === "streak-7")).toBeDefined();
  });

  it("gives every milestone a number — no participation trophies", () => {
    const ms = nextMilestones(
      input({
        starMap: { f1: 1 },
        streak: streak({ current: 2, longest: 9 }),
        xp: 120,
        achievements: [badge()],
        reps: [{ ethos_index: 640 } as RepRow],
      })
    );
    expect(ms.length).toBeGreaterThan(3);
    for (const m of ms) {
      expect(m.detail).toMatch(/\d/);
      expect(m.remainingLabel).toMatch(/\d/);
      expect(m.remaining).toBeGreaterThan(0);
      expect(m.progress).toBeGreaterThanOrEqual(0);
      expect(m.progress).toBeLessThanOrEqual(1);
    }
  });

  it("never shows the same milestone twice under two systems", () => {
    // "Ethos 700" is both an Index band and a badge.
    const ms = nextMilestones(
      input({
        reps: [{ ethos_index: 655 } as RepRow],
        achievements: [
          badge({ id: "index700", name: "Ethos 700", requirement: "Score 700 or higher", progress: 0.94 }),
        ],
      })
    );
    const labels = ms.map((m) => m.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("states a badge's gap as a percentage, not a fake count", () => {
    const ms = nextMilestones(
      input({ achievements: [badge({ name: "Seven straight", progress: 0.86 })] })
    );
    const b = ms.find((m) => m.kind === "badge");
    expect(b?.remainingLabel).toBe("86% there");
  });

  it("states a countable gap as a count", () => {
    const ms = nextMilestones(input({ starMap: { f1: 3 } }));
    expect(ms.find((m) => m.kind === "star")?.remainingLabel).toBe("1 to go");
  });

  /**
   * #215 — the unit unlock is not a milestone. As the closest by
   * proximity it won the pre-record cue nearly every time, so the last
   * line before the Record tap named a unit four stars away instead of
   * the sixty seconds about to happen. The road still carries the gate
   * and its star cost, where it belongs.
   */
  it("never offers a unit unlock as a milestone", () => {
    const ms = nextMilestones(input({ starMap: { f1: 3 } }));
    expect(ms.map((m) => m.kind)).not.toContain("unit");
    expect(ms.map((m) => m.label).join(" ")).not.toContain("Unlock");
  });

  it("offers only the closest badge, not a wall of locked ones", () => {
    const ms = nextMilestones(
      input({
        achievements: [
          badge({ id: "a", progress: 0.1 }),
          badge({ id: "b", progress: 0.9 }),
          badge({ id: "c", progress: 0.4 }),
        ],
      })
    );
    const badges = ms.filter((m) => m.kind === "badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].id).toBe("badge-b");
  });

  it("hides the Index band until there is an Index to beat", () => {
    expect(
      nextMilestones(input()).find((m) => m.kind === "index")
    ).toBeUndefined();
    expect(
      nextMilestones(
        input({ reps: [{ ethos_index: 640 } as RepRow] })
      ).find((m) => m.kind === "index")?.label
    ).toBe("Ethos 700");
  });

  it("stops offering freezes once every slot is full", () => {
    const ms = nextMilestones(input({ freezesEquipped: MAX_EQUIPPED_FREEZES }));
    expect(ms.find((m) => m.kind === "freeze")).toBeUndefined();
  });

  it("keeps offering a freeze while a slot is open", () => {
    const ms = nextMilestones(
      input({ freezesEquipped: MAX_EQUIPPED_FREEZES - 1 })
    );
    expect(ms.find((m) => m.kind === "freeze")).toBeDefined();
  });
});

/* #486: nothing here sums every lesson's stars any more. */
describe("no total of stars", () => {
  it("has no rail, summary or gains left to print one", () => {
    for (const gone of ["journeySteps", "journeySummary", "repGains"]) {
      expect(gone in progress, gone).toBe(false);
    }
  });
});
