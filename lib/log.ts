/**
 * The Log, read (#17, #217; made simple in #506).
 *
 * Pure reads over stored recordings for the Log and the stored
 * recording's page: what a recording is called (`recordingName`, the
 * lesson or the game) and what it was about (`recordingTopic`, the row's
 * title since #506), which trait it practised (`recordingTrait`), the
 * Ethos line on the Log's stage (`ethosLine`, `linePath`), the all-time
 * best (`bestRecording`) and a row's day in words (`dayWords`). Nothing
 * here decides what a number means: every point drawn and every number
 * printed is a stored Ethos.
 *
 * What moved (#217) went with #506 (Timothy, 18 Nov: "what am I even
 * looking at ... no one's gonna really consume that"): its three
 * measures and their Day 1, Now and Change columns, the trend
 * sparklines, the filler heatmap, the insight and the Premium skill and
 * Presence trendlines. A recording's own numbers stay on its own page;
 * each trait's latest reading stays on Lessons and You.
 */

import type { RepRow } from "./client-data";
import { lessonById, lessonFor } from "@/content/lessons";
import { pathItemById } from "@/content/path";
import type { Pool } from "@/content/portfolio";
import { TRAIT, type TraitId } from "@/content/traits";
import { COLD_TOPICS } from "./cold-topics";
import { DRILLS } from "./drills";
import { gameOfLessonId, questionById } from "./games";
import { HOSTILE_PROMPTS, HOSTILE_TAKE_ID, hostileRecordOf } from "./hostile";
import { parsePracticeId } from "./lesson-progress";
import { measured } from "./trait-readings";
import { topicById } from "./topics";
import { UNKNOWN_POOL } from "./pool";

/** The pace band the results walk already names (RepResult, Hostile). */
export const WPM_ZONE = { low: 130, high: 160 } as const;

/**
 * Day 1 vs now (ComparisonCard, the results' Since day one): the first
 * and the latest recordings that measured something. A take too short
 * to score is stored with no fillers and no pauses, and as "now" it
 * printed fillers 9.3 to 0.0 in green (regression review, edges F5).
 * Null under two.
 */
export function sinceDayOne(reps: RepRow[]): { first: RepRow; last: RepRow } | null {
  const kept = reps.filter(measured);
  return kept.length < 2 ? null : { first: kept[0], last: kept[kept.length - 1] };
}

/**
 * What a recording is called by its lesson or game. A stored `lesson_id`
 * is one of six shapes: a lesson's practice (`lesson:<id>:<n>`), a path
 * item (`pause-1-3`), a road lesson (`f1`), a game (`game:<id>:<q>`), a
 * boss topic (`boss:<id>`) or Hostile Q&A's take (`hostile-take`). Only
 * the road lesson used to resolve, so every recording made from Today or
 * a lesson was called "Recording", and Hostile's still was (map 2.4).
 *
 * A game round measured on the server (`round`, lib/round.ts) names its
 * level, "Q&A, level 2": the ladder is per level, so the row says which
 * rung it was. A round recorded before 0026, with no `round`, keeps the
 * game's name alone, since its level was never stored.
 */
export function recordingName(
  r: Pick<RepRow, "lesson_id" | "mode"> & { round?: { game?: unknown; level?: unknown } | null }
): string {
  const id = r.lesson_id;
  const practice = parsePracticeId(id);
  const lesson = practice ? lessonById(practice.lessonId) : null;
  if (lesson) return lesson.title;
  const item = pathItemById(id);
  if (item) return item.title;
  const drill = id ? DRILLS.find((d) => d.id === id) : null;
  if (drill) return drill.title;
  const game = gameOfLessonId(id);
  if (game) {
    const level = r.round?.game === game.id ? r.round.level : null;
    return level === 1 || level === 2 || level === 3 ? `${game.name}, level ${level}` : game.name;
  }
  if (id === HOSTILE_TAKE_ID) return "Hostile Q&A";
  /* Today's own take and a trait's walk had no name here, so they read
     "Recording" among named lessons (regression review, edges F6): the
     first takes the label its card wears, the second its trait's. */
  if (id?.startsWith("topic:") && topicById(id.slice("topic:".length))) return "Today's practice";
  const walk = traitWalk(id);
  if (walk) return TRAIT[walk].name;
  return r.mode === "boss" ? "Boss" : "Recording";
}

