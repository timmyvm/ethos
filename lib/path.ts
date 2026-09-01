/**
 * The path — units → lessons → stars (mechanics.md progression).
 * Stars are earned from rep metrics only (DECISIONS #10): the best
 * star ever earned on a lesson sticks, replays can raise it, nothing
 * is awarded for showing up.
 *
 * Star totals gate unit unlocks. Boss units stay premium (DECISIONS #13).
 */

import { DRILLS, type Drill } from "./drills";

/**
 * A unit's teaching screen, shown once when the unit opens (#210).
 * Optional: a unit without approved copy skips straight to its first
 * lesson rather than showing a screen we'd have had to write.
 */
export interface UnitIntro {
  /** 2 to 4 words. */
  title: string;
  /** ONE sentence. */
  line: string;
  /** 2 to 3 tactics. */
  howTo: string[];
}

export interface Unit {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  /** Stars needed across earlier units before this one opens. */
  unlocksAt: number;
  boss?: boolean;
  lessons: Drill[];
  intro?: UnitIntro;
}

const BOSS_LESSONS: Drill[] = [
  {
    id: "b1",
    unit: "Cold Topic",
    title: "Boss: unknown territory",
    prompt:
      "A topic you've never studied. 4 minutes to research, 90 seconds to explain. Scored on delivery and accuracy.",
    tips: [
      "Say what you know and flag what you don't. A wrong claim stated as fact costs three times what an admitted unknown does.",
      "Structure beats coverage: one definition, one mechanism, one example.",
      "Hedge honestly. \"I think\" in front of a shaky claim is cheaper than being wrong.",
    ],
  },
  {
    id: "b2",
    unit: "Cold Topic",
    title: "Boss: hostile Q&A",
    prompt:
      "Give a 60-second take. Demos interrupts with skeptical questions. Scored on composure and pause quality under pressure.",
    tips: [
      "When the interruption lands, pause before answering. The pause is the answer to \"are you rattled\".",
      "Answer the question asked, then return to your point. Abandoning the point is what makes people sound beaten.",
      "One breath before you resume. Restarting mid-sentence reads as flustered and is scored as a repair.",
    ],
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
    /* docs/voice.md Part 3, verbatim. The third tactic is the one only
       somebody who has actually done the drill would say, and it does
       the work the old paragraph was reaching for. */
    intro: {
      title: "No fillers",
      line: "No ums, no ahs. You pause instead.",
      howTo: [
        "Know your first sentence before you hit record.",
        'When you feel an "um" coming, just close your mouth.',
        "The silence always feels longer to you than it does to anyone listening.",
      ],
    },
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
  /*
   * The back half of the road (#141) — the three units mechanics.md
   * always named and nobody had built. The gates keep #28's ladder
   * spacing: each opens on stars the previous units can actually pay.
   */
  {
    id: "structure",
    name: "Structure",
    icon: "🧱",
    blurb: "Claim, points, landing. An argument you can see the shape of.",
    unlocksAt: 16,
    lessons: lessonsFor("Structure"),
  },
  {
    id: "compression",
    name: "Compression",
    icon: "🗜️",
    blurb: "Half the words, all of the point.",
    unlocksAt: 24,
    lessons: lessonsFor("Compression"),
  },
  {
    id: "fire",
    name: "Thinking Under Fire",
    icon: "⚡",
    blurb: "No script, no warm-up, still clear.",
    unlocksAt: 32,
    lessons: lessonsFor("Thinking Under Fire"),
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

export function unitById(id: string | undefined): Unit | null {
  return UNITS.find((u) => u.id === id) ?? null;
}

/**
 * Does this unit still owe its teaching screen (#210)?
 *
 * Once, on the way into a unit nobody has scored in yet — Duolingo's
 * unit header, which is shown when the unit opens and never again. A
 * unit with stars in it has been taught by the doing, and a technique
 * screen in front of every lesson would be a paragraph a day.
 */
export function introDue(
  unit: Unit | null,
  starMap: Record<string, number>
): boolean {
  if (!unit?.intro) return false;
  return unit.lessons.every((l) => (starMap[l.id] ?? 0) === 0);
}

/** The unit intro's route. */
export function introHref(unitId: string, mods: string[] = []): string {
  const q = mods.length > 0 ? `?mods=${mods.join(",")}` : "";
  return `/lesson/${unitId}${q}`;
}
