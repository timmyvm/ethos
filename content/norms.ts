/**
 * The population distributions (DECISIONS #256). What "58th percentile"
 * is measured against.
 *
 * This is the file that decides whether the whole model is honest. A
 * percentile is a claim about everybody else, and the only thing that
 * makes it a measurement rather than a decoration is a real
 * distribution from real published data, with the leaps written down.
 *
 * So every norm carries its sources and its assumptions, and
 * `content/norms.test.ts` refuses to pass while a norm claims better
 * evidence than it has. `docs/percentiles.md` is the long version: what
 * was searched for, what was found, what was audited and what came back
 * wrong.
 *
 * PENDING is not a style of comment here, it is a state the test
 * fails on. A norm marked pending is one whose numbers were put in to
 * get a screen rendering and have not yet been replaced by sourced
 * ones; the suite is red until every one of them is gone.
 */

import type { Norm } from "@/lib/percentile";
import type { TraitId } from "./traits";

/**
 * How much the PLACEMENT is worth trusting. Never the measurement: what
 * somebody did is known either way, and this is only about whether the
 * population it is being compared to is real.
 *
 *   good         published distributions, with dispersion, on a
 *                population and task close enough to this one
 *   partial      published central values, but the spread is estimated,
 *                or the population is a stretch
 *   provisional  no usable published data. The UI draws the ring's
 *                TROUGH dashed and says so in words.
 */
export type NormQuality = "good" | "partial" | "provisional";

export interface SourcedNorm extends Norm {
  quality: NormQuality;
  /** Real citations with URLs. Empty is only allowed for provisional. */
  sources: string[];
  /** Every leap from the sources to these parameters. */
  assumptions: string[];
  /** Set while the numbers are placeholders. The test fails on it. */
  pending?: true;
}

export const NORMS: Record<TraitId, SourcedNorm> = {
  pause: {
    shape: "lognormal",
    mu: Math.log(2.2),
    sigma: Math.log(2),
    direction: "higher",
    quality: "provisional",
    sources: [],
    assumptions: ["Placeholder pending the literature review."],
    pending: true,
  },
  fillers: {
    shape: "lognormal",
    mu: Math.log(4),
    sigma: Math.log(2),
    direction: "lower",
    quality: "provisional",
    sources: [],
    assumptions: ["Placeholder pending the literature review."],
    pending: true,
  },
  repairs: {
    shape: "lognormal",
    mu: Math.log(1),
    sigma: Math.log(2.2),
    direction: "lower",
    quality: "provisional",
    sources: [],
    assumptions: ["Placeholder pending the literature review."],
    pending: true,
  },
  pace: {
    shape: "normal",
    mu: 145,
    sigma: 30,
    direction: "band",
    band: { lo: 130, hi: 160 },
    quality: "provisional",
    sources: [],
    assumptions: ["Placeholder pending the literature review."],
    pending: true,
  },
  range: {
    shape: "normal",
    mu: 55,
    sigma: 8,
    direction: "higher",
    quality: "provisional",
    sources: [],
    assumptions: ["Placeholder pending the literature review."],
    pending: true,
  },
};
