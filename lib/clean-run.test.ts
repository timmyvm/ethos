import { describe, expect, it } from "vitest";
import { interval, longestCleanRun } from "./clean-run";

const at = (...ts: number[]) => ts.map((t) => ({ word: "um", t }));

describe("the clean run", () => {
  it("is the whole recording when nothing was said wrong", () => {
    const r = longestCleanRun([], 60);
    expect(r).toEqual({ seconds: 60, from: 0, to: 60, whole: true });
  });

  /* Both ends count: the clean run-up to somebody's first stumble is
     the same achievement as the same stretch in the middle. */
  it("counts the run-up to the first filler", () => {
    const r = longestCleanRun(at(38, 42, 47), 60);
    expect(r.seconds).toBe(38);
    expect(r.from).toBe(0);
  });

  it("counts the run-out after the last", () => {
    const r = longestCleanRun(at(2, 5, 9), 60);
    expect(r.seconds).toBe(51);
    expect(r.to).toBe(60);
  });

  it("finds the longest gap in the middle", () => {
    const r = longestCleanRun(at(3, 30, 33), 40);
    expect(r.seconds).toBe(27);
    expect(r.from).toBe(3);
    expect(r.to).toBe(30);
  });

  it("does not care what order the fillers arrive in", () => {
    expect(longestCleanRun(at(33, 3, 30), 40).seconds).toBe(27);
  });

  /* A transcript can time a word a hair past the last audio frame, and
     a negative clean run would be a very confusing personal best. */
  it("clamps a filler past the end rather than trusting it", () => {
    const r = longestCleanRun(at(61.4), 60);
    expect(r.seconds).toBe(60);
    expect(r.seconds).toBeGreaterThanOrEqual(0);
  });

  it("is zero for a recording with no length", () => {
    expect(longestCleanRun(at(1), 0).seconds).toBe(0);
    expect(longestCleanRun([], Number.NaN).seconds).toBe(0);
  });

  it("turns a rate into the gap a body feels", () => {
    expect(interval(4)).toBe(15);
    expect(interval(0)).toBeNull();
    expect(interval(-1)).toBeNull();
  });
});
