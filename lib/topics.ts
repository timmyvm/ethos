/**
 * The roulette pool — topics to speak on cold.
 *
 * Competitor note (Wellspoken): a spinning wheel of random topics before
 * the rep. The mechanic is good for a real reason — it removes the
 * "what do I even talk about" stall, and it makes the rep a genuine
 * cold open rather than something you quietly rehearsed while deciding.
 *
 * These are deliberately answerable by anyone: opinions and experiences,
 * not knowledge. The Cold Topic boss is where not-knowing is the point
 * (lib/cold-topics.ts); here, not-knowing would just waste the rep.
 *
 * Structure tips are per-shape, not per-topic, so the advice is honest:
 * we know what shape of answer the prompt asks for, and nothing more.
 */

import type { Pool } from "@/content/portfolio";

export type TopicShape = "opinion" | "story" | "explain" | "pitch";

export interface Topic {
  id: string;
  prompt: string;
  shape: TopicShape;
  /** Pools this prompt doesn't fit (content/portfolio.ts): a school
   *  pool drops the job prompts, because a prompt you can't answer
   *  wastes the recording. */
  not?: Pool[];
}

export const TOPIC_SHAPES: Record<
  TopicShape,
  { label: string; tips: string[] }
> = {
  opinion: {
    label: "Take a side",
    tips: [
      "Say which side you're on in your first sentence.",
      "One reason, one example, then stop.",
      "Say the best point against you, then answer it in one sentence.",
    ],
  },
  story: {
    label: "Tell it straight",
    tips: [
      "Start in the middle of the action, not the background.",
      "Pick one moment and tell just that.",
      "End on what changed, not on 'so yeah'.",
    ],
  },
  explain: {
    label: "Make it land",
    tips: [
      "Open with what it IS in one sentence.",
      "Compare it to one thing they already know.",
      "Finish with why it matters to them.",
    ],
  },
  pitch: {
    label: "Sell it",
    tips: [
      "Start with the problem, and say who has it.",
      "Sum up your idea in one line a stranger could repeat.",
      "End by telling them the one thing to do next.",
    ],
  },
};

