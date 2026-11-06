/**
 * The log's "What moved" table (#217).
 *
 * One row grammar for every metric on the summary screen: what it is,
 * what it was on day one, what it is now, how much it moved, and the
 * series behind it. Pure arithmetic over stored reps (#30), so the page
 * only lays rows out and never decides what a number means.
 */

import type { RepRow } from "./client-data";
import { lessonById } from "@/content/lessons";
import { pathItemById } from "@/content/path";
import { TRAIT, type TraitId } from "@/content/traits";
import { DRILLS } from "./drills";
import { gameOfLessonId } from "./games";
import { HOSTILE_TAKE_ID } from "./hostile";
import { parsePracticeId } from "./lesson-progress";
import { dimensionPoints, INDEX_WEIGHTS } from "./index-score";
import { measured } from "./trait-readings";
import { topicById } from "./topics";
import { TRAITS, type TraitKey } from "./traits";
import { ALL_FILLERS_PER_MIN, HELD_PER_RECORDING } from "./metric-labels";

/** The pace band the results walk already names (RepResult). */
export const WPM_ZONE = { low: 130, high: 160 } as const;

/** The Log's labels for the every-filler rate and one recording's held pauses. */
export { ALL_FILLERS, ALL_FILLERS_PER_MIN, HELD_PER_RECORDING } from "./metric-labels";

export type Direction = "up" | "down" | "flat";

export interface MovedRow {
  key: string;
  label: string;
  /** Day-one value, formatted. Null before there is one. */
  then: string | null;
  /** Latest value, formatted. Null before there is one. */
  now: string | null;
  /** The printed change, never left for the reader to subtract. */
  change: string | null;
  /** Which way the change wears its colour (#195). */
  direction: Direction;
  /** The raw series, oldest first, for the trend track. */
  series: number[];
  /** True when lower is better, so the track draws in quiet stone. */
  invert: boolean;
}

function fpm(r: RepRow): number {
  return r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : 0;
}

