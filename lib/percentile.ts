/**
 * Percentiles (DECISIONS #256). The maths only: where the numbers come
 * from, and how good they are, is `content/norms.ts` and
 * `docs/percentiles.md`.
 *
 * The job is to turn one measurement of one person into "you are at the
 * Nth percentile", honestly. Three things make that harder than it
 * sounds, and each one is a decision recorded here rather than a line
 * of arithmetic nobody can find later.
 *
 * 1. DIRECTION. For most speech traits the raw scale is not the health
 *    scale. Fewer fillers is better, so the percentile has to invert.
 *
 * 2. BANDS. Speech rate has no "more is better": too slow and too fast
 *    are both worse than the middle. A percentile of the raw value
 *    would tell somebody speaking at 210 wpm that they beat 97% of
 *    people, which is true and useless. So a banded trait is ranked on
 *    DISTANCE FROM THE BAND CENTRE, and the percentile answers "how
 *    many people are further from the middle than you". The assumption
 *    that buys — that the two sides of the band cost the same — is
 *    stated in docs/percentiles.md because it is the shakiest thing
 *    here.
 *
 * 3. SHAPE. Rates that cannot go below zero and have a long right tail
 *    (fillers a minute, pause length) are log-normal, not normal.
 *    Using a normal there puts a quarter of the population below zero,
 *    which shows up as everybody scoring above the 50th.
 *
 * Everything is a pure function of the parameters, so
 * `lib/percentile.test.ts` can check the maths against values computed
 * independently rather than against itself.
 */

/**
 * The standard normal CDF, via the Abramowitz and Stegun 7.1.26
 * approximation to erf. Absolute error below 1.5e-7, which is four
 * orders of magnitude tighter than the norms it will be applied to.
 */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * The inverse, via Acklam's rational approximation (relative error
 * below 1.15e-9). Needed for the other direction: "what would I have to
 * hit to move up five points" is a quantile question, and answering it
 * by searching the CDF would be slower and less exact for no reason.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - plow) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * How a trait's raw scale relates to its health scale.
 *
 *   lower   fewer is better (fillers a minute, self-corrections)
 *   higher  more is better (lexical variety)
 *   band    there is a middle, and both sides of it are worse (pace)
 */
export type Direction = "lower" | "higher" | "band";

/** The shape of the population's raw values. */
export type Shape = "normal" | "lognormal";

export interface Norm {
  shape: Shape;
  /**
   * For "normal", the mean and SD of the value itself. For "lognormal",
   * the mean and SD OF ITS NATURAL LOG, which is what the papers that
   * fit log-normals report and what `fromMedian` builds.
   */
  mu: number;
  sigma: number;
  direction: Direction;
  /** Required when direction is "band": the healthy range. */
  band?: { lo: number; hi: number };
}

/**
 * Build a log-normal from the numbers papers usually give: a median (or
 * geometric mean) and the ratio between the 84th percentile and the
 * median, which is one log-SD up.
 *
 * Here because doing it at each call site is how a sigma ends up being
 * the SD of the raw values in one trait and of their logs in another,
 * and nothing downstream would ever notice.
 */
export function fromMedian(median: number, ratio84: number): Pick<Norm, "mu" | "sigma"> {
  return { mu: Math.log(median), sigma: Math.log(ratio84) };
}

/** P(X ≤ x) under the norm's own shape. */
function cdf(x: number, n: Norm): number {
  if (n.shape === "lognormal") {
    if (x <= 0) return 0;
    return normalCdf((Math.log(x) - n.mu) / n.sigma);
  }
  return normalCdf((x - n.mu) / n.sigma);
}

/** The value at probability p under the norm's own shape. */
function quantile(p: number, n: Norm): number {
  const z = normalQuantile(p);
  return n.shape === "lognormal" ? Math.exp(n.mu + n.sigma * z) : n.mu + n.sigma * z;
}

/**
 * Where one measurement sits, 0 to 100, as "the percentage of the
 * population you are doing BETTER than on this trait".
 *
 * Rounded to a whole number, because a percentile with a decimal claims
 * a precision no speech norm in the literature can support, and because
 * "58th" is a thing a person can hold and "58.3rd" is not.
 */
export function percentile(value: number, n: Norm): number {
  return Math.round(100 * fraction(value, n));
}

/** The same, unrounded, for the ring: 0 to 1. */
export function fraction(value: number, n: Norm): number {
  if (!Number.isFinite(value)) return 0;

  if (n.direction === "band") {
    const band = n.band;
    if (!band) throw new Error("a banded norm needs a band");
    const centre = centreOf(band, n);
    const mine = Math.abs(transform(value, n) - centre);
    /*
     * How many people are FURTHER from the middle than this. Both tails
     * count, and they are not symmetric once the population's own mean
     * sits off-centre in the band, which is why this is computed rather
     * than doubled.
     */
    const below = cdfT(centre - mine, n);
    const above = 1 - cdfT(centre + mine, n);
    return clamp(below + above);
  }

  const p = cdf(value, n);
  return clamp(n.direction === "lower" ? 1 - p : p);
}

/**
 * A banded trait is ranked in the space the norm is fitted in: for a
 * log-normal that is log space, or the "middle" of a 130 to 160 band
 * would be the arithmetic 145 while the population's own middle sat
 * somewhere else entirely.
 */
function transform(x: number, n: Norm): number {
  return n.shape === "lognormal" ? Math.log(Math.max(1e-9, x)) : x;
}
function centreOf(band: { lo: number; hi: number }, n: Norm): number {
  return (transform(band.lo, n) + transform(band.hi, n)) / 2;
}
/** CDF in the transformed space, so the band maths stays in one space. */
function cdfT(t: number, n: Norm): number {
  return normalCdf((t - n.mu) / n.sigma);
}
function clamp(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * What would you have to hit to be `points` higher? The whole reason
 * the model exists: a percentile nobody can act on is a horoscope with
 * a number in it.
 *
 * Returns null when the target is already past 100, or when the trait
 * is banded and the answer would be two different numbers depending on
 * which side of the middle you are standing. (It is not: the answer is
 * always "closer to the middle", so a banded trait returns the value
 * that distance from the centre, on the side you are already on.)
 */
export function valueFor(
  target: number,
  n: Norm,
  currentValue?: number
): number | null {
  const p = target / 100;
  if (!(p > 0 && p < 1)) return null;

  if (n.direction === "band") {
    const band = n.band;
    if (!band) throw new Error("a banded norm needs a band");
    const centre = centreOf(band, n);
    /*
     * Solve for the distance d where below(d) + above(d) = p. Both
     * terms fall monotonically in d, so a bisection converges fast and
     * cannot be tripped by the asymmetry an off-centre population
     * introduces.
     */
    const at = (d: number) =>
      cdfT(centre - d, n) + (1 - cdfT(centre + d, n));
    let lo = 0;
    let hi = 10 * n.sigma;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid) > p) lo = mid;
      else hi = mid;
    }
    const d = (lo + hi) / 2;
    const side =
      currentValue !== undefined && transform(currentValue, n) < centre ? -1 : 1;
    const t = centre + side * d;
    return n.shape === "lognormal" ? Math.exp(t) : t;
  }

  return quantile(n.direction === "lower" ? 1 - p : p, n);
}
