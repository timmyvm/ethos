import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  BOSSES,
  CONTEXTS,
  GOALS,
  LEVELS,
  NAME_REPLY,
  OPENING,
  PAINS,
  TIMES,
} from "@/content/portfolio";
import { EMPTY_ANSWERS, type Answers } from "./answers";
import { UNITS } from "./path";
import { buildPortfolio, dayOneNote, poolFor, topicsFor } from "./portfolio";
import { TOPICS } from "./topics";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const budget = (s: string) => {
  expect(words(s)).toBeLessThanOrEqual(15);
  expect(s).not.toContain("—");
};

/**
 * content/portfolio.ts is the one editable mapping (DECISIONS #232);
 * these hold it to the road and to the copy rules, so an edit that
 * names a unit that doesn't exist, or writes a sixteen-word line,
 * fails here rather than on a phone.
 */
describe("the mapping", () => {
  it("names only units that exist on the road", () => {
    for (const p of PAINS) expect(UNITS.some((u) => u.id === p.unit)).toBe(true);
  });

  it("names only bosses that exist", () => {
    for (const g of GOALS) expect(BOSSES[g.boss]).toBeDefined();
  });

  it("keeps every tappable answer and headline inside the budget", () => {
    for (const list of [AGE_BANDS, GOALS, PAINS, LEVELS, CONTEXTS, TIMES]) {
      for (const o of list) budget(o.label);
    }
    for (const g of GOALS) budget(g.headline);
  });

  /**
   * Demos replies where an answer changes something and nods where it
   * does not (#249), and "something" means a NUMBER or a SETTING, not a
   * word in the plan.
   *
   * So: every pain replies, because each one names what gets measured.
   * Every level replies, because each one moves `frameStep` or
   * `intros`. Exactly one age band replies, the one whose prompt pool
   * is not "all". And the goal, the place and the hour say nothing —
   * the goal because the plan two screens later IS that answer and
   * saying it early spoils it, the place because it narrows the same
   * prompt pool the age question already spoke about, and the hour
   * because the only honest thing to say about it would be a promise
   * about notifications that nobody has granted yet.
   *
   * The point of the test is the rule, not the strings: adding a reply
   * to the goal table fails here, and that failure is the argument.
   */
  it("gives Demos a line only where the answer moves a number or a setting", () => {
    for (const p of PAINS) expect([p.id, Boolean(p.reply)]).toEqual([p.id, true]);
    for (const l of LEVELS) expect([l.id, Boolean(l.reply)]).toEqual([l.id, true]);
    for (const b of AGE_BANDS) {
      expect([b.id, Boolean(b.reply)]).toEqual([b.id, b.pool !== "all"]);
    }
    for (const list of [GOALS, CONTEXTS, TIMES]) {
      for (const o of list) expect(o).not.toHaveProperty("reply");
    }
  });

  it("keeps every reply and opening inside the budget", () => {
    const replies = [
      ...PAINS.map((p) => p.reply),
      ...LEVELS.map((l) => l.reply),
      ...AGE_BANDS.flatMap((b) => (b.reply ? [b.reply] : [])),
      NAME_REPLY("Tim"),
      OPENING.full("Tim", "trailing off"),
      OPENING.noName("trailing off"),
      OPENING.noPain("Tim"),
      OPENING.none,
    ];
    for (const r of replies) budget(r);
  });

  /**
   * A reply that praises the choice is the one kind of line this table
   * may not hold: the whole point is that the app heard a thing, not
   * that it approves of you (vision.md, and CLAUDE.md on manufactured
   * feeling).
   */
  it("never congratulates anybody for an answer", () => {
    const FLATTERY = /\b(great|nice|awesome|perfect|good choice|love (that|it)|excellent)\b/i;
    for (const r of [...PAINS.map((p) => p.reply), ...LEVELS.map((l) => l.reply)]) {
      expect([r, FLATTERY.test(r)]).toEqual([r, false]);
    }
  });

  /** The hours have to be hours Settings also offers, or the two
   *  screens disagree about what "evening" means. */
  it("offers only hours the settings screen offers", () => {
    const settings = [null, 7, 8, 12, 18, 20, 21];
    for (const t of TIMES) expect(settings).toContain(t.hour);
  });
});

