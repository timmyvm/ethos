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
  /**
   * How to do this drill — the technique, not encouragement.
   *
   * A lesson that names a target and doesn't say how to hit it is a
   * test, not a lesson. Each of these is one instruction you can act on
   * inside sixty seconds, and each maps to something the engine
   * actually measures, so the feedback afterwards is about the same
   * thing the tip was about.
   */
  tips: string[];
}

export const DRILLS: Drill[] = [
  {
    id: "f1",
    unit: "Filler Elimination",
    title: "The baseline rep",
    prompt:
      "Introduce yourself and what you're building — 60 seconds, no notes.",
    tips: [
      "Decide your first sentence before you start. Most fillers happen in the first five seconds, while you work out where to begin.",
      "One idea per sentence. Long sentences run out of road and you fill the gap with \"um\".",
      "Land on a full stop rather than trailing into \"...yeah, so\".",
    ],
  },
  {
    id: "f2",
    unit: "Filler Elimination",
    title: "Kill 'like'",
    prompt: "Explain your favorite app to someone who's never used a phone.",
    tips: [
      "\"Like\" is usually a placeholder for a comparison you haven't found yet. Stop, find it, then say it.",
      "When you feel one coming, close your mouth. A closed mouth cannot say \"like\".",
      "Explaining to someone who knows nothing forces concrete nouns, and concrete nouns leave no room for filler.",
    ],
  },
  {
    id: "f3",
    unit: "Filler Elimination",
    title: "Silence beats 'um'",
    prompt:
      "Describe your morning routine. Every time you'd say a filler — pause instead.",
    tips: [
      "The swap is silence INSTEAD of the \"um\", not silence either side of it. A pause with an \"um\" leaning on it scores as a filled hesitation here.",
      "A one-second gap feels like ten from the inside and like composure from the outside. Trust the outside.",
      "If you catch yourself mid-\"um\", finish the word and keep going. Stopping to restart costs more than the filler did.",
    ],
  },
  {
    id: "p1",
    unit: "Pace Control",
    title: "The 140 zone",
    prompt: "Tell the story of how you learned to code, at a walking pace.",
    tips: [
      "130–160 words a minute is the zone. That's slower than you talk to friends and faster than you think a speech should be.",
      "Pace is set by breathing, not by effort. Full breath at each full stop and the rate takes care of itself.",
      "Steady is not monotone — the score rewards pace that MOVES, so speed up through the setup and slow down on the point.",
    ],
  },
  {
    id: "p2",
    unit: "Pace Control",
    title: "Slow is smooth",
    prompt:
      "Explain compound interest to a 10-year-old. Slower than feels natural.",
    tips: [
      "Say the hard number slower than the words around it. That contrast is what makes it land.",
      "Explaining to a child bans jargon, and jargon is where speeding up starts.",
      "When you notice you're rushing, finish the sentence you're in before you correct. Mid-sentence corrections cost you twice.",
    ],
  },
  {
    id: "h1",
    unit: "The Pause",
    title: "Hold one second",
    prompt:
      "Argue for your most controversial food opinion. Pause a full second before each new point.",
    tips: [
      "The pause goes at the JOINT — after you finish a point, before you start the next. Inside a sentence it reads as searching, and it's scored that way.",
      "One to two seconds. Under one is a breath; past three and a half it reads as lost.",
      "Finish the point first. A pause after half a thought has nothing to land.",
    ],
  },
  {
    id: "h2",
    unit: "The Pause",
    title: "Land the ending",
    prompt:
      "Pitch what you're building in 45 seconds. End on a sentence, then hold the silence.",
    tips: [
      "Know your last sentence before you start. Endings are where people trail off into \"...so yeah\".",
      "Stop on the full stop. Don't add the summary — the silence is the summary.",
      "A held pause in the last fifth of the rep scores separately here. That's the one that makes an ending sound decided.",
    ],
  },
];

/** The drill after this one, for "next lesson". Wraps at the end. */
export function nextDrill(id: string | null): Drill {
  const i = DRILLS.findIndex((d) => d.id === id);
  return DRILLS[(i + 1 + DRILLS.length) % DRILLS.length];
}

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
