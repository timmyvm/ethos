/**
 * What to practise today, and why (DECISIONS #268).
 *
 * ONE SELECTOR. This is the whole point of the file. Today's first card
 * used to take its title from `nextLesson` (a position on the fixed
 * road, gated on stars) and its reason from `nextFocus` (the weakest
 * entry in `SKILLS`), which are two independent calculations over two
 * different trait vocabularies. So the card said "Move the pace" and
 * then, underneath, "Range scored 58/100": a title naming one trait and
 * a reason naming another. No rewording fixes that. The card has to be
 * driven by one thing, and this is it.
 *
 * IT RANKS ON THE RAW MEASUREMENT, NOT THE PERCENTILE. Every scale in
 * `content/norms.ts` is provisional: the centres are published and the
 * between-speaker spread is not, so a percentile cannot honestly place
 * anybody yet (docs/percentiles.md). The measurement is known either
 * way. Ranking on the measurement means this works today, keeps working
 * when the norms are real, and never needs a second code path.
 *
 * To compare five numbers in five different units, each trait's raw
 * value is turned into a 0-to-1 position between a floor and a ceiling
 * taken from the same literature the norms came from. That is a
 * comparison, not a score, and it is never shown.
 */

import { PATH, type PathItem } from "@/content/path";
import type { TraitId } from "@/content/traits";
import { NORMS } from "@/content/norms";
import { ordinal, withUnit, type TraitReading } from "./trait-readings";
import type { Topic } from "./topics";

/**
 * Where a trait's raw value sits, 0 worst to 1 best, for comparison
 * only. Built from each norm's own median and spread, so the two live
 * in one place and move together: a value at the population median
 * scores 0.5 in every trait, which is what makes five different units
 * comparable at all.
 */
export function standing(trait: TraitId, raw: number): number {
  const n = NORMS[trait];
  const median = n.shape === "lognormal" ? Math.exp(n.mu) : n.mu;
  if (!Number.isFinite(raw) || median <= 0) return 0.5;

  if (n.direction === "band") {
    const lo = n.band?.lo ?? median;
    const hi = n.band?.hi ?? median;
    if (raw >= lo && raw <= hi) return 1;
    const off = raw < lo ? lo - raw : raw - hi;
    return clamp(1 - off / Math.max(1, (hi - lo) * 1.5));
  }
  const ratio = raw / median;
  /* One median above is 0 and one below is 1 for a "lower is better"
     trait, and the other way round for "higher". Linear on the ratio
     rather than the value, because these are rates. */
  const better = n.direction === "lower" ? 2 - ratio : ratio;
  return clamp(better / 2);
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export interface Chosen {
  item: PathItem;
  trait: TraitId;
  reading: TraitReading;
  /** The one sentence under the title. Names the SAME trait, always. */
  because: string;
}

/**
 * The weakest trait, then a practice for it.
 *
 * The tier is the lower one until that trait's standing clears the
 * halfway mark, and it is never named. Which of the twelve is
 * deterministic per day, so a refresh does not reshuffle the card and
 * two people on the same day are not doing the same thing.
 */
export function choosePractice(
  readings: TraitReading[],
  now: Date = new Date(),
  allowed?: (t: Topic) => boolean
): Chosen | null {
  if (readings.length === 0) return null;

  const ranked = readings
    .map((r) => ({ r, s: standing(r.id, r.raw) }))
    .sort((a, b) => a.s - b.s || a.r.id.localeCompare(b.r.id));
  const weakest = ranked[0];

  const tier: 1 | 2 = weakest.s < 0.5 ? 1 : 2;
  let pool = PATH.filter((p) => p.trait === weakest.r.id && p.tier === tier);
  if (allowed) {
    const kept = pool.filter((p) => allowed({ id: p.topicId } as Topic));
    if (kept.length > 0) pool = kept;
  }
  if (pool.length === 0) return null;

  const day = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000
  );
  const item = pool[Math.abs(day) % pool.length];

  return {
    item,
    trait: weakest.r.id,
    reading: weakest.r,
    because: because(weakest.r),
  };
}

/**
 * Why this one, in the trait's own unit.
 *
 * It quotes the MEASUREMENT and not the position, for the same reason
 * the selector ranks on it: the measurement is true today and the
 * placement is not. When a scale stops being provisional this gains the
 * percentile rather than changing its mind about the trait.
 */
export function because(r: TraitReading): string {
  return r.quality === "provisional"
    ? `${withUnit(r.id, r.raw)}. Your weakest number right now.`
    : `${withUnit(r.id, r.raw)}, the ${ordinal(r.percentile)} percentile. The lowest of your five.`;
}