function held(r: RepRow): number {
  return (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
}

function fmt(v: number, decimals = 0): string {
  return v.toFixed(decimals);
}

/** "▲ +131", "▼ 3.3": the sign is the arrow, the number is the size. */
function signed(delta: number, decimals = 0): string {
  const size = fmt(Math.abs(delta), decimals);
  return delta >= 0 ? `▲ +${size}` : `▼ ${size}`;
}

function endpoints(
  key: string,
  label: string,
  series: number[],
  opts: { decimals?: number; invert?: boolean } = {}
): MovedRow {
  const { decimals = 0, invert = false } = opts;
  if (series.length === 0) {
    return { key, label, then: null, now: null, change: null, direction: "flat", series, invert };
  }
  const first = series[0];
  const last = series[series.length - 1];
  const delta = Math.round((last - first) * 10 ** decimals) / 10 ** decimals;
  const moved = series.length > 1 && delta !== 0;
  const better = invert ? delta < 0 : delta > 0;
  return {
    key,
    label,
    then: fmt(first, decimals),
    now: fmt(last, decimals),
    change: moved ? signed(delta, decimals) : null,
    direction: moved ? (better ? "up" : "down") : "flat",
    series,
    invert,
  };
}

/**
 * Pace is the one metric with a zone rather than a direction, and the
 * zone is printed so the colour is inferable from the row (#217): "in
 * 130 to 160" is sage, "over 160" or "under 130" is rust. A distance to a
 * target the reader cannot see is not a change anyone can check.
 */
function paceRow(series: number[]): MovedRow {
  const base = endpoints("wpm", "Words / min", series);
  if (base.now === null) return base;
  const last = series[series.length - 1];
  if (last > WPM_ZONE.high) {
    return { ...base, change: `over ${WPM_ZONE.high}`, direction: "down" };
  }
  if (last < WPM_ZONE.low) {
    return { ...base, change: `under ${WPM_ZONE.low}`, direction: "down" };
  }
  return { ...base, change: `in ${WPM_ZONE.low} to ${WPM_ZONE.high}`, direction: "up" };
}

/**
 * A trailing mean over the last `n` values (log-23): each point is the
 * average of itself and the n - 1 before it, so the first points
 * average what exists. Same length as the series and the same first
 * value, so a smoothed trend still starts at the Day 1 number printed
 * beside it. Per-recording WPM and held pauses are noisy enough that,
 * at 2px a recording in a 44px track, the raw line reads as hatching.
 */
export function rolling(series: number[], n: number): number[] {
  const size = Math.max(1, Math.floor(n));
  let sum = 0;
  return series.map((v, i) => {
    sum += v;
    if (i >= size) sum -= series[i - size];
    return sum / Math.min(i + 1, size);
  });
}

/**
 * Day 1 vs now (ComparisonCard, ShareCard): the first and the latest
 * recordings that measured something, by the rule What moved reads its
 * three measurements with. A take too short to score is stored with no
 * fillers and no pauses, and as "now" it printed fillers 9.3 to 0.0 in
 * green (regression review, edges F5). Null under two.
 */
export function sinceDayOne(reps: RepRow[]): { first: RepRow; last: RepRow } | null {
  const kept = reps.filter(measured);
  return kept.length < 2 ? null : { first: kept[0], last: kept[kept.length - 1] };
}

/**
 * The four rows everyone sees, oldest recording first. The three
 * measurements read only recordings that measured something: a one-word
 * take printed Words / min 128 to 7 and Fillers 9.3 to 0.0 here. The
 * Index row is already the scored ones.
 */
export function movedRows(reps: RepRow[]): MovedRow[] {
  const index = reps
    .filter((r) => r.ethos_index !== null)
    .map((r) => r.ethos_index as number);
  const kept = reps.filter(measured);
  return [
    endpoints("index", "Ethos Index", index),
    endpoints("fillers", ALL_FILLERS_PER_MIN, kept.map(fpm), { decimals: 1, invert: true }),
    paceRow(kept.map((r) => r.wpm)),
    endpoints("held", HELD_PER_RECORDING, kept.map(held)),
  ];
}

/** Presence has its own history (#69): only video recordings carry it. */
export function presenceRow(reps: RepRow[]): MovedRow | null {
  const series = reps
    .filter((r) => r.presence_score !== null)
    .map((r) => r.presence_score as number);
  if (series.length === 0) return null;
  return endpoints("presence", "Presence", series);
}

/**
 * One row per Index dimension (#200), in the weighted points the
 * debrief speaks (#101), skipping recordings that never carried it, and
 * takes too short to score, whose stored dimensions made no Index.
 */
export function skillRows(reps: RepRow[]): MovedRow[] {
  return TRAITS.map((t) => {
    const series: number[] = [];
    for (const r of reps) {
      const d = r.dimensions;
      if (!d || !measured(r)) continue;
      const tier1 = d.tier1 as Partial<Record<TraitKey, number>>;
      const tier2 = d.tier2 as Partial<Record<TraitKey, { score: number }>> | null;
      const raw = tier1[t.key] ?? tier2?.[t.key]?.score;
      if (typeof raw === "number") {
        series.push(dimensionPoints(raw, INDEX_WEIGHTS[t.key]));
      }
    }
    return endpoints(t.key, t.name, series);
  }).filter((row) => row.series.length >= 2);
}

/**
 * What a recording is called in its row. A stored `lesson_id` is one of
 * six shapes: a lesson's practice (`lesson:<id>:<n>`), a path item
 * (`pause-1-3`), a road lesson (`f1`), a game (`game:<id>:<q>`), a boss
 * topic (`boss:<id>`) or Hostile Q&A's take (`hostile-take`). Only the
 * road lesson used to resolve, so every recording made from Today or a
 * lesson was called "Recording", and Hostile's still was (map 2.4).
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
 * The trait a recording practised, so its row can wear that trait's
 * tone (`[data-trait]`) the way the lesson does on /lessons. Null for a
 * game, a boss, a free recording and the road's Structure, Compression
 * and Thinking Under Fire units: those practise no one trait, and a
 * tone they did not earn would teach the wrong colour.
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

/** The trait a "What moved" row measures, by its key, or null. */
export function rowTrait(key: string): TraitId | null {
  const byRow: Record<string, TraitId> = {
    fillers: "fillers",
    wpm: "pace",
    held: "pause",
    // The Premium skill rows carry the Index dimension's own key.
    pause: "pause",
    repairs: "repairs",
    pace: "pace",
    range: "range",
  };
  return byRow[key] ?? null;
}
