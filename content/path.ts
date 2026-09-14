/**
 * The path: 120 practices, generated rather than authored
 * (DECISIONS #268).
 *
 * The old road was 27 hand-written lessons in a fixed order, gated on
 * stars, and it was the same road for everybody. This replaces it with
 * a set big enough that the daily practice never repeats inside a
 * fortnight and always matches the trait the numbers say is weakest.
 *
 * IT IS COMBINATORIAL ON PURPOSE. 120 hand-written prompts is 120
 * chances to write something nobody reviewed, and volume is exactly
 * where slop gets in. So nothing here is new copy at the sentence
 * level: every PROMPT is a `TOPICS` entry that already shipped, every
 * TIP is either a trait's own technique from `content/traits.ts` or a
 * shape's from `TOPIC_SHAPES`, and the only thing written per item is
 * its TITLE, which is a short name for an angle on a trait. Five
 * traits, two tiers, twelve angles each.
 *
 * THE TIER IS NEVER SHOWN. It is not a level, a difficulty badge or a
 * thing to unlock, and nothing in the interface names it. It decides
 * one thing: which half of the topic pool the prompt comes from. Tier 1
 * draws on opinion and story, where the content is already in your head
 * and the only load is delivery. Tier 2 draws on explain and pitch,
 * where you have to build something for a listener while you speak,
 * which is the harder task by every measure in docs/percentiles.md.
 * Somebody weak on a trait gets that trait at tier 1 until the number
 * moves.
 */

import { TRAIT, type TraitId } from "@/content/traits";
import { TOPICS, TOPIC_SHAPES, type Topic } from "@/lib/topics";

export interface PathItem {
  id: string;
  trait: TraitId;
  /** 1 or 2. Never rendered. See the note above. */
  tier: 1 | 2;
  title: string;
  topicId: string;
  prompt: string;
  tips: string[];
}

/**
 * Twelve angles per trait: a short name for one way into the trait.
 *
 * These are the only sentences written for this file, and they are
 * titles rather than instructions, so the technique still comes from
 * the trait's own approved `howTo`.
 */
const ANGLES: Record<TraitId, string[]> = {
  pause: [
    "The full stop",
    "Land the first point",
    "One beat, then the next idea",
    "The silence you keep",
    "Stop before the best line",
    "Two seconds, on purpose",
    "The pause nobody fills",
    "Breathe where it ends",
    "Hold it one longer",
    "The gap that reads as certain",
    "End, then wait",
    "Silence instead of the sound",
  ],
  fillers: [
    "The cold open",
    "Close the mouth",
    "One idea a sentence",
    "The first five seconds",
    "Nothing in the gap",
    "Say it or stop",
    "The word you cannot hear",
    "Start clean",
    "Slow the run-up",
    "Drop the crutch",
    "Straight in",
    "The quiet swap",
  ],
  repairs: [
    "Finish the sentence",
    "Land the one you started",
    "No second attempt",
    "Commit to the ending",
    "Know the landing first",
    "The weaker sentence, finished",
    "One run at it",
    "Say it once",
    "Carry it through",
    "Correct as a new sentence",
    "Decide, then speak",
    "No going back",
  ],
  pace: [
    "Room to land",
    "The steady open",
    "Slow the important part",
    "One gear down",
    "Even, then faster",
    "Give the point time",
    "Match the idea",
    "Not a race",
    "Push the middle",
    "Hold the rhythm",
    "Start at your speed",
    "Change gear once",
  ],
  range: [
    "Name it once",
    "The pronoun after",
    "Short concrete nouns",
    "Drop the repeat",
    "A second word for it",
    "The phrase you lean on",
    "Say the thing itself",
    "One name per idea",
    "Fresh on the second pass",
    "Trade the long word",
    "No phrase twice",
    "Reach further",
  ],
};

/** Tier 1: the content is already yours. Tier 2: you build it as you go. */
const TIER_SHAPES = {
  1: ["opinion", "story"],
  2: ["explain", "pitch"],
} as const;

function topicsForTier(tier: 1 | 2): Topic[] {
  const shapes: readonly string[] = TIER_SHAPES[tier];
  return TOPICS.filter((t) => shapes.includes(t.shape));
}

/**
 * One item's tips: the trait's technique first, because that is what
 * this practice is FOR, then the shape's, because that is what the
 * prompt asks of you. Three lines, which is the hero block's budget.
 */
function tipsFor(trait: TraitId, topic: Topic, i: number): string[] {
  const own = TRAIT[trait].howTo;
  const shape = TOPIC_SHAPES[topic.shape].tips;
  return [own[i % own.length], own[(i + 1) % own.length], shape[i % shape.length]];
}

function build(): PathItem[] {
  const out: PathItem[] = [];
  for (const trait of Object.keys(ANGLES) as TraitId[]) {
    for (const tier of [1, 2] as const) {
      const pool = topicsForTier(tier);
      ANGLES[trait].forEach((title, i) => {
        /* The topic pool is smaller than twelve, so it wraps. That is
           the point: the same prompt under a different angle is a
           different practice, and it is what makes 120 affordable. The
           offset keeps a trait's two tiers from pairing the same topic
           with the same position. */
        const topic = pool[(i + (tier === 2 ? 3 : 0)) % pool.length];
        out.push({
          id: `${trait}-${tier}-${i + 1}`,
          trait,
          tier,
          title,
          topicId: topic.id,
          prompt: topic.prompt,
          tips: tipsFor(trait, topic, i),
        });
      });
    }
  }
  return out;
}

export const PATH: PathItem[] = build();

export function pathItemById(id: string | null | undefined): PathItem | null {
  return PATH.find((p) => p.id === id) ?? null;
}