/**
 * Two road lessons open on how to speak rather than what about ("Hold
 * one full second of silence, then answer: what's a rule you live by?",
 * "No think time. Your topic is the last object you touched. Go."), so
 * their first sentence is not their topic. Every other road lesson's is.
 */
const DRILL_TOPIC: Record<string, string> = {
  h3: "A rule you live by",
  t3: "The last object you touched",
};

/**
 * A road lesson's prompt names its topic, then says how ("Argue that one
 * everyday habit is underrated. Full stop, one beat, next sentence."):
 * the topic is its first sentence, a title's full stop dropped (#454),
 * a question keeping its mark.
 */
function firstSentence(prompt: string): string {
  const end = /[.?!](?=\s|$)/.exec(prompt);
  const first = end ? prompt.slice(0, end.index + 1) : prompt;
  return first.replace(/\.$/, "").trim();
}

/**
 * What a recording was about, the Log's row title since #506: a person
 * finds a recording by what they talked about ("Whether being busy is a
 * choice"), and the lesson's name ("Punctuate with silence") stays on
 * the recording's own page. Read from the stored `lesson_id` alone, so it
 * is the topic the recorder showed:
 *
 *  - a lesson's practice: its topic in this person's pool (#492: the
 *    recorder resolves it through `lessonFor` with the phone's pool);
 *  - Today's practice or a spun topic (`topic:<id>`): the topic;
 *  - a path item: its topic;
 *  - a road lesson: its prompt's first sentence (DRILL_TOPIC for two);
 *  - the weekly boss: its Cold Topic;
 *  - a game round: the question drawn;
 *  - Hostile Q&A: the claim argued, from its stored verdict;
 *  - anything else (a trait's walk, a recording older than its id's
 *    shape): `recordingName`, never an empty or raw id.
 */
export function recordingTopic(
  r: Pick<RepRow, "lesson_id" | "mode"> & { round?: unknown },
  pool: Pool = UNKNOWN_POOL
): string {
  const id = r.lesson_id;
  const practice = parsePracticeId(id);
  const lesson = practice ? lessonById(practice.lessonId) : null;
  if (lesson && practice) {
    const prompt = lessonFor(lesson, pool).practices[practice.practice - 1]?.prompt;
    if (prompt) return prompt;
  }
  if (id?.startsWith("topic:")) {
    const topic = topicById(id.slice("topic:".length));
    if (topic) return topic.prompt;
  }
  const item = pathItemById(id);
  const itemTopic = item ? topicById(item.topicId) : null;
  if (itemTopic) return itemTopic.prompt;
  const drill = id ? DRILLS.find((d) => d.id === id) : null;
  if (drill) return DRILL_TOPIC[drill.id] ?? firstSentence(drill.prompt);
  if (id?.startsWith("boss:")) {
    const cold = COLD_TOPICS.find((t) => t.id === id.slice("boss:".length));
    if (cold) return cold.title;
  }
  const game = gameOfLessonId(id);
  const question = game ? questionById(game, id?.split(":")[2]) : null;
  if (question) return question.prompt;
  if (id === HOSTILE_TAKE_ID) {
    const record = hostileRecordOf(r.round);
    const claim = record ? HOSTILE_PROMPTS.find((p) => p.id === record.claimId)?.claim : null;
    if (claim) return claim;
  }
  return recordingName({ lesson_id: id, mode: r.mode, round: (r.round ?? null) as { game?: unknown; level?: unknown } | null });
}

/** The trait of a trait's walk (`practice:trait-pause`, lib/rep-config.ts), or null. */
function traitWalk(id: string | null): TraitId | null {
  const m = id?.match(/^practice:trait-(\w+)$/);
  return m && Object.prototype.hasOwnProperty.call(TRAIT, m[1]) ? (m[1] as TraitId) : null;
}

/** The road's three trait-shaped units; the rest name no single trait. */
const UNIT_TRAIT: Record<string, TraitId> = {
  "Filler Elimination": "fillers",
  "Pace Control": "pace",
  "The Pause": "pause",
};

/**
 * The trait a recording practised, so its page can wear that trait's
 * chip the way the lesson does on /lessons. Null for a game, a boss, a
 * free recording and the road's Structure, Compression and Thinking
 * Under Fire units: those practise no one trait, and a tone they did not
 * earn would teach the wrong colour.
 */
