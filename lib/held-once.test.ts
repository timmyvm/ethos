import { beforeEach, describe, expect, it, vi } from "vitest";
import { BILLING_KEY, REUSE_MS, forget, forgetProfile, forgetRecordings, held, hold, once, resetHeld, reuseHeld } from "./held";

vi.mock("./supabase-browser", () => ({ supabaseBrowser: () => null }));

describe("tab to tab reads once (#467)", () => {
  beforeEach(resetHeld);

  it("hands back a fresh held answer, tab to tab, without asking", async () => {
    hold("spine", [1, 2]);
    reuseHeld(true);
    const run = vi.fn(async () => [9]);
    expect(await once("spine", run)).toEqual([1, 2]);
    expect(run).not.toHaveBeenCalled();
  });

  it("asks again off the bar, past the minute, or after a write dropped it", async () => {
    hold("spine", [1]);
    const run = vi.fn(async () => [2]);
    reuseHeld(false);
    await once("spine", run);
    reuseHeld(true);
    await once("spine", run, Date.now() + REUSE_MS + 1);
    forgetRecordings();
    await once("spine", run);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("shares a read already out", async () => {
    let done!: (v: number[]) => void;
    const run = vi.fn(() => new Promise<number[]>((r) => (done = r)));
    const a = once("xp", run);
    const b = once("xp", run);
    done([5]);
    expect(await a).toEqual([5]);
    expect(await b).toEqual([5]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not share a read begun before a drop", async () => {
    const run = vi.fn(() => new Promise<number[]>(() => {}));
    void once("xp", run);
    forget();
    void once("xp", run);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("the plan row is held for a first frame (#468)", () => {
  beforeEach(resetHeld);

  it("stays across a recording and goes with the profile", () => {
    hold(BILLING_KEY, { status: "active" });
    forgetRecordings();
    expect(held(BILLING_KEY)).toEqual({ status: "active" });
    forgetProfile();
    expect(held(BILLING_KEY)).toBeUndefined();
  });
});
