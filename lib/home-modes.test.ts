import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLD_TOPICS, weeklyTopic } from "./cold-topics";
import { HOSTILE_PROMPTS, HOSTILE_TAKE_ID, claimOfTheDay } from "./hostile";
import { HOSTILE_FREE_ROUNDS } from "./hostile";
import { BOSS_ASK_LINE, BOSS_NAME, bossTile, hostileTile } from "./home-modes";

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

describe("Hostile Q&A's row", () => {
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
    expect(hostileTile({ now: NOW, premium: false, rows: [] }).pips).toEqual({ left: 3, of: HOSTILE_FREE_ROUNDS });
    expect(
      hostileTile({
        now: NOW,
        premium: false,
        rows: [ago(1, HOSTILE_TAKE_ID), ago(2, "h4"), ago(30, HOSTILE_TAKE_ID)],
      }).line
    ).toBe("2 free today");
  });

  /* #500, from the games-forward design: the count as pips, one going out
     for each round played, all out at the cap, none on Premium. */
  it("draws the rounds as pips: one out for each round played, all out at the cap, none on Premium or unread", () => {
    const one = hostileTile({ now: NOW, premium: false, rows: [ago(1, HOSTILE_TAKE_ID), ago(3, HOSTILE_TAKE_ID)] });
    expect(one.pips).toEqual({ left: 1, of: 3 });
    expect(one.line).toBe("1 free today");
    const cap = hostileTile({ now: NOW, premium: false, rows: [ago(2, HOSTILE_TAKE_ID), ago(5, HOSTILE_TAKE_ID), ago(9, HOSTILE_TAKE_ID)] });
    expect(cap.pips).toEqual({ left: 0, of: 3 });
    expect(hostileTile({ now: NOW, premium: true, rows: [] }).pips).toBeNull();
    expect(hostileTile({ now: NOW, premium: null, rows: [] }).pips).toBeNull();
    expect(hostileTile({ now: NOW, premium: false, rows: null }).pips).toBeNull();
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

describe("the weekly boss's row", () => {
  /* #500 named the row "Cold Topic"; merged over #494 it takes the boss's
     one name, "Weekly boss", as /boss's eyebrow, Practice's stage, the
     Log and the tab title say it. */
  it("is one tap to the boss, named as its own screen names it, and back comes to Today", () => {
    const t = bossTile({ now: NOW, rows: [] });
    expect(t.href).toBe("/boss?from=today");
    expect(t.name).toBe("Weekly boss");
    expect(BOSS_NAME).toBe("Weekly boss");
    const boss = readFileSync(path.resolve(__dirname, "../app/boss/page.tsx"), "utf8");
    expect(boss).toContain(`eyebrow="${BOSS_NAME}"`);
    expect(t.pips).toBeNull();
  });

  it("shows the week's topic, the one /boss opens on, and what it asks, with no countdown (#486)", () => {
    const t = bossTile({ now: NOW, rows: [] });
    expect(t.subject).toBe(weeklyTopic(NOW).title);
    expect(COLD_TOPICS.map((c) => c.title)).toContain(t.subject);
    expect(t.line).toBe(BOSS_ASK_LINE);
    // The week's last evening says the same: no "Last day", no days left, no seconds.
    expect(bossTile({ now: new Date(2026, 10, 22, 21, 0), rows: [] }).line).toBe(BOSS_ASK_LINE);
    expect(t.line).not.toMatch(/day|second|minute|\d/i);
    expect(t.label).toBe(`Weekly boss. This week's topic: ${t.subject}. ${BOSS_ASK_LINE}.`);
  });

  it("says Done this week, earned, once a boss take is in this week, and not for last week's", () => {
    const done = bossTile({ now: NOW, rows: [ago(20, "boss:dunning-kruger")] });
    expect(done.line).toBe("Done this week");
    expect(done.done).toBe(true);
    // Done names the topic the take stored, as the Log's row does (#494
    // review): a Spin or a pick takes another than the week's.
    expect(weeklyTopic(NOW).id).not.toBe("dunning-kruger");
    expect(done.subject).toBe(COLD_TOPICS.find((c) => c.id === "dunning-kruger")?.title);
    const last = bossTile({ now: NOW, rows: [ago(24 * 4, "boss:dunning-kruger"), ago(1, HOSTILE_TAKE_ID)] });
    expect(last.line).toBe(BOSS_ASK_LINE);
    expect(last.done).toBe(false);
  });

  it("holds its place while the clock or the rows are unread", () => {
    expect(bossTile({ now: null, rows: [] }).subject).toBeNull();
    expect(bossTile({ now: null, rows: [] }).line).toBe(NBSP);
    expect(bossTile({ now: NOW, rows: null }).line).toBe(NBSP);
  });
});

describe("Today draws the two straight under the card, over the foot (#478, #500)", () => {
  const page = readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf8");
  it("under the practice card, before the test tile and the foot; no switch and no tiles", () => {
    const hero = page.indexOf("<HomeHero");
    const modes = page.indexOf("<ModeRows");
    expect(hero).toBeGreaterThan(0);
    expect(modes).toBeGreaterThan(hero);
    expect(modes).toBeLessThan(page.indexOf("<TestTile"));
    expect(modes).toBeLessThan(page.indexOf("<TodayFoot"));
    expect(page).not.toMatch(/<Segmented|<TodayTiles|<WeekTiles|<ModeTiles|weekView/);
  });

  it("reads the clock after mount, never in render", () => {
    expect(page).toMatch(/useState<Date \| null>\(\(\) => \(warm \? new Date\(\) : null\)\)/);
    expect(page).toContain("setClock(new Date());");
  });

  /* #478 review: the clock moved only when the day turned, so a tile at
     the cap said "Next in about 2 hours" for as long as Today stayed
     open, and still said it after the round had opened. */
  it("moves the clock on every check, a return or the minute's tick, not only when the day turns", () => {
    const check = page.slice(page.indexOf("const check = () => {"), page.indexOf('addEventListener("visibilitychange", check)'));
    expect(check.length).toBeGreaterThan(0);
    const moved = check.indexOf("setClock(new Date());");
    expect(moved).toBeGreaterThan(-1);
    expect(moved).toBeLessThan(check.indexOf("if (!dayTurned("));
    expect(page).toMatch(/window\.setInterval\(check, 60_000\)/);
  });
});
