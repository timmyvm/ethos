/**
 * Streak tiers (DECISIONS #253). Four of them, and the mark changes at
 * each one.
 *
 * A counter that only ever counts has nothing to cross. The closure
 * research (`docs/closure.md`) is consistent on one thing: what moves
 * people is a bounded remainder they can see, and "day 47" is not
 * bounded. Four named tiers give a long streak something to be part way
 * through, so the ring on the streak has an arc that means something.
 *
 * The boundaries are not round numbers for their own sake:
 *
 *   Spark   1 to 9    the days before it is a habit at all
 *   Flame   10 to 30  a fortnight in, past the point most people quit
 *   Torch   31 to 75  a month, which is the first streak worth losing
 *   Beacon  76+       open ended, because a ceiling on a habit is a
 *                     reason to stop
 *
 * The fourth tier has no end on purpose. Every tier below it has a
 * remainder to close; the last one has a number that only grows, and
 * somebody 400 days in does not need a new badge, they need the app to
 * stop pretending the badge was the point.
 *
 * Nothing here is bought, and nothing here is a star (#10): the tiers
 * are a property of days, and days are not purchasable.
 */

export type StreakTierId = "spark" | "flame" | "torch" | "beacon";

export interface StreakTier {
  id: StreakTierId;
  name: string;
  /** First day of this tier. */
  from: number;
  /** Last day, or null for the open-ended top tier. */
  to: number | null;
}

export const STREAK_TIERS: StreakTier[] = [
  { id: "spark", name: "Spark", from: 1, to: 9 },
  { id: "flame", name: "Flame", from: 10, to: 30 },
  { id: "torch", name: "Torch", from: 31, to: 75 },
  { id: "beacon", name: "Beacon", from: 76, to: null },
];

export interface StreakStanding {
  tier: StreakTier;
  /** How far through this tier, 0 to 1. The top tier is always 1. */
  progress: number;
  /** Days until the next tier, or null at the top. */
  toGo: number | null;
  next: StreakTier | null;
}

/**
 * Where a streak stands. Pure, so the tests can walk every boundary
 * rather than trusting the arithmetic by eye.
 *
 * Day 0 is not a tier: somebody with no streak is not a Spark waiting
 * to happen, they are somebody who has not recorded today, and dressing
 * that up is the manufactured feeling vision.md rules out.
 */
export function standing(days: number): StreakStanding | null {
  if (!Number.isFinite(days) || days < 1) return null;
  const n = Math.floor(days);
  const i = STREAK_TIERS.findIndex((t) => n >= t.from && (t.to === null || n <= t.to));
  const tier = STREAK_TIERS[i];
  const next = STREAK_TIERS[i + 1] ?? null;
  if (tier.to === null) return { tier, progress: 1, toGo: null, next: null };
  const span = tier.to - tier.from + 1;
  return {
    tier,
    progress: (n - tier.from + 1) / span,
    toGo: tier.to - n + 1,
    next,
  };
}

/** True on the day a streak crosses into a new tier: the moment. */
export function crossed(before: number, after: number): StreakTier | null {
  const a = standing(before)?.tier.id ?? null;
  const b = standing(after);
  if (b === null || b.tier.id === a) return null;
  return b.tier;
}
