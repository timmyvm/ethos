import { describe, expect, it } from "vitest";
import { AGE_BANDS, BOSSES, CONTEXTS, GOALS, LEVELS, PAINS } from "@/content/portfolio";
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
    for (const list of [AGE_BANDS, GOALS, PAINS, LEVELS, CONTEXTS]) {
      for (const o of list) budget(o.label);
    }
    for (const g of GOALS) budget(g.headline);
  });
});

describe("the portfolio", () => {
  const every: Answers[] = [EMPTY_ANSWERS];
  for (const g of GOALS)
    for (const p of PAINS)
      for (const l of LEVELS)
        every.push({ name: null, ageBand: "18_24", goal: g.id, pains: [p.id], level: l.id, context: null });

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
    expect(plan.settings).toEqual({ frameStep: false, intros: true });
  });

  it("sets the two defaults from the level, and nothing else scores", () => {
    expect(buildPortfolio({ ...EMPTY_ANSWERS, level: "never" }).settings).toEqual({ frameStep: true, intros: true });
    expect(buildPortfolio({ ...EMPTY_ANSWERS, level: "often" }).settings).toEqual({ frameStep: false, intros: false });
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
