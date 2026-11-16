import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countWords, GLANCE_WORDS_RULES, rulesBudget } from "./glance";
import {
  markRulesNoteTold,
  PAUSE_RULES,
  pauseRulesOf,
  RULES_NOTE_KEY,
  RULES_NOTE_MIN,
  rulesNote,
  rulesNoteForAnswer,
  rulesNoteShown,
  rulesNoteTold,
  type RulesRow,
} from "./pause-rules";

/*
 * #491: the first take scored under #476's pause rules sets its Index
 * beside a take scored before them, so its delta reads high from the rule
 * alone (the fixture: Pause 26 stored, 73 now, +71 on the Index). That
 * take says so, once, traced to the two Pause scores.
 */

/** A stored take before #476: no mark on its dimensions. */
const old = (index: number, pause: number, extra: Partial<RulesRow> = {}): RulesRow => ({
  ethos_index: index,
  dimensions: { tier1: { pause, fillers: 60, pace: 80, range: 60 }, anchors: {}, tier2: null },
  mode: "daily",
  ...extra,
});
/** A stored take scored under #476: the route's mark on its dimensions. */
const marked = (index: number, pause: number): RulesRow => ({
  ethos_index: index,
  dimensions: { tier1: { pause, fillers: 60, pace: 80, range: 60 }, anchors: {}, tier2: null, pauseRules: PAUSE_RULES },
  mode: "daily",
});
const now = (index: number, pause: number) => ({ rules: PAUSE_RULES, index, pause });

const DELTA = "Part of this jump comes from new pause scoring: Pausing went 26 to 73.";

describe("the first take under #476 (#491)", () => {
  it("says the jump is partly the new scoring, with the Pause scores that moved", () => {
    const prior = [old(560, 40), old(600, 30), old(602, 26)];
    expect(rulesNote({ now: now(673, 73), previousIndex: 602, prior })).toEqual({ kind: "delta", text: DELTA });
  });

  it("reads plain: no internal words, no em dash, the two numbers in it, and under the glance's allowance", () => {
    expect(DELTA).not.toMatch(/—|#476|rule|dimension|Index|tier/i);
    expect(DELTA).toMatch(/26 to 73/);
    expect(countWords(DELTA)).toBeLessThanOrEqual(GLANCE_WORDS_RULES);
  });

  it("is never on a later take: once a stored take carries the mark, it is done, on every phone", () => {
    const prior = [old(600, 26), marked(673, 73)];
    expect(rulesNote({ now: now(700, 80), previousIndex: 673, prior })).toBeNull();
    /* Even a best still held by a take from before #476. */
    const best = [old(760, 20), marked(673, 73)];
    expect(rulesNote({ now: now(780, 80), previousIndex: 673, prior: best })).toBeNull();
  });

  it("is never twice on this phone (a first take whose save failed)", () => {
    expect(rulesNote({ now: now(673, 73), previousIndex: 602, prior: [old(602, 26)], told: true })).toBeNull();
  });

  it("needs the take to be under #476, scored, and up", () => {
    const prior = [old(602, 26)];
    expect(rulesNote({ now: { ...now(673, 73), rules: undefined }, previousIndex: 602, prior })).toBeNull();
    expect(rulesNote({ now: { ...now(673, 73), rules: 0 }, previousIndex: 602, prior })).toBeNull();
    expect(rulesNote({ now: { rules: PAUSE_RULES, index: null, pause: 73 }, previousIndex: 602, prior })).toBeNull();
    expect(rulesNote({ now: now(602, 73), previousIndex: 602, prior })).toBeNull();
    expect(rulesNote({ now: now(590, 73), previousIndex: 602, prior })).toBeNull();
  });

  it("says nothing when the Pause score did not rise enough to be part of the jump", () => {
    const prior = [old(602, 70)];
    expect(rulesNote({ now: now(640, 70 + RULES_NOTE_MIN - 1), previousIndex: 602, prior })).toBeNull();
    expect(rulesNote({ now: now(640, 70 + RULES_NOTE_MIN), previousIndex: 602, prior })?.kind).toBe("delta");
    /* Fell: the jump is not the rule's. */
    expect(rulesNote({ now: now(640, 50), previousIndex: 602, prior })).toBeNull();
  });

  it("reads the take the delta compared with: the newest at that Index, a boss's from the bosses", () => {
    const prior = [old(602, 30, { mode: "boss" }), old(610, 50), old(602, 40)];
    /* A daily: the newest take at 602, Pause 40. */
    expect(rulesNote({ now: now(650, 73), previousIndex: 602, prior })?.text).toMatch(/went 40 to 73/);
    /* A boss: last week's boss at 602, Pause 30. */
    expect(rulesNote({ now: now(650, 73), previousIndex: 602, prior, boss: true })?.text).toMatch(/went 30 to 73/);
  });

  it("names the best it passed when the delta's take is not the one it can trace", () => {
    /* The delta's take is not in the history read (a slow replica); the best is. */
    const prior = [old(640, 30), old(600, 70)];
    expect(rulesNote({ now: now(673, 73), previousIndex: 590, prior })).toEqual({
      kind: "best",
      text: "Part of passing your 640 comes from new pause scoring: Pausing went 30 to 73.",
    });
    /* Not past the best: nothing. */
    expect(rulesNote({ now: now(630, 73), previousIndex: 590, prior })).toBeNull();
  });

  it("skips takes with no Index, and an account with nothing scored before has no jump to explain", () => {
    expect(rulesNote({ now: now(673, 73), previousIndex: null, prior: [] })).toBeNull();
    const unscored: RulesRow = { ethos_index: null, dimensions: { tier1: { pause: 10 }, pauseRules: PAUSE_RULES } };
    /* An unscored take under #476 is no comparison: the first scored one still says it. */
    expect(rulesNote({ now: now(673, 73), previousIndex: 602, prior: [old(602, 26), unscored] })?.kind).toBe("delta");
  });

  it("draws a best's note only where the glance says Best yet, and nothing on an unscored take", () => {
    const delta = { kind: "delta" as const, text: DELTA };
    const best = { kind: "best" as const, text: "Part of passing your 640 comes from new pause scoring: Pausing went 30 to 73." };
    expect(rulesNoteShown(delta, { scorable: true, earned: null })).toBe(DELTA);
    expect(rulesNoteShown(delta, { scorable: false, earned: null })).toBeNull();
    expect(rulesNoteShown(best, { scorable: true, earned: "Best yet, past your 640" })).toBe(best.text);
    expect(rulesNoteShown(best, { scorable: true, earned: "Best yet" })).toBe(best.text);
    expect(rulesNoteShown(best, { scorable: true, earned: "Lesson done: 6, 4, 4 fillers" })).toBeNull();
    expect(rulesNoteShown(best, { scorable: true, earned: undefined })).toBeNull();
    expect(rulesNoteShown(null, { scorable: true, earned: "Best yet" })).toBeNull();
  });

  it("reads a stored take's mark safely", () => {
    expect(pauseRulesOf(null)).toBe(0);
    expect(pauseRulesOf({})).toBe(0);
    expect(pauseRulesOf({ pauseRules: "476" })).toBe(0);
    expect(pauseRulesOf({ pauseRules: PAUSE_RULES })).toBe(476);
  });

  it("rides on the glance's ceiling by its own words, up to its allowance", () => {
    expect(rulesBudget(25, null)).toBe(25);
    expect(rulesBudget(25, DELTA)).toBe(25 + countWords(DELTA));
    expect(rulesBudget(25, "word ".repeat(40))).toBe(25 + GLANCE_WORDS_RULES);
  });
});

describe("this phone's memory of the note", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is kept under its key, and a phone with no storage reads as not told", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(rulesNoteTold()).toBe(false);
    markRulesNoteTold();
    expect(store.get(RULES_NOTE_KEY)).toBe(String(PAUSE_RULES));
    expect(rulesNoteTold()).toBe(true);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("refused");
      },
      setItem: () => {
        throw new Error("refused");
      },
    });
    expect(rulesNoteTold()).toBe(false);
    expect(() => markRulesNoteTold()).not.toThrow();
  });
});

