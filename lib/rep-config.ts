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
import { lessonById } from "@/content/lessons";
import { pathItemById, type PathItem } from "@/content/path";
import {
  dailyQuestion,
  gameById,
  gameLessonId,
  questionById,
} from "./games";
import { topicById, TOPIC_SHAPES, type Topic } from "./topics";
import {
  parseMods,
  xpMultiplier,
  type StressMod,
} from "./stress-mods";

export const DAILY_MAX_SECONDS = 90;
/** 30 since 27 Aug (#194, Timothy's call) — 45 wasn't tight enough to
 *  force the compression the mod exists to train. */
export const TIGHT_MAX_SECONDS = 30;

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
  /** The path item Today's card printed, when its Start opened it (E52). */
  practice?: PathItem | null;
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
  /**
   * The path item Today's card printed (content/path.ts), when its Start
   * opened that practice's topic (E52). The recording screen heads with
   * its angle and leads with its tactic, so the tile under your thumb is
   * the one the card promised. Ignored unless the item's topic is `topic`.
   */
  item?: string | null;
  /** A game id from the Games tab, with `q` naming the drawn question. */
  game?: string | null;
  q?: string | null;
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

  /*
   * A game IS its conditions, and its conditions come WITH it (#194):
   * the staged mods are parsed as entitled, because premium gates the
   * mod PICKER, not the games — reported live as "Demos doesn't cut in"
   * plus the game losing its name and ending like a lesson, both from
   * the entitlement (or its fetch race) silently dropping the staged
   * interruption. User-added extras still respect the entitlement.
   * Staged first so a stacked extra can never squeeze one out of the
   * two-mod cap; the name still never outruns the conditions.
   */
  const game = gameById(input.game);
  if (game) {
    const staged = parseMods(
      [
        ...game.modIds,
        ...parseMods(input.mods, { premium: input.premium }).map((m) => m.id),
      ].join(","),
      { premium: true }
    );
    const ran = (id: string) => staged.some((m) => m.id === id);
    if (game.modIds.every(ran)) {
      const q = questionById(game, input.q) ?? dailyQuestion(game, now);
      const stagedHas = (effect: StressMod["effect"]) =>
        staged.some((m) => m.effect === effect);
      return {
        mods: staged,
        hidePrompt: stagedHas("hide-prompt"),
        crowdNoise: stagedHas("crowd-noise"),
        interrupt: stagedHas("interrupt"),
        kind: "daily",
        lessonId: gameLessonId(game, q),
        unit: `Games · ${game.name}`,
        title: q.prompt,
        prompt: game.direction,
        maxSeconds: stagedHas("tight-timer")
          ? TIGHT_MAX_SECONDS
          : DAILY_MAX_SECONDS,
        xpMultiplier: xpMultiplier(staged),
        topic: null,
        tips: game.tips,
        rouletteTopic: null,
      };
    }
  }

  const roulette = topicById(input.topic);
  if (roulette) {
    /*
     * Today's Start carries the practice it printed (E52): the card said
     * "Today's practice", the angle and "Pause after the full stop", so
     * the recording screen says the same three things, the angle where a
     * lesson's title goes and the tactic on tile 1. A spun topic carries
     * no item: the roulette named its shape, so it keeps the shape's tips.
     * The take itself is the topic's either way (`topic:<id>`): no star,
     * gate or family moves with the item.
     */
    const item = pathItemById(input.item);
    const practice = item && item.topicId === roulette.id ? item : null;
    return {
      ...base,
      kind: "daily",
      lessonId: `topic:${roulette.id}`,
      unit: practice ? "Today's practice" : `Roulette · ${TOPIC_SHAPES[roulette.shape].label}`,
      title: roulette.prompt,
      prompt: practice ? practice.title : "Sixty to ninety seconds.",
      maxSeconds: tight ? TIGHT_MAX_SECONDS : DAILY_MAX_SECONDS,
      xpMultiplier: xpMultiplier(mods),
      topic: null,
      tips: practice ? practice.tips : TOPIC_SHAPES[roulette.shape].tips,
      rouletteTopic: roulette,
      practice,
    };
  }

  /*
   * AN UNKNOWN LESSON ID IS NOT TODAY'S DRILL.
   *
   * This used to be `DRILLS.find(...) ?? todaysDrill(now)`, and the
   * fallback was silent, which made it a data bug rather than a
   * cosmetic one. `/practice/[trait]` has been sending
   * `?lesson=trait-pause` since #258; that matches no drill, so every
   * recording made from the five trait walks showed an unrelated
   * prompt AND filed its star against whichever drill the rotation
   * happened to be on. Stars move unit gates, so a lesson nobody did
   * was opening doors.
   *
   * An id we do not recognise is now NAMESPACED rather than guessed at:
   * `practice:trait-pause` can never collide with a drill id, so the
   * star lands on the thing that was actually done and the road's
   * per-lesson counts stop being credited with work nobody did. The
   * prompt falls back to the rotation, which is a real approved prompt
   * rather than a blank.
   */
  /*
   * A LESSON PRACTICE, when `lesson` names one of content/lessons.ts
   * and `q` says which of its three. `lessonId` is namespaced so
   * lib/lesson-progress.ts can read the practice back out of the log:
   * there is no progress table, and a counter that can drift from the
   * recordings would.
   */
  const lesson = lessonById(input.lesson);
  if (lesson) {
    const n = Math.min(
      Math.max(1, Number(input.q) || 1),
      lesson.practices.length
    );
    const practice = lesson.practices[n - 1];
    /* The practice's own mod on top of whatever the screen had on.
       Always the FREE one on a lesson's last practice, so finishing a
       lesson never needs a subscription (#14). */
    const withMod = parseMods(
      [...(input.mods ?? []), ...(practice.mods ?? [])].join(","),
      { premium: input.premium }
    );
    const tightNow = withMod.some((m) => m.effect === "tight-timer");
    return {
      ...base,
      mods: withMod,
      hidePrompt: withMod.some((m) => m.effect === "hide-prompt"),
      crowdNoise: withMod.some((m) => m.effect === "crowd-noise"),
      interrupt: withMod.some((m) => m.effect === "interrupt"),
      kind: "daily",
      lessonId: `lesson:${lesson.id}:${n}`,
      unit: lesson.title,
      title: lesson.title,
      prompt: practice.prompt,
      tips: practice.tips,
      maxSeconds: tightNow ? TIGHT_MAX_SECONDS : DAILY_MAX_SECONDS,
      xpMultiplier: xpMultiplier(withMod),
      topic: null,
      rouletteTopic: null,
    };
  }

  const drill = input.lesson
    ? (DRILLS.find((d) => d.id === input.lesson) ?? null)
    : todaysDrill(now);

  if (!drill) {
    const rotation = todaysDrill(now);
    return {
      ...base,
      kind: "daily",
      lessonId: `practice:${input.lesson}`,
      unit: rotation.unit,
      title: rotation.title,
      prompt: rotation.prompt,
      tips: rotation.tips,
      maxSeconds: tight ? TIGHT_MAX_SECONDS : DAILY_MAX_SECONDS,
      xpMultiplier: xpMultiplier(mods),
      topic: null,
      rouletteTopic: null,
    };
  }

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
    // The lesson's own technique, not the generic shape tips: a lesson
    // that names a target without saying how to hit it is a test.
    tips: drill.tips,
    rouletteTopic: null,
  };
}

