/**
 * Lessons (DECISIONS #269).
 *
 * A LESSON IS NOT A PATH ITEM, and keeping the two apart is the whole
 * design. `content/path.ts` is 120 practices that the daily card draws
 * from: one recording, chosen by whichever trait is weakest, gone
 * tomorrow. A lesson is a thing you decide to do. It has a name, a
 * picture, three practices, and a last one that is harder than the two
 * before it.
 *
 * FIFTEEN, not one hundred and twenty. These carry hand-written titles
 * and blurbs and their own artwork, which is affordable at fifteen and
 * is exactly what makes them feel chosen rather than generated. The
 * volume lives in the path, where it belongs, and is combinatorial.
 *
 * THE LAST PRACTICE CARRIES A MOD, and it is always the FREE one.
 * `no-notes` hides the prompt the moment you hit record, which is the
 * cheapest real difficulty in the app and needs no subscription. The
 * three premium mods stay where they are, optional and on top: a lesson
 * whose final step could not be reached without paying would be
 * progress sold for money, which #14 rules out.
 */

import { TRAIT, type TraitId } from "@/content/traits";
import { TOPICS, TOPIC_SHAPES } from "@/lib/topics";

export interface LessonPractice {
  topicId: string;
  prompt: string;
  tips: string[];
  /** Only the last one, and only ever the free mod. */
  mods?: string[];
}

export interface Lesson {
  id: string;
  trait: TraitId;
  title: string;
  /** One sentence. What this lesson is for. */
  blurb: string;
  /** The card's own artwork. */
  art: string;
  practices: LessonPractice[];
}

/** The hardener on every lesson's last practice. Free, on purpose. */
export const FINAL_MOD = "no-notes";

type Seed = { id: string; trait: TraitId; title: string; blurb: string; topics: [string, string, string] };

const SEEDS: Seed[] = [
  // Pausing
  { id: "the-landing", trait: "pause", title: "The landing", blurb: "Finish the sentence, then hold the silence that proves you meant it.", topics: ["t2", "t15", "t9"] },
  { id: "inside-or-after", trait: "pause", title: "Inside or after", blurb: "The same silence reads as command or as searching. Only the placement decides.", topics: ["t6", "t12", "t4"] },
  { id: "the-long-one", trait: "pause", title: "The long one", blurb: "Two seconds feels like ten from the inside. Learn what it actually sounds like.", topics: ["t17", "t7", "t3"] },
  // Fillers
  { id: "the-cold-open", trait: "fillers", title: "The cold open", blurb: "Most fillers land in the first five seconds. Decide the first sentence before you start.", topics: ["t1", "t13", "t8"] },
  { id: "closed-mouth", trait: "fillers", title: "The closed mouth", blurb: "An open mouth says um on its own. Close it at the end of every clause.", topics: ["t5", "t14", "t10"] },
  { id: "the-crutch", trait: "fillers", title: "Your crutch word", blurb: "Everyone has one and nobody can hear their own. The recording can.", topics: ["t19", "t2", "t16"] },
  // Restarts
  { id: "finish-it", trait: "repairs", title: "Finish it anyway", blurb: "The weaker sentence, finished, beats the better one abandoned halfway.", topics: ["t3", "t11", "t7"] },
  { id: "know-the-landing", trait: "repairs", title: "Know the landing", blurb: "Most restarts are a sentence that set off with nowhere to arrive.", topics: ["t20", "t6", "t15"] },
  { id: "or-rather", trait: "repairs", title: "Or rather", blurb: "Correct yourself as a new sentence instead of reversing into the old one.", topics: ["t9", "t18", "t1"] },
  // Pace
  { id: "room-to-land", trait: "pace", title: "Room to land", blurb: "The point needs air after it. Speed is what takes the air away.", topics: ["t4", "t12", "t6"] },
  { id: "one-gear-down", trait: "pace", title: "One gear down", blurb: "Slow the sentence that matters and leave the rest where it is.", topics: ["t8", "t16", "t2"] },
  { id: "change-gear", trait: "pace", title: "Change gear once", blurb: "One steady rate for a minute reads as recited, however good the rate is.", topics: ["t13", "t10", "t19"] },
  // Variety
  { id: "name-it-once", trait: "range", title: "Name it once", blurb: "Say the thing properly, then use a pronoun. Repeating the full phrase reads as padding.", topics: ["t14", "t5", "t20"] },
  { id: "short-and-concrete", trait: "range", title: "Short and concrete", blurb: "A short concrete noun beats a long abstract one every time you reach.", topics: ["t11", "t1", "t17"] },
  { id: "second-pass", trait: "range", title: "The second pass", blurb: "The second time you reach for an idea, reach somewhere else.", topics: ["t18", "t7", "t3"] },
];

function practicesFor(seed: Seed): LessonPractice[] {
  const own = TRAIT[seed.trait].howTo;
  return seed.topics.map((topicId, i) => {
    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic) throw new Error(`lesson ${seed.id} names topic ${topicId}, which does not exist`);
    return {
      topicId,
      prompt: topic.prompt,
      /* The trait's own technique, then the shape's. Same rule as the
         path: nothing here is a sentence written at scale. */
      tips: [own[i % own.length], own[(i + 1) % own.length], TOPIC_SHAPES[topic.shape].tips[i % 3]],
      ...(i === seed.topics.length - 1 ? { mods: [FINAL_MOD] } : {}),
    };
  });
}

export const LESSONS: Lesson[] = SEEDS.map((s) => ({
  id: s.id,
  trait: s.trait,
  title: s.title,
  blurb: s.blurb,
  art: `/lessons/${s.id}.webp`,
  practices: practicesFor(s),
}));

export function lessonById(id: string | null | undefined): Lesson | null {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export function lessonsForTrait(trait: TraitId): Lesson[] {
  return LESSONS.filter((l) => l.trait === trait);
}
