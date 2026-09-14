import { describe, expect, it } from "vitest";
import {
  fraction,
  fromMedian,
  normalCdf,
  normalQuantile,
  percentile,
  valueFor,
  type Norm,
} from "./percentile";

/**
 * The maths, checked against values computed independently rather than
 * against itself (#256). A percentile model that is self-consistent and
 * wrong is the failure mode here, and it looks exactly like a working
 * one on a screen.
 */
describe("the normal", () => {
  it("matches published values of the standard normal CDF", () => {
    // Any statistical table. Tolerance is the approximation's own.
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-2.5758)).toBeCloseTo(0.005, 5);
  });

  it("inverts itself", () => {
    for (const p of [0.001, 0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
    }
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
  });

  it("does not fall over at the edges", () => {
    expect(normalCdf(Infinity)).toBe(1);
    expect(normalCdf(-Infinity)).toBe(0);
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
  });
});

describe("direction", () => {
  const higher: Norm = { shape: "normal", mu: 100, sigma: 15, direction: "higher" };
  const lower: Norm = { shape: "normal", mu: 100, sigma: 15, direction: "lower" };

  it("puts the mean at the 50th either way", () => {
    expect(percentile(100, higher)).toBe(50);
    expect(percentile(100, lower)).toBe(50);
  });

  /* The whole point of the direction flag: one SD above the mean is
     the 84th when more is better and the 16th when less is. */
  it("inverts when fewer is better", () => {
    expect(percentile(115, higher)).toBe(84);
    expect(percentile(115, lower)).toBe(16);
    expect(percentile(85, lower)).toBe(84);
  });
});

describe("log-normal rates", () => {
  /* A rate that cannot go below zero with a long right tail. Built
     from a median and the 84th/median ratio, which is what a paper
     reporting a skewed distribution usually gives. */
  const n: Norm = { ...fromMedian(4, 2), shape: "lognormal", direction: "lower" };

  it("puts the median at the 50th", () => {
    expect(percentile(4, n)).toBe(50);
  });

  it("puts one log-SD up at the 16th, because fewer is better", () => {
    expect(percentile(8, n)).toBe(16);
    expect(percentile(2, n)).toBe(84);
  });

  /* The reason the shape flag exists: a normal fitted to a skewed rate
     puts a chunk of the population below zero, and everybody left
     scores above the 50th. */
  it("never assigns probability below zero", () => {
    expect(fraction(0, n)).toBe(1);
    expect(fraction(-5, n)).toBe(1);
  });
});

describe("banded traits", () => {
  /* Speech rate: a middle, and both sides worse. The population sits
     roughly on the band, which is the realistic case. */
  const pace: Norm = {
    shape: "normal",
    mu: 145,
    sigma: 30,
    direction: "band",
    band: { lo: 130, hi: 160 },
  };

  it("scores the centre of the band at the top", () => {
    expect(percentile(145, pace)).toBe(100);
  });

  it("scores symmetrically either side of the centre", () => {
    expect(percentile(125, pace)).toBe(percentile(165, pace));
    expect(percentile(100, pace)).toBe(percentile(190, pace));
  });

  /* The failure this exists to prevent: ranking the RAW value tells
     somebody sprinting at 210 wpm they beat 97% of people. */
  it("does not reward being far out on the fast side", () => {
    const fast = percentile(210, pace);
    expect(fast).toBeLessThan(10);
    expect(fast).toBe(percentile(80, pace));
  });

  it("falls monotonically as you move away from the middle", () => {
    let last = 101;
    for (const v of [145, 150, 158, 165, 175, 190, 210]) {
      const p = percentile(v, pace);
      expect([v, p <= last]).toEqual([v, true]);
      last = p;
    }
  });
});

describe("what would move me", () => {
  const lower: Norm = { shape: "normal", mu: 100, sigma: 15, direction: "lower" };
  const pace: Norm = {
    shape: "normal", mu: 145, sigma: 30, direction: "band", band: { lo: 130, hi: 160 },
  };

  it("round-trips: the value it names scores the percentile it was asked for", () => {
    for (const target of [10, 25, 40, 60, 75, 90]) {
      expect([target, percentile(valueFor(target, lower)!, lower)]).toEqual([target, target]);
    }
  });

  it("round-trips on a banded trait too, on the side you are standing", () => {
    for (const target of [20, 45, 70, 88]) {
      const v = valueFor(target, pace, 190)!;
      expect(v).toBeGreaterThan(145);
      expect([target, percentile(v, pace)]).toEqual([target, target]);
      const slow = valueFor(target, pace, 100)!;
      expect(slow).toBeLessThan(145);
      expect([target, percentile(slow, pace)]).toEqual([target, target]);
    }
  });

  it("has no answer above the top", () => {
    expect(valueFor(100, lower)).toBeNull();
    expect(valueFor(0, lower)).toBeNull();
  });
});
