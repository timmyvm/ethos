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
import type { TraitId } from "@/content/traits";
import { DRILLS } from "./drills";
import { gameById } from "./games";
import { parsePracticeId } from "./lesson-progress";
import { dimensionPoints, INDEX_WEIGHTS } from "./index-score";
import { TRAITS, type TraitKey } from "./traits";

/** The pace band the results walk already names (RepResult). */
export const WPM_ZONE = { low: 130, high: 160 } as const;

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
 * 130–160" is sage, "over 160" or "under 130" is rust. A distance to a
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
  return { ...base, change: `in ${WPM_ZONE.low}–${WPM_ZONE.high}`, direction: "up" };
}

/** The four rows everyone sees, oldest recording first. */
export function movedRows(reps: RepRow[]): MovedRow[] {
  const index = reps
    .filter((r) => r.ethos_index !== null)
    .map((r) => r.ethos_index as number);
  return [
    endpoints("index", "Ethos Index", index),
    endpoints("fillers", "Fillers / min", reps.map(fpm), { decimals: 1, invert: true }),
    paceRow(reps.map((r) => r.wpm)),
    endpoints("held", "Held pauses", reps.map(held)),
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
 * debrief speaks (#101), skipping recordings that never carried it.
 */
export function skillRows(reps: RepRow[]): MovedRow[] {
  return TRAITS.map((t) => {
    const series: number[] = [];
    for (const r of reps) {
      const d = r.dimensions;
      if (!d) continue;
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
 * five shapes: a lesson's practice (`lesson:<id>:<n>`), a path item
 * (`pause-1-3`), a road drill (`f1`), a game (`game:<id>:<q>`) or a
 * boss topic (`boss:<id>`). Only the road drill used to resolve, so
 * every recording made from Today or a lesson was called "Recording".
 */
export function recordingName(r: Pick<RepRow, "lesson_id" | "mode">): string {
  const id = r.lesson_id;
  const practice = parsePracticeId(id);
  const lesson = practice ? lessonById(practice.lessonId) : null;
  if (lesson) return lesson.title;
  const item = pathItemById(id);
  if (item) return item.title;
  const drill = id ? DRILLS.find((d) => d.id === id) : null;
  if (drill) return drill.title;
  const game = id?.startsWith("game:") ? gameById(id.split(":")[1]) : null;
  if (game) return game.name;
  return r.mode === "boss" ? "Boss" : "Recording";
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