/**
 * Which string is the TOPIC and which the heading under it. A lesson or a
 * practice names itself in `title` and puts what you will talk about in
 * `prompt`; a roulette spin (Today's practice included), a game question
 * and a boss put the topic in `title` and the direction in `prompt`. The
 * topic takes the card either way, and the other is the one line of what
 * to do over the three tiles (COPY-RULES: one line).
 */
export function recordingText(
  config: Pick<RepConfig, "kind" | "rouletteTopic" | "lessonId" | "title" | "prompt">
): { topic: string; heading: string } {
  const topicFirst =
    config.kind === "boss" ||
    config.rouletteTopic !== null ||
    config.lessonId.startsWith("game:");
  return topicFirst
    ? { topic: config.title, heading: config.prompt }
    : { topic: config.prompt, heading: config.title };
}

/** Query string for a configured rep — one place builds the link. */
export function repHref(opts: {
  lesson?: string;
  boss?: string;
  topic?: string;
  /** The path item Today's card printed, with its `topic` (E52). */
  item?: string;
  game?: string;
  /** The drawn question, so a shared game link repeats the same rep. */
  q?: string;
  mods?: string[];
  /**
   * Where the recorder hands control back (#258). A lesson sends
   * somebody out to record and needs them to land on its own last
   * screen rather than on the floor, because the change it is about to
   * show is the point of the lesson.
   */
  back?: string;
  /**
   * The family the pressed card wore (D50), for a practice whose own id
   * names no trait: Today's topic. Colour only, never part of the take.
   */
  trait?: string;
}): string {
  const q = new URLSearchParams();
  if (opts.boss) q.set("boss", opts.boss);
  else if (opts.game) {
    q.set("game", opts.game);
    if (opts.q) q.set("q", opts.q);
  } else if (opts.topic) {
    q.set("topic", opts.topic);
    if (opts.item) q.set("item", opts.item);
  } else if (opts.lesson) {
    q.set("lesson", opts.lesson);
    /* A lesson practice carries WHICH of its three. `q` used to be
       bound to the game branch alone, so a lesson could only ever
       send its first. */
    if (opts.q) q.set("q", opts.q);
  }
  if (opts.mods?.length) q.set("mods", opts.mods.join(","));
  if (opts.back) q.set("back", opts.back);
  if (opts.trait) q.set("trait", opts.trait);
  const s = q.toString();
  return s ? `/rep?${s}` : "/rep";
}

/**
 * Which recording a /rep address asks for: everything that changes the
 * take or what its screen says (lesson, topic, item, boss, game,
 * question, mods), and nothing that only
 * says where to go after it (`back`). The recording screen resets when
 * this changes, and only then.
 */
const REP_KEY_PARAMS = ["lesson", "topic", "item", "boss", "game", "q", "mods"] as const;

export function repKey(params: { get(k: string): string | null }): string {
  return REP_KEY_PARAMS.map((k) => params.get(k) ?? "").join("|");
}

/**
 * True when `href` is the recording already on screen. Pushing it is a
 * no-op in Next (same route, same key, nothing remounts or resets), so
 * a caller resets in place instead: "Go again" on the address you are on.
 */
export function sameRepScreen(
  href: string,
  current: { get(k: string): string | null }
): boolean {
  const u = new URL(href, "http://ethos.local");
  return u.pathname === "/rep" && repKey(u.searchParams) === repKey(current);
}
