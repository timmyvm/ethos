import { describe, expect, it } from "vitest";
import { inLanes } from "./lanes";

describe("inLanes", () => {
  it("does every item once, never more than the lanes at a time", async () => {
    let now = 0;
    let most = 0;
    const done: number[] = [];
    await inLanes(Array.from({ length: 50 }, (_, i) => i), 16, async (i) => {
      now++;
      most = Math.max(most, now);
      for (let k = 0; k < (i % 5) + 1; k++) await Promise.resolve();
      done.push(i);
      now--;
    });
    expect(done.sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(most).toBe(16);
  });

  it("takes items in order of start, and handles none and fewer than the lanes", async () => {
    const started: number[] = [];
    await inLanes([1, 2, 3], 16, async (i) => {
      started.push(i);
    });
    expect(started).toEqual([1, 2, 3]);
    await inLanes([], 16, async () => {
      throw new Error("never");
    });
  });
});
