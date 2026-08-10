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

export type TopicShape = "opinion" | "story" | "explain" | "pitch";

export interface Topic {
  id: string;
  prompt: string;
  shape: TopicShape;
}

export const TOPIC_SHAPES: Record<
  TopicShape,
  { label: string; tips: string[] }
> = {
  opinion: {
    label: "Take a side",
    tips: [
      "Say your position in the first sentence. Don't warm up to it.",
      "One reason, one example, then stop.",
      "Name the strongest objection and answer it in a line.",
    ],
  },
  story: {
    label: "Tell it straight",
    tips: [
      "Start in the middle of the action, not the background.",
      "One scene. Resist covering the whole week.",
      "End on what changed, not on 'so yeah'.",
    ],
  },
  explain: {
    label: "Make it land",
    tips: [
      "Open with what it IS in one sentence.",
      "One comparison to something they already know.",
      "Finish with why it matters to them.",
    ],
  },
  pitch: {
    label: "Sell it",
    tips: [
      "Problem first, and make it someone's actual problem.",
      "Your answer in one line a stranger could repeat.",
      "Close on the single next step.",
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
  { id: "t10", prompt: "The worst job you've ever done", shape: "story" },
  { id: "t11", prompt: "Explain your work to a ten-year-old", shape: "explain" },
  { id: "t12", prompt: "Explain how interest works to someone who's never had a bank account", shape: "explain" },
  { id: "t13", prompt: "Explain why the sky changes colour at sunset", shape: "explain" },
  { id: "t14", prompt: "Explain a hobby of yours to someone who finds it boring", shape: "explain" },
  { id: "t15", prompt: "Explain what makes a good friend", shape: "explain" },
  { id: "t16", prompt: "Pitch your city to someone deciding where to move", shape: "pitch" },
  { id: "t17", prompt: "Pitch a book or film you love, without spoiling it", shape: "pitch" },
  { id: "t18", prompt: "Pitch yourself for a job you're not qualified for", shape: "pitch" },
  { id: "t19", prompt: "Pitch a change your workplace or school should make", shape: "pitch" },
  { id: "t20", prompt: "Pitch the last thing you spent real money on", shape: "pitch" },
];

/**
 * Pick a topic at random, never repeating the one on screen.
 *
 * `rand` is injected so the spin is testable — Math.random() in a
 * component is untestable by construction.
 */
export function spin(
  exclude: string | null = null,
  rand: () => number = Math.random
): Topic {
  const pool = exclude ? TOPICS.filter((t) => t.id !== exclude) : TOPICS;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

export function topicById(id: string | null | undefined): Topic | null {
  if (!id) return null;
  return TOPICS.find((t) => t.id === id) ?? null;
}

export function tipsFor(shape: TopicShape): string[] {
  return TOPIC_SHAPES[shape].tips;
}
