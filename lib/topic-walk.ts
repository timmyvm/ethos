/**
 * The reroll's memory (#473): Today's "Another topic" and "Spin again"
 * walk the whole pool before any topic comes back.
 *
 * The roulette drew at random and excluded only the topic on screen, so
 * with twenty topics a few spins brought the same ones round again. The
 * test said so in three voices ("it kept cycling over the same ones",
 * "I always get the same few when rerolling", "it needed more
 * prompts").
 *
 * This is the games' `drawFresh` (lib/games.ts) applied to what was
 * SHOWN rather than what was answered: a topic the person has not been
 * shown in this walk comes first, and once every topic in their pool has
 * been, a new walk starts that never opens on one of the last
 * `RECENT_TOPICS`. The games read their memory from stored recordings;
 * a spin stores nothing, so this one lives on the device, in
 * localStorage beside the app's other per-device memories (`ethos.*`,
 * emptied with the rest when the account is deleted). A cleared or
 * private browser starts a new walk, which is all it costs.
 *
 * What is remembered is what was on screen: the topic Today's card
 * showed when the roulette opened, and each topic the wheel landed on.
 * The candidates that flash past mid-spin are not draws and are not
 * remembered (`useReel`'s `pass`, components/Reel.tsx).
 */

import { TOPICS, type Topic } from "./topics";

export const TOPIC_WALK_KEY = "ethos.topics.seen";

/**
 * Never one of the last this many shown, even where one walk turns into
 * the next. A walk never runs dry before it is done while every pool is
 * at least twice this (the school pool is 362 since #481). Kept at 20
 * rather than grown with the pool: it only guards the turn between
 * walks, and a walk of 365 is a long way from one.
 */
export const RECENT_TOPICS = 20;

export interface TopicWalk {
  /** The topics shown in the walk under way, newest first, each once. */
  walk: string[];
  /** The last `RECENT_TOPICS` topics shown, newest first, across walks. */
  recent: string[];
}

export const NO_WALK: TopicWalk = { walk: [], recent: [] };

/**
 * The next topic: one this walk has not shown and none of the recent
 * ones; with the walk done, any but the recent ones (a new walk); and
 * never `exclude`, the topic on screen. `rand` is injected, as `spin`
 * and `drawFresh` take it. The fallbacks after the first two only reach
 * a pool smaller than twice `RECENT_TOPICS`, which no shipped pool is.
 */
export function drawTopic(
  pool: readonly Topic[],
  memory: TopicWalk,
  exclude: string | null,
  rand: () => number = Math.random
): Topic {
  const from = pool.length > 0 ? pool : TOPICS;
  const walked = new Set(memory.walk);
  const recent = new Set(memory.recent.slice(0, RECENT_TOPICS));
  const rules: ((t: Topic) => boolean)[] = [
    (t) => !walked.has(t.id) && !recent.has(t.id) && t.id !== exclude,
    (t) => !recent.has(t.id) && t.id !== exclude,
    (t) => t.id !== exclude,
  ];
  for (const keep of rules) {
    const left = from.filter(keep);
    if (left.length > 0) return left[Math.floor(rand() * left.length) % left.length];
  }
  return from[0];
}

/**
 * The memory once `id` has been on screen. A walk that already holds
 * every topic in `pool` is done, and `id` opens the next one. A set, so
 * a spin stays one pass over the pool at 365 rather than one per topic.
 */
export function shown(memory: TopicWalk, id: string, pool: readonly Topic[]): TopicWalk {
  const walked = new Set(memory.walk);
  const done = pool.length > 0 && pool.every((t) => walked.has(t.id));
  return {
    walk: done ? [id] : [id, ...memory.walk.filter((x) => x !== id)],
    recent: [id, ...memory.recent.filter((x) => x !== id)].slice(0, RECENT_TOPICS),
  };
}

const KNOWN = new Set(TOPICS.map((t) => t.id));

/** Ids of topics that exist, each once, in the order given, at most `max`. */
function ids(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<string>();
  for (const x of v) {
    if (typeof x === "string" && KNOWN.has(x)) out.add(x);
    if (out.size === max) break;
  }
  return [...out];
}

/** A stored memory, or nothing: anything malformed reads as a fresh walk. */
export function cleanWalk(v: unknown): TopicWalk {
  if (!v || typeof v !== "object") return NO_WALK;
  const o = v as { walk?: unknown; recent?: unknown };
  return { walk: ids(o.walk, TOPICS.length), recent: ids(o.recent, RECENT_TOPICS) };
}

export function readWalk(): TopicWalk {
  try {
    if (typeof localStorage === "undefined") return NO_WALK;
    const raw = localStorage.getItem(TOPIC_WALK_KEY);
    return raw ? cleanWalk(JSON.parse(raw)) : NO_WALK;
  } catch {
    return NO_WALK;
  }
}

export function writeWalk(w: TopicWalk): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TOPIC_WALK_KEY, JSON.stringify({ v: 1, walk: w.walk, recent: w.recent }));
  } catch {
    /* No storage: the next spin is drawn without the memory, as before. */
  }
}

/**
 * The reroll, on this device: `onScreen` (the card's topic, or the one
 * the wheel last landed on) counts as seen, the next is drawn from what
 * is left of the walk, and it is remembered as shown. The wheel's own
 * last landing is already the newest shown, so only a topic the memory
 * has not just recorded (the card's) is added: noted twice, the last of
 * a walk would open the next one too.
 */
export function nextTopic(
  pool: readonly Topic[],
  onScreen: string | null,
  rand: () => number = Math.random
): Topic {
  let memory = readWalk();
  if (onScreen && memory.recent[0] !== onScreen && pool.some((t) => t.id === onScreen)) {
    memory = shown(memory, onScreen, pool);
  }
  const next = drawTopic(pool, memory, onScreen, rand);
  writeWalk(shown(memory, next.id, pool));
  return next;
}
