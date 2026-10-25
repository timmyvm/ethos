import { afterEach, describe, expect, it, vi } from "vitest";
import type { BillingRow, ProfileRow } from "./client-data";
import { ReadTimeout } from "./load";
import { planView } from "./plan-view";
import { planFailed, planProfile, readBilling } from "./use-plan";

/**
 * The plan as a page holds it: when it has failed, and which profile it
 * reads. The hook is a thin shell over these.
 */
const TODAY = new Date(2026, 9, 25, 9, 30);
const PROFILE: ProfileRow = { display_name: "Timothy", premium: true, premium_until: null, equipped_pose: null };
const LIVE: BillingRow = {
  status: "active",
  ladder_month: 3,
  price_cents: 1099,
  next_price_cents: 999,
  current_period_end: new Date(2026, 10, 24, 14).toISOString(),
  cancel_at_period_end: false,
};
const CANCELED: BillingRow = { ...LIVE, status: "canceled", next_price_cents: null };

describe("planFailed", () => {
  it("never hides a live plan behind a profile that failed: the row decides alone", () => {
    const view = planView(undefined, LIVE, TODAY);
    expect(view.kind).toBe("active");
    expect(planFailed(view, false, LIVE, "failed")).toBe(false);
  });

  it("fails while the plan cannot be decided", () => {
    // The billing read failed.
    expect(planFailed(planView(PROFILE, undefined, TODAY), true, undefined, PROFILE)).toBe(true);
    // No row, and the profile that would say code or free failed.
    expect(planFailed(planView(undefined, null, TODAY), false, null, "failed")).toBe(true);
    // An ended row needs the profile too.
    expect(planFailed(planView(undefined, CANCELED, TODAY), false, CANCELED, "failed")).toBe(true);
    // The profile failed while billing is still out: the error line, until a live row lands.
    expect(planFailed(planView(undefined, undefined, TODAY), false, undefined, "failed")).toBe(true);
  });

  it("is not failed while the reads are only loading, or over a row already on screen", () => {
    expect(planFailed(planView(undefined, undefined, TODAY), false, undefined, "loading")).toBe(false);
    // A quiet re-read that failed leaves the row it had.
    expect(planFailed(planView(PROFILE, LIVE, TODAY), true, LIVE, PROFILE)).toBe(false);
  });
});

describe("planProfile", () => {
  it("is unknown while the page's profile read is out or failed", () => {
    expect(planProfile("loading", undefined)).toBeUndefined();
    expect(planProfile("failed", true)).toBeUndefined();
  });

  it("takes the billing routes' word on Premium over an older profile read", () => {
    // Mount read a Stripe-sourced premium:true; resume then answered 409
    // with the plan ended and premium false. The slot is the free door,
    // never "Premium is on this account."
    const p = planProfile(PROFILE, false);
    expect(p).toMatchObject({ premium: false, display_name: "Timothy" });
    expect(planView(p, CANCELED, TODAY).kind).toBe("ended");
    expect(planView(planProfile(PROFILE, undefined), CANCELED, TODAY).kind).toBe("code");
    // No word from a route: the read as it was.
    expect(planProfile(PROFILE, undefined)).toBe(PROFILE);
    expect(planProfile(null, false)).toBeNull();
  });
});

describe("readBilling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts the page-level ceiling on a billing read that never answers", async () => {
    vi.useFakeTimers();
    const hung = readBilling(() => new Promise<BillingRow | null>(() => {}), 8000);
    const caught = hung.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await caught).toBeInstanceOf(ReadTimeout);
  });

  it("hands back a read that answers", async () => {
    await expect(readBilling(async () => LIVE)).resolves.toBe(LIVE);
    await expect(readBilling(async () => null)).resolves.toBeNull();
  });
});
