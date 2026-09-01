/**
 * The progression layer — one pure module that answers "how far am I,
 * and what's the very next thing I'm about to earn".
 *
 * Built on four findings (docs/progression-research.md):
 *
 * 1. Progress in meaningful work is the strongest motivator there is
 *    (Amabile & Kramer, 12,000 diary entries). So progress gets the
 *    first screen, not a settings sub-page.
 * 2. Goal-gradient: effort rises as perceived distance to the goal
 *    falls. So we surface the CLOSEST milestone first, always, with the
 *    exact remaining count.
 * 3. Endowed progress (Nunes & Drèze 2006): reframing a task as
 *    "started but unfinished" rather than "not begun" nearly doubled
 *    completion — with a visible, admittedly-free head start. The
 *    reframe does the work, not the deception. So the rail opens with a
 *    filled node for something the user genuinely did (showed up), and
 *    never with a fake star.
 * 4. Rewards raise motivation when they carry INFORMATION and depress
 *    it when they read as control (SDT gamification meta-analysis;
 *    Hattie & Timperley put self-level praise among the least effective
 *    feedback). So every milestone here names its number. A milestone
 *    that can't state what it measures doesn't ship.
 */

import type { Achievement } from "./achievements";
import type { RepRow } from "./client-data";
import { levelFromXp, xpForLevel } from "./level";
import { MAX_STARS, UNITS, totalStars, unitStates } from "./path";
import { MAX_EQUIPPED_FREEZES, type StreakState } from "./streak";

/** Duolingo's published streak thresholds — where loss aversion bites. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/** Index bands. Round numbers people aim at, not participation tiers. */
export const INDEX_BANDS = [500, 600, 700, 800, 900];

export type MilestoneKind =
  | "star"
  | "streak"
  | "level"
  | "freeze"
  | "index"
  | "badge";

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  /** What you get. */
  label: string;
  /** The number that unlocks it. Never empty — that's the point. */
  detail: string;
  current: number;
  target: number;
  /** 0–1, clamped. */
  progress: number;
  remaining: number;
  /**
   * The gap in words. Countable milestones say "3 to go"; a badge whose
   * progress is only a proportion says "86% there" instead of inventing
   * a unit. Every row still carries a number — it just has to be a
   * number that means something.
   */
  remainingLabel: string;
}

function milestone(
  m: Omit<Milestone, "progress" | "remaining" | "remainingLabel">
): Milestone | null {
  const remaining = m.target - m.current;
  if (remaining <= 0) return null;
  return {
    ...m,
    remaining,
    remainingLabel: `${Math.round(remaining)} to go`,
    progress: m.target > 0 ? Math.min(1, Math.max(0, m.current / m.target)) : 0,
  };
}

function nextIn(list: number[], current: number): number | null {
  return list.find((n) => n > current) ?? null;
}

export interface ProgressInput {
  reps: RepRow[];
  starMap: Record<string, number>;
  streak: StreakState;
  xp: number;
  freezesEquipped: number;
  achievements: Achievement[];
}

/**
 * Every milestone the user is currently working toward, closest first.
 * Goal-gradient says proximity is what moves effort, so the ordering is
 * the feature — not an implementation detail.
 */
