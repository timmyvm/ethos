/**
 * Which lesson the Lessons page hands its one tap to.
 *
 * The page used to be a gallery of fifteen equal pictures and nothing
 * on it said where you were, so it read as a shop window: a first-time
 * user asked whether she had to pay for them. A list you move through
 * has a next thing, and the next thing gets the tap (the Duolingo and
 * Headspace pattern).
 *
 * The order: a lesson already started, in the trait they named first;
 * then any lesson already started; then the first unfinished lesson in
 * the trait they named; then the first unfinished lesson at all. Null
 * once all fifteen are done, and the page shows no tap at all then.
 */

import { LESSONS, type Lesson } from "@/content/lessons";
import type { TraitId } from "@/content/traits";
import { PAINS } from "@/content/portfolio";
import { substance } from "./metrics";
import { readTraitsFromRow } from "./trait-readings";

export function upNextLesson(
  done: Record<string, number>,
  focus: TraitId | null,
  lessons: Lesson[] = LESSONS
): Lesson | null {
  const d = (l: Lesson) => done[l.id] ?? 0;
  const started = (l: Lesson) => d(l) > 0 && d(l) < l.practices.length;
  const open = (l: Lesson) => d(l) < l.practices.length;
  const mine = (l: Lesson) => focus !== null && l.trait === focus;
  return (
    lessons.find((l) => mine(l) && started(l)) ??
    lessons.find(started) ??
    lessons.find((l) => mine(l) && open(l)) ??
    lessons.find(open) ??
    null
  );
}

/**
 * Which trait an introduction answer points at, by the pain's own
 * metric rather than by sniffing its words (#294): "sounding flat" is
 * measured as range and never matched a substring. The two structure
 * pains have no trait among the five and stay unmarked on purpose.
 */
export function traitForSaid(said: string | null | undefined): TraitId | null {
  if (!said) return null;
  const metric = PAINS.find((p) => p.said === said)?.metric;
  const BY_METRIC: Record<string, TraitId> = {
    fillers: "fillers",
    wpm: "pace",
    pause: "pause",
    range: "range",
  };
  return metric ? (BY_METRIC[metric] ?? null) : null;
}

/**
 * The number each trait's section on Lessons opens with, and the one the
 * lesson page calls "Your number": the last recording's reading, in the
 * trait's own unit (lib/trait-readings.ts, the one definition of "your
 * pausing"). A number, not a description (#317: no trait descriptions).
 *
 * Absent, never zero, wherever the row cannot say: no recordings, a row
 * with no length or no words, and Restarts on a row that stored no
 * restarts score (readTraitsFromRow reads that as a rate of 0, which
 * would print "0 restarts per hundred words" for a number nobody took).
 * `rows` is the log oldest first, as fetchReps returns it.
 */
export function lastReadings(
  rows: Parameters<typeof readTraitsFromRow>[0][]
): Partial<Record<TraitId, number>> {
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  if (!last || !(last.duration_s > 0)) return {};
  if (substance(last.transcript ?? "").wordCount === 0) return {};
  const out: Partial<Record<TraitId, number>> = {};
  for (const r of readTraitsFromRow(last)) {
    if (!Number.isFinite(r.raw)) continue;
    if (r.id === "repairs" && typeof last.dimensions?.tier1?.repairs !== "number") continue;
    out[r.id] = r.raw;
  }
  return out;
}
