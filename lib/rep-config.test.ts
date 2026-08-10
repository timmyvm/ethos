import { describe, expect, it } from "vitest";
import {
  BOSS_XP_BASE,
  DAILY_MAX_SECONDS,
  TIGHT_MAX_SECONDS,
  repHref,
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

  it("carries mods", () => {
    expect(repHref({ lesson: "f1", mods: ["no-notes", "tight"] })).toBe(
      "/rep?lesson=f1&mods=no-notes%2Ctight"
    );
  });
});
