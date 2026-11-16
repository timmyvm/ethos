import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  accountBehind,
  CUE_KEY,
  forgetCarriedCue,
  localCue,
  missingCueColumn,
  ownCopy,
  skipWarmup,
  WARMUP_SKIPPED_KEY,
  warmupSkipped,
} from "./cue-store";
import { PAUSE_MARK, type CueState } from "./carried-cue";

/* The carried cue's store (#477): the account's copy, this phone's, and the column before 0033. */
const STATE: CueState = {
  v: 1,
  cue: { kind: "filler", word: "um", from: 5, last: 5, givenOn: "2026-11-15", answeredOn: null, tries: 0, line: { text: `So ${PAUSE_MARK} they compound.`, at: 2 } },
  aside: [],
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
    expect(() => forgetCarriedCue()).not.toThrow();
  });
  it("is forgotten on sign-out, the skip with it, and nothing else (the #477 review)", () => {
    g.localStorage!.setItem(CUE_KEY, JSON.stringify({ uid: "u1", state: STATE }));
    skipWarmup("2026-11-16");
    g.localStorage!.setItem("ethos.theme", "dark");
    forgetCarriedCue();
    expect(g.localStorage!.getItem(CUE_KEY)).toBeNull();
    expect(g.localStorage!.getItem(WARMUP_SKIPPED_KEY)).toBeNull();
    expect(g.localStorage!.getItem("ethos.theme")).toBe("dark");
  });
});

describe("another account's copy (the #477 review)", () => {
  it("is drawn only for the account that wrote it; anyone else's is unknown, never none", () => {
    const local = { uid: "u1", state: STATE };
    expect(ownCopy(local, "u1")).toEqual(STATE);
    expect(ownCopy(local, "u2")).toBeUndefined();
    expect(ownCopy(local, null)).toBeUndefined();
    expect(ownCopy({ uid: null, state: STATE }, null)).toEqual(STATE);
    expect(ownCopy({ uid: "u1", state: null }, "u1")).toBeNull();
    expect(ownCopy(null, "u1")).toBeUndefined();
  });
});

describe("a phone copy newer than the account's", () => {
  const at = (iso: string): CueState => ({ ...STATE, at: iso });
  it("goes up to the account; an equal or older one does not", () => {
    expect(accountBehind(at("2026-11-16T09:00:00.000Z"), at("2026-11-15T09:00:00.000Z"))).toBe(true);
    expect(accountBehind(at("2026-11-16T09:00:00.000Z"), null)).toBe(true);
    /* The usual read after a save that landed: the same state on both. */
    expect(accountBehind(STATE, { ...STATE })).toBe(false);
    expect(accountBehind(at("2026-11-14T09:00:00.000Z"), STATE)).toBe(false);
    expect(accountBehind(null, STATE)).toBe(false);
  });
});
