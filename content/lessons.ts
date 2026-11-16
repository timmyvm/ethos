/**
 * Lessons (DECISIONS #269).
 *
 * A LESSON IS NOT A PATH ITEM, and keeping the two apart is the whole
 * design. `content/path.ts` is 1,645 practices that the daily card draws
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
  { id: "the-landing", trait: "pause", title: "Finish, then go quiet", blurb: "Finish your sentence, then stay silent for a second or two.", topics: ["t2", "t15", "t9"] },
  { id: "inside-or-after", trait: "pause", title: "Pause between sentences", blurb: "Pause at the end of a sentence, not in the middle.", topics: ["t6", "t12", "t4"] },
  { id: "the-long-one", trait: "pause", title: "The two-second pause", blurb: "Hold a two-second pause, then hear how calm it sounds.", topics: ["t17", "t7", "t3"] },
  // Fillers
  { id: "the-cold-open", trait: "fillers", title: "Your first sentence", blurb: "Plan your first sentence. Most ums happen in the first five seconds.", topics: ["t1", "t13", "t8"] },
  { id: "closed-mouth", trait: "fillers", title: "The closed mouth", blurb: "Close your mouth between sentences. An open mouth says um on its own.", topics: ["t5", "t14", "t10"] },
  { id: "the-crutch", trait: "fillers", title: "The word you overuse", blurb: "Everyone overuses one word, often \"basically\" or \"literally\". The recording finds yours.", topics: ["t19", "t2", "t16"] },
  // Restarts
  { id: "finish-it", trait: "repairs", title: "Finish it anyway", blurb: "Finish the sentence you started, even if a better one comes to mind.", topics: ["t3", "t11", "t7"] },
  { id: "know-the-landing", trait: "repairs", title: "Know how it ends", blurb: "Know where your sentence ends before you start it.", topics: ["t20", "t6", "t15"] },
  { id: "or-rather", trait: "repairs", title: "Fix it after", blurb: "Said it wrong? Finish, then fix it in a new sentence.", topics: ["t9", "t18", "t1"] },
  // Pace
  { id: "room-to-land", trait: "pace", title: "Let it sink in", blurb: "Give your main point a second to sink in before you move on.", topics: ["t4", "t12", "t6"] },
  { id: "one-gear-down", trait: "pace", title: "Slow your main point", blurb: "Slow down only for the sentence that matters most.", topics: ["t8", "t16", "t2"] },
  { id: "change-gear", trait: "pace", title: "Change speed once", blurb: "Change your speed at least once. One speed the whole time sounds memorised.", topics: ["t13", "t10", "t19"] },
  // Variety
  { id: "name-it-once", trait: "range", title: "Name it once", blurb: "Say \"my new phone\" once, then just \"it\".", topics: ["t14", "t5", "t20"] },
  { id: "short-and-concrete", trait: "range", title: "The actual thing", blurb: "Name the actual thing: \"my charger\", not \"that thing\".", topics: ["t11", "t1", "t17"] },
  { id: "second-pass", trait: "range", title: "Same idea, new words", blurb: "Coming back to an idea? Say it in new words.", topics: ["t18", "t7", "t3"] },
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
