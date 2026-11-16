import { beforeEach, describe, expect, it } from "vitest";
import {
  COINS_KEY,
  FREEZES_KEY,
  PROFILE_KEY,
  forget,
  forgetBalance,
  forgetProfile,
  forgetRecordings,
  held,
  heldFor,
  heldMark,
  hold,
  resetHeld,
} from "./held";
import { REVALIDATE_GAP_MS, revalidateDue } from "./use-revalidate";

/*
 * What the visit holds (#433). The store is how a tab opens on its
 * numbers; these are the three ways it must never lie: another
 * account's rows, numbers from before a write, and a read that landed
 * after either.
 */
describe("what this visit last read", () => {
  beforeEach(() => resetHeld());

  it("hands back what a read left, and nothing before one", () => {
    expect(held("reps:90")).toBeUndefined();
    const rows = [{ id: "a" }];
    expect(hold("reps:90", rows, heldMark())).toBe(rows);
    expect(held("reps:90")).toBe(rows);
  });

  it("keeps an empty answer apart from no answer", () => {
    hold("lexicon:100", [], heldMark());
    hold(PROFILE_KEY, null, heldMark());
    expect(held("lexicon:100")).toEqual([]);
    expect(held(PROFILE_KEY)).toBeNull();
    expect(held("spine")).toBeUndefined();
  });

  it("is dropped whole when the account changes", () => {
    heldFor("user-a");
    hold("reps:90", [1], heldMark());
    hold(PROFILE_KEY, { premium: true }, heldMark());
    heldFor("user-a"); // a token refresh: the same account
    expect(held("reps:90")).toEqual([1]);
    heldFor("user-b");
    expect(held("reps:90")).toBeUndefined();
    expect(held(PROFILE_KEY)).toBeUndefined();
  });

  it("is dropped on a sign-out, and a guest's rows never reach the account they become", () => {
    heldFor("guest-1");
    hold("spine", [1, 2], heldMark());
    heldFor(null);
    expect(held("spine")).toBeUndefined();
    heldFor(null);
    hold("spine", [], heldMark());
    heldFor("user-a");
    expect(held("spine")).toBeUndefined();
  });

  it("never keeps a read that was out while the store was dropped", () => {
    heldFor("user-a");
    const mark = heldMark();
    heldFor("user-b"); // the account changed while the read was in flight
    hold("reps:90", ["a's rows"], mark);
    expect(held("reps:90")).toBeUndefined();
  });

  it("a stored recording drops everything counted from recordings, and keeps the profile", () => {
    for (const key of ["reps:90", "reps:200", "spine", "rounds", "xp", "lexicon:100", COINS_KEY, FREEZES_KEY, "guest"]) {
      hold(key, 1, heldMark());
    }
    hold(PROFILE_KEY, { premium: false }, heldMark());
    const mark = heldMark();
    forgetRecordings();
    for (const key of ["reps:90", "reps:200", "spine", "rounds", "xp", "lexicon:100", COINS_KEY, FREEZES_KEY]) {
      expect(held(key), key).toBeUndefined();
    }
    expect(held(PROFILE_KEY)).toEqual({ premium: false });
    // A read begun before the recording landed is the old answer.
    hold("reps:90", ["before"], mark);
    expect(held("reps:90")).toBeUndefined();
  });

  it("a changed name, pose or plan drops the profile alone", () => {
    hold(PROFILE_KEY, { premium: false }, heldMark());
    hold("spine", [1], heldMark());
    forgetProfile();
    expect(held(PROFILE_KEY)).toBeUndefined();
    expect(held("spine")).toEqual([1]);
  });

  it("coins spent drop the balance and the freezes it may have bought", () => {
    hold(COINS_KEY, { balance: 9 }, heldMark());
    hold(FREEZES_KEY, { equipped: 1 }, heldMark());
    hold("spine", [1], heldMark());
    forgetBalance();
    expect(held(COINS_KEY)).toBeUndefined();
    expect(held(FREEZES_KEY)).toBeUndefined();
    expect(held("spine")).toEqual([1]);
  });

  it("forget with no test empties it", () => {
    hold("a", 1, heldMark());
    forget();
    expect(held("a")).toBeUndefined();
  });
});

describe("when a screen left open reads again", () => {
  const base = { visible: true, online: false, lastAt: 0, now: 0 };

  it("never while the page is hidden", () => {
    expect(revalidateDue({ ...base, visible: false, now: 10 * REVALIDATE_GAP_MS })).toBe(false);
    expect(revalidateDue({ ...base, visible: false, online: true })).toBe(false);
  });

  it("not inside the gap: the lock screen and back is one visit", () => {
    expect(revalidateDue({ ...base, now: REVALIDATE_GAP_MS - 1 })).toBe(false);
  });

  it("once the gap has passed", () => {
    expect(revalidateDue({ ...base, now: REVALIDATE_GAP_MS })).toBe(true);
  });

  it("at once when the network comes back", () => {
    expect(revalidateDue({ ...base, online: true, now: 1 })).toBe(true);
  });
});
