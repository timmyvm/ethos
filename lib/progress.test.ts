import { describe, expect, it } from "vitest";
import type { Achievement } from "./achievements";
import type { RepRow } from "./client-data";
import {
  journeySteps,
  journeySummary,
  nextMilestones,
  repGains,
  type ProgressInput,
} from "./progress";
import { MAX_STARS } from "./path";
import type { StreakState } from "./streak";

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
    expect(ms.find((m) => m.kind === "unit")?.remainingLabel).toBe("1 to go");
  });

  it("surfaces the next locked unit with its star cost", () => {
    const ms = nextMilestones(input({ starMap: { f1: 3 } }));
    const unit = ms.find((m) => m.kind === "unit");
    expect(unit?.label).toBe("Unlock Pace Control");
    expect(unit?.current).toBe(3);
    expect(unit?.target).toBe(4);
    expect(unit?.remaining).toBe(1);
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

  it("stops offering freezes once both slots are full", () => {
    const ms = nextMilestones(input({ freezesEquipped: 2 }));
    expect(ms.find((m) => m.kind === "freeze")).toBeUndefined();
  });
});

describe("journeySteps", () => {
  it("opens with an honest completed node, never a free star", () => {
    const steps = journeySteps({}, false);
    expect(steps[0].endowed).toBe(true);
    expect(steps[0].done).toBe(true);
    expect(steps[0].stars).toBe(0);
    // The endowed node contributes nothing to the star count.
    expect(journeySummary({}).stars).toBe(0);
  });

  it("reflects earned stars per lesson", () => {
    const steps = journeySteps({ f1: 3, f2: 1 }, true);
    expect(steps.find((s) => s.id === "f1")?.stars).toBe(3);
    expect(steps.find((s) => s.id === "f2")?.stars).toBe(1);
    expect(steps.find((s) => s.id === "f3")?.stars).toBe(0);
  });

  it("locks steps in units that haven't opened", () => {
    expect(journeySteps({}, false).find((s) => s.id === "p1")?.locked).toBe(
      true
    );
    expect(
      journeySteps({ f1: 3, f2: 3 }, true).find((s) => s.id === "p1")?.locked
    ).toBe(false);
  });
});

describe("journeySummary", () => {
  it("counts stars against the real maximum", () => {
    const s = journeySummary({ f1: 3, f2: 2 });
    expect(s.stars).toBe(5);
    expect(s.maxStars).toBe(MAX_STARS);
    expect(s.pct).toBeCloseTo(5 / MAX_STARS, 5);
    expect(s.lessonsMastered).toBe(1);
    expect(s.lessonsStarted).toBe(2);
  });

  it("is zero, not negative or NaN, for a new user", () => {
    const s = journeySummary({});
    expect(s.stars).toBe(0);
    expect(s.pct).toBe(0);
    expect(s.lessonsMastered).toBe(0);
  });
});

describe("repGains", () => {
  it("reports only what actually changed", () => {
    const gains = repGains({
      starsBefore: 4,
      starsAfter: 6,
      indexBefore: 610,
      indexAfter: 655,
      streakAfter: 3,
      unlockedUnit: "The Pause",
    });
    expect(gains.map((g) => g.label)).toEqual([
      "+2★",
      "+45 Ethos",
      "3-day streak",
      "The Pause unlocked",
    ]);
  });

  it("says nothing about stars or Index when neither moved", () => {
    const gains = repGains({
      starsBefore: 4,
      starsAfter: 4,
      indexBefore: 610,
      indexAfter: 610,
      streakAfter: 0,
      unlockedUnit: null,
    });
    expect(gains).toEqual([]);
  });

  it("reports a drop honestly rather than hiding it", () => {
    const gains = repGains({
      starsBefore: 4,
      starsAfter: 4,
      indexBefore: 700,
      indexAfter: 640,
      streakAfter: 0,
      unlockedUnit: null,
    });
    expect(gains[0].label).toBe("-60 Ethos");
    expect(gains[0].detail).toBe("700 → 640");
  });
});
