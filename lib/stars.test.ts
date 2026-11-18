import { describe, expect, it } from "vitest";
import {
  MIN_WORDS_TO_SCORE,
  STAR_THREE_SLIPS_PER_MIN,
  STAR_TWO_SLIPS_PER_MIN,
  slipLimit,
  starGoals,
  starsFor,
  type Substance,
} from "./metrics";

/*
 * The stars are three goals (DECISIONS #504): a real answer, fewer slips
 * than 11 a minute, fewer than 3. Each one is drawn under its star on
 * the results, so the words and the count are held to the same numbers.
 */
const real: Substance = { wordCount: 120, distinctRatio: 0.6, repeatShare: 0.05 };
const thin: Substance = { wordCount: 12, distinctRatio: 0.9, repeatShare: 0 };
const looped: Substance = { wordCount: 32, distinctRatio: 0.2, repeatShare: 0.6 };

describe("the slip limit", () => {
  it("is the rate held as a count for the take's length", () => {
    expect(slipLimit(11, 60)).toBe(11);
    expect(slipLimit(11, 62)).toBe(12);
    expect(slipLimit(3, 62)).toBe(4);
    expect(slipLimit(3, 40)).toBe(2);
    expect(slipLimit(3, 41)).toBe(3);
  });
  it("never asks for fewer than none", () => {
    expect(slipLimit(3, 15)).toBe(1);
    expect(slipLimit(11, 0)).toBe(1);
  });
  it("lands whole minutes on the rate itself, never one over by rounding", () => {
    for (const s of [20, 40, 60, 80, 100, 120]) expect(slipLimit(3, s)).toBe((3 * s) / 60);
  });
});

describe("the stars", () => {
  it("gives none to a take with no real answer, however clean", () => {
    expect(starsFor({ slips: 0, durationS: 8, substance: thin })).toBe(0);
    expect(starsFor({ slips: 0, durationS: 40, substance: looped })).toBe(0);
  });
  it("gives the first to any real answer, however many slips", () => {
    expect(starsFor({ slips: 40, durationS: 62, substance: real })).toBe(1);
  });
  it("gives the second under 11 slips a minute and the third under 3", () => {
    expect(starsFor({ slips: 12, durationS: 62, substance: real })).toBe(1);
    expect(starsFor({ slips: 11, durationS: 62, substance: real })).toBe(2);
    expect(starsFor({ slips: 4, durationS: 62, substance: real })).toBe(2);
    expect(starsFor({ slips: 3, durationS: 62, substance: real })).toBe(3);
    expect(starsFor({ slips: 0, durationS: 62, substance: real })).toBe(3);
  });
  it("takes each star in order: a clean take too thin to score earns none", () => {
    expect(starsFor({ slips: 0, durationS: 5, substance: thin })).toBe(0);
  });
});

describe("the goals under the stars", () => {
  it("name each star's goal in three words or fewer", () => {
    expect(starGoals(62)).toEqual([`${MIN_WORDS_TO_SCORE}+ words`, "Under 12 slips", "Under 4 slips"]);
    for (const g of [...starGoals(62), ...starGoals(15), ...starGoals(240)]) {
      expect(g.split(/\s+/).length, g).toBeLessThanOrEqual(3);
      expect(g, g).not.toMatch(/—|–|\.$/);
    }
  });
  it("say no slips where none are allowed", () => {
    expect(starGoals(15)).toEqual(["20+ words", "Under 3 slips", "No slips"]);
  });
  /* The goal under a star and the star can never disagree: for every
     length and count, a star is lit exactly when the count is under the
     number its goal names. */
  it("agree with the stars at every length and count", () => {
    const limit = (goal: string) => (goal === "No slips" ? 1 : Number(goal.split(" ")[1]));
    for (let d = 4; d <= 180; d += 0.37) {
      const durationS = Math.round(d * 100) / 100;
      const [, two, three] = starGoals(durationS);
      for (let slips = 0; slips <= 40; slips++) {
        const stars = starsFor({ slips, durationS, substance: real });
        expect(stars >= 2, `${durationS}s ${slips}`).toBe(slips < limit(two));
        expect(stars >= 3, `${durationS}s ${slips}`).toBe(slips < limit(three));
      }
    }
  });
});

