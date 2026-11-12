import { beforeEach, describe, expect, it } from "vitest";
import { countedBefore, rememberCounted, resetCounted } from "./counted";

describe("a number counts once per visit on a tab (#467)", () => {
  beforeEach(resetCounted);

  it("counts the first time and not on the way back", () => {
    expect(countedBefore("/history#640", 640)).toBe(false);
    rememberCounted("/history#640", 640);
    expect(countedBefore("/history#640", 640)).toBe(true);
  });

  it("counts again when the number changed", () => {
    rememberCounted("/#5", 5);
    expect(countedBefore("/#6", 6)).toBe(false);
  });

  it("keeps each tab apart", () => {
    rememberCounted("/#5", 5);
    expect(countedBefore("/you#5", 5)).toBe(false);
  });

  it("never holds back a number off the tab bar", () => {
    rememberCounted("/rep#700", 700);
    expect(countedBefore("/rep#700", 700)).toBe(false);
  });
});
