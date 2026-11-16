/**
 * The path: 1,645 practices, generated rather than authored
 * (DECISIONS #268, #473, #481).
 *
 * The old road was 27 hand-written lessons in a fixed order, gated on
 * stars, and it was the same road for everybody. This replaces it with
 * a set big enough that the daily practice does not repeat for months
 * and always matches the trait the numbers say is weakest.
 *
 * IT IS COMBINATORIAL ON PURPOSE. Hand-written prompts by the thousand
 * are a thousand chances to write something nobody reviewed, and volume
 * is exactly where slop gets in. So nothing here is new copy at the
 * sentence level: every PROMPT is a `TOPICS` entry that already
 * shipped, every TIP is either a trait's own technique from
 * `content/traits.ts` or a shape's from `TOPIC_SHAPES`, and the only
 * thing written per item is its TITLE, which is a short name for an
 * angle on a trait. Five traits, two tiers, twelve angles each, taken in
 * turn: a trait's thirteenth practice is its first angle on a new topic.
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
    "Drop your go-to word",
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
    "Use \"it\" the second time",
    "Name real things",
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

/** t1 to t60: the topics each trait's first twelve a tier were cut from (#473). */
const FIRST_TOPICS = 60;
const isFirst = (t: Topic) => Number(t.id.slice(1)) <= FIRST_TOPICS;

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
  (Object.keys(ANGLES) as TraitId[]).forEach((trait, t) => {
    for (const tier of [1, 2] as const) {
      const angles = ANGLES[trait];
      const first = topicsForTier(tier).filter(isFirst);
      /* A trait's first twelve, as #473 cut them and as they shipped:
         its own twelve of the tier's thirty from t1 to t60, starting
         where the trait before it stopped, and wrapping. Every one of
         those topics serves two traits. A stored take or a link that
         names `pause-1-3` still means the topic it meant. */
      const own = angles.map((_, i) => first[(t * angles.length + i + (tier === 2 ? 3 : 0)) % first.length]);
      /* Then every topic of the tier from t61 on, in the pool's order,
         the same for every trait (#481). The card turns over by the day
         (lib/next-practice.ts), so from the thirteenth day on every trait
         at a tier stands the same topic under its own angle: the topic
         is the day's and the angle is the trait's. A trait that stays
         weakest meets 165 different topics (164 at tier 2) before one
         comes round again, and a change of weakest trait never brings
         one of these back early, because each sits at the same place in
         every trait's walk. The angles keep taking turns, so the
         thirteenth is the first angle on a new topic. */
      const rest = topicsForTier(tier).filter((x) => !isFirst(x));
      [...own, ...rest].forEach((topic, i) => {
        out.push({
          id: `${trait}-${tier}-${i + 1}`,
          trait,
          tier,
          title: angles[i % angles.length],
          topicId: topic.id,
          prompt: topic.prompt,
          tips: tipsFor(trait, topic, i),
        });
      });
    }
  });
  return out;
}

export const PATH: PathItem[] = build();

const BY_ID = new Map(PATH.map((p) => [p.id, p]));

export function pathItemById(id: string | null | undefined): PathItem | null {
  return (id && BY_ID.get(id)) || null;
}