export function nextMilestones(input: ProgressInput): Milestone[] {
  const { reps, starMap, streak, xp, freezesEquipped, achievements } = input;
  const out: (Milestone | null)[] = [];

  /*
   * The next unit unlock is NOT a milestone (#215, Timothy's call).
   *
   * It was here as the biggest structural reward available, and as the
   * closest by proximity it won the pre-record cue almost every time,
   * so the last line before the Record tap read "Unlock Pace Control ·
   * 4 to go": a unit you are not in, four stars away, on the one screen
   * whose whole job is the next sixty seconds. The road already carries
   * the gate and its star cost, which is where somebody choosing what
   * to train is actually looking (#44, #156). Anticipation keeps its
   * surface (#48); what it names is now something this recording can
   * actually move.
   */

  // Next star on a lesson that isn't maxed — the smallest real win.
  for (const unit of unitStates(starMap)) {
    if (unit.locked || unit.boss) continue;
    const lesson = unit.lessons.find((l) => (starMap[l.id] ?? 0) < 3);
    if (!lesson) continue;
    const have = starMap[lesson.id] ?? 0;
    out.push(
      milestone({
        id: `star-${lesson.id}`,
        kind: "star",
        label: `${have + 1}★ on ${lesson.title}`,
        detail:
          have === 0
            ? "first star: any recording that clears the threshold"
            : `${have} of 3 earned`,
        current: have,
        target: have + 1,
      })
    );
    break;
  }

  const nextStreak = nextIn(STREAK_MILESTONES, streak.current);
  if (nextStreak) {
    out.push(
      milestone({
        id: `streak-${nextStreak}`,
        kind: "streak",
        label: `${nextStreak}-day streak`,
        detail: `${streak.current} days now`,
        current: streak.current,
        target: nextStreak,
      })
    );
  }

  const level = levelFromXp(xp);
  out.push(
    milestone({
      id: `level-${level.level + 1}`,
      kind: "level",
      label: `Level ${level.level + 1}`,
      detail: `${xp} of ${xpForLevel(level.level + 1)} XP`,
      current: level.intoLevel,
      target: level.forNext,
    })
  );

  // Freezes are earned per full week of streak (DECISIONS #38).
  if (freezesEquipped < MAX_EQUIPPED_FREEZES) {
    const nextFreezeAt = (Math.floor(streak.longest / 7) + 1) * 7;
    out.push(
      milestone({
        id: `freeze-${nextFreezeAt}`,
        kind: "freeze",
        label: "Earn a streak freeze",
        detail: `${nextFreezeAt}-day streak, best is ${streak.longest}`,
        current: streak.longest,
        target: nextFreezeAt,
      })
    );
  }

  const bestIndex = reps.reduce((a, r) => Math.max(a, r.ethos_index ?? 0), 0);
  const nextBand = nextIn(INDEX_BANDS, bestIndex);
  if (nextBand && bestIndex > 0) {
    out.push(
      milestone({
        id: `index-${nextBand}`,
        kind: "index",
        label: `Ethos ${nextBand}`,
        detail: `best is ${bestIndex}`,
        current: bestIndex,
        target: nextBand,
      })
    );
  }

  // The closest unearned badge, and only that one — a wall of locked
  // badges reads as a list of failures.
  const badge = achievements
    .filter((a) => !a.earned && a.progress > 0)
    .sort((a, b) => b.progress - a.progress)[0];
  if (badge) {
    out.push({
      id: `badge-${badge.id}`,
      kind: "badge",
      label: badge.name,
      detail: badge.requirement,
      current: Math.round(badge.progress * 100),
      target: 100,
      progress: badge.progress,
      remaining: Math.max(1, Math.round((1 - badge.progress) * 100)),
      remainingLabel: `${Math.round(badge.progress * 100)}% there`,
    });
  }

  // A badge often shadows a structural milestone — "Ethos 700" is both
  // an Index band and a badge. Two identical rows read as a bug and
  // halve the information on screen, so the nearer one wins.
  const byLabel = new Map<string, Milestone>();
  for (const m of out.filter(Boolean) as Milestone[]) {
    const key = m.label.trim().toLowerCase();
    const seen = byLabel.get(key);
    if (!seen || m.progress > seen.progress) byLabel.set(key, m);
  }

  return [...byLabel.values()].sort((a, b) => b.progress - a.progress);
}

export interface JourneyStep {
  id: string;
  label: string;
  /** 0–3 for lessons; endowed steps are simply done or not. */
  stars: number;
  maxStars: number;
  done: boolean;
  locked: boolean;
  unitName: string;
  /** True for the leading "you showed up" node (endowed progress). */
  endowed: boolean;
  /** Boss lessons live on /boss, not /rep?lesson=. */
  boss: boolean;
  lessonId: string | null;
}

