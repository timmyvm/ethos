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

import type { Pool } from "@/content/portfolio";
import { TRAIT, type TraitId } from "@/content/traits";
import { fitsPool, TOPICS, TOPIC_SHAPES } from "@/lib/topics";

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
  /**
   * The practices as the "all" pool has them. Their count, mods and
   * order are every pool's; a practice's TOPIC is not (#492): read what
   * a person is shown through `lessonFor(lesson, pool)`.
   */
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
  // Sentence restarts
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

/*
 * THE SCHOOL POOL'S STAND-INS (#492). Three topics need a job (t10 "The
 * worst job you've ever done", t11 "Explain your work to a ten-year-old",
 * t18 "Pitch yourself for a job you're not qualified for"), and the
 * school pool drops them (lib/topics.ts `not`, lib/pool.ts `poolFor`).
 * Six lesson practices named one. For someone in that pool each takes a
 * topic of the same shape, so the practice's tips (the shape's) are the
 * same words, chosen for what the lesson teaches, from the topics no
 * lesson already names (lessons use t1 to t20), one per practice:
 *
 *  - closed-mouth, 3 (t10): "A deadline you only just made". A scramble
 *    told beat by beat, where "and um" is what joins the beats: close
 *    your mouth between them instead.
 *  - change-gear, 2 (t10): "A day that didn't go to plan". The plan at
 *    one speed and the moment it went wrong at another: the change of
 *    speed is in the story.
 *  - finish-it, 2 (t11): "Explain a slang word to someone twice your
 *    age". t11 turned round: your world to someone outside it, where a
 *    better example arrives mid-sentence. Finish the one you started.
 *  - short-and-concrete, 1 (t11): "Explain how you'd pack for a week
 *    away". A list of actual things (the charger the blurb names), never
 *    "that thing".
 *  - or-rather, 2 (t18): "Pitch yourself as class captain". The same
 *    pitch of yourself; a claim said wrong gets fixed in the next
 *    sentence.
 *  - second-pass, 1 (t18): "Pitch your goal for this year to a sceptic".
 *    A sceptic sends you back to the same idea, so the second time needs
 *    new words.
 *
 * The lesson, its id, its practice numbers and its art are every pool's,
 * so stars and progress (`lesson:<id>:<n>`, lib/lesson-progress.ts)
 * count the same take whichever topic it was spoken on.
 */
const STAND_INS: Partial<Record<Pool, Record<string, Record<string, string>>>> = {
  school: {
    "closed-mouth": { t10: "t262" },
    "change-gear": { t10: "t46" },
    "finish-it": { t11: "t83" },
    "short-and-concrete": { t11: "t31" },
    "or-rather": { t18: "t332" },
    "second-pass": { t18: "t216" },
  },
};

function topicOf(id: string) {
  return TOPICS.find((t) => t.id === id) ?? null;
}

/**
 * The topic a seed's practice speaks on in a pool: its own, or where the
 * pool drops it, the lesson's stand-in. A dropped topic with no stand-in,
 * or a stand-in the pool drops too or of another shape, stops the module
 * (as a topic id that does not exist does), so no pool is ever handed a
 * topic it leaves out.
 */
function topicIn(seed: Seed, asked: string, pool: Pool): string {
  const topic = topicOf(asked);
  if (!topic) throw new Error(`lesson ${seed.id} names topic ${asked}, which does not exist`);
  if (fitsPool(topic, pool)) return asked;
  const id = STAND_INS[pool]?.[seed.id]?.[asked];
  const stand = topicOf(id ?? "");
  if (!stand || !fitsPool(stand, pool) || stand.shape !== topic.shape)
    throw new Error(`lesson ${seed.id}: the ${pool} pool drops ${asked} and has no ${topic.shape} stand-in for it`);
  return stand.id;
}

function practicesFor(seed: Seed, pool: Pool = "all"): LessonPractice[] {
  const own = TRAIT[seed.trait].howTo;
  return seed.topics.map((asked, i) => {
    const topicId = topicIn(seed, asked, pool);
    const topic = topicOf(topicId)!;
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

/* A pool's lessons (#492): only a pool some topic leaves out (`not`)
   changes any, and then only the lessons that name such a topic. */
const NARROWING: Pool[] = [...new Set(TOPICS.flatMap((t) => t.not ?? []))];
const BY_POOL = new Map<Pool, Map<string, Lesson>>(
  NARROWING.map((pool) => [
    pool,
    new Map(
      SEEDS.filter((s) => s.topics.some((t) => !fitsPool(topicOf(t)!, pool))).map((s) => {
        const base = LESSONS.find((l) => l.id === s.id)!;
        return [s.id, { ...base, practices: practicesFor(s, pool) }];
      })
    ),
  ])
);

/**
 * The lesson as a person in `pool` is shown it (#492): for a pool that
 * drops one of its topics, the same lesson with that practice on its
 * stand-in (`STAND_INS`); for every other pool and lesson, the lesson
 * itself, the very object `LESSONS` holds. Every screen that shows a
 * lesson's topic reads it through here: the lesson page and the
 * recorder (lib/rep-config.ts).
 */
export function lessonFor(lesson: Lesson, pool: Pool): Lesson {
  return BY_POOL.get(pool)?.get(lesson.id) ?? lesson;
}

/**
 * Practice `i`'s topic while the person's pool is not yet known (the
 * server's page, before the phone's answers are read): the topic when
 * every pool agrees on it, null where a pool stands another in, so the
 * page holds the line rather than guess one (#492).
 */
export function settledPrompt(lesson: Lesson, i: number): string | null {
  const own = lesson.practices[i]?.prompt ?? null;
  return NARROWING.every((pool) => lessonFor(lesson, pool).practices[i]?.prompt === own) ? own : null;
}

export function lessonsForTrait(trait: TraitId): Lesson[] {
  return LESSONS.filter((l) => l.trait === trait);
}
