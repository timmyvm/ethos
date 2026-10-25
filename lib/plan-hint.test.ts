import { describe, expect, it } from "vitest";
import type { BillingRow } from "./client-data";
import { planView } from "./plan-view";
import { PLAN_ROW_KEY, keepPlanHint, readPlanHint, settingsRowSlot, type HintStore } from "./plan-hint";

/**
 * Settings' "Manage plan" row lands after the billing read. This device
 * remembers whether it last saw a plan, so a subscriber's row holds its
 * place from the first frame and a free account never draws one.
 */
const TODAY = new Date(2026, 9, 25);
const LIVE: BillingRow = {
  status: "active",
  ladder_month: 3,
  price_cents: 1099,
  next_price_cents: 999,
  current_period_end: new Date(2026, 10, 24, 12).toISOString(),
  cancel_at_period_end: false,
};

function memory(initial: string | null = null): HintStore & { value: string | null } {
  const m = {
    value: initial,
    get: () => m.value,
    set: (v: string) => {
      m.value = v;
    },
    clear: () => {
      m.value = null;
    },
  };
  return m;
}

const broken: HintStore = {
  get: () => {
    throw new Error("blocked");
  },
  set: () => {
    throw new Error("blocked");
  },
  clear: () => {
    throw new Error("blocked");
  },
};

describe("the plan hint", () => {
  it("lives under an ethos key, so deleting the account clears it with the rest", () => {
    expect(PLAN_ROW_KEY.startsWith("ethos")).toBe(true);
  });

  it("remembers a plan once the plan is known, and forgets it once there is none", () => {
    const store = memory();
    keepPlanHint(planView(null, LIVE, TODAY), false, store);
    expect(readPlanHint(store)).toBe(true);
    keepPlanHint(planView(null, null, TODAY), false, store);
    expect(readPlanHint(store)).toBe(false);
    keepPlanHint(planView(null, { ...LIVE, status: "canceled" }, TODAY), false, store);
    expect(store.value).toBeNull();
  });

  it("touches nothing while the plan is unknown or its read failed", () => {
    const store = memory("1");
    keepPlanHint(planView(null, undefined, TODAY), false, store);
    keepPlanHint(planView(null, undefined, TODAY), true, store);
    expect(store.value).toBe("1");
  });

  it("reads a store that misbehaves as no hint, and never throws", () => {
    expect(readPlanHint(broken)).toBe(false);
    expect(() => keepPlanHint(planView(null, LIVE, TODAY), false, broken)).not.toThrow();
    expect(readPlanHint(memory("junk"))).toBe(false);
  });
});

describe("settingsRowSlot", () => {
  const unknown = planView(null, undefined, TODAY);
  const live = planView(null, LIVE, TODAY);
  const free = planView(null, null, TODAY);

  it("holds a subscriber's place while the plan is unknown, and draws nothing for anyone else", () => {
    expect(settingsRowSlot({ view: unknown, ready: true, failed: false, hint: true, signedIn: true })).toBe("skeleton");
    expect(settingsRowSlot({ view: unknown, ready: false, failed: false, hint: true, signedIn: true })).toBe("skeleton");
    expect(settingsRowSlot({ view: unknown, ready: true, failed: false, hint: false, signedIn: true })).toBe("none");
  });

  it("draws the row once a plan is known, and nothing for free", () => {
    expect(settingsRowSlot({ view: live, ready: true, failed: false, hint: false, signedIn: true })).toBe("row");
    expect(settingsRowSlot({ view: free, ready: true, failed: false, hint: true, signedIn: true })).toBe("none");
  });

  it("says a failed read with a retry for an account that can hold a plan, never nothing", () => {
    expect(settingsRowSlot({ view: unknown, ready: true, failed: true, hint: false, signedIn: true })).toBe("error");
    expect(settingsRowSlot({ view: unknown, ready: true, failed: true, hint: true, signedIn: false })).toBe("error");
    // An anonymous session cannot hold a plan (Checkout asks for an account first).
    expect(settingsRowSlot({ view: unknown, ready: true, failed: true, hint: false, signedIn: false })).toBe("none");
  });
});
