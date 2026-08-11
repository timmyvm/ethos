/**
 * One resolver for "what is this rep". The recording screen, the
 * analyze route and the results view all need the same answer — which
 * prompt, how long, under what conditions, at what XP multiplier — so
 * it lives in one pure function instead of three near-copies.
 *
 * Daily reps stay the 90-second default (vision.md: ≤5 minutes, always).
 * Boss reps are the weekly Cold Topic (DECISIONS #13) and carry a base
 * multiplier because they're harder, not because they're paid.
 */

import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "./cold-topics";
import { DRILLS, todaysDrill } from "./drills";
import { topicById, TOPIC_SHAPES, type Topic } from "./topics";
import {
  parseMods,
  xpMultiplier,
  type StressMod,
} from "./stress-mods";

export const DAILY_MAX_SECONDS = 90;
export const TIGHT_MAX_SECONDS = 45;

/** Boss reps earn more XP for the same stars — effort, not quality. */
export const BOSS_XP_BASE = 1.5;

export type RepKind = "daily" | "boss";

export interface RepConfig {
  kind: RepKind;
  /** Stored on the rep. Boss reps use `boss:<topicId>`. */
  lessonId: string;
  unit: string;
  title: string;
  prompt: string;
  maxSeconds: number;
  mods: StressMod[];
  xpMultiplier: number;
  topic: ColdTopic | null;
  /** Structure tips for the shape of answer being asked for. */
  tips: string[];
  /** The roulette topic, when this rep came from a spin. */
  rouletteTopic: Topic | null;
  /** no-notes: the prompt vanishes the moment recording starts. */
  hidePrompt: boolean;
  crowdNoise: boolean;
  interrupt: boolean;
}

export interface RepConfigInput {
  lesson?: string | null;
  boss?: string | null;
  /** A roulette topic id — the user span for it rather than choosing. */
  topic?: string | null;
  mods?: string | null;
  premium?: boolean;
}

export function bossLessonId(topicId: string): string {
  return `boss:${topicId}`;
}

export function topicFromLessonId(lessonId: string | null): ColdTopic | null {
  if (!lessonId?.startsWith("boss:")) return null;
  const id = lessonId.slice(5);
  return COLD_TOPICS.find((t) => t.id === id) ?? null;
}

/**
 * `boss` may be a topic id or the bare flag "1" — the boss screen links
 * with the id so a bookmarked run keeps its topic across the week roll.
 */
export function resolveRepConfig(
  input: RepConfigInput = {},
  now = new Date()
): RepConfig {
  const mods = parseMods(input.mods, { premium: input.premium });
  const has = (effect: StressMod["effect"]) =>
    mods.some((m) => m.effect === effect);

  const tight = has("tight-timer");
  const base = {
    mods,
    hidePrompt: has("hide-prompt"),
    crowdNoise: has("crowd-noise"),
    interrupt: has("interrupt"),
  };

  if (input.boss) {
    const topic =
      COLD_TOPICS.find((t) => t.id === input.boss) ?? weeklyTopic(now);
    return {
      ...base,
      kind: "boss",
      lessonId: bossLessonId(topic.id),
      unit: "Weekly boss · Cold Topic",
      title: topic.title,
      prompt: `Explain ${topic.title} from memory. Wrong claims stated as fact cost more than saying you're unsure.`,
      maxSeconds: tight ? TIGHT_MAX_SECONDS : DAILY_MAX_SECONDS,
      xpMultiplier: xpMultiplier(mods, BOSS_XP_BASE),
      topic,
      tips: TOPIC_SHAPES.explain.tips,
      rouletteTopic: null,
    };
  }

  const roulette = topicById(input.topic);
  if (roulette) {
    return {
      ...base,
      kind: "daily",
      lessonId: `topic:${roulette.id}`,
      unit: `Roulette · ${TOPIC_SHAPES[roulette.shape].label}`,
      title: roulette.prompt,
      prompt: "You didn't pick this one. Sixty to ninety seconds.",
      maxSeconds: tight ? TIGHT_MAX_SECONDS : DAILY_MAX_SECONDS,
      xpMultiplier: xpMultiplier(mods),
      topic: null,
      tips: TOPIC_SHAPES[roulette.shape].tips,
      rouletteTopic: roulette,
    };
  }

  const drill =
    DRILLS.find((d) => d.id === input.lesson) ?? todaysDrill(now);
  return {
    ...base,
    kind: "daily",
    lessonId: drill.id,
    unit: drill.unit,
    title: drill.title,
    prompt: drill.prompt,
    maxSeconds: tight ? TIGHT_MAX_SECONDS : DAILY_MAX_SECONDS,
    xpMultiplier: xpMultiplier(mods),
    topic: null,
    // The lesson's own technique, not the generic shape tips: a drill
    // that names a target without saying how to hit it is a test.
    tips: drill.tips,
    rouletteTopic: null,
  };
}

/** Query string for a configured rep — one place builds the link. */
export function repHref(opts: {
  lesson?: string;
  boss?: string;
  topic?: string;
  mods?: string[];
}): string {
  const q = new URLSearchParams();
  if (opts.boss) q.set("boss", opts.boss);
  else if (opts.topic) q.set("topic", opts.topic);
  else if (opts.lesson) q.set("lesson", opts.lesson);
  if (opts.mods?.length) q.set("mods", opts.mods.join(","));
  const s = q.toString();
  return s ? `/rep?${s}` : "/rep";
}
