import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanAnswers,
  cleanName,
  EMPTY_STATE,
  isAgeBand,
  isGoal,
  isPain,
  MAX_NAME,
  MAX_PAINS,
  readOnboarding,
  writeOnboarding,
} from "./answers";

/** A localStorage for node: the walk's persistence is what's under test. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

describe("answers", () => {
  it("validates against the closed sets", () => {
    expect(isAgeBand("u18")).toBe(true);
    expect(isAgeBand(17)).toBe(false);
    expect(isGoal("feet")).toBe(true);
    expect(isGoal("swagger")).toBe(false);
    expect(isPain("rambling")).toBe(true);
  });

  it("cleans unknown values to null and caps the pains", () => {
    const a = cleanAnswers({
      ageBand: "u18",
      goal: "nope" as never,
      pains: ["fillers", "fillers", "rushing", "flat", "rambling"] as never,
      level: "often",
    });
    expect(a).toEqual({
      name: null,
      ageBand: "u18",
      goal: null,
      pains: ["fillers", "rushing", "flat"],
      level: "often",
      context: null,
      time: null,
    });
    expect(a.pains.length).toBe(MAX_PAINS);
  });

  /*
   * The name is the one free-text answer in the walk (#249), so it is
   * the one that can arrive as anything at all.
   */
  it("trims, caps and blanks the name", () => {
    expect(cleanName("  Tim  ")).toBe("Tim");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("")).toBeNull();
    expect(cleanName(42 as never)).toBeNull();
    expect(cleanName(null)).toBeNull();
    // Capped, then trimmed again, so a cut mid-space leaves no tail.
    const long = "a".repeat(MAX_NAME + 10);
    expect(cleanName(long)).toHaveLength(MAX_NAME);
    expect(cleanName("Tim".padEnd(MAX_NAME + 4, " ") + "X")).toBe("Tim");
    expect(cleanAnswers({ name: "  Tim  " } as never).name).toBe("Tim");
  });

  it("reads an empty state where there is no storage", () => {
    expect(readOnboarding()).toEqual(EMPTY_STATE);
  });
});

describe("persistence", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("keeps the step and the answers across a refresh", () => {
    writeOnboarding({ answers: { ...EMPTY_STATE.answers, goal: "present" } });
    writeOnboarding({ step: 5 });
    const s = readOnboarding();
    expect(s.answers.goal).toBe("present");
    expect(s.step).toBe(5);
    expect(s.done).toBe(false);
  });

  it("marks a changed answer unsynced, and only a sync marks it synced", () => {
    writeOnboarding({ answers: { ...EMPTY_STATE.answers, level: "never" }, done: true });
    expect(readOnboarding().synced).toBe(false);
    writeOnboarding({ synced: true });
    expect(readOnboarding().synced).toBe(true);
    writeOnboarding({ answers: { ...EMPTY_STATE.answers, level: "some" } });
    expect(readOnboarding().synced).toBe(false);
    writeOnboarding({ step: 2 });
    expect(readOnboarding().synced).toBe(false);
  });

  it("survives a corrupt value", () => {
    localStorage.setItem("ethos.onboarding", "{not json");
    expect(readOnboarding()).toEqual(EMPTY_STATE);
    localStorage.setItem("ethos.onboarding", JSON.stringify({ step: -4, answers: { pains: "fillers" } }));
    expect(readOnboarding().step).toBe(0);
    expect(readOnboarding().answers.pains).toEqual([]);
  });
});