export const TOPICS: Topic[] = [
  { id: "t1", prompt: "The most overrated piece of advice you've been given", shape: "opinion" },
  { id: "t2", prompt: "Something you changed your mind about this year", shape: "opinion" },
  { id: "t3", prompt: "A rule you think everyone should break", shape: "opinion" },
  { id: "t4", prompt: "Whether being busy is a choice", shape: "opinion" },
  { id: "t5", prompt: "The best thing you own under $50", shape: "opinion" },
  { id: "t6", prompt: "A time you were completely wrong in public", shape: "story" },
  { id: "t7", prompt: "The last time you were genuinely nervous", shape: "story" },
  { id: "t8", prompt: "How you met someone who matters to you", shape: "story" },
  { id: "t9", prompt: "A decision you nearly didn't make", shape: "story" },
  { id: "t10", prompt: "The worst job you've ever done", shape: "story", not: ["school"] },
  { id: "t11", prompt: "Explain your work to a ten-year-old", shape: "explain", not: ["school"] },
  { id: "t12", prompt: "Explain how interest works to someone who's never had a bank account", shape: "explain" },
  { id: "t13", prompt: "Explain why the sky changes colour at sunset", shape: "explain" },
  { id: "t14", prompt: "Explain a hobby of yours to someone who finds it boring", shape: "explain" },
  { id: "t15", prompt: "Explain what makes a good friend", shape: "explain" },
  { id: "t16", prompt: "Pitch your city to someone deciding where to move", shape: "pitch" },
  { id: "t17", prompt: "Pitch a book or film you love, without spoiling it", shape: "pitch" },
  { id: "t18", prompt: "Pitch yourself for a job you're not qualified for", shape: "pitch", not: ["school"] },
  { id: "t19", prompt: "Pitch a change your workplace or school should make", shape: "pitch" },
  { id: "t20", prompt: "Pitch the last thing you spent real money on", shape: "pitch" },
  /*
   * The second forty (#473). The test's roulette cycled: "it kept
   * cycling over the same ones", "I always get the same few when
   * rerolling", "it needed more prompts". Written for someone 16 to 28
   * who wants more, and held to the rule above: answerable cold in 60
   * to 90 seconds, by anyone, with nothing to look up, no money to have
   * spent and no job to have held, so none of them leaves a pool. The
   * shapes take turns, opinion, story, explain, pitch, so the path's
   * slice of each tier (content/path.ts) gets both of that tier's
   * shapes, whichever trait it is cut for. The longest is 48
   * characters, and each was measured holding Today's card in three
   * lines at 375 and 390 and the reel's four-line window at 320
   * (scripts/look-topics.mjs `fit`, its numbers in
   * docs/look/topics/after/fit.json): characters are only a proxy, so a
   * new topic is measured, not counted.
   */
  { id: "t21", prompt: "Whether phones belong in classrooms", shape: "opinion" },
  { id: "t22", prompt: "A time you stood up for someone", shape: "story" },
  { id: "t23", prompt: "Explain how to make your favourite meal", shape: "explain" },
  { id: "t24", prompt: "Pitch a new public holiday", shape: "pitch" },
  { id: "t25", prompt: "Whether talent or effort matters more", shape: "opinion" },
  { id: "t26", prompt: "A time you were properly lost", shape: "story" },
  { id: "t27", prompt: "Explain the rules of a game you know well", shape: "explain" },
  { id: "t28", prompt: "Pitch a club you'd want to start", shape: "pitch" },
  { id: "t29", prompt: "The skill school should teach and doesn't", shape: "opinion" },
  { id: "t30", prompt: "Something you taught yourself", shape: "story" },
  { id: "t31", prompt: "Explain how you'd pack for a week away", shape: "explain" },
  { id: "t32", prompt: "Pitch a habit you swear by", shape: "pitch" },
  { id: "t33", prompt: "Whether you need a five-year plan", shape: "opinion" },
  { id: "t34", prompt: "The hardest thing you've ever finished", shape: "story" },
  { id: "t35", prompt: "Explain how a group chat falls apart", shape: "explain" },
  { id: "t36", prompt: "Pitch an app that doesn't exist yet", shape: "pitch" },
  { id: "t37", prompt: "The most underrated app on your phone", shape: "opinion" },
  { id: "t38", prompt: "The kindest thing a stranger did for you", shape: "story" },
  { id: "t39", prompt: "Explain how you decide what to watch next", shape: "explain" },
  { id: "t40", prompt: "Pitch a fix for something that annoys everyone", shape: "pitch" },
  { id: "t41", prompt: "A trend you hope disappears", shape: "opinion" },
  { id: "t42", prompt: "Your first day somewhere new", shape: "story" },
  { id: "t43", prompt: "Explain how to start talking to a stranger", shape: "explain" },
  { id: "t44", prompt: "Pitch a game to someone who doesn't play games", shape: "pitch" },
  { id: "t45", prompt: "Whether morning people really get more done", shape: "opinion" },
  { id: "t46", prompt: "A day that didn't go to plan", shape: "story" },
  { id: "t47", prompt: "Explain how you learn something new fast", shape: "explain" },
  { id: "t48", prompt: "Pitch someone you know for an award", shape: "pitch" },
  { id: "t49", prompt: "A food everyone loves that you don't", shape: "opinion" },
  { id: "t50", prompt: "The last time you laughed until it hurt", shape: "story" },
  { id: "t51", prompt: "Explain how you'd teach someone to ride a bike", shape: "explain" },
  { id: "t52", prompt: "Pitch a four-day week", shape: "pitch" },
  { id: "t53", prompt: "The best way to spend a free Sunday", shape: "opinion" },
  { id: "t54", prompt: "A time you changed someone's mind", shape: "story" },
  { id: "t55", prompt: "Explain how to tell if a news story is true", shape: "explain" },
  { id: "t56", prompt: "Pitch your favourite season", shape: "pitch" },
  { id: "t57", prompt: "Whether to be great at one thing or good at many", shape: "opinion" },
  { id: "t58", prompt: "Something you made or fixed with your hands", shape: "story" },
  { id: "t59", prompt: "Explain what makes a good teacher", shape: "explain" },
  { id: "t60", prompt: "Pitch a song everyone should hear once", shape: "pitch" },
];

/**
 * Pick a topic at random, never repeating the one on screen.
 *
 * `rand` is injected so the spin is testable — Math.random() in a
 * component is untestable by construction.
 */
export function spin(
  exclude: string | null = null,
  rand: () => number = Math.random,
  /** The pool to draw from; the profile narrows it (lib/profile.ts). */
  from: Topic[] = TOPICS
): Topic {
  const pool = exclude ? from.filter((t) => t.id !== exclude) : from;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

export function topicById(id: string | null | undefined): Topic | null {
  if (!id) return null;
  return TOPICS.find((t) => t.id === id) ?? null;
}

export function tipsFor(shape: TopicShape): string[] {
  return TOPIC_SHAPES[shape].tips;
}

/**
 * Where a topic in display type (Today's card, the recorder's ready
 * card, `.home-display`) steps down a size: past 40 characters to 34px,
 * and past 60 to 28, the reel's own size (#473). At 34px t12, the one
 * prompt over 60, ran five lines and stretched Today's card 58px past
 * its 376 at 390 (docs/look/topics/before/card-longest-390-light.png).
 */
export const LONG_TOPIC = 40;
export const LONGER_TOPIC = 60;
