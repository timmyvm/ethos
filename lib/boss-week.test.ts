import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bossWeekField, bossWeeks, lastBossWeek, parseBossWeek } from "./boss";

/*
 * The boss's delta and the lobby's record name the same last week across
 * a clock change (games review, finding 4). Node reads TZ as it changes,
 * so this file runs on Los Angeles' calendar, where summer time ended on
 * Sunday 1 November 2026.
 */
const was = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  if (was === undefined) delete process.env.TZ;
  else process.env.TZ = was;
});

describe("last week across a clock change", () => {
  it("runs on Los Angeles' calendar", () => {
    expect(new Date(2026, 9, 26).toISOString()).toBe("2026-10-26T07:00:00.000Z");
  });

  it("sends the lobby's own Mondays, an hour apart from a week of 168 hours", () => {
    // Friday 6 Nov 2026, 10:00 PST.
    const at = new Date("2026-11-06T18:00:00Z");
    const field = bossWeekField(at);
    expect(field).toBe("2026-10-26T07:00:00.000Z/2026-11-02T08:00:00.000Z");
    // The offset alone puts last Monday at 01:00 PDT, an hour late.
    expect(lastBossWeek(at, at.getTimezoneOffset()).from.toISOString()).toBe("2026-10-26T08:00:00.000Z");
    const week = parseBossWeek(field, at)!;
    expect(week.from.toISOString()).toBe("2026-10-26T07:00:00.000Z");
    expect(week.to.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("names the take the lobby's last-week slot shows", () => {
    const at = new Date("2026-11-06T18:00:00Z");
    // Monday 26 Oct, 00:30 PDT: last week's first boss on the lobby.
    const early = "2026-10-26T07:30:00.000Z";
    const rows = [
      { created_at: early, lesson_id: "boss:t1", ethos_index: 612 },
      { created_at: "2026-10-28T19:00:00.000Z", lesson_id: "boss:t2", ethos_index: 640 },
    ];
    const lobby = bossWeeks(rows, at);
    expect(lobby[lobby.length - 2].index).toBe(612);
    const week = parseBossWeek(bossWeekField(at), at)!;
    const t = new Date(early).getTime();
    expect(t >= week.from.getTime() && t < week.to.getTime()).toBe(true);
  });
});

describe("the server's check of the phone's week", () => {
  const at = new Date("2026-11-06T18:00:00Z");

  it("refuses a week that is not one, or not the one before the take", () => {
    expect(parseBossWeek(undefined, at)).toBeNull();
    expect(parseBossWeek("nonsense", at)).toBeNull();
    expect(parseBossWeek("2026-10-26T07:00:00.000Z/2026-11-02T08:00:00.000Z/x", at)).toBeNull();
    // Eight days long.
    expect(parseBossWeek("2026-10-25T07:00:00.000Z/2026-11-02T08:00:00.000Z", at)).toBeNull();
    // A week that ends after the take, or two weeks before it.
    expect(parseBossWeek("2026-11-02T08:00:00.000Z/2026-11-09T08:00:00.000Z", at)).toBeNull();
    expect(parseBossWeek("2026-10-19T07:00:00.000Z/2026-10-26T07:00:00.000Z", at)).toBeNull();
  });

  it("takes a week of 167 to 169 hours that ends at this week's Monday", () => {
    expect(parseBossWeek("2026-10-26T07:00:00.000Z/2026-11-02T08:00:00.000Z", at)).not.toBeNull();
    expect(parseBossWeek("2026-10-26T08:00:00.000Z/2026-11-02T08:00:00.000Z", at)).not.toBeNull();
  });
});
