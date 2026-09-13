/**
 * Reading the traits off a recording (DECISIONS #257).
 *
 * NOT `lib/traits.ts`, which is a different and older idea with the
 * same word on it: nine Index dimensions turned into LEVELS on the
 * profile. The shift retires that — no levels, no stars as a unit of
 * progress — but /you, the results screen and the log still read it,
 * so it stays until the star system comes out and this lives beside it
 * under a name that says which one it is.
 *
 * One place that says, for every trait: what raw number comes out of
 * `RepMetrics`, where that number sits against the population, and how
 * much the placement is worth trusting. Everything downstream — the
 * cards, the ring, which lesson comes next — reads this and nothing
 * else, so there is one definition of "your pausing" in the app.
 *
 * The raw EXTRACTORS live here. The DISTRIBUTIONS live in
 * `content/norms.ts` with their citations, because a number that places
 * somebody against the general population needs a source beside it.
 */

import { NORMS, type NormQuality } from "@/content/norms";
import { TRAIT, TRAITS, type TraitId } from "@/content/traits";
import { FILLED_PAUSES, per100, substance, type RepMetrics } from "./metrics";
import { REPAIR_ZERO_AT } from "./index-score";
import { fraction, percentile, valueFor } from "./percentile";

export interface TraitReading {
  id: TraitId;
  /** The measurement, in the trait's own unit. */
  raw: number;
  /** 0 to 100, "the percentage of people you are doing better than". */
  percentile: number;
  /** The same unrounded, for the ring. */
  fraction: number;
  /** How much the PLACEMENT is worth trusting. Not the measurement. */
  quality: NormQuality;
}

/**
 * The raw number per trait. Each one is a single field of `RepMetrics`
 * or one division away from it, on purpose: a trait whose raw value
 * needs a paragraph of derivation is a trait nobody can check.
 */
const RAW: Record<TraitId, (m: RepMetrics) => number> = {
  /*
   * Pausing is measured as LANDED pauses a minute, not all pauses.
   * Ethos's whole position on silence is that placement is the skill
   * (`pause-quality.ts`), and a count that included the searching ones
   * would go UP when somebody got worse.
   */
  pause: (m) => perMin(m.composedPauses, m.durationS),
  /*
   * Filled pauses per hundred words, not all fillers per minute. Two
   * separate reasons, both in docs/percentiles.md.
   *
   * The SET, because every published rate counts um and uh and nothing
   * else, and Ethos also counts like, you know and basically. Placing
   * somebody against one set while measuring another is not a
   * percentile, it is a subtraction between two different quantities.
   *
   * The UNIT, because per minute rewards talking faster. The same
   * speaker at 120 and at 160 words a minute, saying "um" exactly as
   * often per sentence, appears to have cut a third of them.
   */
  fillers: (m) => m.filledPer100,
  repairs: (m) => m.repairsPerMin,
  pace: (m) => m.wpm,
  /* Distinct words per hundred spoken: the lexical measure the Index
     already calls "range", scaled to a unit a person can picture. */
  range: (m) => m.substance.distinctRatio * 100,
};

function perMin(count: number, durationS: number): number {
  if (!Number.isFinite(durationS) || durationS <= 0) return 0;
  return (count * 60) / durationS;
}

/** Every trait, read off one recording, in the order they are defined. */
export function readTraits(m: RepMetrics): TraitReading[] {
  return TRAITS.map((t) => {
    const norm = NORMS[t.id];
    const raw = RAW[t.id](m);
    return {
      id: t.id,
      raw,
      percentile: percentile(raw, norm),
      fraction: fraction(raw, norm),
      quality: norm.quality,
    };
  });
}

/**
 * The next lesson, and the reason for it. This IS the road now: there
 * is no fixed order, and the answer to "why this one" is always a
 * number the person can see.
 *
 * A provisional trait cannot be the reason. Sending somebody to a
 * lesson because of a percentile the evidence does not support would
 * be the one dishonest thing the whole model exists to avoid, so those
 * traits show their card and wait for real data.
 */
export function nextTrait(readings: TraitReading[]): {
  next: TraitReading;
  /** The traits it passed over, strongest first, so the card can say so. */
  skipped: TraitReading[];
} | null {
  const usable = readings.filter((r) => r.quality !== "provisional");
  if (usable.length === 0) return null;
  const sorted = [...usable].sort((a, b) => a.percentile - b.percentile);
  return {
    next: sorted[0],
    skipped: sorted.slice(1).reverse(),
  };
}

