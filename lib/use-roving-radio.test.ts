import { describe, expect, it } from "vitest";
import { nextIndex } from "./use-roving-radio";

/**
 * The radio keys (PRINCIPLES 10): one tab stop per group, arrows move
 * the choice and wrap, disabled options are stepped over, Home and End
 * jump to the ends. Everything else is left to the browser.
 */
describe("nextIndex", () => {
  it("moves forward on Right and Down, back on Left and Up", () => {
    expect(nextIndex(3, 0, "ArrowRight")).toBe(1);
    expect(nextIndex(3, 0, "ArrowDown")).toBe(1);
    expect(nextIndex(3, 2, "ArrowLeft")).toBe(1);
    expect(nextIndex(3, 2, "ArrowUp")).toBe(1);
  });

  it("wraps at both ends", () => {
    expect(nextIndex(3, 2, "ArrowRight")).toBe(0);
    expect(nextIndex(3, 0, "ArrowLeft")).toBe(2);
  });

  it("goes to the first and last on Home and End", () => {
    expect(nextIndex(4, 2, "Home")).toBe(0);
    expect(nextIndex(4, 1, "End")).toBe(3);
  });

  it("skips disabled options, wrapping past them", () => {
    const off = (i: number) => i === 1;
    expect(nextIndex(3, 0, "ArrowRight", off)).toBe(2);
    expect(nextIndex(3, 2, "ArrowLeft", off)).toBe(0);
    const lastOff = (i: number) => i === 2;
    expect(nextIndex(3, 1, "ArrowRight", lastOff)).toBe(0);
  });

  it("lands Home and End on the nearest enabled option", () => {
    const ends = (i: number) => i === 0 || i === 3;
    expect(nextIndex(4, 2, "Home", ends)).toBe(1);
    expect(nextIndex(4, 1, "End", ends)).toBe(2);
  });

  it("stays put when nothing else is enabled", () => {
    const allButOne = (i: number) => i !== 1;
    expect(nextIndex(3, 1, "ArrowRight", allButOne)).toBe(1);
    expect(nextIndex(3, 1, "End", allButOne)).toBe(1);
  });

  it("ignores keys that are not radio keys", () => {
    for (const key of ["Tab", " ", "Enter", "a", "Escape"]) {
      expect(nextIndex(3, 1, key)).toBeNull();
    }
  });

  it("does nothing for an empty group", () => {
    expect(nextIndex(0, 0, "ArrowRight")).toBeNull();
  });
});
