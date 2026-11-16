import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLD_TOPICS, weeklyTopic } from "./cold-topics";
import { HOSTILE_PROMPTS, HOSTILE_TAKE_ID, claimOfTheDay } from "./hostile";
import { bossTile, hostileTile } from "./home-modes";

/*
 * Today's other two things (#478, docs/plan-next.md section 10): Hostile
 * Q&A and this week's boss, each one tap away, each with what it is
 * about now and one line worth coming back for.
 */
const NBSP = " ";
/** Tuesday 17 November 2026, 10:00 on the camera's clock. */
const NOW = new Date(2026, 10, 17, 10, 0);
const ago = (hours: number, lesson: string | null) => ({
  lesson_id: lesson,
  created_at: new Date(NOW.getTime() - hours * 3_600_000).toISOString(),
  ethos_index: 640,
});

describe("Hostile Q&A's tile", () => {
  it("is one tap to Hostile, and back comes to Today", () => {
    const t = hostileTile({ now: NOW, premium: false, rows: [] });
    expect(t.href).toBe("/hostile?from=today");
    expect(t.name).toBe("Hostile Q&A");
  });

  it("shows the claim of the day, the one the screen opens on", () => {
    const t = hostileTile({ now: NOW, premium: false, rows: [] });
    expect(t.subject).toBe(claimOfTheDay("2026-11-17").claim);
    expect(HOSTILE_PROMPTS.map((p) => p.claim)).toContain(t.subject);
    const tomorrow = hostileTile({ now: new Date(2026, 10, 18, 10, 0), premium: false, rows: [] });
    expect(tomorrow.subject).not.toBe(t.subject);
  });

  it("says the free plan's rounds left today, counting only Hostile's takes in the last 24 hours", () => {
    expect(hostileTile({ now: NOW, premium: false, rows: [] }).line).toBe("3 free today");
    expect(
      hostileTile({
        now: NOW,
        premium: false,
        rows: [ago(1, HOSTILE_TAKE_ID), ago(2, "h4"), ago(30, HOSTILE_TAKE_ID)],
      }).line
    ).toBe("2 free today");
  });

  it("at the cap says when the next round opens, never zero", () => {
    const rows = [ago(2, HOSTILE_TAKE_ID), ago(5, HOSTILE_TAKE_ID), ago(9, HOSTILE_TAKE_ID)];
    const t = hostileTile({ now: NOW, premium: false, rows });
    expect(t.line).toBe("Next in about 15 hours");
    expect(t.label).toBe(`Hostile Q&A. Today's claim: ${t.subject}. Next in about 15 hours.`);
  });

  it("on Premium carries no count, only the rule", () => {
    const rows = [ago(1, HOSTILE_TAKE_ID), ago(2, HOSTILE_TAKE_ID), ago(3, HOSTILE_TAKE_ID), ago(4, HOSTILE_TAKE_ID)];
    expect(hostileTile({ now: NOW, premium: true, rows }).line).toBe("Argue either side");
  });

  it("holds its place while anything is unread: no claim before the clock, no count before the plan and the rows", () => {
    expect(hostileTile({ now: null, premium: false, rows: [] }).subject).toBeNull();
    expect(hostileTile({ now: NOW, premium: null, rows: [] }).line).toBe(NBSP);
    expect(hostileTile({ now: NOW, premium: false, rows: null }).line).toBe(NBSP);
    expect(hostileTile({ now: null, premium: null, rows: null }).label).toBe("Hostile Q&A.");
  });
});

describe("the weekly boss's tile", () => {
  it("is one tap to the boss, and back comes to Today", () => {
    const t = bossTile({ now: NOW, rows: [] });
    expect(t.href).toBe("/boss?from=today");
    expect(t.name).toBe("Weekly boss");
  });

  it("shows the week's topic, the one /boss opens on, and the days left in the week", () => {
    const t = bossTile({ now: NOW, rows: [] });
    expect(t.subject).toBe(weeklyTopic(NOW).title);
    expect(COLD_TOPICS.map((c) => c.title)).toContain(t.subject);
    // Tuesday: Monday was day one of seven.
    expect(t.line).toBe("6 days left");
    expect(bossTile({ now: new Date(2026, 10, 22, 21, 0), rows: [] }).line).toBe("Last day");
    expect(t.label).toBe(`Weekly boss. This week's topic: ${t.subject}. 6 days left.`);
  });

  it("says Done this week, earned, once a boss take is in this week, and not for last week's", () => {
    const done = bossTile({ now: NOW, rows: [ago(20, "boss:dunning-kruger")] });
    expect(done.line).toBe("Done this week");
    expect(done.done).toBe(true);
    const last = bossTile({ now: NOW, rows: [ago(24 * 4, "boss:dunning-kruger"), ago(1, HOSTILE_TAKE_ID)] });
    expect(last.line).toBe("6 days left");
    expect(last.done).toBe(false);
  });

  it("holds its place while the clock or the rows are unread", () => {
    expect(bossTile({ now: null, rows: [] }).subject).toBeNull();
    expect(bossTile({ now: null, rows: [] }).line).toBe(NBSP);
    expect(bossTile({ now: NOW, rows: null }).line).toBe(NBSP);
  });
});

describe("Today draws the two between the card and the trait tiles (#478)", () => {
  const page = readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf8");
  it("under the practice card, before the test tile and the switch", () => {
    const hero = page.indexOf("<HomeHero");
    const modes = page.indexOf("<ModeTiles");
    expect(hero).toBeGreaterThan(0);
    expect(modes).toBeGreaterThan(hero);
    expect(modes).toBeLessThan(page.indexOf("<TestTile"));
    expect(modes).toBeLessThan(page.indexOf("<Segmented"));
    expect(modes).toBeLessThan(page.indexOf("<TodayTiles"));
  });

  it("reads the clock after mount, never in render", () => {
    expect(page).toMatch(/useState<Date \| null>\(\(\) => \(warm \? new Date\(\) : null\)\)/);
    expect(page).toContain("setClock(new Date());");
  });
});
