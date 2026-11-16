import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { takeThisWeek } from "./boss";
import { COLD_TOPICS, bossWeekNumber, weeklyTopic } from "./cold-topics";
import { weekStart } from "./level";

/*
 * The week's boss topic turns on Monday, with the boss's own week (#494):
 * the lock (`takeThisWeek`), Today's tile and the Log's Weekly boss all
 * count Monday to Sunday (`weekStart`). Counted in 7-day blocks from 1
 * January it turned on the weekday the year began, a Thursday in 2026.
 *
 * Melbourne's calendar, the camera's: summer time ended on Sunday 5 April
 * 2026 and began on Sunday 4 October 2026, so a run of weeks here crosses
 * both changes.
 */
const was = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Australia/Melbourne";
});
afterAll(() => {
  if (was === undefined) delete process.env.TZ;
  else process.env.TZ = was;
});

const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

describe("the week's boss topic", () => {
  it("runs on Melbourne's calendar", () => {
    expect(new Date(2026, 10, 16).toISOString()).toBe("2026-11-15T13:00:00.000Z");
  });

  it("is one topic from Monday 00:00 to Sunday 23:59, and turns on Monday", () => {
    const monday = new Date(2026, 10, 16);
    const topic = weeklyTopic(monday).id;
    for (let d = 0; d < 7; d++) {
      for (const [h, m] of [[0, 0], [9, 30], [23, 59]]) {
        const at = new Date(2026, 10, 16 + d, h, m);
        expect(weeklyTopic(at).id, `${DAY[d]} ${h}:${m}`).toBe(topic);
      }
    }
    expect(weeklyTopic(new Date(2026, 10, 15, 23, 59)).id).not.toBe(topic);
    expect(weeklyTopic(new Date(2026, 10, 23, 0, 0)).id).not.toBe(topic);
    // Thursday was the old turn: nothing happens there now.
    expect(weeklyTopic(new Date(2026, 10, 18, 23, 59)).id).toBe(weeklyTopic(new Date(2026, 10, 19, 0, 1)).id);
  });

  it("turns with the week the boss's lock counts", () => {
    for (let d = -3; d < 10; d++) {
      const at = new Date(2026, 10, 16 + d, 12);
      const take = { id: "t", created_at: weekStart(at).toISOString(), lesson_id: `boss:${weeklyTopic(at).id}`, ethos_index: 640 };
      // The week's own take, stored at its Monday, is this week's take on every day of it.
      expect(takeThisWeek([take], at)?.lesson_id).toBe(`boss:${weeklyTopic(at).id}`);
    }
  });

  it("keeps the topic Monday 16 November 2026 showed: the turn moved, not the topic on screen", () => {
    expect(weeklyTopic(new Date(2026, 10, 16, 9)).id).toBe("great-vowel-shift");
    expect(weeklyTopic(new Date(2026, 10, 17, 10, 13)).id).toBe("great-vowel-shift");
  });

  it("counts one week a week across both clock changes, for three years", () => {
    let monday = new Date(2026, 0, 5);
    for (let w = 0; w < 160; w++) {
      expect(bossWeekNumber(monday), monday.toDateString()).toBe(w);
      // Sunday night, an hour before the turn, is still the week.
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23);
      expect(bossWeekNumber(sunday), sunday.toDateString()).toBe(w);
      monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
    }
  });

  it("walks every topic once before any comes back, the year's end included", () => {
    const seen: string[] = [];
    let monday = new Date(2026, 9, 5);
    for (let w = 0; w < COLD_TOPICS.length; w++) {
      seen.push(weeklyTopic(monday).id);
      monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
    }
    expect(new Set(seen).size).toBe(COLD_TOPICS.length);
    expect(weeklyTopic(monday).id).toBe(seen[0]);
  });

  it("still names a topic on a clock set before the first Monday", () => {
    expect(bossWeekNumber(new Date(2025, 11, 31))).toBe(-1);
    expect(weeklyTopic(new Date(2025, 11, 31)).id).toBe(COLD_TOPICS[COLD_TOPICS.length - 1].id);
    expect(weeklyTopic(new Date(2020, 3, 1))).toBeDefined();
  });
});