export function recordingTrait(r: Pick<RepRow, "lesson_id">): TraitId | null {
  const id = r.lesson_id;
  if (!id) return null;
  const walk = traitWalk(id);
  if (walk) return walk;
  const practice = parsePracticeId(id);
  if (practice) return lessonById(practice.lessonId)?.trait ?? null;
  const item = pathItemById(id);
  if (item) return item.trait;
  const drill = DRILLS.find((d) => d.id === id);
  return drill ? (UNIT_TRAIT[drill.unit] ?? null) : null;
}

/**
 * The narrowest stretch of Ethos the stage's line is drawn on (#506,
 * from the next-move design). Fitted to its own range, 611 to 662 ran
 * corner to corner and a 51-point rise read as a cliff; a small dip
 * would have read as a crash. On at least 100 points, a rise looks its
 * size and a flat run looks flat.
 */
export const LINE_SPAN = 100;

/**
 * The stage's line (#506): one point per scored recording, oldest
 * first, as [x, y] in the unit square (x 0 to 1 left to right, y 0 at
 * the top). Null under two scored recordings: one number is no line.
 *
 * Smoothed so a recording's ups and downs read as a direction: each
 * point is the mean of itself and up to two either side, the window
 * shrinking at the ends, so the first point IS the first Ethos and the
 * last IS today's. The ring and the dot then sit on the two numbers the
 * stage's change subtracts, and the line ends where the number printed
 * over it is, whatever the history (a trailing mean ended 10 points
 * over 662 on the tour's account). Drawn on at least LINE_SPAN points,
 * centred on its own range.
 */
export function ethosLine(series: readonly number[]): [number, number][] | null {
  const n = series.length;
  if (n < 2) return null;
  const smooth = series.map((_, i) => {
    const w = Math.min(2, i, n - 1 - i);
    const slice = series.slice(i - w, i + w + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const lo = Math.min(...smooth);
  const hi = Math.max(...smooth);
  const span = Math.max(LINE_SPAN, hi - lo);
  const floor = (lo + hi) / 2 - span / 2;
  return smooth.map((v, i) => [i / (n - 1), 1 - (v - floor) / span]);
}

/**
 * A monotone curve through points in px (Fritsch and Carlson): it never
 * swings past a point's value between two points, so the line shows no
 * high or low that no recording had.
 */
export function linePath(pts: readonly [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(pts[i][0] + h)} ${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}

/**
 * The all-time best (#506, the house's best grammar, #421): the
 * recording with the highest Ethos over every recording the account
 * holds (the spine, not the free plan's seven days), the first to reach
 * it when two tie, since that one set it. Null under two scored
 * recordings: a best of one is only the number.
 */
export function bestRecording<T extends { created_at: string; ethos_index: number | null }>(
  oldestFirst: readonly T[]
): T | null {
  let best: T | null = null;
  let scored = 0;
  for (const r of oldestFirst) {
    if (r.ethos_index === null) continue;
    scored += 1;
    if (best === null || r.ethos_index > (best.ethos_index as number)) best = r;
  }
  return scored >= 2 ? best : null;
}

/**
 * The Log's list (#506): every recording the account holds, newest
 * first, from the spine (`fetchRepSpine` reads them all, a few columns
 * each), less what a cutoff holds back (the free plan's seven days,
 * counted in `hidden`). Each row is the recording's whole read where the
 * newest 90 hold it, so a round keeps its level and Hostile its claim,
 * and the spine's own row past them. Before, the list was the whole
 * reads alone: past 90 recordings "Recordings 100" stood over 90 rows,
 * and the oldest ten had no door.
 */
export function logList<T extends { id: string; created_at: string }>(
  spine: readonly T[],
  whole: readonly T[],
  cutoff = -Infinity
): { rows: T[]; hidden: number; total: number } {
  const every = spine.length > 0 ? spine : whole;
  const byId = new Map(whole.map((r) => [r.id, r]));
  const rows: T[] = [];
  let hidden = 0;
  for (let i = every.length - 1; i >= 0; i--) {
    const r = every[i];
    if (new Date(r.created_at).getTime() < cutoff) hidden += 1;
    else rows.push(byId.get(r.id) ?? r);
  }
  return { rows, hidden, total: every.length };
}

/**
 * A row's day in words (#506): "Today", "Yesterday", then the weekday
 * and the date ("Sun 15 Nov"), on the phone's own calendar.
 */
export function dayWords(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const back = Math.round((day(now) - day(d)) / 86_400_000);
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  /* Two reads joined by a space, so no locale puts a comma after the
     weekday ("Mon, 16 Nov" in en-AU). */
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${weekday} ${date}`;
}
