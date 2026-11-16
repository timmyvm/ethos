import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CUE_KEY, localCue, missingCueColumn, skipWarmup, warmupSkipped } from "./cue-store";
import { PAUSE_MARK, type CueState } from "./carried-cue";

/* The carried cue's store (#477): the account's copy, this phone's, and the column before 0033. */
const STATE: CueState = {
  v: 1,
  cue: { kind: "filler", word: "um", from: 5, last: 5, givenOn: "2026-11-15", answeredOn: null, tries: 0, line: { text: `So ${PAUSE_MARK} they compound.`, at: 2 } },
  aside: null,
  at: "2026-11-15T09:00:00.000Z",
};

class Memory {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe("the column before 0033", () => {
  it("reads Postgres's and PostgREST's answers for it as missing, and nothing else", () => {
    expect(missingCueColumn({ code: "42703", message: "column profiles.carried_cue does not exist" })).toBe(true);
    expect(missingCueColumn({ code: "PGRST204", message: "Could not find the 'carried_cue' column of 'profiles' in the schema cache" })).toBe(true);
    expect(missingCueColumn({ code: "42703", message: "column profiles.round does not exist" })).toBe(false);
    expect(missingCueColumn({ code: "42501", message: "permission denied for table profiles" })).toBe(false);
    expect(missingCueColumn(null)).toBe(false);
  });
});

describe("this phone's copy", () => {
  const g = globalThis as unknown as { localStorage?: Memory };
  beforeEach(() => {
    g.localStorage = new Memory();
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it("is read for its own account, or for whoever is signed in before the account is known", () => {
    g.localStorage!.setItem(CUE_KEY, JSON.stringify({ uid: "u1", state: STATE }));
    expect(localCue("u1")).toEqual(STATE);
    expect(localCue()).toEqual(STATE);
    expect(localCue("u2")).toBeNull();
  });
  it("reads a broken copy as none", () => {
    g.localStorage!.setItem(CUE_KEY, "{not json");
    expect(localCue()).toBeNull();
    g.localStorage!.setItem(CUE_KEY, JSON.stringify({ uid: "u1", state: { v: 9 } }));
    expect(localCue("u1")).toBeNull();
  });
  it("keeps a skipped warm-up away for the rest of the day only", () => {
    expect(warmupSkipped("2026-11-16")).toBe(false);
    skipWarmup("2026-11-16");
    expect(warmupSkipped("2026-11-16")).toBe(true);
    expect(warmupSkipped("2026-11-17")).toBe(false);
  });
  it("never throws where the phone keeps nothing", () => {
    delete g.localStorage;
    expect(localCue()).toBeNull();
    expect(warmupSkipped("2026-11-16")).toBe(false);
    expect(() => skipWarmup("2026-11-16")).not.toThrow();
  });
});
