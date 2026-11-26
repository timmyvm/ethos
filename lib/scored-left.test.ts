import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  forgetScoredLeft,
  keepScoredLeft,
  leftFromReply,
  localDayKey,
  readScoredLeft,
  SCORED_LEFT_KEY,
  scoredUsed,
  type JudgedReply,
} from "./scored-left";

/*
 * The reel's honest wins, build 5: the line under Record says today's
 * scored recordings are used only when this phone is sure, for this
 * account and this day, and never for Premium.
 */
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

const g = globalThis as { localStorage?: unknown };
let store: Memory;
beforeEach(() => {
  store = new Memory();
  g.localStorage = store;
});
afterEach(() => {
  delete g.localStorage;
});

const AT = new Date(2026, 10, 26, 18, 40);
const judged = (over: Partial<JudgedReply> = {}): JudgedReply => ({ ran: true, unlimited: false, remaining: 0, capped: false, counted: true, ...over });

describe("what a reply says is left", () => {
  it("keeps the third scored take's 0, and a capped take's 0", () => {
    expect(keepScoredLeft({ uid: "u1", at: AT, judged: judged() })).toEqual({ uid: "u1", day: "2026-11-26", left: 0 });
    expect(JSON.parse(store.getItem(SCORED_LEFT_KEY) ?? "null")).toEqual({ uid: "u1", day: "2026-11-26", left: 0 });
    store.removeItem(SCORED_LEFT_KEY);
    expect(keepScoredLeft({ uid: "u1", at: AT, judged: judged({ ran: false, capped: true, counted: false }) })?.left).toBe(0);
    expect(readScoredLeft()).toEqual({ uid: "u1", day: "2026-11-26", left: 0 });
  });

  it("keeps a count still left, so a new day's first take overwrites yesterday's 0", () => {
    keepScoredLeft({ uid: "u1", at: AT, judged: judged() });
    keepScoredLeft({ uid: "u1", at: new Date(2026, 10, 27, 8), judged: judged({ remaining: 2 }) });
    expect(readScoredLeft()).toEqual({ uid: "u1", day: "2026-11-27", left: 2 });
  });

  it("keeps nothing from a take too short to score, a coach that failed, or Premium", () => {
    // Too short: no read was asked for, and the 0 counts nothing.
    expect(keepScoredLeft({ uid: "u1", at: AT, judged: judged({ ran: false, capped: false, counted: false }) })).toBeNull();
    // The third take's coach failed: its read went back, one is still left.
    expect(keepScoredLeft({ uid: "u1", at: AT, judged: judged({ ran: false, remaining: 0, counted: false }) })).toBeNull();
    // Premium is never metered.
    expect(keepScoredLeft({ uid: "u1", at: AT, judged: judged({ unlimited: true, remaining: 0 }) })).toBeNull();
    expect(store.getItem(SCORED_LEFT_KEY)).toBeNull();
  });

  it("keeps nothing from a read the meter did not count: no session, a meter that could not be read, a reply from before", () => {
    expect(leftFromReply(judged({ counted: false }))).toBeNull();
    expect(leftFromReply(judged({ counted: undefined }))).toBeNull();
    expect(leftFromReply(null)).toBeNull();
    expect(leftFromReply(judged({ remaining: -1 }))).toBeNull();
    expect(keepScoredLeft({ uid: null, at: AT, judged: judged() })).toBeNull();
    expect(store.getItem(SCORED_LEFT_KEY)).toBeNull();
  });
});

describe("whether the line shows", () => {
  const entry = { uid: "u1", day: localDayKey(AT), left: 0 };

  it("shows for this account, this local day, none left, a free plan", () => {
    expect(scoredUsed(entry, { uid: "u1", now: new Date(2026, 10, 26, 23, 59), free: true })).toBe(true);
  });

  it("says nothing on another day, for another account, with one left, for Premium, or unread", () => {
    expect(scoredUsed(entry, { uid: "u1", now: new Date(2026, 10, 27, 0, 1), free: true })).toBe(false);
    expect(scoredUsed(entry, { uid: "u2", now: AT, free: true })).toBe(false);
    expect(scoredUsed({ ...entry, left: 1 }, { uid: "u1", now: AT, free: true })).toBe(false);
    expect(scoredUsed(entry, { uid: "u1", now: AT, free: false })).toBe(false);
    expect(scoredUsed(entry, { uid: null, now: AT, free: true })).toBe(false);
    expect(scoredUsed(null, { uid: "u1", now: AT, free: true })).toBe(false);
  });

  it("reads nothing from a phone that throws, or a copy it cannot trust", () => {
    g.localStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    expect(readScoredLeft()).toBeNull();
    expect(() => forgetScoredLeft()).not.toThrow();
    // A write that throws still hands the screen what the reply said.
    expect(keepScoredLeft({ uid: "u1", at: AT, judged: judged() })).toEqual(entry);
    g.localStorage = store;
    store.setItem(SCORED_LEFT_KEY, "{not json");
    expect(readScoredLeft()).toBeNull();
    store.setItem(SCORED_LEFT_KEY, JSON.stringify({ uid: "u1", day: "26 Nov", left: 0 }));
    expect(readScoredLeft()).toBeNull();
    store.setItem(SCORED_LEFT_KEY, JSON.stringify({ uid: "u1", day: "2026-11-26", left: "0" }));
    expect(readScoredLeft()).toBeNull();
    delete g.localStorage;
    expect(readScoredLeft()).toBeNull();
  });

  it("forgets on sign-out", () => {
    keepScoredLeft({ uid: "u1", at: AT, judged: judged() });
    forgetScoredLeft();
    expect(readScoredLeft()).toBeNull();
  });
});
