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
