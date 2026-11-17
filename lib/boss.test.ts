import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOSS_DONE_LINE,
  BOSS_RESEARCH_SECONDS,
  bossXpMultiplier,
  lastBossWeek,
  takeThisWeek,
  type BossTakeRow,
} from "./boss";
import * as boss from "./boss";
import { BOSS_XP_BASE } from "./rep-config";

/*
 * #486 (Timothy, 16 Nov, on /boss's card: "they don't need to know any
 * time frame", "get rid of 6 days left", the fact-check line "somewhere
 * else or not said at all", "last 6 weeks is really confusing"). The
 * card names the boss and nothing else; a taken week says so.
 */
describe("the boss card says the boss, not its clocks", () => {
  const pages = ["app/games/page.tsx", "app/boss/page.tsx"].map((f) => [f, readFileSync(f, "utf8")] as const);

  it("prints no time frame, no countdown and no promise of what the take earns", () => {
    for (const [file, page] of pages) {
      for (const gone of [
        /Read for \d/,
        /Explain it in/,
        /bossReadLine|bossAnswerLine|bossWeekLine|daysLeftInWeek/,
        /days left/,
        /"Last day"/,
        /delivery score and a fact-check/,
        /Last six weeks/,
        /BossRecord|bossWeeks/,
      ]) {
        expect(page, `${file} ${gone}`).not.toMatch(gone);
      }
      // The card is still the house stage: "Weekly boss" over the week's
      // topic, one name and one face (#494).
      expect(page).toMatch(/<HeroStage\b/);
      expect(page).toContain(`eyebrow="Weekly boss"`);
      expect(page).toMatch(/<h[12] (id="boss-title" )?className="boss-topic font-display/);
      expect(page).not.toMatch(/eyebrow="This week's boss"|"Cold Topic"|>\s*Cold Topic\s*</);
      // A taken week says so, from the one string.
      expect(page).toContain("BOSS_DONE_LINE");
    }
  });

  /* #494, the morning tour (docs/look/tour/09-boss-390-light.png): /boss
     had two titles, "Cold Topic" on a stage that took the free height
     (300pt of empty sky) and the topic again on the ground under it. */
  it("gives /boss one title, the topic, on a stage at the house's height", () => {
    const page = readFileSync("app/boss/page.tsx", "utf8");
    const lobby = page.slice(page.indexOf('phase === "lobby" && ('), page.indexOf('phase === "research" && topic && ('));
    const stage = lobby.slice(lobby.indexOf("<HeroStage"), lobby.indexOf("</HeroStage>"));
    expect(stage).toContain("center");
    expect(stage).not.toMatch(/artGrow|flex-1"|className="mt-4 flex-1/);
    // The reel turns in the title's slot, and nowhere else.
    expect(stage).toMatch(/<h1 className="boss-topic font-display mt-1\.5">\s*<Reel/);
    expect(lobby.match(/<Reel\b/g)).toHaveLength(1);
    expect(lobby.match(/<h1\b/g)).toHaveLength(1);
    // The taken week's slot is drawn from the first frame, as Practice's is.
    expect(stage).toContain('{taken === null ? "\\u00a0" : takenThisWeek ? BOSS_DONE_LINE : BOSS_ASK_LINE}');
  });

  /* #494 review: at 320 the stage's column is 142px and three topics are
     one word wider than it ("Superconductivity" is 166px at 20/800).
     Where the browser has no hyphenation dictionary the reel's window
     clipped it to "Superconductiv" and Practice ran it under Demos. */
  it("never clips or overruns a one-word topic wider than the column", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const at = css.indexOf(".boss-topic {");
    const rule = css.slice(at, css.indexOf("}", at));
    expect(rule).toContain("hyphens: auto");
    expect(rule).toContain("overflow-wrap: anywhere");
  });

  it("names the tier once at the head of Premium's section, on Practice and /boss", () => {
    for (const file of ["app/games/page.tsx", "app/boss/page.tsx"]) {
      const page = readFileSync(file, "utf8");
      expect(page, file).not.toContain('<h2 className="section-head">Premium</h2>');
      expect(page, file).toContain('<PremiumMark variant="chip" />');
    }
  });

  it("says no time frame in the page's own description either", () => {
    const layout = readFileSync("app/boss/layout.tsx", "utf8");
    expect(layout).not.toMatch(/\d+\s*(minutes?|seconds?)/);
    expect(layout).toContain('title: "Weekly boss · Ethos"');
  });

  /* #486 review: Practice's words stand at the stage's middle height,
     and a taken week's line, landing with the read, pulled them 33px up
     the stage. Its slot is drawn from the first frame instead. */
  it("holds Practice's eyebrow and name still while the week is read", () => {
    const practice = readFileSync("app/games/page.tsx", "utf8");
    const stage = practice.slice(practice.indexOf("<HeroStage"), practice.indexOf("/>", practice.indexOf("artSize={BOSS_ART}")));
    expect(stage).toContain("center");
    expect(stage).toContain('{bossDone === null ? "\\u00a0" : bossDone ? BOSS_DONE_LINE : BOSS_ASK_LINE}');
    expect(stage).toContain("practice-week font-display mt-1 text-link");
    expect(stage).not.toMatch(/className=[^>]*mt-auto/);
    expect(stage).not.toMatch(/line=\{\s*bossDone \?/);
    // The house stage puts a centred stage's line in the group, never at the foot.
    expect(readFileSync("components/ui/HeroStage.tsx", "utf8")).toContain('center ? "mt-1" : "mt-auto pt-3"');
  });

  it("keeps one line for a taken week, and only that", () => {
    expect(BOSS_DONE_LINE).toBe("Done this week");
    expect(Object.keys(boss).sort()).toEqual(
      [
        "BOSS_DONE_LINE",
        "BOSS_RESEARCH_SECONDS",
        "bossWeekField",
        "bossXpMultiplier",
        "isBossTake",
        "lastBossWeek",
        "parseBossWeek",
        "takeThisWeek",
      ].sort()
    );
  });

  it("still runs the reading's clock on the reading, at 90 seconds", () => {
    expect(BOSS_RESEARCH_SECONDS).toBe(90);
    const page = readFileSync("app/boss/page.tsx", "utf8");
    expect(page).toContain("useState(BOSS_RESEARCH_SECONDS)");
    expect(page).toContain('role="timer"');
  });

  /* No Ready screen and no mods row: the reading's end goes straight to
     the recording screen, and the boss carries no mods there. */
  it("goes from the reading straight to the recording screen, with no mods", () => {
    const page = readFileSync("app/boss/page.tsx", "utf8");
    expect(page).not.toMatch(/"ready"/);
    expect(page).not.toMatch(/ModPicker|Stress mods/);
    expect(page).toContain("repHref({ boss: topic.id })");
    expect(page).toContain("I&apos;m ready early");
    expect(page).toContain("See your take");
  });
});

/** The boss's XP: a scored take pays the boss's, an unscored one what any unscored take pays. */
describe("what a boss take pays", () => {
  it("pays the boss's ×1.5 only for a take the engine scored", () => {
    expect(bossXpMultiplier(true)).toBe(BOSS_XP_BASE);
    expect(bossXpMultiplier(false)).toBe(1);
  });
});

/** This week's take: the one a free account's spent week opens. */
describe("this week's take", () => {
  // Friday 6 Nov 2026, 10:00 on the device's clock: this week's Monday is 2 Nov.
  const NOW = new Date(2026, 10, 6, 10);
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();
  const take = (created_at: string, ethos_index: number | null, id?: string): BossTakeRow => ({
    id,
    created_at,
    lesson_id: "boss:crispr",
    ethos_index,
  });

  it("finds this week's take, the scored one first, for See your take", () => {
    expect(takeThisWeek([take(at(2026, 9, 27), 648, "last")], NOW)).toBeNull();
    expect(
      takeThisWeek(
        [take(at(2026, 10, 3), null, "short"), take(at(2026, 10, 4), 684, "scored"), take(at(2026, 10, 5), 690, "later")],
        NOW
      )?.id
    ).toBe("scored");
    expect(takeThisWeek([take(at(2026, 10, 3), null, "short")], NOW)?.id).toBe("short");
  });

  it("reads only bosses, and files Sunday night in its own week", () => {
    expect(takeThisWeek([{ created_at: at(2026, 10, 3), lesson_id: "topic:t1", ethos_index: 700 }], NOW)).toBeNull();
    expect(takeThisWeek([take(new Date(2026, 10, 1, 23, 59).toISOString(), 650)], NOW)).toBeNull();
    expect(takeThisWeek([take(new Date(2026, 10, 2, 0, 0).toISOString(), 684)], NOW)?.ethos_index).toBe(684);
  });
});

/** The server's last week, for the delta "on last week's boss", in the speaker's own week. */
describe("last week, on the server", () => {
  it("is Monday to Monday on the speaker's clock", () => {
    // Melbourne (UTC+11, getTimezoneOffset -660): Friday 6 Nov 10:00 local
    // is Thursday 23:00 UTC. Its week began Monday 2 Nov 00:00 local,
    // which is Sunday 1 Nov 13:00 UTC.
    const w = lastBossWeek(new Date("2026-11-05T23:00:00Z"), -660);
    expect(w.to.toISOString()).toBe("2026-11-01T13:00:00.000Z");
    expect(w.from.toISOString()).toBe("2026-10-25T13:00:00.000Z");
  });

  it("puts Monday morning in Melbourne in the new week, where UTC still says Sunday", () => {
    // Monday 2 Nov 08:00 local is Sunday 1 Nov 21:00 UTC.
    const w = lastBossWeek(new Date("2026-11-01T21:00:00Z"), -660);
    expect(w.to.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });

  it("falls back to UTC's week with no offset, and west of UTC too", () => {
    const utc = lastBossWeek(new Date("2026-11-04T12:00:00Z"), null);
    expect(utc.to.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(utc.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    // New York (UTC-5, offset 300): Sunday 1 Nov 22:00 local is Monday 03:00 UTC.
    const ny = lastBossWeek(new Date("2026-11-02T03:00:00Z"), 300);
    expect(ny.to.toISOString()).toBe("2026-10-26T05:00:00.000Z");
  });
});
