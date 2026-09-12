import { describe, expect, it } from "vitest";
import { UNITS } from "./path";
import {
  AGE_BANDS,
  GOALS,
  dayOneNote,
  isAgeBand,
  isGoal,
  planFor,
  readProfile,
  topicsFor,
} from "./profile";
import { TOPICS } from "./topics";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

describe("the self-diagnosis (DECISIONS #231)", () => {
  it("maps every goal to a unit that exists on the road", () => {
    for (const g of GOALS) {
      expect(UNITS.some((u) => u.id === g.unitId)).toBe(true);
    }
  });

  it("keeps every tappable answer inside the word budget", () => {
    for (const s of [...GOALS.map((g) => g.label), ...AGE_BANDS.map((a) => a.label)]) {
      expect(words(s)).toBeLessThanOrEqual(15);
      expect(s).not.toContain("—");
    }
  });

  it("validates answers as closed sets", () => {
    expect(isGoal("pace")).toBe(true);
    expect(isGoal("swagger")).toBe(false);
    expect(isAgeBand("u18")).toBe(true);
    expect(isAgeBand(17)).toBe(false);
  });

  it("reads an empty profile where there is no storage", () => {
    expect(readProfile()).toEqual({ goal: null, ageBand: null, synced: false });
  });
});

describe("the plan", () => {
  it("is three lines, each inside the budget, with no em dash", () => {
    for (const goal of [null, ...GOALS.map((g) => g.id)] as const) {
      const lines = planFor(goal);
      expect(lines).toHaveLength(3);
      for (const l of lines) {
        expect(words(l)).toBeLessThanOrEqual(15);
        expect(l).not.toContain("—");
      }
    }
  });

  it("names the road's own gate for a later unit", () => {
    const pace = UNITS.find((u) => u.id === "pace")!;
    expect(planFor("pace")[2]).toBe(
      `Then Pace Control, the unit for rushing. Opens at ${pace.unlocksAt} stars.`
    );
    expect(planFor("fire")[2]).toContain("Thinking Under Fire");
  });

  it("does not send the first unit's goal to a gate it is already past", () => {
    expect(planFor("fillers")[2]).toBe("Every lesson in it targets what you noticed.");
  });

  it("still has a plan when the questions were skipped", () => {
    expect(planFor(null)[2]).toBe("Then the road, one unit at a time.");
  });

  it("repeats the answer back on day one, in their words", () => {
    expect(dayOneNote("pace")).toBe(
      "You said: rushing. The baseline sets the number to beat."
    );
    expect(dayOneNote(null)).toBeUndefined();
  });
});

describe("the one thing age changes", () => {
  it("drops the job prompts under 18 and nothing else", () => {
    const kept = topicsFor("u18", TOPICS).map((t) => t.id);
    // The worst job, explain your work, pitch yourself for a job.
    for (const id of ["t10", "t11", "t18"]) expect(kept).not.toContain(id);
    // "Your workplace or school" stays: half of it is answerable.
    expect(kept).toContain("t19");
    expect(kept.length).toBe(TOPICS.length - 3);
  });

  it("changes nothing for everyone else", () => {
    expect(topicsFor("25_34", TOPICS)).toBe(TOPICS);
    expect(topicsFor(null, TOPICS)).toBe(TOPICS);
  });
});
