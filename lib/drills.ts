/**
 * The daily drill loop — build order step 2 (vision.md: app serves ONE
 * prompt a day). Units → lessons per mechanics.md; content ported from
 * the prototype. Boss modes are premium weekly content and stay out of
 * this rotation (DECISIONS.md #13).
 */

export interface Drill {
  id: string;
  unit: string;
  title: string;
  prompt: string;
}

export const DRILLS: Drill[] = [
  {
    id: "f1",
    unit: "Filler Elimination",
    title: "The baseline rep",
    prompt:
      "Introduce yourself and what you're building — 60 seconds, no notes.",
  },
  {
    id: "f2",
    unit: "Filler Elimination",
    title: "Kill 'like'",
    prompt: "Explain your favorite app to someone who's never used a phone.",
  },
  {
    id: "f3",
    unit: "Filler Elimination",
    title: "Silence beats 'um'",
    prompt:
      "Describe your morning routine. Every time you'd say a filler — pause instead.",
  },
  {
    id: "p1",
    unit: "Pace Control",
    title: "The 140 zone",
    prompt: "Tell the story of how you learned to code, at a walking pace.",
  },
  {
    id: "p2",
    unit: "Pace Control",
    title: "Slow is smooth",
    prompt:
      "Explain compound interest to a 10-year-old. Slower than feels natural.",
  },
  {
    id: "h1",
    unit: "The Pause",
    title: "Hold one second",
    prompt:
      "Argue for your most controversial food opinion. Pause a full second before each new point.",
  },
  {
    id: "h2",
    unit: "The Pause",
    title: "Land the ending",
    prompt:
      "Pitch what you're building in 45 seconds. End on a sentence, then hold the silence.",
  },
];

/** Dogfood day zero — the rotation anchor. */
const EPOCH = new Date(2026, 7, 9); // 9 Aug 2026, local time

/** One drill per local calendar day, rotating through the list. */
export function todaysDrill(now = new Date()): Drill {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(
    0,
    Math.round((a.getTime() - EPOCH.getTime()) / 86_400_000)
  );
  return DRILLS[days % DRILLS.length];
}
