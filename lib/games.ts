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
 *
 * LEVELS (the games plan, item 2). Every game has three, and a level
 * changes only the staging: when Demos cuts in, how long the clock runs,
 * when the question shows. Stars, the Index and every threshold the
 * round is measured against never move with the level, and money never
 * buys one (the ladder is `lib/ladder.ts`, the measure `lib/round.ts`).
 */

import {
  MAX_XP_MULTIPLIER,
  parseMods,
  xpMultiplier,
  type StressMod,
} from "./stress-mods";

export interface GameQuestion {
  id: string;
  prompt: string;
}

export type LevelN = 1 | 2 | 3;

export const LEVELS: readonly LevelN[] = [1, 2, 3];

export interface GameLevel {
  n: LevelN;
  /** One line of stage direction on the recording screen, under the question. */
  direction: string;
  /** The clock's cap in seconds. Absent: the daily cap, `GAME_CAP_S`. */
  capS?: number;
  /**
   * Demos's cut-ins, one window each, in seconds into the take:
   * `[aimLo, forceBy]`. He cuts in on the first voiced frame after an aim
   * second drawn from the window, and at `forceBy` if you are silent then.
   */
  cutIns: [number, number][];
  /** When the question shows: before Record, or when Record is pressed. */
  reveal: "before" | "record";
  /** What this level changes, one line: the detail when it opens. */
  condition: string;
}

export interface Game {
  id: string;
  name: string;
  /** The Caprasimo character in the menu row's pebble badge. */
  glyph?: string;
  /** One line on the menu card. */
  blurb: string;
  /**
   * Level 1's direction, kept for callers that read one line. A level's
   * own line is `gameLevel(game, n).direction`.
   */
  direction: string;
  /** Behind the Premium wall on Practice (26 Sep, Timothy's call). */
  premium?: boolean;
  /** Mods the game stages at every level. The game IS its conditions. */
  modIds: string[];
  /** Three, in order: level 1, 2, 3. */
  levels: [GameLevel, GameLevel, GameLevel];
  /** What Demos says when he cuts in. Empty for a game with no cut-in. */
  cutInLines: string[];
  /** The rule a round is measured by, one sentence (lib/round.ts). */
  countsWhen: string;
  questions: GameQuestion[];
  tips: string[];
}

/**
 * The daily cap, which a level without its own clock runs to. The same
 * 90 as `DAILY_MAX_SECONDS` in lib/rep-config.ts (asserted in
 * lib/games.test.ts); kept here so this file imports nothing that
 * imports it back.
 */
export const GAME_CAP_S = 90;

/** XP by level (#37: XP, never stars). Capped with the mods at MAX_XP_MULTIPLIER. */
export const LEVEL_XP: Record<LevelN, number> = { 1: 1, 2: 1.25, 3: 1.5 };

const QA_LEVELS: Game["levels"] = [
  {
    n: 1,
    direction: "Take a side. When Demos cuts in, hold a second before you answer.",
    cutIns: [[12, 20]],
    reveal: "before",
    condition: "Demos cuts in once.",
  },
  {
    n: 2,
    direction: "Take a side. Demos cuts in early. Hold a second before you answer.",
    cutIns: [[6, 10]],
    reveal: "before",
    condition: "Demos cuts in early.",
  },
  {
    n: 3,
    direction: "Take a side. Demos cuts in twice. Hold a second each time.",
    cutIns: [
      [6, 10],
      [30, 40],
    ],
    reveal: "before",
    condition: "Demos cuts in twice.",
  },
];

const RUSH_LEVELS: Game["levels"] = [
  {
    n: 1,
    direction: "45 seconds. Land the ending before the clock does.",
    capS: 45,
    cutIns: [],
    reveal: "before",
    condition: "45 seconds.",
  },
  {
    n: 2,
    direction: "30 seconds. Land the ending before the clock does.",
    capS: 30,
    cutIns: [],
    reveal: "before",
    condition: "30 seconds.",
  },
  {
    n: 3,
    direction: "20 seconds. Land the ending before the clock does.",
    capS: 20,
    cutIns: [],
    reveal: "before",
    condition: "20 seconds.",
  },
];