/**
 * What this person would have to hit to be `points` higher on a trait,
 * in the trait's own unit. The card's "how do I raise this 5%" is this
 * number and nothing else: a percentile nobody can act on is a
 * horoscope with a number in it.
 */
export function targetFor(r: TraitReading, points = 5): number | null {
  const target = Math.min(99, r.percentile + points);
  return valueFor(target, NORMS[r.id], r.raw);
}

/**
 * The raw measurement, printed. One decimal under ten, none above:
 * "1.8 held pauses a minute" is a number somebody can picture and
 * "155.4 words a minute" is a number pretending to a precision a
 * sixty-second sample does not have.
 */
export function fmtRaw(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
}

/**
 * The measurement with its unit, singular where the printed value is
 * one. On the DISPLAYED value and not the raw one, because 0.997 prints
 * as "1" and then reads "1 restarts a minute".
 */
export function withUnit(id: TraitId, raw: number): string {
  const shown = fmtRaw(raw);
  const t = TRAIT[id];
  return `${shown} ${shown === "1" ? t.unitOne : t.unit}`;
}

/**
 * "31st", "62nd", "13th". A percentile is read aloud as an ordinal and
 * printing "31 percentile" is the tell of a number that was never meant
 * to be said out loud.
 */
export function ordinal(n: number): string {
  const v = Math.round(n);
  const rem100 = v % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${v}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[v % 10] ?? "th";
  return `${v}${suffix}`;
}

/**
 * The one concrete move, in the trait's own units: how far the raw
 * number has to travel, which way, and where it lands.
 *
 * Null when the trait has nowhere useful to go (already at the top, or
 * a norm too weak to name a target against).
 */
export function move(
  r: TraitReading,
  points = 5
): { delta: number; up: boolean; target: number } | null {
  if (r.quality === "provisional") return null;
  const target = Math.min(99, r.percentile + points);
  if (target <= r.percentile) return null;
  const want = targetFor(r, points);
  if (want === null || !Number.isFinite(want)) return null;
  const delta = want - r.raw;
  if (Math.abs(delta) < 1e-9) return null;
  return { delta: Math.abs(delta), up: delta > 0, target };
}

/**
 * The same five traits, read off a STORED recording rather than a live
 * one (DECISIONS #257).
 *
 * Four of them come straight out of the row. The fifth does not, and
 * the workaround is written down rather than hidden: `repairs_per_min`
 * is not a column, but `dimensions.tier1.repairs` is, and
 * `repairScore` is exactly invertible —
 *
 *     score = round(100 * (1 - rate / 3))   so   rate = 3 * (1 - score/100)
 *
 * which recovers the rate to within the rounding of the score, about
 * 0.015 a minute. The one place it is lossy is the floor: a score of 0
 * means "three a minute or worse" and cannot say which, so it is
 * reported as three and the trait cannot go below that. Nobody at that
 * end of the scale is served worse by a lower bound than by a blank.
 *
 * The right fix is a column, and that is worth doing before this ships
 * to anyone: every other trait here is the number itself.
 */
export function readTraitsFromRow(row: {
  duration_s: number;
  transcript: string;
  wpm: number;
  filler_count: number;
  /* Every hit carries the word it matched, so the filled pauses can be
     counted back out of a stored row without a new column. */
  fillers?: { word: string }[] | null;
  pauses: { kind: string }[];
  dimensions: { tier1: { repairs?: number } } | null;
}): TraitReading[] {
  const repairsScore = row.dimensions?.tier1?.repairs;
  const sub = substance(row.transcript);
  const filled = (row.fillers ?? []).filter((f) => FILLED_PAUSES.has(f.word));
  const m = {
    durationS: row.duration_s,
    composedPauses: row.pauses.filter((p) => p.kind === "pre").length,
    fillersPerMin: perMin(row.filler_count, row.duration_s),
    filledPauseCount: filled.length,
    filledPer100: per100(filled.length, sub.wordCount),
    repairsPerMin:
      typeof repairsScore === "number"
        ? REPAIR_ZERO_AT * (1 - repairsScore / 100)
        : 0,
    wpm: row.wpm,
    substance: sub,
  } as RepMetrics;
  return readTraits(m);
}
