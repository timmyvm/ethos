import { describe, expect, it } from "vitest";
import {
  askedIdsFrom,
  clampLevel,
  DAY_ROTATION,
  dailyQuestion,
  draw,
  drawFresh,
  GAME_CAP_S,
  GAMES,
  gameById,
  gameLessonId,
  gameLevel,
  gameMods,
  gameModIds,
  gameMultiplier,
  gameOfLessonId,
  gameOfTheDay,
  gameOpen,
  gameXpMultiplier,
  levelCapS,
  needsPremium,
  questionById,
  RECENT_GUARD,
} from "./games";
import { DAILY_MAX_SECONDS, resolveRepConfig } from "./rep-config";
import { MAX_STACKED_MODS, MAX_XP_MULTIPLIER, modById, parseMods } from "./stress-mods";

const NOW = new Date(2026, 7, 21, 12);

describe("the games library", () => {
  it("ships only games that can actually run (#36's honesty rule)", () => {
    for (const g of GAMES) {
      for (const id of g.modIds) {
        expect(modById(id), `${g.name} stages unknown mod ${id}`).not.toBeNull();
      }
      expect(g.modIds.length).toBeLessThanOrEqual(MAX_STACKED_MODS);
    }
  });

  it("gives every game a real pool and real technique", () => {
    for (const g of GAMES) {
      expect(g.questions.length).toBeGreaterThanOrEqual(6);
      expect(g.tips.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps question ids unique across every game", () => {
    const ids = GAMES.flatMap((g) => g.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws from the pool and never repeats the excluded question", () => {
    const qa = gameById("qa")!;
    for (let i = 0; i < 20; i++) {
      const q = draw(qa, "qa1", () => i / 20);
      expect(q.id).not.toBe("qa1");
    }
  });

  it("rotates the daily fallback by day, inside the pool", () => {
    const qa = gameById("qa")!;
    const today = dailyQuestion(qa, NOW);
    const tomorrow = dailyQuestion(qa, new Date(2026, 7, 22, 12));
    expect(qa.questions).toContain(today);
    expect(today.id).not.toBe(tomorrow.id);
  });
});

describe("a game rep through the resolver", () => {
  it("stages the game's mods and pays their XP", () => {
    const c = resolveRepConfig({ game: "qa", q: "qa3", premium: true }, NOW);
    expect(c.kind).toBe("daily");
    expect(c.lessonId).toBe("game:qa:qa3");
    expect(c.interrupt).toBe(true);
    expect(c.xpMultiplier).toBe(2);
    expect(c.title).toBe("Does talent matter more than effort?");
    expect(c.unit).toBe("Games · Q&A");
    expect(c.tips).toEqual(gameById("qa")!.tips);
  });

  /* The games plan, item 2: Speed rush's clock is its level's, 45, 30,
     then 20 seconds. Level 1 ran 30 before there were levels. */
  it("runs speed rush on its level's clock", () => {
    const at = (level?: number) =>
      resolveRepConfig({ game: "rush", q: "ru2", premium: true, level }, NOW);
    expect(at().maxSeconds).toBe(45);
    expect(at(1).maxSeconds).toBe(45);
    expect(at(2).maxSeconds).toBe(30);
    expect(at(3).maxSeconds).toBe(20);
    expect(at().xpMultiplier).toBe(1.5);
    expect(at(2).xpMultiplier).toBe(1.88);
    expect(at(3).xpMultiplier).toBe(2.25);
  });

  it("runs the interview plain: full clock, no multiplier", () => {
    const c = resolveRepConfig({ game: "interview", q: "iv1" }, NOW);
    expect(c.lessonId).toBe("game:interview:iv1");
    expect(c.maxSeconds).toBe(90);
    expect(c.xpMultiplier).toBe(1);
  });

  it("falls back to the daily question when the link names none", () => {
    const c = resolveRepConfig({ game: "interview" }, NOW);
    const q = dailyQuestion(gameById("interview")!, NOW);
    expect(c.lessonId).toBe(gameLessonId(gameById("interview")!, q));
  });

  /*
   * The label never outruns the conditions: a game whose staged mods
   * the account can't run resolves as an ordinary rep, not as the game
   * with its defining condition quietly missing.
   */
  it("a game's conditions come WITH it, whatever the entitlement (#194)", () => {
    // The old contract dropped premium-staged mods for free accounts,
    // which silently killed the interruption AND the game's identity —
    // reported live as "Demos doesn't cut in" plus a game ending like a
    // lesson. Premium gates the mod picker, never the games.
    const c = resolveRepConfig({ game: "qa", q: "qa3", premium: false }, NOW);
    expect(c.lessonId.startsWith("game:")).toBe(true);
    expect(c.interrupt).toBe(true);
  });

  it("a free account's stacked EXTRAS still respect the entitlement", () => {
    const c = resolveRepConfig(
      { game: "qa", q: "qa3", mods: "crowd", premium: false },
      NOW
    );
    expect(c.interrupt).toBe(true);
    expect(c.crowdNoise).toBe(false);
  });

  it("keeps the game's mods when an extra is stacked on top", () => {
    const c = resolveRepConfig(
      { game: "qa", q: "qa1", mods: "no-notes,crowd", premium: true },
      NOW
    );
    const ids = c.mods.map((m) => m.id);
    expect(ids).toContain("interrupt");
    expect(ids).toHaveLength(MAX_STACKED_MODS);
  });

  it("ignores an unknown game instead of erroring", () => {
    expect(resolveRepConfig({ game: "nope" }, NOW).lessonId).not.toMatch(
      /^game:/
    );
  });
});

describe("the menu's claims", () => {
  it("computes the advertised multiplier from the staged mods", () => {
    expect(gameMultiplier(gameById("qa")!)).toBe(2);
    expect(gameMultiplier(gameById("rush")!)).toBe(1.5);
    expect(gameMultiplier(gameById("interview")!)).toBe(1);
  });

  it("marks the games behind the Premium wall", () => {
    expect(needsPremium(gameById("qa")!)).toBe(false);
    expect(needsPremium(gameById("rush")!)).toBe(true);
    expect(needsPremium(gameById("interview")!)).toBe(true);
  });

  it("resolves questions by id and rejects strangers", () => {
    const g = gameById("rush")!;
    expect(questionById(g, "ru1")?.prompt).toMatch(/what you do all day/);
    expect(questionById(g, "qa1")).toBeNull();
    expect(questionById(g, null)).toBeNull();
  });
});

describe("levels (the games plan, item 2)", () => {
  it("gives every game three levels, in order, each with a direction and a condition", () => {
    for (const g of GAMES) {
      expect(g.levels.map((l) => l.n)).toEqual([1, 2, 3]);
      for (const l of g.levels) {
        expect(l.direction.length, `${g.id} ${l.n}`).toBeGreaterThan(10);
        expect(l.condition.length, `${g.id} ${l.n}`).toBeGreaterThan(5);
        for (const [lo, hi] of l.cutIns) {
          expect(lo).toBeGreaterThan(0);
          expect(hi).toBeGreaterThan(lo);
          expect(hi).toBeLessThan(levelCapS(g, l.n));
        }
      }
    }
  });

  it("keeps the top-level direction as level 1's", () => {
    for (const g of GAMES) expect(g.direction).toBe(g.levels[0].direction);
  });

  it("stages Q&A's cut-ins: one at 12 to 20, one early, then two", () => {
    const qa = gameById("qa")!;
    expect(qa.levels.map((l) => l.cutIns)).toEqual([[[12, 20]], [[6, 10]], [[6, 10], [30, 40]]]);
    expect(qa.levels.map((l) => l.direction)).toEqual([
      "Take a side. When Demos cuts in, hold a second before you answer.",
      "Take a side. Demos cuts in early. Hold a second before you answer.",
      "Take a side. Demos cuts in twice. Hold a second each time.",
    ]);
    expect(qa.levels.slice(1).map((l) => l.condition)).toEqual([
      "Demos cuts in early.",
      "Demos cuts in twice.",
    ]);
    expect(qa.cutInLines).toEqual([
      "So what?",
      "Says who?",
      "Give me an example.",
      "Why does that matter?",
      "Get to the point.",
    ]);
  });

  it("runs Speed rush at 45, 30 and 20 seconds", () => {
    const rush = gameById("rush")!;
    expect(rush.levels.map((l) => l.capS)).toEqual([45, 30, 20]);
    expect(rush.levels.map((l) => l.direction)).toEqual([
      "45 seconds. Land the ending before the clock does.",
      "30 seconds. Land the ending before the clock does.",
      "20 seconds. Land the ending before the clock does.",
    ]);
    expect(rush.levels.slice(1).map((l) => l.condition)).toEqual(["30 seconds.", "20 seconds."]);
    expect(rush.levels.every((l) => l.cutIns.length === 0)).toBe(true);
  });

  it("hides Interview's question from level 2 and adds a follow-up at level 3", () => {
    const iv = gameById("interview")!;
    expect(iv.levels.map((l) => l.reveal)).toEqual(["before", "record", "record"]);
    expect(iv.levels.map((l) => l.cutIns)).toEqual([[], [], [[35, 45]]]);
    expect(iv.levels.map((l) => l.direction)).toEqual([
      "Answer like they asked you in the room. Finish between 1:00 and 1:30.",
      "Finish between 1:00 and 1:30.",
      "Demos asks one follow-up. Finish between 1:00 and 1:30.",
    ]);
    expect(iv.levels.slice(1).map((l) => l.condition)).toEqual([
      "The question shows when you press Record.",
      "Demos asks one follow-up.",
    ]);
    expect(iv.cutInLines).toHaveLength(5);
    expect(gameModIds(iv, 3)).toEqual(["interrupt"]);
    expect(gameModIds(iv, 2)).toEqual([]);
  });

  it("clamps a level to 1, 2 or 3", () => {
    expect([0, 1, 2, 3, 4, -1, 2.7, NaN, "2", null, undefined, "x"].map(clampLevel)).toEqual([
      1, 1, 2, 3, 3, 1, 2, 1, 2, 1, 1, 1,
    ]);
    expect(gameLevel(gameById("qa")!, 9).n).toBe(3);
  });

  it("runs a level with no clock of its own to the daily cap", () => {
    expect(GAME_CAP_S).toBe(DAILY_MAX_SECONDS);
    expect(levelCapS(gameById("qa")!, 3)).toBe(90);
    expect(levelCapS(gameById("interview")!, 1)).toBe(90);
  });

  it("says the rule a round counts by, once per game", () => {
    expect(GAMES.map((g) => g.countsWhen)).toEqual([
      "A round counts when you hold 0.8s after each cut-in and keep two stars.",
      "A round counts when you finish before the clock and keep two stars.",
      "A round counts when you finish inside 60 to 90 seconds and keep two stars.",
    ]);
  });

  it("makes Q&A's first tip the one the round measures (F2)", () => {
    expect(gameById("qa")!.tips[0]).toBe(
      "Stop when he cuts in. Hold a second, then answer him. Your result times that pause."
    );
  });
});

describe("a level through the resolver", () => {
  it("states the level's direction, clock, cut-ins and reveal", () => {
    const qa2 = resolveRepConfig({ game: "qa", q: "qa3", level: "2" }, NOW);
    expect(qa2.level).toBe(2);
    expect(qa2.prompt).toBe(gameLevel(gameById("qa")!, 2).direction);
    expect(qa2.cutIns).toEqual([[6, 10]]);
    expect(qa2.interrupt).toBe(true);
    expect(qa2.maxSeconds).toBe(90);
    expect(qa2.revealOnRecord).toBe(false);
    expect(qa2.xpMultiplier).toBe(2.5);

    const iv3 = resolveRepConfig({ game: "interview", q: "iv2", level: 3 }, NOW);
    expect(iv3.revealOnRecord).toBe(true);
    expect(iv3.interrupt).toBe(true);
    expect(iv3.cutIns).toEqual([[35, 45]]);
    expect(iv3.xpMultiplier).toBe(3);
    expect(resolveRepConfig({ game: "interview", q: "iv2", level: 2 }, NOW).interrupt).toBe(false);
  });

  it("defaults to level 1 and clamps a hand-typed one", () => {
    expect(resolveRepConfig({ game: "qa", q: "qa1" }, NOW).level).toBe(1);
    expect(resolveRepConfig({ game: "qa", q: "qa1", level: "7" }, NOW).level).toBe(3);
    expect(resolveRepConfig({ game: "qa", q: "qa1", level: "junk" }, NOW).level).toBe(1);
  });

  it("gives a take that is not a game no level, and the old middle window when it interrupts", () => {
    const plain = resolveRepConfig({ lesson: "f1" }, NOW);
    expect(plain.level).toBeNull();
    expect(plain.cutIns).toEqual([]);
    expect(plain.revealOnRecord).toBe(false);
    const picked = resolveRepConfig({ lesson: "f1", mods: "interrupt", premium: true }, NOW);
    expect(picked.interrupt).toBe(true);
    expect(picked.cutIns).toEqual([[36, 54]]);
    const rushExtra = resolveRepConfig(
      { game: "rush", q: "ru1", mods: "interrupt", premium: true },
      NOW
    );
    expect(rushExtra.interrupt).toBe(true);
    expect(rushExtra.cutIns).toEqual([[18, 27]]);
  });
});

describe("game XP: shown is paid (the games plan, item 10)", () => {
  const qa = gameById("qa")!;
  const rush = gameById("rush")!;
  const iv = gameById("interview")!;

  it("pays the staged mods times the level, Interruption only when he cut in", () => {
    const table = (g: typeof qa, fired: boolean) =>
      [1, 2, 3].map((n) => gameXpMultiplier(g, n, fired));
    expect(table(qa, true)).toEqual([2, 2.5, 3]);
    expect(table(qa, false)).toEqual([1, 1.25, 1.5]);
    expect(table(rush, false)).toEqual([1.5, 1.88, 2.25]);
    expect(table(iv, true)).toEqual([1, 1.25, 3]);
    expect(table(iv, false)).toEqual([1, 1.25, 1.5]);
  });

  it("never pays past the cap, whatever is stacked", () => {
    const extras = parseMods("crowd,no-notes", { premium: true });
    expect(gameXpMultiplier(qa, 3, true, extras)).toBe(MAX_XP_MULTIPLIER);
    expect(gameXpMultiplier(rush, 3, true, extras)).toBeLessThanOrEqual(MAX_XP_MULTIPLIER);
  });

  it("stages the game's own mods first, so an extra never squeezes one out", () => {
    const extras = parseMods("crowd,no-notes", { premium: true });
    expect(gameMods(qa, 1, { cutInFired: true, extras }).map((m) => m.id)).toEqual([
      "interrupt",
      "crowd",
    ]);
    expect(gameMods(qa, 1, { cutInFired: false, extras }).map((m) => m.id)).toEqual([
      "crowd",
      "no-notes",
    ]);
  });

  it("keeps the menu's claim at level 1 with the cut-in made", () => {
    for (const g of GAMES) expect(gameMultiplier(g)).toBe(gameXpMultiplier(g, 1, true));
  });
});

describe("pools and question memory (proposal-mastery 7)", () => {
  it("holds 24, 24 and 20 questions", () => {
    expect(GAMES.map((g) => [g.id, g.questions.length])).toEqual([
      ["qa", 24],
      ["rush", 24],
      ["interview", 20],
    ]);
  });

  it("keeps every new string inside the copy rules", () => {
    for (const g of GAMES) {
      const strings = [
        g.blurb,
        g.countsWhen,
        ...g.cutInLines,
        ...g.tips,
        ...g.questions.map((q) => q.prompt),
        ...g.levels.flatMap((l) => [l.direction, l.condition]),
      ];
      for (const x of strings) {
        expect(x, x).not.toMatch(/\u2014/);
        expect(x, x).not.toMatch(/\b(reps?|gym|workout|drills?|training)\b/i);
      }
    }
  });

  it("names a game from its stored lesson id", () => {
    expect(gameOfLessonId("game:rush:ru3")?.id).toBe("rush");
    expect(gameOfLessonId("game:nope:x")).toBeNull();
    expect(gameOfLessonId("topic:t1")).toBeNull();
    expect(gameOfLessonId(null)).toBeNull();
  });

  it("reads asked ids out of lesson ids, newest first, each once, this game only", () => {
    const qa = gameById("qa")!;
    expect(
      askedIdsFrom(["game:qa:qa3", "game:rush:ru1", null, "game:qa:qa1", "game:qa:qa3", "topic:x"], qa)
    ).toEqual(["qa3", "qa1"]);
  });

  /** A seeded stand-in for Math.random, so the walk is the same every run. */
  function seeded(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) % 2 ** 31;
      return s / 2 ** 31;
    };
  }

  it("never repeats a question until the pool is spent", () => {
    for (const g of GAMES) {
      for (const seed of [1, 7, 42]) {
        const rand = seeded(seed);
        const asked: string[] = [];
        for (let i = 0; i < g.questions.length; i++) {
          const q = drawFresh(g, asked, rand);
          expect(asked, `${g.id} draw ${i}`).not.toContain(q.id);
          asked.unshift(q.id);
        }
        expect(new Set(asked).size).toBe(g.questions.length);
      }
    }
  });

  it("then brings back the older half, and never one of the last three", () => {
    for (const g of GAMES) {
      const rand = seeded(9);
      const asked: string[] = [];
      for (let i = 0; i < g.questions.length * 4; i++) {
        const q = drawFresh(g, asked, rand);
        expect(asked.slice(0, RECENT_GUARD), `${g.id} draw ${i}`).not.toContain(q.id);
        if (asked.length >= g.questions.length) {
          const distinct = [...new Set(asked)];
          const older = distinct.slice(Math.ceil(distinct.length / 2));
          expect(older, `${g.id} draw ${i}`).toContain(q.id);
        }
        asked.unshift(q.id);
      }
    }
  });

  it("ignores asked ids from other games and ones no longer in the pool", () => {
    const qa = gameById("qa")!;
    const rand = () => 0;
    const all = qa.questions.map((q) => q.id);
    const asked = [...all.slice(1), "ru1", "qa99"];
    expect(drawFresh(qa, asked, rand).id).toBe(all[0]);
  });
});

describe("game of the day (the games plan, item 12)", () => {
  it("rotates Speed rush and Interview, one a day", () => {
    const days = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"].map(gameOfTheDay);
    expect(new Set(days)).toEqual(new Set(DAY_ROTATION));
    expect(days[0]).not.toBe(days[1]);
    expect(days[0]).toBe(days[2]);
    expect(days[1]).toBe(days[3]);
  });

  it("rolls over a month and a year end like any other day", () => {
    expect(gameOfTheDay("2026-11-30")).not.toBe(gameOfTheDay("2026-12-01"));
    expect(gameOfTheDay("2026-12-31")).not.toBe(gameOfTheDay("2027-01-01"));
  });

  it("opens Q&A always, a Premium game for Premium, and today's free game for one round", () => {
    const qa = gameById("qa")!;
    const today = "2026-11-06";
    const free = gameById(gameOfTheDay(today))!;
    const other = GAMES.find((g) => needsPremium(g) && g.id !== free.id)!;
    const open = (g: typeof qa, premium: boolean | null, rounds: number) =>
      gameOpen(g, { premium, dayKey: today, roundsTodayOfGame: rounds });

    expect(open(qa, false, 9)).toBe(true);
    expect(open(qa, null, 0)).toBe(true);
    expect(open(free, true, 5)).toBe(true);
    expect(open(other, true, 5)).toBe(true);
    expect(open(free, false, 0)).toBe(true);
    expect(open(free, false, 1)).toBe(false);
    expect(open(other, false, 0)).toBe(false);
    expect(open(free, null, 0)).toBe(true);
    expect(open(other, null, 0)).toBe(false);
  });
});
