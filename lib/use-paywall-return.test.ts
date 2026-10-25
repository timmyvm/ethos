import { describe, expect, it } from "vitest";
import { asksForPaywall, authHref, nextFrom, onwardLink, safeNextPath, withPaywall, withoutPaywall } from "./use-paywall-return";

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

/*
 * The page an inbox link or Google lands on (/auth/reset?first=1,
 * /auth/callback) reads `next` and offers the way on: back to the sheet
 * when it asked for it, the floor when nothing did.
 */
describe("the way on from an account page", () => {
  it("reads next from a query, or from the sign-up page an attempt began on", () => {
    expect(nextFrom("?first=1&next=%2Fyou%3Fpaywall%3D1")).toBe("/you?paywall=1");
    expect(nextFrom("/signup?next=%2Fgames%3Fpaywall%3D1")).toBe("/games?paywall=1");
    expect(nextFrom("?next=%2F%2Fevil.com")).toBeNull();
    expect(nextFrom("")).toBeNull();
    expect(nextFrom(null)).toBeNull();
  });

  it("names the sheet it reopens, and otherwise goes to the floor", () => {
    expect(onwardLink("/you?paywall=1")).toEqual({ href: "/you?paywall=1", label: "Back to Premium" });
    expect(onwardLink("/games")).toEqual({ href: "/games", label: "Carry on" });
    expect(onwardLink(null)).toEqual({ href: "/", label: "Back to the floor" });
    expect(onwardLink("//evil.com")).toEqual({ href: "/", label: "Back to the floor" });
  });
});
