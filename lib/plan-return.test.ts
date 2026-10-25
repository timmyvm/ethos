import { describe, expect, it } from "vitest";
import { checkoutOutcome, readReturn, withPortalReturn, withoutReturn } from "./plan-return";

describe("readReturn", () => {
  it("reads Checkout's success page and the portal's back link", () => {
    expect(readReturn("/you?checkout=done")).toBe("checkout");
    expect(readReturn("/settings?portal=done")).toBe("portal");
    expect(readReturn("/you?tab=1&portal=done#plan")).toBe("portal");
  });

  it("reads nothing else as a return", () => {
    expect(readReturn("/you")).toBeNull();
    expect(readReturn("/you?checkout=cancel")).toBeNull();
    expect(readReturn("/you?portal=1")).toBeNull();
    expect(readReturn("/you?paywall=1")).toBeNull();
  });

  it("lets Checkout win if both are set", () => {
    expect(readReturn("/you?portal=done&checkout=done")).toBe("checkout");
  });
});

describe("withoutReturn", () => {
  it("takes both flags out and keeps the rest", () => {
    expect(withoutReturn("/you?checkout=done")).toBe("/you");
    expect(withoutReturn("/you?a=1&portal=done#plan")).toBe("/you?a=1#plan");
    expect(withoutReturn("/settings")).toBe("/settings");
  });
});

describe("withPortalReturn", () => {
  it("flags the page the sheet was opened on", () => {
    expect(withPortalReturn("/you")).toBe("/you?portal=done");
    expect(withPortalReturn("/settings?x=1")).toBe("/settings?x=1&portal=done");
  });

  it("never carries a checkout flag back, so a portal trip cannot celebrate", () => {
    expect(withPortalReturn("/you?checkout=done")).toBe("/you?portal=done");
  });

  it("is idempotent", () => {
    expect(withPortalReturn(withPortalReturn("/you"))).toBe("/you?portal=done");
  });

  it("never points off this site", () => {
    expect(withPortalReturn("//evil.example/x")).toBe("/you?portal=done");
    expect(withPortalReturn("https://evil.example/x")).toBe("/you?portal=done");
  });
});

describe("checkoutOutcome", () => {
  const plan = (kind: string, month: number, live = true) => ({ kind, month, live });

  it("celebrates a plan live in its first month", () => {
    expect(checkoutOutcome(plan("active", 1))).toEqual({ arrival: "on", reread: false });
  });

  it("draws the card for an old link to a later month", () => {
    expect(checkoutOutcome(plan("active", 4))).toEqual({ arrival: null, reread: false });
    expect(checkoutOutcome(plan("floor", 9))).toEqual({ arrival: null, reread: false });
  });

  it("re-reads once when sync failed or found nothing yet", () => {
    expect(checkoutOutcome(null)).toEqual({ arrival: "slow", reread: true });
    expect(checkoutOutcome(plan("free", 0, false))).toEqual({ arrival: "slow", reread: true });
    expect(checkoutOutcome(null, true)).toEqual({ arrival: "slow", reread: false });
  });

  it("lets a pending first payment speak for itself, and re-reads it once", () => {
    expect(checkoutOutcome(plan("incomplete", 0, false))).toEqual({ arrival: null, reread: true });
    expect(checkoutOutcome(plan("incomplete", 0, false), true)).toEqual({ arrival: null, reread: false });
  });

  it("celebrates when the one re-read finds the plan live", () => {
    expect(checkoutOutcome(plan("active", 1), true)).toEqual({ arrival: "on", reread: false });
  });
});
