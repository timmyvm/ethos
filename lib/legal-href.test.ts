import { describe, expect, it } from "vitest";
import { legalHref } from "./legal-href";

describe("legalHref (#446)", () => {
  it("names the ask it came from", () => {
    expect(legalHref("/privacy", "welcome")).toBe("/privacy?from=welcome");
    expect(legalHref("/terms", "signup")).toBe("/terms?from=signup");
  });

  it("carries the form's way back, so a paywall's return survives the detour", () => {
    expect(legalHref("/privacy", "signup", "/games?paywall=1")).toBe(
      "/privacy?from=signup&next=%2Fgames%3Fpaywall%3D1"
    );
  });

  it("drops a next that is not a path of ours", () => {
    expect(legalHref("/terms", "signup", "https://evil.example/")).toBe("/terms?from=signup");
    expect(legalHref("/terms", "signup", "//evil.example/")).toBe("/terms?from=signup");
  });

  it("the walk's ask carries no next: the walk keeps its own place", () => {
    expect(legalHref("/privacy", "welcome", "/shop")).toBe("/privacy?from=welcome");
  });
});
