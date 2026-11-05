import { describe, expect, it } from "vitest";
import { achievements } from "./achievements";
import type { RepRow } from "./client-data";

/** Enough words to score (`measured`): the rows below are real takes. */
const SAID =
  "The best part of my week was a long walk by the river with my sister after work on Friday, talking about nothing much.";

function rep(over: Partial<RepRow> = {}): RepRow {
  return {
    id: "r",
    lesson_id: "f1",
    created_at: new Date(2026, 7, 9).toISOString(),
    duration_s: 60,
    transcript: SAID,
    wpm: 145,
    filler_count: 5,
    fillers: [],
    pauses: [],
    stars: 2,
    focus: null,
    strength: null,
    supply: null,
    ethos_index: 600,
    audio_path: null,
    dimensions: null,
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "voice",
    delivery_metrics: null,
    presence_score: null,
    delivery_moments: null,
    ...over,
  };
}

const byId = (reps: RepRow[], id: string) =>
  achievements(reps).find((a) => a.id === id)!;

describe("achievements", () => {
  it("earns nothing on an empty history", () => {
    expect(achievements([]).every((a) => !a.earned)).toBe(true);
  });

  it("earns the first rep immediately", () => {
    expect(byId([rep()], "first").earned).toBe(true);
  });

  it("earns the clean run only under 3 fillers/min", () => {
    expect(byId([rep({ filler_count: 5 })], "clean").earned).toBe(false);
    expect(byId([rep({ filler_count: 2 })], "clean").earned).toBe(true);
  });

  it("counts composed pauses, not beats", () => {
    const pauses = [
      ...Array.from({ length: 5 }, (_, i) => ({ t: i, len: 1.2, kind: "pre" as const })),
      { t: 9, len: 0.4, kind: "beat" as const },
    ];
    expect(byId([rep({ pauses })], "silence").earned).toBe(true);
    const mostlyBeats = Array.from({ length: 8 }, (_, i) => ({
      t: i,
      len: 0.4,
      kind: "beat" as const,
    }));
    expect(byId([rep({ pauses: mostlyBeats })], "silence").earned).toBe(false);
  });

  it("tracks streak badges off the longest run", () => {
    const week = Array.from({ length: 7 }, (_, i) =>
      rep({ created_at: new Date(2026, 7, 3 + i).toISOString() })
    );
    expect(byId(week, "week").earned).toBe(true);
    expect(byId(week, "fortnight").earned).toBe(false);
    expect(byId(week, "fortnight").progress).toBeCloseTo(0.5);
  });

  it("earns index badges from the best rep ever", () => {
    const reps = [rep({ ethos_index: 640 }), rep({ ethos_index: 712 })];
    expect(byId(reps, "seven").earned).toBe(true);
    expect(byId(reps, "eight").earned).toBe(false);
  });

  /* A two-word take at 0 fillers a minute earned "Under 3 fillers a minute". */
  it("earns no number off a take too short to score, and still counts it", () => {
    const short = rep({ transcript: "Okay then.", duration_s: 5, filler_count: 0, wpm: 145 });
    const reps = [rep({ filler_count: 5 }), short];
    expect(byId(reps, "clean").earned).toBe(false);
    expect(byId(Array.from({ length: 5 }, () => short), "zone").progress).toBe(0);
    expect(byId([short], "first").earned).toBe(true);
  });

  it("reports partial progress for unearned badges", () => {
    const reps = Array.from({ length: 15 }, () => rep());
    expect(byId(reps, "thirty").earned).toBe(false);
    expect(byId(reps, "thirty").progress).toBeCloseTo(0.5);
  });
});

/**
 * The shelf is a ladder (DECISIONS #153). Order carries the difficulty
 * claim because nothing on screen says "hard", so a reordering has to be
 * a decision someone makes here rather than a line that drifted.
 */
describe("the shelf", () => {
  it("runs easiest to hardest, ending on the north star", () => {
    expect(achievements([]).map((a) => a.id)).toEqual([
      "first",
      "clean",
      "silence",
      "seven",
      "zone",
      "held",
      "week",
      "eight",
      "thirty",
      "fortnight",
    ]);
  });

  it("gives every badge somewhere to go and a mark", () => {
    for (const a of achievements([])) {
      expect(a.href.startsWith("/rep")).toBe(true);
      expect(a.icon).toBeTruthy();
    }
  });

  it("never states its own difficulty", () => {
    for (const a of achievements([])) {
      expect(`${a.name} ${a.requirement}`).not.toMatch(
        /easy|hard|advanced|beginner|tier|level \d/i
      );
    }
  });
});