/*
 * The cut points against the data (DECISIONS #504). Production's last 30
 * days, aggregates only: 213 takes; under the old rule 128 at one star,
 * 50 at two, 35 at three; the filler-only rate a minute at p10/25/40/50/
 * 60/75/90 of 0, 1.0, 2.2, 3.1, 4.1, 6.5, 10.1; the length at p10/50/90 of
 * 20, 41 and 74 seconds. Restarts have no column, so their rate is the
 * unknown: a lognormal (median 3.5 a minute, spread 0.7, rank-correlated
 * 0.3 with the fillers) fitted so the old rule reproduces its own 16% and
 * 23%, with 6% of takes too thin to score and 15% under the old
 * substance cap. Under that fit the new rule must land star two on
 * 65 to 75% of scored takes and star three on 15 to 25%, the targets of
 * #504. The other fits tried (unscorable 3 to 10%, capped 5 to 25%) put
 * star two at 64 to 77% and star three at 19 to 24%.
 */
describe("the cut points against production's last 30 days", () => {
  let seed = 777;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  const randn = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
  const erf = (x: number) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  };
  const ncdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
  const poisson = (l: number) => {
    const L = Math.exp(-l);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rand();
    } while (p > L);
    return k - 1;
  };
  const interp = (pts: [number, number][], p: number) => {
    for (let i = 1; i < pts.length; i++) {
      if (p <= pts[i][0]) {
        const [p0, v0] = pts[i - 1];
        const [p1, v1] = pts[i];
        return v0 + ((v1 - v0) * (p - p0)) / (p1 - p0);
      }
    }
    return pts[pts.length - 1][1];
  };
  const FILLERS: [number, number][] = [[0, 0], [0.1, 0], [0.25, 1], [0.4, 2.2], [0.5, 3.1], [0.6, 4.1], [0.75, 6.5], [0.9, 10.1], [1, 22]];
  const LENGTH: [number, number][] = [[0, Math.log(6)], [0.1, Math.log(20)], [0.5, Math.log(41)], [0.9, Math.log(74)], [1, Math.log(150)]];
  const takes = Array.from({ length: 40000 }, () => {
    const z1 = randn();
    const z2 = 0.3 * z1 + Math.sqrt(1 - 0.09) * randn();
    const durationS = Math.round(Math.exp(interp(LENGTH, rand())) * 100) / 100;
    const min = durationS / 60;
    const slips = Math.round(interp(FILLERS, ncdf(z1)) * min) + poisson(3.5 * Math.exp(0.7 * z2) * min);
    return { durationS, slips, scorable: rand() >= 0.06, capped: rand() < 0.15 };
  });
  const share = (n: number, of: number) => n / of;

  it("reproduces the old rule's own split, so the fit is the data's", () => {
    let three = 0;
    let two = 0;
    for (const t of takes) {
      if (!t.scorable) continue;
      const rate = t.slips / (t.durationS / 60);
      if (rate < 3 && !t.capped) three++;
      else if (rate < 6) two++;
    }
    expect(share(three, takes.length)).toBeGreaterThan(35 / 213 - 0.02);
    expect(share(three, takes.length)).toBeLessThan(35 / 213 + 0.02);
    expect(share(two, takes.length)).toBeGreaterThan(50 / 213 - 0.02);
    expect(share(two, takes.length)).toBeLessThan(50 / 213 + 0.02);
  });

  it("lands star two on 65 to 75% of scored takes and star three on 15 to 25%", () => {
    const scored = takes.filter((t) => t.scorable);
    const stars = scored.map((t) => starsFor({ slips: t.slips, durationS: t.durationS, substance: real }));
    const two = share(stars.filter((s) => s >= 2).length, scored.length);
    const three = share(stars.filter((s) => s === 3).length, scored.length);
    expect(two).toBeGreaterThanOrEqual(0.65);
    expect(two).toBeLessThanOrEqual(0.75);
    expect(three).toBeGreaterThanOrEqual(0.15);
    expect(three).toBeLessThanOrEqual(0.25);
  });

  it("keeps each star harder than the one before", () => {
    expect(STAR_TWO_SLIPS_PER_MIN).toBeGreaterThan(STAR_THREE_SLIPS_PER_MIN);
  });
});
