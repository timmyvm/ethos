import { describe, expect, it } from "vitest";
import { asksForPaywall, authHref, safeNextPath, withPaywall, withoutPaywall } from "./use-paywall-return";

/**
 * The paywall's way back through sign-up: only a same-origin path is
 * ever followed, and the flag comes and goes without touching the rest
 * of the address.
 */
describe("safeNextPath", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(safeNextPath("/games?paywall=1")).toBe("/games?paywall=1");
    expect(safeNextPath("/rep/rep-22?paywall=1#top")).toBe("/rep/rep-22?paywall=1#top");
    expect(safeNextPath("/")).toBe("/");
  });

  it("refuses another host, a scheme, a backslash or a control character", () => {
    for (const bad of [
      "https://evil.example/you",
      "//evil.example/you",
      "/\\evil.example",
      "javascript:alert(1)",
      "you",
      "/you\n",
      "/you\u0000",
      "",
      null,
      42,
      `/${"a".repeat(600)}`,
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("never sends anyone back to an auth screen", () => {
    expect(safeNextPath("/signin?next=/you")).toBeNull();
    expect(safeNextPath("/signup")).toBeNull();
    expect(safeNextPath("/auth/callback")).toBeNull();
    expect(safeNextPath("/signupsheet")).toBe("/signupsheet");
  });
});

describe("the flag", () => {
  it("is added and taken out without touching the rest", () => {
    expect(withPaywall("/games")).toBe("/games?paywall=1");
    expect(withPaywall("/rep?lesson=h4#x")).toBe("/rep?lesson=h4&paywall=1#x");
    expect(withPaywall("/games?paywall=1")).toBe("/games?paywall=1");
    expect(withoutPaywall("/rep?lesson=h4&paywall=1#x")).toBe("/rep?lesson=h4#x");
    expect(withoutPaywall("/games?paywall=1")).toBe("/games");
    expect(asksForPaywall("/games?paywall=1")).toBe(true);
    expect(asksForPaywall("/games?paywall=0")).toBe(false);
    expect(asksForPaywall("/games")).toBe(false);
  });

  it("builds the auth doors with next encoded, or bare when next is unsafe", () => {
    expect(authHref("signup", "/games?paywall=1")).toBe("/signup?next=%2Fgames%3Fpaywall%3D1");
    expect(authHref("signin", "/you?paywall=1")).toBe("/signin?next=%2Fyou%3Fpaywall%3D1");
    expect(authHref("signup", "https://evil.example")).toBe("/signup");
    expect(authHref("signin", null)).toBe("/signin");
  });
});
