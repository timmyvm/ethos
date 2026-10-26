import { describe, expect, it } from "vitest";
import {
  BOSS_XP_BASE,
  DAILY_MAX_SECONDS,
  TIGHT_MAX_SECONDS,
  repHref,
  repKey,
  sameRepScreen,
  resolveRepConfig,
  topicFromLessonId,
} from "./rep-config";
import {
  MAX_XP_MULTIPLIER,
  parseMods,
  xpMultiplier,
} from "./stress-mods";

const NOW = new Date(2026, 7, 9, 12);

describe("resolveRepConfig", () => {
  it("falls back to the daily rotation", () => {
    const c = resolveRepConfig({}, NOW);
    expect(c.kind).toBe("daily");
    expect(c.maxSeconds).toBe(DAILY_MAX_SECONDS);
    expect(c.xpMultiplier).toBe(1);
    expect(c.topic).toBeNull();
  });

  it("honours a requested lesson", () => {
    expect(resolveRepConfig({ lesson: "h2" }, NOW).title).toBe(
      "Land the ending"
    );
  });

  it("ignores an unknown lesson instead of erroring", () => {
    expect(resolveRepConfig({ lesson: "nope" }, NOW).kind).toBe("daily");
  });

  it("builds a boss rep with a boss lesson id", () => {
    const c = resolveRepConfig({ boss: "crispr" }, NOW);
    expect(c.kind).toBe("boss");
    expect(c.lessonId).toBe("boss:crispr");
    expect(c.topic?.id).toBe("crispr");
    expect(c.xpMultiplier).toBe(BOSS_XP_BASE);
  });

  it("round-trips the boss lesson id back to a topic", () => {
    expect(topicFromLessonId("boss:jevons")?.title).toBe("The Jevons paradox");
    expect(topicFromLessonId("f1")).toBeNull();
    expect(topicFromLessonId(null)).toBeNull();
  });

  it("drops premium mods without an entitlement", () => {
    const free = resolveRepConfig({ mods: "tight,no-notes" }, NOW);
    expect(free.maxSeconds).toBe(DAILY_MAX_SECONDS);
    expect(free.hidePrompt).toBe(true);
    expect(free.mods.map((m) => m.id)).toEqual(["no-notes"]);
  });

  it("applies premium mod effects when entitled", () => {
    const c = resolveRepConfig(
      { mods: "tight,crowd", premium: true },
      NOW
    );
    expect(c.maxSeconds).toBe(TIGHT_MAX_SECONDS);
    expect(c.crowdNoise).toBe(true);
    expect(c.xpMultiplier).toBe(2.25);
  });

  it("stacks boss and mod multipliers under the ceiling", () => {
    const c = resolveRepConfig(
      { boss: "crispr", mods: "interrupt,tight", premium: true },
      NOW
    );
    expect(c.xpMultiplier).toBe(MAX_XP_MULTIPLIER);
  });
});

describe("parseMods", () => {
  it("returns nothing for empty input", () => {
    expect(parseMods(null)).toEqual([]);
    expect(parseMods("")).toEqual([]);
  });

  it("drops unknown ids and duplicates", () => {
    const mods = parseMods("no-notes,fake,no-notes", { premium: true });
    expect(mods.map((m) => m.id)).toEqual(["no-notes"]);
  });

  it("caps the stack at two", () => {
    const mods = parseMods("no-notes,tight,crowd,interrupt", {
      premium: true,
    });
    expect(mods).toHaveLength(2);
  });

  it("never exceeds the multiplier ceiling", () => {
    const mods = parseMods("interrupt,tight", { premium: true });
    expect(xpMultiplier(mods, 2)).toBe(MAX_XP_MULTIPLIER);
  });
});

describe("repHref", () => {
  it("links a bare daily rep", () => {
    expect(repHref({})).toBe("/rep");
  });

  it("prefers the boss over a lesson", () => {
    expect(repHref({ boss: "crispr", lesson: "f1" })).toBe("/rep?boss=crispr");
  });

  it("links a game with its drawn question", () => {
    expect(repHref({ game: "qa", q: "qa3" })).toBe("/rep?game=qa&q=qa3");
    expect(repHref({ game: "rush", topic: "t1" })).toBe("/rep?game=rush");
  });

  it("carries mods", () => {
    expect(repHref({ lesson: "f1", mods: ["no-notes", "tight"] })).toBe(
      "/rep?lesson=f1&mods=no-notes%2Ctight"
    );
  });
});

describe("repKey and sameRepScreen (Go again)", () => {
  const here = (s: string) => new URLSearchParams(s);

  it("keys on mods too, so dropping or changing them is a new screen", () => {
    expect(repKey(here("lesson=f1&mods=tight"))).not.toBe(
      repKey(here("lesson=f1"))
    );
  });

  it("ignores where the recording hands back to", () => {
    expect(repKey(here("lesson=f1&back=%2Flessons%2Fx"))).toBe(
      repKey(here("lesson=f1"))
    );
  });

  it("knows a push to the address already on screen goes nowhere", () => {
    expect(sameRepScreen(repHref({ lesson: "f1" }), here("lesson=f1"))).toBe(true);
    expect(sameRepScreen(repHref({ lesson: "p3" }), here("lesson=f1"))).toBe(false);
    expect(
      sameRepScreen(repHref({ lesson: "f1" }), here("lesson=f1&mods=tight"))
    ).toBe(false);
    expect(sameRepScreen("/", here("lesson=f1"))).toBe(false);
    expect(sameRepScreen("/games", here(""))).toBe(false);
  });
});