/**
 * The rail: one node per lesson, led by a node for something the user
 * actually did. Nunes & Drèze's head start was visible and free and
 * still worked — what moves people is the task reading as *underway*.
 * So this node is labelled honestly and carries no stars.
 */
export function journeySteps(
  starMap: Record<string, number>,
  hasAnyRep: boolean
): JourneyStep[] {
  const steps: JourneyStep[] = [
    {
      id: "start",
      label: "Showed up",
      stars: 0,
      maxStars: 0,
      done: true,
      locked: false,
      unitName: "Start",
      endowed: true,
      boss: false,
      lessonId: null,
    },
  ];

  for (const unit of unitStates(starMap)) {
    for (const lesson of unit.lessons) {
      const stars = starMap[lesson.id] ?? 0;
      steps.push({
        id: lesson.id,
        label: lesson.title,
        stars,
        maxStars: 3,
        done: stars > 0,
        locked: unit.locked,
        unitName: unit.name,
        endowed: false,
        boss: unit.boss ?? false,
        lessonId: lesson.id,
      });
    }
  }

  // Before the first rep the second node reads as "in progress", so the
  // rail is never an empty row of grey.
  if (!hasAnyRep && steps[1]) steps[1].done = false;
  return steps;
}

export interface JourneySummary {
  stars: number;
  maxStars: number;
  /** Share of all available stars, 0–1. */
  pct: number;
  lessonsStarted: number;
  lessonsMastered: number;
  totalLessons: number;
  unitsOpen: number;
  totalUnits: number;
}

export function journeySummary(
  starMap: Record<string, number>
): JourneySummary {
  const states = unitStates(starMap);
  const lessons = UNITS.flatMap((u) => u.lessons);
  const stars = totalStars(starMap);
  return {
    stars,
    maxStars: MAX_STARS,
    pct: MAX_STARS > 0 ? stars / MAX_STARS : 0,
    lessonsStarted: lessons.filter((l) => (starMap[l.id] ?? 0) > 0).length,
    lessonsMastered: lessons.filter((l) => (starMap[l.id] ?? 0) === 3).length,
    totalLessons: lessons.length,
    unitsOpen: states.filter((u) => !u.locked).length,
    totalUnits: states.length,
  };
}

/**
 * What this rep changed, in numbers. Shown once, on the results screen.
 * Task-level feedback (Hattie & Timperley) — never "great job".
 */
export interface RepGain {
  label: string;
  detail: string;
  /** False when the number moved the wrong way (#195): the chip wears
   *  terracotta instead of sage. Absent = a gain. */
  good?: boolean;
}

export function repGains(params: {
  starsBefore: number;
  starsAfter: number;
  indexBefore: number | null;
  indexAfter: number | null;
  streakAfter: number;
  unlockedUnit: string | null;
}): RepGain[] {
  const gains: RepGain[] = [];
  const starDelta = params.starsAfter - params.starsBefore;
  if (starDelta > 0) {
    gains.push({
      label: `+${starDelta}★`,
      detail: `${params.starsAfter} of ${MAX_STARS} stars`,
    });
  }
  if (params.indexAfter !== null && params.indexBefore !== null) {
    const d = params.indexAfter - params.indexBefore;
    if (d !== 0) {
      gains.push({
        label: `${d > 0 ? "+" : ""}${d} Ethos`,
        detail: `${params.indexBefore} → ${params.indexAfter}`,
        ...(d < 0 ? { good: false } : {}),
      });
    }
  }
  if (params.streakAfter > 0) {
    gains.push({
      label: `${params.streakAfter}-day streak`,
      detail: params.streakAfter === 1 ? "day one" : "kept alive",
    });
  }
  if (params.unlockedUnit) {
    gains.push({
      label: `${params.unlockedUnit} unlocked`,
      detail: "new unit open on the path",
    });
  }
  return gains;
}
