/**
 * The games — the real engine under rolled conditions.
 *
 * Reference: Elevate's Games tab, a library where every game names the
 * skill it trains. Ours names the CONDITIONS instead, because the skill
 * list is the path's job and a game here is not a new scorer: every
 * game is an ordinary rep through the ordinary engine, so every number
 * it returns is as checkable as a daily one (vision.md, no horoscope).
 *
 * The honesty rule is inherited from DECISIONS #36: a game ships only
 * if it runs today. Q&A stages the existing interruption effect, Speed
 * rush stages the existing tight timer, Interview is new questions
 * through the unchanged engine. Debate stays out until an opposing
 * voice exists, and Yoodli-style conversational follow-ups are out of
 * scope on purpose: one real interruption beats a simulated interviewer
 * we can't actually run.
 *
 * XP multiplies with the staged mods (#37); stars stay measured (#10);
 * a game rep is `kind: "daily"`, so streaks, coins and the judged meter
 * treat it exactly like any other rep.
 */

import { modById, parseMods, xpMultiplier } from "./stress-mods";

export interface GameQuestion {
  id: string;
  prompt: string;
}

export interface Game {
  id: string;
  name: string;
  /** The Caprasimo character in the menu row's pebble badge. */
  glyph?: string;
  /** One line on the menu card. */
  blurb: string;
  /** One line of stage direction on the rep screen, under the question. */
  direction: string;
  /** Mods the game stages. The game IS its conditions. */
  modIds: string[];
  questions: GameQuestion[];
  tips: string[];
}

export const GAMES: Game[] = [
  {
    id: "qa",
    name: "Q&A",
    glyph: "?",
    blurb: "Give your take. Demos cuts in with a question.",
    direction: "Take a side and hold it. Demos will cut in once.",
    modIds: ["interrupt"],
    questions: [
      { id: "qa1", prompt: "Should everyone work a service job once?" },
      { id: "qa2", prompt: "Would you rather be respected or liked?" },
      { id: "qa3", prompt: "Does talent matter more than effort?" },
      { id: "qa4", prompt: "Should phones be banned in schools?" },
      { id: "qa5", prompt: "Is renting throwing money away?" },
      { id: "qa6", prompt: "Do open offices work?" },
      { id: "qa7", prompt: "Should you always negotiate the price?" },
      { id: "qa8", prompt: "Are degrees still worth it?" },
    ],
    tips: [
      "Pause before you answer the interruption. A held pause reads as composure, and the engine scores it.",
      "Answer the question asked, then walk back to your point.",
      "Finish the sentence you started. A restart is scored as a repair.",
    ],
  },
  {
    id: "rush",
    name: "Speed rush",
    glyph: "30",
    blurb: "The whole answer in 30 seconds.",
    direction: "30 seconds. Land the ending before the clock does.",
    modIds: ["tight"],
    questions: [
      { id: "ru1", prompt: "Explain what you do all day" },
      { id: "ru2", prompt: "Sell someone on your favorite app" },
      { id: "ru3", prompt: "Explain how you make your coffee, start to finish" },
      { id: "ru4", prompt: "Give the plot of the last film you watched" },
      { id: "ru5", prompt: "Explain why the seasons change" },
      { id: "ru6", prompt: "Sell a tourist on your neighborhood" },
      { id: "ru7", prompt: "Explain the rules of a sport you know" },
      { id: "ru8", prompt: "Make the case for your favorite meal" },
    ],
    tips: [
      "Your first sentence is the point. The wind-up is what the clock eats.",
      "One point, one example, stop.",
      "Finishing early beats getting cut off.",
    ],
  },
  {
    id: "interview",
    name: "Interview",
    glyph: "\u201c",
    blurb: "Classic questions, answered cold.",
    direction: "Answer like they asked you in the room. Sixty to ninety seconds.",
    modIds: [],
    questions: [
      { id: "iv1", prompt: "Tell me about yourself" },
      { id: "iv2", prompt: "Why should we pick you?" },
      { id: "iv3", prompt: "Tell me about a time you failed" },
      { id: "iv4", prompt: "What is your biggest weakness?" },
      { id: "iv5", prompt: "Tell me about a decision you'd make differently now" },
      { id: "iv6", prompt: "Describe a time you disagreed with someone in charge" },
      { id: "iv7", prompt: "What have you done that you're proud of?" },
      { id: "iv8", prompt: "Where do you want to be in five years?" },
      { id: "iv9", prompt: "Tell me about a time you led without being asked" },
      { id: "iv10", prompt: "Why do you want this?" },
    ],
    tips: [
      "Answer the question in your first sentence. The story comes second.",
      "One specific beats three adjectives. Name the thing you did.",
      "Land on the result, with a number if you have one.",
    ],
  },
];

export function gameById(id: string | null | undefined): Game | null {
  if (!id) return null;
  return GAMES.find((g) => g.id === id) ?? null;
}

export function questionById(
  game: Game,
  id: string | null | undefined
): GameQuestion | null {
  if (!id) return null;
  return game.questions.find((q) => q.id === id) ?? null;
}

/**
 * Draw a question at random, never repeating the one on screen.
 * `rand` is injected so the draw is testable, same as the roulette.
 */
export function draw(
  game: Game,
  exclude: string | null = null,
  rand: () => number = Math.random
): GameQuestion {
  const pool = exclude
    ? game.questions.filter((q) => q.id !== exclude)
    : game.questions;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

/**
 * The fallback when a link arrives with no question: rotate by day, the
 * same shape as the daily drill, so a bare URL is still a real rep and
 * two people sharing it the same day get the same question.
 */
export function dailyQuestion(game: Game, now = new Date()): GameQuestion {
  const day = Math.floor(now.getTime() / 86_400_000);
  return game.questions[day % game.questions.length];
}

/** Stored rep id: `game:<game>:<question>`. */
export function gameLessonId(game: Game, q: GameQuestion): string {
  return `game:${game.id}:${q.id}`;
}

/** Does this game stage a mod the free tier doesn't hold? */
export function needsPremium(game: Game): boolean {
  return game.modIds.some((id) => modById(id)?.premium ?? false);
}

/** The XP multiplier the game's staged mods pay (#37: XP, never stars). */
export function gameMultiplier(game: Game): number {
  return xpMultiplier(parseMods(game.modIds.join(","), { premium: true }));
}
