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
 * The walk the stored step counts in. Until the room (#475), the walk
 * opened on three pitch screens (#209), so its steps ran two ahead: the
 * room stands where those three stood, and a step stored then carries no
 * mark. Layout 2 is the room's walk: the room 0, seven questions with
 * the beat before the hour, the plan 9, the account ask 10. Layout 3
 * (#501) is today's: the goal, the place and the beat went, so the room
 * 0, the name 1, the age 2, what you notice 3, how much you've practised
 * 4, the hour 5, the plan 6, the account ask 7.
 */
export const WALK_LAYOUT = 3;

/**
 * Layout 2's steps in today's walk (#501): a screen that went sends you
 * to the one that took its place, the next question, never back.
 *
 *   room name age goal pains level place beat hour plan ask
 *    0    1    2   3    4     5     6     7    8    9    10
 *    0    1    2   3    3     4     5     5    5    6    7
 */
const FROM_LAYOUT_2 = [0, 1, 2, 3, 3, 4, 5, 5, 5, 6, 7] as const;

/**
 * A stored step in today's walk. Someone who left part way through an
 * older walk lands on the screen they left, or the one that took its
 * place: the pitch's three screens become the room (step 0), and every
 * screen of the room's walk moves to where it stands now.
 */
export function stepFromStore(step: number, layout: unknown): number {
  if (layout === WALK_LAYOUT) return step;
  const two = layout === 2 ? step : step <= 2 ? 0 : step - 2;
  if (two < FROM_LAYOUT_2.length) return FROM_LAYOUT_2[two];
  /* Past the end stays past the end, never the account ask: a walk that
     resumes ON the account ask is one a Google attempt left there. */
  const last = FROM_LAYOUT_2.length - 1;
  return two - (last - FROM_LAYOUT_2[last]);
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
