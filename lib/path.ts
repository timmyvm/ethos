/**
 * The path — units → lessons → stars (mechanics.md progression).
 * Stars are earned from rep metrics only (DECISIONS #10): the best
 * star ever earned on a lesson sticks, replays can raise it, nothing
 * is awarded for showing up.
 *
 * Star totals gate unit unlocks. Boss units stay premium (DECISIONS #13).
 */

import { DRILLS, type Drill } from "./drills";

export interface Unit {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  /** Stars needed across earlier units before this one opens. */
  unlocksAt: number;
  boss?: boolean;
  lessons: Drill[];
}

const BOSS_LESSONS: Drill[] = [
  {
    id: "b1",
    unit: "Cold Topic",
    title: "Boss: unknown territory",
    prompt:
      "A topic you've never studied. 4 minutes to research, 90 seconds to explain it — scored on delivery AND accuracy.",
  },
  {
    id: "b2",
    unit: "Cold Topic",
    title: "Boss: hostile Q&A",
    prompt:
      "Give a 60-second take. Demos interrupts with skeptical questions. Scored on composure and pause quality under pressure.",
  },
];

function lessonsFor(unitName: string): Drill[] {
  return DRILLS.filter((d) => d.unit === unitName);
}

export const UNITS: Unit[] = [
  {
    id: "filler",
    name: "Filler Elimination",
    icon: "✂️",
    blurb: "Cut the noise. Every 'um' you drop is a second of authority back.",
    unlocksAt: 0,
    lessons: lessonsFor("Filler Elimination"),
  },
  {
    id: "pace",
    name: "Pace Control",
    icon: "⏱",
    blurb: "130–160 words a minute. Fast enough to hold, slow enough to land.",
    unlocksAt: 4,
    lessons: lessonsFor("Pace Control"),
  },
  {
    id: "pause",
    name: "The Pause",
    icon: "🤫",
    blurb: "Silence you hold on purpose. The skill nobody else scores.",
    unlocksAt: 8,
    lessons: lessonsFor("The Pause"),
  },
  {
    id: "boss",
    name: "Cold Topic",
    icon: "🔥",
    blurb: "Unknown territory, on the clock. Weekly, premium.",
    unlocksAt: 12,
    boss: true,
    lessons: BOSS_LESSONS,
  },
];

export const TOTAL_LESSONS = UNITS.flatMap((u) => u.lessons).length;
export const MAX_STARS = TOTAL_LESSONS * 3;

/** Best star earned per lesson id, from rep history. */
export function starsByLesson(
  reps: { lesson_id: string | null; stars: number }[]
): Record<string, number> {
  const best: Record<string, number> = {};
  for (const r of reps) {
    if (!r.lesson_id) continue;
    best[r.lesson_id] = Math.max(best[r.lesson_id] ?? 0, r.stars);
  }
  return best;
}

export function totalStars(starMap: Record<string, number>): number {
  return Object.values(starMap).reduce((a, b) => a + b, 0);
}

export interface UnitState extends Unit {
  earned: number;
  possible: number;
  locked: boolean;
}

export function unitStates(starMap: Record<string, number>): UnitState[] {
  const total = totalStars(starMap);
  return UNITS.map((u) => ({
    ...u,
    earned: u.lessons.reduce((a, l) => a + (starMap[l.id] ?? 0), 0),
    possible: u.lessons.length * 3,
    locked: total < u.unlocksAt,
  }));
}

/** The next lesson worth doing: first without 3 stars in an open unit. */
export function nextLesson(
  starMap: Record<string, number>
): { lesson: Drill; unit: Unit } | null {
  for (const u of unitStates(starMap)) {
    if (u.locked || u.boss) continue;
    for (const l of u.lessons) {
      if ((starMap[l.id] ?? 0) < 3) return { lesson: l, unit: u };
    }
  }
  return null;
}
