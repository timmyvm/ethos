/**
 * The portfolio (DECISIONS #232): the first month's plan, in the
 * person's own words, built from the introduction's answers and the
 * table in content/portfolio.ts. Pure, so a stored one can be rebuilt
 * whenever the table's version moves.
 *
 * It names the first number, the unit for what was noticed with the
 * road's own gate, and the boss, and it sets two defaults. It never
 * scores anything, never reorders the road, never awards a star.
 */

import {
  AGE_BANDS,
  BOSSES,
  CONTEXTS,
  GOALS,
  LEVELS,
  OPENING,
  PAINS,
  PLAN_LINES,
  PORTFOLIO_RULES_VERSION,
  TIMES,
  type Pool,
} from "@/content/portfolio";
import { type Answers, type PainId, readOnboarding } from "./answers";
import { UNITS, type Unit } from "./path";
import { spin, TOPICS, type Topic } from "./topics";

export interface Portfolio {
  headline: string;
  line: string;
  /** What Demos calls them, or null if they skipped it. */
  name: string | null;
  /**
   * Demos's first line to them, in place of `line` on the plan screen.
   * Built from the name and the first thing they said they notice, and
   * degrading to a shorter true sentence when either is missing.
   */
  opening: string;
  /** The three lines of the screen template, in order. */
  lines: string[];
  /** What was noticed first, and where the road trains it. */
  focus: {
    pain: PainId;
    said: string;
    metric: string;
    unitId: string;
    unitName: string;
    unlocksAt: number;
  } | null;
  boss: { id: keyof typeof BOSSES; name: string; href: string; line: string } | null;
  settings: { frameStep: boolean; intros: boolean; reminderHour: number | null };
  pool: Pool;
  rulesVersion: number;
}

export function buildPortfolio(a: Answers, units: Unit[] = UNITS): Portfolio {
  const goal = GOALS.find((g) => g.id === a.goal) ?? null;
  const pain = PAINS.find((p) => p.id === a.pains[0]) ?? null;
  const level = LEVELS.find((l) => l.id === a.level) ?? null;
  const first = units.find((u) => !u.boss && u.unlocksAt === 0) ?? units[0];
  const unit = pain ? (units.find((u) => u.id === pain.unit) ?? null) : null;

  const lines = [
    PLAN_LINES.dayOne,
    pain ? PLAN_LINES.firstNumber(pain.line) : PLAN_LINES.firstNumberDefault,
    !pain || !unit
      ? PLAN_LINES.road
      : unit.id === first.id
        ? PLAN_LINES.firstUnit(unit.name, pain.said)
        : PLAN_LINES.laterUnit(unit.name, pain.said, unit.unlocksAt),
  ];

  const boss = goal
    ? { id: goal.boss, ...BOSSES[goal.boss], line: PLAN_LINES.boss(BOSSES[goal.boss].name) }
    : null;

  const name = a.name;
  const opening =
    name !== null && pain !== null
      ? OPENING.full(name, pain.said)
      : name === null && pain !== null
        ? OPENING.noName(pain.said)
        : name !== null
          ? OPENING.noPain(name)
          : OPENING.none;

  return {
    headline: goal?.headline ?? PLAN_LINES.headlineDefault,
    line: PLAN_LINES.line,
    name,
    opening,
    lines,
    focus:
      pain && unit
        ? {
            pain: pain.id,
            said: pain.said,
            metric: pain.metric,
            unitId: unit.id,
            unitName: unit.name,
            unlocksAt: unit.unlocksAt,
          }
        : null,
    boss,
    settings: {
      frameStep: level?.frameStep ?? false,
      intros: level?.intros ?? true,
      // null covers both "no reminder" and "never answered": the
      // outcome is the same, so the walk does not need them apart here.
      reminderHour: TIMES.find((t) => t.id === a.time)?.hour ?? null,
    },
    pool: poolFor(a),
    rulesVersion: PORTFOLIO_RULES_VERSION,
  };
}

/** Where the answer says school (by age or by place), the pool is school. */
export function poolFor(a: Answers): Pool {
  const byAge = AGE_BANDS.find((b) => b.id === a.ageBand)?.pool ?? "all";
  const byPlace = CONTEXTS.find((c) => c.id === a.context)?.pool ?? "all";
  if (byAge === "school" || byPlace === "school") return "school";
  return byPlace !== "all" ? byPlace : byAge;
}

/** A prompt lists the pools it doesn't fit; the pool drops those. */
export function topicsFor(pool: Pool, topics: Topic[] = TOPICS): Topic[] {
  const kept = topics.filter((t) => !t.not?.includes(pool));
  return kept.length > 0 && kept.length < topics.length ? kept : topics;
}

/** The roulette, drawn from this device's pool. */
export function spinForAnswers(exclude: string | null): Topic {
  return spin(exclude, Math.random, topicsFor(poolFor(readOnboarding().answers)));
}

/** The floor's day-one line, in their words: "fillers, rushing". */
export function dayOneNote(a: Answers): string | undefined {
  const said: string[] = a.pains.flatMap((id) => {
    const p = PAINS.find((x) => x.id === id);
    return p ? [p.said] : [];
  });
  return said.length > 0 ? PLAN_LINES.dayOneNote(said.join(", ")) : undefined;
}