const INTERVIEW_LEVELS: Game["levels"] = [
  {
    n: 1,
    direction: "Answer like they asked you in the room. Finish between 1:00 and 1:30.",
    cutIns: [],
    reveal: "before",
    condition: "The question shows before you press Record.",
  },
  {
    n: 2,
    direction: "Finish between 1:00 and 1:30.",
    cutIns: [],
    reveal: "record",
    condition: "The question shows when you press Record.",
  },
  {
    n: 3,
    direction: "Demos asks one follow-up. Finish between 1:00 and 1:30.",
    cutIns: [[35, 45]],
    reveal: "record",
    condition: "Demos asks one follow-up.",
  },
];

export const GAMES: Game[] = [
  {
    id: "qa",
    name: "Q&A",
    glyph: "?",
    blurb: "Give your take. Demos cuts in with a question.",
    direction: QA_LEVELS[0].direction,
    modIds: ["interrupt"],
    levels: QA_LEVELS,
    cutInLines: [
      "So what?",
      "Says who?",
      "Give me an example.",
      "Why does that matter?",
      "Get to the point.",
    ],
    countsWhen: "A round counts when you hold 0.8s after each cut-in and keep two stars.",
    questions: [
      { id: "qa1", prompt: "Should everyone work a service job once?" },
      { id: "qa2", prompt: "Would you rather be respected or liked?" },
      { id: "qa3", prompt: "Does talent matter more than effort?" },
      { id: "qa4", prompt: "Should phones be banned in schools?" },
      { id: "qa5", prompt: "Is renting throwing money away?" },
      { id: "qa6", prompt: "Do open offices work?" },
      { id: "qa7", prompt: "Should you always negotiate the price?" },
      { id: "qa8", prompt: "Are degrees still worth it?" },
      { id: "qa9", prompt: "Is it better to be early or exactly on time?" },
      { id: "qa10", prompt: "Should you tell a friend their idea is bad?" },
      { id: "qa11", prompt: "Is a gap year a good idea?" },
      { id: "qa12", prompt: "Should group projects be marked one person at a time?" },
      { id: "qa13", prompt: "Are online friends real friends?" },
      { id: "qa14", prompt: "Should tipping disappear?" },
      { id: "qa15", prompt: "Is it worth learning to cook well?" },
      { id: "qa16", prompt: "Should you tell people your goals?" },
      { id: "qa17", prompt: "Is a side project worth more than a top mark?" },
      { id: "qa18", prompt: "Should everyone learn a second language?" },
      { id: "qa19", prompt: "Is it rude to check your phone at dinner?" },
      { id: "qa20", prompt: "Is winning more important than playing well?" },
      { id: "qa21", prompt: "Should you stay in the town you grew up in?" },
      { id: "qa22", prompt: "Do rankings make people better?" },
      { id: "qa23", prompt: "Should every exam be open book?" },
      { id: "qa24", prompt: "Is it better to go deep on one thing or try everything?" },
    ],
    tips: [
      "Stop when he cuts in. Hold a second, then answer him. Your result times that pause.",
      "Answer the question asked, then walk back to your point.",
      "Finish the sentence you started. A restart is scored as a repair.",
    ],
  },
  {
    id: "rush",
    name: "Speed rush",
    glyph: "30",
    blurb: "The whole answer before the clock.",
    premium: true,
    direction: RUSH_LEVELS[0].direction,
    modIds: ["tight"],
    levels: RUSH_LEVELS,
    cutInLines: [],
    countsWhen:
      "A round counts when you finish in the clock's second half, before it runs out, and keep two stars.",
    questions: [
      { id: "ru1", prompt: "Explain what you do all day" },
      { id: "ru2", prompt: "Sell someone on your favorite app" },
      { id: "ru3", prompt: "Explain how you make your coffee, start to finish" },
      { id: "ru4", prompt: "Give the plot of the last film you watched" },
      { id: "ru5", prompt: "Explain why the seasons change" },
      { id: "ru6", prompt: "Sell a tourist on your neighborhood" },
      { id: "ru7", prompt: "Explain the rules of a sport you know" },
      { id: "ru8", prompt: "Make the case for your favorite meal" },
      { id: "ru9", prompt: "Explain how you would spend a free Saturday" },
      { id: "ru10", prompt: "Sell someone on a book you liked" },
      { id: "ru11", prompt: "Explain what makes a good teacher" },
      { id: "ru12", prompt: "Explain why the sky is blue" },
      { id: "ru13", prompt: "Sell someone on waking up an hour earlier" },
      { id: "ru14", prompt: "Explain the best game you have played" },
      { id: "ru15", prompt: "Explain how to split a restaurant bill fairly" },
      { id: "ru16", prompt: "Sell someone on learning an instrument" },
      { id: "ru17", prompt: "Explain how rain forms" },
      { id: "ru18", prompt: "Explain how to get better at something fast" },
      { id: "ru19", prompt: "Sell a friend on the last song you played twice" },
      { id: "ru20", prompt: "Explain how a phone knows where you are" },
      { id: "ru21", prompt: "Sell someone on a walk instead of a scroll" },
      { id: "ru22", prompt: "Explain how you would teach a kid to ride a bike" },
      { id: "ru23", prompt: "Explain why bread goes stale" },
      { id: "ru24", prompt: "Sell someone on your favorite place to eat" },
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
    glyph: "“",
    blurb: "Classic questions, answered on the spot.",
    premium: true,
    direction: INTERVIEW_LEVELS[0].direction,
    modIds: [],
    levels: INTERVIEW_LEVELS,
    cutInLines: [
      "What did you do, exactly?",
      "What was the result?",
      "Give me a number.",
      "Why did that work?",
      "What would you change now?",
    ],
    countsWhen: "A round counts when you finish between 1:00 and 1:30 and keep two stars.",
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
      { id: "iv11", prompt: "Tell me about a time you had to learn something fast" },
      { id: "iv12", prompt: "What would someone who has worked with you say about you?" },
      { id: "iv13", prompt: "Tell me about a time you changed someone's mind" },
      { id: "iv14", prompt: "What feedback changed how you work?" },
      { id: "iv15", prompt: "Tell me about a time you missed a deadline" },
      { id: "iv16", prompt: "How do you handle a week with too much to do?" },
      { id: "iv17", prompt: "Tell me about something you started yourself" },
      { id: "iv18", prompt: "What do you do when you don't know the answer?" },
      { id: "iv19", prompt: "Tell me about a time you worked with someone difficult" },
      { id: "iv20", prompt: "What should we know that isn't on your résumé?" },
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

/** The game a stored lesson id names (`game:<game>:<question>`), or null. */
export function gameOfLessonId(lessonId: string | null | undefined): Game | null {
  if (!lessonId?.startsWith("game:")) return null;
  return gameById(lessonId.split(":")[1]);
}

export function questionById(
  game: Game,
  id: string | null | undefined
): GameQuestion | null {
  if (!id) return null;
  return game.questions.find((q) => q.id === id) ?? null;
}

/** Any input as a level: 2 or 3 when it says so, 1 for anything else. */
export function clampLevel(n: unknown): LevelN {
  const v = Math.floor(Number(n));
  return v >= 3 ? 3 : v === 2 ? 2 : 1;
}

/** One of the game's three levels; a number outside 1 to 3 clamps. */
export function gameLevel(game: Game, n: unknown): GameLevel {
  return game.levels[clampLevel(n) - 1];
}

/** The clock a level runs to, in seconds. */
export function levelCapS(game: Game, n: unknown): number {
  return gameLevel(game, n).capS ?? GAME_CAP_S;
}

/**
 * The mods a game stages at a level: its own, plus the interruption at a
 * level where Demos cuts in (Interview's follow-up at level 3 is the same
 * single scripted cut-in Q&A runs).
 */
export function gameModIds(game: Game, n: unknown): string[] {
  const ids = [...game.modIds];
  if (gameLevel(game, n).cutIns.length > 0 && !ids.includes("interrupt")) {
    ids.push("interrupt");
  }
  return ids;
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

/** Never one of the last this many asked, even once the pool is spent. */
export const RECENT_GUARD = 3;

/**
 * The question ids of `game` out of stored lesson ids, each once, in the
 * order given: pass the lesson ids newest first and this is what
 * `drawFresh` takes.
 */
export function askedIdsFrom(
  lessonIds: readonly (string | null | undefined)[],
  game: Game
): string[] {
  const prefix = `game:${game.id}:`;
  const out: string[] = [];
  for (const id of lessonIds) {
    if (!id?.startsWith(prefix)) continue;
    const q = id.slice(prefix.length);
    if (q && !out.includes(q)) out.push(q);
  }
  return out;
}

/**
 * The draw with a memory (proposal-mastery 7). `askedIds` are the
 * question ids already answered in this game, NEWEST FIRST
 * (`askedIdsFrom`). A question never asked comes first; once every one
 * has been, the older half of the asked ones come back, and never one of
 * the last three. `rand` is injected, as `draw` does.
 */
export function drawFresh(
  game: Game,
  askedIds: readonly string[],
  rand: () => number = Math.random
): GameQuestion {
  const inPool = new Set(game.questions.map((q) => q.id));
  const asked: string[] = [];
  for (const id of askedIds) {
    if (inPool.has(id) && !asked.includes(id)) asked.push(id);
  }
  const askedSet = new Set(asked);
  const recent = new Set(asked.slice(0, RECENT_GUARD));

  let pool = game.questions.filter((q) => !askedSet.has(q.id));
  if (pool.length === 0) {
    const older = new Set(asked.slice(Math.ceil(asked.length / 2)));
    pool = game.questions.filter((q) => older.has(q.id) && !recent.has(q.id));
  }
  // Only a pool of three or fewer reaches these; every shipped pool has 20.
  if (pool.length === 0) pool = game.questions.filter((q) => !recent.has(q.id));
  if (pool.length === 0) pool = game.questions.filter((q) => q.id !== asked[0]);
  if (pool.length === 0) pool = game.questions;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

/**
 * The fallback when a link arrives with no question: rotate by day, the
 * same shape as the daily lesson, so a bare URL is still a real rep and
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

/**
 * Is this game behind the Premium wall? It used to be read off the mods
 * (a game staging a premium mod was premium), which made Q&A paid and
 * Interview free. Since 26 Sep the tier is the game's own flag: Q&A is
 * the free game, Speed rush and Interview are Premium. Staged mods still
 * run as entitled inside a game (rep-config, #194).
 */
export function needsPremium(game: Game): boolean {
  return game.premium === true;
}

/** What the game's staged mods pay at level 1 with its cut-in made (#37: XP, never stars). */
export function gameMultiplier(game: Game): number {
  return gameXpMultiplier(game, 1, true);
}

/**
 * The mods a game round is paid for. The game's staged mods at its level
 * come as entitled on any plan (#194: premium gates the picker, never the
 * games); the interruption only when Demos actually cut in. `extras` are
 * the mods the player stacked, already parsed against their plan. Staged
 * first, so an extra never squeezes one out of the two-mod cap.
 */
export function gameMods(
  game: Game,
  level: unknown,
  opts: { cutInFired: boolean; extras?: readonly StressMod[] }
): StressMod[] {
  const ids = [...gameModIds(game, level), ...(opts.extras ?? []).map((m) => m.id)];
  const kept = ids.filter((id) => id !== "interrupt" || opts.cutInFired);
  return parseMods(kept.join(","), { premium: true });
}

/**
 * What a game round pays: its mods' multiplier times the level's
 * (×1, ×1.25, ×1.5), capped at MAX_XP_MULTIPLIER and rounded to 2dp.
 * Interruption counts only when a cut-in fired.
 */
export function gameXpMultiplier(
  game: Game,
  level: unknown,
  cutInFired: boolean,
  extras: readonly StressMod[] = []
): number {
  const mods = gameMods(game, level, { cutInFired, extras });
  const raw = xpMultiplier(mods) * LEVEL_XP[clampLevel(level)];
  return Math.round(Math.min(MAX_XP_MULTIPLIER, raw) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Game of the day (the games plan, item 12). A free account plays one
 * Premium game each day, in rotation, for a full round that counts.
 * ------------------------------------------------------------------ */

/** The Premium games, in the order the free days walk them. */
export const DAY_ROTATION = ["rush", "interview"] as const;
export type DayGameId = (typeof DAY_ROTATION)[number];

/** Days since 1970-01-01 for a `YYYY-MM-DD` key (lib/challenge.ts `dayKey`), or null. */
function dayNumber(dayKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.round(t / 86_400_000) : null;
}

/** Today's free Premium game, for a device-local `dayKey` ("2026-11-06"). */
export function gameOfTheDay(dayKey: string): DayGameId {
  const n = dayNumber(dayKey) ?? 0;
  const size = DAY_ROTATION.length;
  return DAY_ROTATION[((n % size) + size) % size];
}

/**
 * The speaker's own day, for the server (the games plan, item 12): the
 * `dayKey` the phone's calendar gives `at`, and that day's start and end
 * as instants, from the phone's `getTimezoneOffset()` minutes (west of
 * UTC is positive, as /api/analyze receives it; with none the day is
 * UTC's). What a free account's one round of today's Premium game is
 * counted against, the same day the phone's `gameOpen` reads.
 */
export function gameDayWindow(
  at: Date,
  tzOffset: number | null
): { dayKey: string; from: Date; to: Date } {
  const offset =
    tzOffset === null || !Number.isFinite(tzOffset)
      ? 0
      : Math.max(-14 * 60, Math.min(14 * 60, Math.trunc(tzOffset)));
  // Its UTC fields read the speaker's own clock.
  const wall = new Date(at.getTime() - offset * 60_000);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const d = wall.getUTCDate();
  const from = new Date(Date.UTC(y, m, d) + offset * 60_000);
  return {
    dayKey: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    from,
    to: new Date(from.getTime() + 86_400_000),
  };
}

/**
 * Can this account start a round of `game` now? Q&A always. A Premium
 * game for Premium, or for anyone when it is today's free game and they
 * have not played a round of it today. `premium` null (not read yet) is
 * not Premium.
 */
export function gameOpen(
  game: Game,
  opts: { premium: boolean | null; dayKey: string; roundsTodayOfGame: number }
): boolean {
  if (!needsPremium(game)) return true;
  if (opts.premium === true) return true;
  return gameOfTheDay(opts.dayKey) === game.id && opts.roundsTodayOfGame === 0;
}

/**
 * Does the server measure, store and pay this round as the game it says
 * it is (games review, finding 3)? The phone's `gameOpen`, checked where
 * it cannot be forged: a Premium game on a free plan only as today's
 * free game (`gameOfTheDay` of the speaker's own day, `gameDayWindow`),
 * and only when no round of it is stored that day yet, as /api/hostile
 * counts its weekly take. A plan read that failed (`premium` null) is
 * unknown, never free, so it stays open. A round that is not open is
 * still scored and stored as a recording, with no round and only the
 * mods the plan pays.
 */
export function roundEntitled(
  game: Game,
  opts: { premium: boolean | null; dayKey: string; storedToday: number }
): boolean {
  if (opts.premium === null) return true;
  return gameOpen(game, {
    premium: opts.premium,
    dayKey: opts.dayKey,
    roundsTodayOfGame: opts.storedToday,
  });
}
