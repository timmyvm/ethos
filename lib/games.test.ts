import { describe, expect, it } from "vitest";
import {
  dailyQuestion,
  draw,
  GAMES,
  gameById,
  gameLessonId,
  gameMultiplier,
  needsPremium,
  questionById,
} from "./games";
import { resolveRepConfig } from "./rep-config";
import { MAX_STACKED_MODS, modById } from "./stress-mods";

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

  it("runs speed rush on the tight clock", () => {
    const c = resolveRepConfig({ game: "rush", q: "ru2", premium: true }, NOW);
    expect(c.maxSeconds).toBe(45);
    expect(c.xpMultiplier).toBe(1.5);
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
  it("never wears the game's name over conditions it didn't run", () => {
    const c = resolveRepConfig({ game: "qa", q: "qa3", premium: false }, NOW);
    expect(c.lessonId.startsWith("game:")).toBe(false);
    expect(c.interrupt).toBe(false);
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

  it("marks the games that stage premium mods", () => {
    expect(needsPremium(gameById("qa")!)).toBe(true);
    expect(needsPremium(gameById("rush")!)).toBe(true);
    expect(needsPremium(gameById("interview")!)).toBe(false);
  });

  it("resolves questions by id and rejects strangers", () => {
    const g = gameById("rush")!;
    expect(questionById(g, "ru1")?.prompt).toMatch(/what you do all day/);
    expect(questionById(g, "qa1")).toBeNull();
    expect(questionById(g, null)).toBeNull();
  });
});
