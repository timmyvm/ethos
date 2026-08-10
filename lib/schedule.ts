/**
 * Why come back tomorrow.
 *
 * The honest diagnosis (Timothy, 10 Aug): a rep felt like one-time
 * feedback. Nothing carried from one day to the next, so there was no
 * reason today's session would differ from yesterday's — and no reason
 * to open the app again.
 *
 * Duolingo's answer to the same problem is published and it is NOT the
 * streak. Settles & Meeder (ACL 2016) fit a half-life regression per
 * learner per word: the model estimates when memory strength decays to
 * 50%, and practice is scheduled just before recall drops. The reason
 * to return is that the app holds a model of what YOU are about to
 * lose. Their reported result was a 45%+ error reduction over baselines
 * at predicting recall.
 *
 * The transferable principle is the scheduling, not the vocabulary:
 * measure per-skill decay for this user, and let it choose what's next.
 *
 * Here that means the four MEASURED skills (the Tier-1 Index
 * dimensions — no LLM, DECISIONS #30). Strength combines how well the
 * skill last scored with how long ago that was, decaying on a half-life.
 * The weakest is what tomorrow trains, and the app says which number
 * made that call.
 */

import type { RepRow } from "./client-data";
import { UNITS } from "./path";

export type Skill = "fillers" | "pace" | "pause" | "range";

export const SKILLS: {
  id: Skill;
  label: string;
  unitId: string | null;
  /** What the number actually measures, in the user's words. */
  measures: string;
}[] = [
  {
    id: "fillers",
    label: "Fillers",
    unitId: "filler",
    measures: "fillers per minute",
  },
  { id: "pace", label: "Pace", unitId: "pace", measures: "words per minute" },
  {
    id: "pause",
    label: "The pause",
    unitId: "pause",
    measures: "pauses you held on purpose",
  },
  {
    id: "range",
    label: "Range",
    unitId: null,
    measures: "distinct words vs repeats",
  },
];

/**
 * Days for an un-practised skill to fall to half strength.
 *
 * A guess, and flagged as one — Duolingo FITS this per item from
 * millions of traces; we have one user and no data yet. Seven days is
 * chosen so a week away halves you, which matches the streak
 * thresholds. Calibrate against real reps (open queue).
 */
export const HALF_LIFE_DAYS = 7;

export interface SkillState {
  skill: Skill;
  label: string;
  /** Latest measured score for the skill, 0–100. Null before any rep. */
  score: number | null;
  /** Whole days since the most recent rep that measured it. */
  daysSince: number | null;
  /** 0–1. Score, decayed by time away. Null before any rep. */
  strength: number | null;
  /** Change against the previous rep that measured it. */
  delta: number | null;
}

function daysBetween(a: Date, b: Date): number {
  const d = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.max(
    0,
    Math.round((d(b).getTime() - d(a).getTime()) / 86_400_000)
  );
}

function scoreOf(rep: RepRow, skill: Skill): number | null {
  const t1 = rep.dimensions?.tier1;
  if (!t1) return null;
  const v = t1[skill];
  return typeof v === "number" ? v : null;
}

export function decay(days: number, halfLife = HALF_LIFE_DAYS): number {
  return Math.pow(0.5, days / halfLife);
}

export function skillStates(reps: RepRow[], now = new Date()): SkillState[] {
  return SKILLS.map(({ id, label }) => {
    const scored = reps
      .filter((r) => scoreOf(r, id) !== null)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    if (scored.length === 0) {
      return {
        skill: id,
        label,
        score: null,
        daysSince: null,
        strength: null,
        delta: null,
      };
    }

    const last = scored[scored.length - 1];
    const score = scoreOf(last, id) as number;
    const prev =
      scored.length > 1 ? scoreOf(scored[scored.length - 2], id) : null;
    const daysSince = daysBetween(new Date(last.created_at), now);

    return {
      skill: id,
      label,
      score,
      daysSince,
      strength: Math.max(0, Math.min(1, score / 100)) * decay(daysSince),
      delta: prev === null ? null : score - prev,
    };
  });
}

export interface NextFocus {
  skill: Skill;
  label: string;
  /** The unit to train it, when one exists. */
  unitId: string | null;
  lessonId: string | null;
  /** Why this one — always carries the number that decided it. */
  reason: string;
  /** Null until there's a rep to reason from. */
  strength: number | null;
}

/**
 * What tomorrow trains, and the number that chose it.
 *
 * Never "you're doing great" — the reason is always the measurement, so
 * the user can check the call against their own log.
 */
export function nextFocus(reps: RepRow[], now = new Date()): NextFocus {
  const states = skillStates(reps, now);
  const measured = states.filter((s) => s.strength !== null);

  if (measured.length === 0) {
    return {
      skill: "fillers",
      label: "Fillers",
      unitId: "filler",
      lessonId: UNITS.find((u) => u.id === "filler")?.lessons[0]?.id ?? null,
      reason: "First rep sets your baseline. Nothing to aim at yet.",
      strength: null,
    };
  }

  const weakest = measured.reduce((a, b) =>
    (a.strength as number) <= (b.strength as number) ? a : b
  );
  const meta = SKILLS.find((s) => s.id === weakest.skill)!;
  const unit = meta.unitId
    ? UNITS.find((u) => u.id === meta.unitId) ?? null
    : null;

  const parts = [`${weakest.label} scored ${weakest.score}/100`];
  if (weakest.delta !== null && weakest.delta !== 0) {
    parts.push(
      `${weakest.delta > 0 ? "up" : "down"} ${Math.abs(weakest.delta)} on the rep before`
    );
  }
  if ((weakest.daysSince ?? 0) >= 2) {
    parts.push(`and it's been ${weakest.daysSince} days`);
  }

  return {
    skill: weakest.skill,
    label: weakest.label,
    unitId: meta.unitId,
    lessonId: unit?.lessons[0]?.id ?? null,
    reason: `${parts.join(", ")} — your weakest right now.`,
    strength: weakest.strength,
  };
}

/**
 * Everything decays while you're away, so a gap is worth naming — but
 * only as a fact, never a scolding (DECISIONS #26).
 */
export function decayNote(reps: RepRow[], now = new Date()): string | null {
  if (reps.length === 0) return null;
  const last = reps.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  );
  const days = daysBetween(new Date(last.created_at), now);
  if (days < 3) return null;
  const pct = Math.round((1 - decay(days)) * 100);
  return `${days} days since your last rep. On our curve that's about ${pct}% off every score — one rep re-measures it.`;
}
