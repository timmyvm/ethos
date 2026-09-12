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
} from "@/content/portfolio";

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];
export type GoalId = (typeof GOALS)[number]["id"];
export type PainId = (typeof PAINS)[number]["id"];
export type LevelId = (typeof LEVELS)[number]["id"];
export type ContextId = (typeof CONTEXTS)[number]["id"];

/** Up to three: more than that is a list, not a focus. */
export const MAX_PAINS = 3;

export interface Answers {
  ageBand: AgeBandId | null;
  goal: GoalId | null;
  pains: PainId[];
  level: LevelId | null;
  context: ContextId | null;
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
  ageBand: null,
  goal: null,
  pains: [],
  level: null,
  context: null,
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

/** Anything unknown becomes null; pains are deduplicated and capped. */
export function cleanAnswers(raw: Partial<Answers> | null | undefined): Answers {
  const pains = Array.isArray(raw?.pains)
    ? raw!.pains.filter(isPain).filter((p, i, all) => all.indexOf(p) === i).slice(0, MAX_PAINS)
    : [];
  return {
    ageBand: isAgeBand(raw?.ageBand) ? raw!.ageBand : null,
    goal: isGoal(raw?.goal) ? raw!.goal : null,
    pains,
    level: isLevel(raw?.level) ? raw!.level : null,
    context: isContext(raw?.context) ? raw!.context : null,
  };
}

export function answered(a: Answers): boolean {
  return (
    a.ageBand !== null ||
    a.goal !== null ||
    a.pains.length > 0 ||
    a.level !== null ||
    a.context !== null
  );
}

const KEY = "ethos.onboarding";

export function readOnboarding(): OnboardingState {
  if (typeof localStorage === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const p = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      answers: cleanAnswers(p.answers),
      step: Number.isInteger(p.step) && (p.step as number) >= 0 ? (p.step as number) : 0,
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
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
