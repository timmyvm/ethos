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
  stepFromStore,
  WALK_LAYOUT,
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

  it("keeps the accounts it settled with when an answer changes, and reads only user ids (#499)", () => {
    writeOnboarding({ answers: { ...EMPTY_STATE.answers, level: "never" }, done: true, synced: true, syncedTo: ["acct-a", "acct-b"] });
    writeOnboarding({ answers: { ...EMPTY_STATE.answers, level: "some" } });
    expect(readOnboarding()).toMatchObject({ synced: false, syncedTo: ["acct-a", "acct-b"] });
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: {}, step: 9, done: true, synced: true, syncedTo: "acct-a" }));
    expect(readOnboarding().syncedTo).toEqual([]);
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: {}, step: 9, done: true, syncedTo: ["acct-a", 4, null, "acct-a", "acct-b"] }));
    expect(readOnboarding().syncedTo).toEqual(["acct-a", "acct-b"]);
  });

  it("survives a corrupt value", () => {
    localStorage.setItem("ethos.onboarding", "{not json");
    expect(readOnboarding()).toEqual(EMPTY_STATE);
    localStorage.setItem("ethos.onboarding", JSON.stringify({ step: -4, answers: { pains: "fillers" } }));
    expect(readOnboarding().step).toBe(0);
    expect(readOnboarding().answers.pains).toEqual([]);
  });
});

/*
 * The room (#475) took the place of the three pitch screens, so a step
 * stored by the old walk counts two ahead of today's. Someone who left
 * part way through comes back to the screen they left.
 */
describe("a walk stored before the room", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  /* The old walk: pitch 0 to 2, the six questions 3 to 8, the beat 9,
     the hour 10, the plan 11, the account ask 12. The room's walk
     (layout 2): the room 0, the questions 1 to 6, the beat 7, the hour 8,
     the plan 9, the ask 10. Today's (#501): the room 0, the name 1, the
     age 2, what you notice 3, how much 4, the hour 5, the plan 6, the
     ask 7. */
  it("lands on the question it was on, or the one in its place", () => {
    expect(stepFromStore(3, undefined)).toBe(1); // the name
    expect(stepFromStore(5, undefined)).toBe(3); // the goal, gone: what you notice
    expect(stepFromStore(9, undefined)).toBe(5); // the beat, gone: the hour
    expect(stepFromStore(11, undefined)).toBe(6); // the plan
    expect(stepFromStore(12, undefined)).toBe(7); // the account ask
  });

  it("moves the room's walk (layout 2) to today's", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => stepFromStore(n, 2))).toEqual([0, 1, 2, 3, 3, 4, 5, 5, 5, 6, 7]);
    /* Past the end stays past the end: never the account ask, which a
       walk resumes on only when a Google attempt left it there. */
    expect(stepFromStore(14, 2)).toBe(11);
    expect(stepFromStore(99, undefined)).toBeGreaterThan(7);
  });

  it("puts the pitch's three screens on the room", () => {
    expect([0, 1, 2].map((n) => stepFromStore(n, undefined))).toEqual([0, 0, 0]);
  });

  it("reads an old store in today's steps, and moves it only once", () => {
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", pains: [] }, step: 5, done: false, synced: false }));
    expect(readOnboarding().step).toBe(3);
    /* A write that is not about the step (the sync) keeps it where it is. */
    writeOnboarding({ synced: true });
    expect(readOnboarding().step).toBe(3);
    expect(JSON.parse(localStorage.getItem("ethos.onboarding")!).walk).toBe(WALK_LAYOUT);
  });

  it("never moves a step today's walk wrote", () => {
    writeOnboarding({ step: 5 });
    expect(readOnboarding().step).toBe(5);
    expect(stepFromStore(5, WALK_LAYOUT)).toBe(5);
  });
});
