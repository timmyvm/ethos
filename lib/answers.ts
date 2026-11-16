/**
 * The introduction's answers (DECISIONS #232), on this device.
 *
 * Given before any session exists, so they live in localStorage first,
 * with the step the walk reached, so a refresh resumes where it was.
 * `lib/answers-sync.ts` moves them to the account once one exists.
 * Every field is validated against `content/portfolio.ts` on read, so
 * an edited or stale value can never reach a screen.
 */

import {
  AGE_BANDS,
  CONTEXTS,
  GOALS,
  LEVELS,
  PAINS,
  TIMES,
} from "@/content/portfolio";

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];
export type GoalId = (typeof GOALS)[number]["id"];
export type PainId = (typeof PAINS)[number]["id"];
export type LevelId = (typeof LEVELS)[number]["id"];
export type ContextId = (typeof CONTEXTS)[number]["id"];
export type TimeId = (typeof TIMES)[number]["id"];

/** Up to three: more than that is a list, not a focus. */
export const MAX_PAINS = 3;

/**
 * The cap on what they call themselves. One number, here rather than in
 * `lib/client-data.ts`, because the same string is now an introduction
 * answer AND `profiles.display_name`, and two caps on one string is a
 * bug waiting for a 25-character name.
 */
export const MAX_NAME = 24;

export interface Answers {
  /** What Demos calls them. Given before any account exists. */
  name: string | null;
  ageBand: AgeBandId | null;
  goal: GoalId | null;
  pains: PainId[];
  level: LevelId | null;
  context: ContextId | null;
  /**
   * When the daily nudge fires. Kept HERE as well as in prefs, because
   * prefs only knows the hour and "no reminder" and "not asked yet" are
   * both a null hour — and a walk has to know whether its seventh
   * question was answered.
   */
  time: TimeId | null;
}

export interface OnboardingState {
  answers: Answers;
  /** The walk's step, so a refresh lands where it left off. */
  step: number;
  /** The plan was shown: the walk is finished. */
  done: boolean;
  /** The account holds the same answers. */
  synced: boolean;
}

export const EMPTY_ANSWERS: Answers = {
  name: null,
  ageBand: null,
  goal: null,
  pains: [],
  level: null,
  context: null,
  time: null,
};

export const EMPTY_STATE: OnboardingState = {
  answers: EMPTY_ANSWERS,
  step: 0,
  done: false,
  synced: false,
};

const has = (list: readonly { id: string }[], v: unknown) =>
  typeof v === "string" && list.some((x) => x.id === v);

export const isAgeBand = (v: unknown): v is AgeBandId => has(AGE_BANDS, v);
export const isGoal = (v: unknown): v is GoalId => has(GOALS, v);
export const isPain = (v: unknown): v is PainId => has(PAINS, v);
export const isLevel = (v: unknown): v is LevelId => has(LEVELS, v);
export const isContext = (v: unknown): v is ContextId => has(CONTEXTS, v);
export const isTime = (v: unknown): v is TimeId => has(TIMES, v);

/** Trimmed, capped, and blank is the same as never answered. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, MAX_NAME).trim();
  return clean.length > 0 ? clean : null;
}

/** Anything unknown becomes null; pains are deduplicated and capped. */
export function cleanAnswers(raw: Partial<Answers> | null | undefined): Answers {
  const pains = Array.isArray(raw?.pains)
    ? raw!.pains.filter(isPain).filter((p, i, all) => all.indexOf(p) === i).slice(0, MAX_PAINS)
    : [];
  return {
    name: cleanName(raw?.name),
    ageBand: isAgeBand(raw?.ageBand) ? raw!.ageBand : null,
    goal: isGoal(raw?.goal) ? raw!.goal : null,
    pains,
    level: isLevel(raw?.level) ? raw!.level : null,
    context: isContext(raw?.context) ? raw!.context : null,
    time: isTime(raw?.time) ? raw!.time : null,
  };
}

export function answered(a: Answers): boolean {
  return (
    a.name !== null ||
    a.ageBand !== null ||
    a.goal !== null ||
    a.pains.length > 0 ||
    a.level !== null ||
    a.context !== null ||
    a.time !== null
  );
}

const KEY = "ethos.onboarding";

/**
 * The walk the stored step counts in (#475). Until the room, the walk
 * opened on three pitch screens (#209), so its steps ran two ahead of
 * today's: the room stands where those three stood. A step stored then
 * carries no mark; every write since carries this one.
 */
export const WALK_LAYOUT = 2;

/**
 * A stored step in today's walk. Someone who left part way through the
 * old walk lands on the question they left, never two further on: the
 * pitch's three screens become the room (step 0), and every screen after
 * them moves up two, the plan and the account ask included.
 */
export function stepFromStore(step: number, layout: unknown): number {
  if (layout === WALK_LAYOUT) return step;
  return step <= 2 ? 0 : step - 2;
}

export function readOnboarding(): OnboardingState {
  if (typeof localStorage === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const p = JSON.parse(raw) as Partial<OnboardingState> & { walk?: unknown };
    return {
      answers: cleanAnswers(p.answers),
      step: Number.isInteger(p.step) && (p.step as number) >= 0 ? stepFromStore(p.step as number, p.walk) : 0,
      done: p.done === true,
      synced: p.synced === true,
    };
  } catch {
    return EMPTY_STATE;
  }
}

/**
 * A changed answer is unsynced until the account hears it; a caller
 * that only moves the step, or marks the sync, says so explicitly.
 */
export function writeOnboarding(patch: Partial<OnboardingState>): OnboardingState {
  const current = readOnboarding();
  const next: OnboardingState = {
    ...current,
    ...patch,
    answers: patch.answers ? cleanAnswers(patch.answers) : current.answers,
    synced: patch.synced ?? (patch.answers ? false : current.synced),
  };
  try {
    /* Marked with today's walk, so the step is never moved twice. */
    localStorage.setItem(KEY, JSON.stringify({ ...next, walk: WALK_LAYOUT }));
  } catch {}
  return next;
}
