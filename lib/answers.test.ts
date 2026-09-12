import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanAnswers,
  EMPTY_STATE,
  isAgeBand,
  isGoal,
  isPain,
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
      ageBand: "u18",
      goal: null,
      pains: ["fillers", "rushing", "flat"],
      level: "often",
      context: null,
    });
    expect(a.pains.length).toBe(MAX_PAINS);
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
