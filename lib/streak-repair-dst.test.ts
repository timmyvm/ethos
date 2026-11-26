import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeStreak, keptDays, repairState, type RepairTake } from "./streak";

/*
 * The repair counts the phone's own days, exactly as computeStreak does
 * (lib/streak.ts dayKey and daysBetween): across midnight, and across a
 * clock change, when a day is 23 or 25 hours long. Node reads TZ as it
 * changes, so each block runs on a calendar with a change in it.
 */
const was = process.env.TZ;
const zone = (tz: string) => {
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
  });
};
const at = (y: number, m: number, d: number, h: number, min = 0): RepairTake => ({
  created_at: new Date(y, m - 1, d, h, min).toISOString(),
  scorable: true,
});

describe("on Melbourne's calendar, where summer time began on Sunday 4 October 2026", () => {
  zone("Australia/Melbourne");

  it("runs on Melbourne's clock: Sunday 4 October has 23 hours", () => {
    expect(new Date(2026, 9, 5).getTime() - new Date(2026, 9, 4).getTime()).toBe(23 * 3_600_000);
  });

  it("keeps the short Sunday for two takes on Monday, and the run reads 4", () => {
    const takes = [at(2026, 10, 1, 20), at(2026, 10, 2, 20), at(2026, 10, 3, 20), at(2026, 10, 5, 0, 30), at(2026, 10, 5, 23, 30)];
    const now = new Date(2026, 9, 5, 23, 45);
    const kept = keptDays(takes, [], now, "2026-10-01");
    expect(kept.map((d) => d.toDateString())).toEqual([new Date(2026, 9, 4).toDateString()]);
    expect(computeStreak(takes.map((t) => new Date(t.created_at)), now, kept).current).toBe(4);
    // Monday morning, before either take: the repair is open.
    expect(repairState(takes.slice(0, 3), [], new Date(2026, 9, 5, 0, 10), "2026-10-01")).toMatchObject({ run: 3, counted: 0 });
  });

  it("files a take at 23:59 and one at 00:01 on their own days", () => {
    // Spoke Thursday to Saturday, the last at 23:59; Sunday's first take at
    // 00:01 means Sunday was spoken, so nothing is missed.
    const late = [at(2026, 10, 1, 20), at(2026, 10, 2, 20), at(2026, 10, 3, 23, 59)];
    expect(repairState(late, [], new Date(2026, 9, 5, 9), "2026-10-01")).toMatchObject({ run: 3, counted: 0 });
    const early = [...late, at(2026, 10, 4, 0, 1)];
    expect(repairState(early, [], new Date(2026, 9, 5, 9), "2026-10-01")).toBeNull();
    // Two takes just after Monday's midnight count for Monday.
    const monday = [...late, at(2026, 10, 5, 0, 1), at(2026, 10, 5, 0, 2)];
    expect(keptDays(monday, [], new Date(2026, 9, 5, 0, 3), "2026-10-01")).toHaveLength(1);
  });
});

describe("on Los Angeles' calendar, where summer time ended on Sunday 1 November 2026", () => {
  zone("America/Los_Angeles");

  it("runs on Los Angeles' clock: Sunday 1 November has 25 hours", () => {
    expect(new Date(2026, 10, 2).getTime() - new Date(2026, 10, 1).getTime()).toBe(25 * 3_600_000);
  });

  it("keeps the long Sunday for two takes on Monday", () => {
    const takes = [at(2026, 10, 30, 19), at(2026, 10, 31, 19), at(2026, 11, 2, 7), at(2026, 11, 2, 22)];
    const now = new Date(2026, 10, 2, 23);
    const kept = keptDays(takes, [], now, "2026-10-01");
    expect(kept.map((d) => d.toDateString())).toEqual([new Date(2026, 10, 1).toDateString()]);
    expect(computeStreak(takes.map((t) => new Date(t.created_at)), now, kept).current).toBe(3);
  });
});
