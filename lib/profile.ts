/**
 * The self-diagnosis (DECISIONS #231).
 *
 * Two questions at the end of the introduction, answered by tap,
 * skippable, before any account and never in front of a paywall: what
 * you notice when you talk, and how old you are. The persona
 * self-diagnoses (vision.md: "we never have to convince them the
 * problem exists"), so the app asks what they noticed and builds the
 * first month's plan from it, in the path's own order, with the path's
 * own gates. Nothing here scores anything, and nothing here is a quiz
 * wall (#11): the mic is one tap away on every screen of it.
 *
 * Device-local first, because the answers exist before a session does;
 * upserted onto the profile once one exists, so the plan follows the
 * account to the next phone (the same rule as the equipped pose, #7's
 * successor in 0007). The remote copy wins when both exist, for the
 * same reason.
 */

import type { Unit } from "./path";
import { UNITS } from "./path";
import { spin, TOPICS, type Topic } from "./topics";

export type Goal = "fillers" | "pace" | "structure" | "fire";
export type AgeBand = "u18" | "18_24" | "25_34" | "35_plus";

export interface Profile {
  goal: Goal | null;
  ageBand: AgeBand | null;
  /** True once the account holds the same answers. */
  synced: boolean;
}

export const EMPTY_PROFILE: Profile = { goal: null, ageBand: null, synced: false };

/**
 * What you notice, in the words someone would tap. `said` is how the
 * app repeats it back ("You said: rushing."), and `unitId` is the unit
 * on the road that trains it, so the plan can name a real gate.
 */
export const GOALS: { id: Goal; label: string; said: string; unitId: string }[] = [
  { id: "fillers", label: "Um, like, you know", said: "fillers", unitId: "filler" },
  { id: "pace", label: "I rush", said: "rushing", unitId: "pace" },
  { id: "structure", label: "I lose the thread", said: "losing the thread", unitId: "structure" },
  { id: "fire", label: "I freeze on the spot", said: "freezing on the spot", unitId: "fire" },
];

export const AGE_BANDS: { id: AgeBand; label: string }[] = [
  { id: "u18", label: "Under 18" },
  { id: "18_24", label: "18 to 24" },
  { id: "25_34", label: "25 to 34" },
  { id: "35_plus", label: "35 and up" },
];

export function goalById(id: string | null | undefined) {
  return GOALS.find((g) => g.id === id) ?? null;
}

export function isGoal(v: unknown): v is Goal {
  return GOALS.some((g) => g.id === v);
}

export function isAgeBand(v: unknown): v is AgeBand {
  return AGE_BANDS.some((a) => a.id === v);
}

const KEY = "ethos.profile";

export function readProfile(): Profile {
  if (typeof localStorage === "undefined") return EMPTY_PROFILE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      goal: isGoal(p.goal) ? p.goal : null,
      ageBand: isAgeBand(p.ageBand) ? p.ageBand : null,
      synced: p.synced === true,
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function writeProfile(patch: Partial<Profile>): Profile {
  // A changed answer is an unsynced one until the account hears it.
  const next = { ...readProfile(), ...patch, synced: patch.synced ?? false };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/**
 * The plan, as the three lines the screen template allows (docs/voice.md
 * Part 2): day one, the first unit, and the unit that trains what was
 * noticed, with the star count that opens it. Every number is the
 * road's own; nothing is promised about the outcome.
 */
export function planFor(goal: Goal | null, units: Unit[] = UNITS): string[] {
  const first = units.find((u) => !u.boss && u.unlocksAt === 0) ?? units[0];
  const lines = [
    "Day 1: The baseline. Sixty seconds, measured.",
    `Then ${first.name}: ${first.lessons.length} lessons, ${lessonsWord(first.lessons.length)}.`,
  ];
  const target = goal ? units.find((u) => u.id === goalById(goal)?.unitId) : null;
  if (!target) {
    lines.push("Then the road, one unit at a time.");
  } else if (target.id === first.id) {
    lines.push("Every lesson in it targets what you noticed.");
  } else {
    lines.push(
      `Then ${target.name}, the unit for ${goalById(goal)!.said}. Opens at ${target.unlocksAt} stars.`
    );
  }
  return lines;
}

function lessonsWord(n: number): string {
  return n === 1 ? "one a day" : `about ${n} days`;
}

/**
 * The one thing age changes (and the age screen says so): the roulette
 * pool. Under 18, the prompts about your job and your workplace go,
 * because a prompt you can't answer wastes the recording.
 */
const WORK_TOPICS = new Set(["t10", "t11", "t18"]);

export function topicsFor(ageBand: AgeBand | null, pool: Topic[]): Topic[] {
  if (ageBand !== "u18") return pool;
  const kept = pool.filter((t) => !WORK_TOPICS.has(t.id));
  return kept.length > 0 ? kept : pool;
}

/** The roulette, drawn from this device's pool. */
export function spinForProfile(exclude: string | null): Topic {
  return spin(exclude, Math.random, topicsFor(readProfile().ageBand, TOPICS));
}

/** The floor's day-one line, in the person's own words. */
export function dayOneNote(goal: Goal | null): string | undefined {
  const g = goalById(goal);
  return g ? `You said: ${g.said}. The baseline sets the number to beat.` : undefined;
}