/*
 * The review (#491): the note is read off the route's answer in one call,
 * so the recorder's glance and Upload's results cannot drift apart, and
 * Upload carries it: an upload is a take, stored with the mark, so an
 * account whose first take under #476 was an upload would otherwise have
 * had its jump unexplained and the note ended unsaid.
 */
describe("the note read off an answer that just landed (#491 review)", () => {
  const answer = { pauseRules: PAUSE_RULES, ethosIndex: 673, previousIndex: 602, tier1: { pause: 73 }, mode: "daily" };

  it("is the same note rulesNote gives, from the answer's own fields", () => {
    expect(rulesNoteForAnswer(answer, [old(602, 26)], false)).toEqual({ kind: "delta", text: DELTA });
  });

  it("says nothing before the history is read, without a Pause score, or once told", () => {
    expect(rulesNoteForAnswer(answer, null, false)).toBeNull();
    expect(rulesNoteForAnswer(answer, undefined, false)).toBeNull();
    expect(rulesNoteForAnswer({ ...answer, tier1: null }, [old(602, 26)], false)).toBeNull();
    expect(rulesNoteForAnswer(answer, [old(602, 26)], true)).toBeNull();
  });

  it("never on an answer scored before the mark, nor one with no Index (capped or too short)", () => {
    expect(rulesNoteForAnswer({ ...answer, pauseRules: undefined }, [old(602, 26)], false)).toBeNull();
    expect(rulesNoteForAnswer({ ...answer, ethosIndex: null }, [old(602, 26)], false)).toBeNull();
  });

  it("reads a boss's answer against the bosses", () => {
    const prior = [old(602, 30, { mode: "boss" }), old(602, 40)];
    expect(rulesNoteForAnswer({ ...answer, mode: "boss", ethosIndex: 650 }, prior, false)?.text).toMatch(/went 30 to 73/);
  });

  it("is the one call on both screens that show a new take's delta, and each remembers it was told", () => {
    for (const file of ["app/rep/page.tsx", "app/upload/page.tsx"]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("rulesNoteForAnswer(");
      expect(src, file).toContain("rulesNoteTold()");
      expect(src, file).toContain("markRulesNoteTold()");
    }
    const upload = readFileSync("app/upload/page.tsx", "utf8");
    expect(upload).toContain("rulesNote={rulesText}");
    /* No "Best yet" stands on Upload, so its best note never shows there. */
    expect(upload).toMatch(/earned: null/);
    const result = readFileSync("components/RepResult.tsx", "utf8");
    expect(result.match(/data-rules-note/g)?.length).toBe(2);
  });
});
