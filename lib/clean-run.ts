/**
 * The clean run (DECISIONS #254): the longest stretch of a recording
 * with no filler in it.
 *
 * Every other measure in Ethos is a rate or a position. This one is a
 * DURATION, and a duration is the only speech number a body already
 * knows how to feel: "I went forty seconds without stumbling" needs no
 * scale, no population and no explanation, which is exactly what the
 * home card was missing when it led with an index out of a thousand.
 *
 * It is computed from the filler timestamps that are already stored on
 * every recording (`FillerHit.t`), so it is free and it is retroactive:
 * every recording ever taken already has one.
 *
 * What it deliberately does NOT include: self-corrections. Those are
 * counted but not timestamped (`repairCount` has no `t`), and a number
 * that silently ignores half of what it claims to measure is worse than
 * a narrower number that is exactly true. So this is fillers only, and
 * it says so wherever it appears.
 */

import type { FillerHit } from "./metrics";

export interface CleanRun {
  /** The length of the longest filler-free stretch, in seconds. */
  seconds: number;
  /** Where it started and ended, so the player can seek to it. */
  from: number;
  to: number;
  /** True when the whole recording was clean: there is no "longest". */
  whole: boolean;
}

/**
 * Pure. `fillers` need not be sorted; a filler past the end of the
 * recording is clamped rather than trusted, because a transcript can
 * carry a word timed a hair past the last audio frame.
 */
export function longestCleanRun(
  fillers: FillerHit[],
  durationS: number
): CleanRun {
  const end = Math.max(0, durationS);
  if (!Number.isFinite(end) || end === 0) {
    return { seconds: 0, from: 0, to: 0, whole: false };
  }

  const marks = fillers
    .map((f) => f.t)
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.max(0, Math.min(end, t)))
    .sort((a, b) => a - b);

  if (marks.length === 0) {
    return { seconds: end, from: 0, to: end, whole: true };
  }

  /*
   * The gaps are the silences BETWEEN the stumbles, plus the run-up to
   * the first one and the run-out after the last. Both ends count: the
   * clean thirty seconds before somebody's first "um" is the same
   * achievement as thirty clean seconds in the middle.
   */
  let best = { seconds: 0, from: 0, to: 0 };
  let cursor = 0;
  for (const t of [...marks, end]) {
    const len = t - cursor;
    if (len > best.seconds) best = { seconds: len, from: cursor, to: t };
    cursor = t;
  }

  return { ...best, whole: false };
}

/**
 * "41s" for the number, "every 14s" for the interval. One place, so the
 * home card and the results screen round the same way.
 */
export function seconds(n: number): string {
  return `${Math.round(n)}s`;
}

/**
 * A rate turned into the gap a body feels. 4.3 fillers a minute is not
 * a quantity anybody has an instinct for; "one every 14 seconds" is.
 * Null when there were none at all, because "one every infinity
 * seconds" is not a sentence.
 */
export function interval(perMin: number): number | null {
  if (!Number.isFinite(perMin) || perMin <= 0) return null;
  return 60 / perMin;
}