describe("the portfolio", () => {
  const every: Answers[] = [EMPTY_ANSWERS];
  for (const g of GOALS)
    for (const p of PAINS)
      for (const l of LEVELS)
        every.push({ ...EMPTY_ANSWERS, ageBand: "18_24", goal: g.id, pains: [p.id], level: l.id });

  it("is three lines, each inside the budget, for every answer", () => {
    for (const a of every) {
      const plan = buildPortfolio(a);
      expect(plan.lines).toHaveLength(3);
      for (const l of [plan.headline, plan.line, ...plan.lines]) budget(l);
      if (plan.boss) budget(plan.boss.line);
    }
  });

  it("names the road's own gate for a later unit", () => {
    const pace = UNITS.find((u) => u.id === "pace")!;
    const plan = buildPortfolio({ ...EMPTY_ANSWERS, pains: ["rushing"] });
    expect(plan.lines[2]).toBe(
      `Then Pace Control, the unit for rushing. Opens at ${pace.unlocksAt} stars.`
    );
    expect(plan.focus?.unlocksAt).toBe(pace.unlocksAt);
  });

  it("keeps the first unit's pain on the first unit", () => {
    const plan = buildPortfolio({ ...EMPTY_ANSWERS, pains: ["fillers"] });
    expect(plan.lines[2]).toBe("Filler Elimination first. Every lesson in it targets fillers.");
  });

  it("leads with the first pain when there are several", () => {
    const plan = buildPortfolio({ ...EMPTY_ANSWERS, pains: ["freezing", "fillers"] });
    expect(plan.focus?.pain).toBe("freezing");
    expect(plan.lines[1]).toMatch(/^First number: silences/);
  });

  it("still has a plan when every question was skipped", () => {
    const plan = buildPortfolio(EMPTY_ANSWERS);
    expect(plan.headline).toBe("Your first month.");
    expect(plan.lines[1]).toBe("First number: your Ethos Index, out of 1000.");
    expect(plan.lines[2]).toBe("Then the road, one unit at a time.");
    expect(plan.boss).toBeNull();
    expect(plan.settings).toEqual({ frameStep: false, intros: true, reminderHour: null });
    expect(plan.opening).toBe("Sixty seconds a day, measured.");
    expect(plan.name).toBeNull();
  });

  it("sets the three defaults from the answers, and nothing else scores", () => {
    expect(buildPortfolio({ ...EMPTY_ANSWERS, level: "never" }).settings).toEqual({ frameStep: true, intros: true, reminderHour: null });
    expect(buildPortfolio({ ...EMPTY_ANSWERS, level: "often" }).settings).toEqual({ frameStep: false, intros: false, reminderHour: null });
    expect(buildPortfolio({ ...EMPTY_ANSWERS, time: "evening" }).settings.reminderHour).toBe(18);
    // "No reminder" and "never asked" resolve the same, on purpose.
    expect(buildPortfolio({ ...EMPTY_ANSWERS, time: "off" }).settings.reminderHour).toBeNull();
  });

  /*
   * Demos's opening line degrades rather than leaves a hole: the name
   * and the first thing they noticed are each skippable, so all four
   * combinations have to be a true sentence on their own (#249).
   */
  it("opens in their name and their words, and shortens when it cannot", () => {
    const both = buildPortfolio({ ...EMPTY_ANSWERS, name: "Tim", pains: ["rushing"] });
    expect(both.opening).toBe("Tim. You said rushing. From day one that's a number.");
    expect(buildPortfolio({ ...EMPTY_ANSWERS, pains: ["rushing"] }).opening).toBe(
      "You said rushing. From day one that's a number."
    );
    expect(buildPortfolio({ ...EMPTY_ANSWERS, name: "Tim" }).opening).toBe(
      "Tim. Sixty seconds a day, measured."
    );
    expect(buildPortfolio(EMPTY_ANSWERS).opening).toBe("Sixty seconds a day, measured.");
  });

  it("picks the boss from the goal", () => {
    expect(buildPortfolio({ ...EMPTY_ANSWERS, goal: "feet" }).boss?.name).toBe("Hostile Q&A");
    expect(buildPortfolio({ ...EMPTY_ANSWERS, goal: "present" }).boss?.name).toBe("Cold Topic");
  });

  it("repeats the answer back on day one, in their words", () => {
    expect(dayOneNote({ ...EMPTY_ANSWERS, pains: ["fillers", "rushing"] })).toBe(
      "You said: fillers, rushing. The baseline sets the number to beat."
    );
    expect(dayOneNote(EMPTY_ANSWERS)).toBeUndefined();
  });
});

describe("the prompt pool", () => {
  it("is school by age or by place", () => {
    expect(poolFor({ ...EMPTY_ANSWERS, ageBand: "u18" })).toBe("school");
    expect(poolFor({ ...EMPTY_ANSWERS, context: "class" })).toBe("school");
    expect(poolFor({ ...EMPTY_ANSWERS, ageBand: "25_34", context: "work" })).toBe("work");
    expect(poolFor(EMPTY_ANSWERS)).toBe("all");
  });

  it("drops the job prompts for school and nothing else", () => {
    const kept = topicsFor("school").map((t) => t.id);
    for (const id of ["t10", "t11", "t18"]) expect(kept).not.toContain(id);
    expect(kept).toContain("t19");
    expect(kept.length).toBe(TOPICS.length - 3);
    expect(topicsFor("work")).toBe(TOPICS);
    expect(topicsFor("all")).toBe(TOPICS);
  });
});
