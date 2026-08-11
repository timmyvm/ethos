/**
 * Ethos Index — Tier 1 (measured) dimensions + Tier-2 anchors.
 * mechanics.md "Scoring — the Ethos Index (/1000)", DECISIONS #18–19.
 *
 * Pure functions over the deterministic metrics: no LLM anywhere in
 * Tier 1. All curve constants are v1 sketches — calibrate in beta
 * against real recordings, never against vibes.
 */

import {
  detectRepairs,
  normalizeWord,
  type FillerHit,
  type Pause,
  type RepMetrics,
  type Segment,
  type Word,
} from "./metrics";
import { pauseReport } from "./pause-quality";

export const INDEX_WEIGHTS = {
  // Tier 1 — measured
  pause: 150,
  fillers: 150,
  pace: 100,
  range: 100,
  // Tier 2 — judged (LLM, citation-required)
  structure: 150,
  credibility: 150,
  engagement: 100,
  confidence: 100,
} as const;

export type Tier1Dimension = "pause" | "fillers" | "pace" | "range";
export type Tier2Dimension =
  | "structure"
  | "credibility"
  | "engagement"
  | "confidence";

export interface Tier1Scores {
  pause: number;
  fillers: number;
  pace: number;
  range: number;
}

/** Deterministic ground truth handed to the Tier-2 judge (DECISIONS #19). */
export interface Tier2Anchors {
  hedgeCount: number;
  restartCount: number;
}

/**
 * Pause /100 — the signature dimension. Placement, not presence: see
 * `pause-quality.ts` for what the silence has to actually do to score.
 * This wrapper exists so the Index has one shape per dimension.
 */
export function pauseScore(
  pauses: Pause[],
  durationS: number,
  words: Word[] = [],
  fillers: FillerHit[] = []
): number {
  return pauseReport({ pauses, words, fillers, durationS }).score;
}

/**
 * Fillers /100 — linear on DISFLUENCIES per minute (fillers plus
 * self-corrections): 0 = 100, ≥8 = 0. A restarted sentence lands on a
 * listener the same way an "um" does, so it is counted the same way.
 */
export function fillerScore(disfluenciesPerMin: number): number {
  return clamp(Math.round(100 * (1 - disfluenciesPerMin / 8)));
}

/**
 * Pace /100 — distance from the 130–160 WPM zone, plus a variance bonus:
 * pace that moves beats monotone pace. Per-segment WPM spread in a healthy
 * band (8–35 std dev) earns up to +10; in-zone base is 90.
 */
export function paceScore(
  wpm: number,
  words: Word[],
  segments: Segment[]
): number {
  const distance = wpm < 130 ? 130 - wpm : wpm > 160 ? wpm - 160 : 0;
  let score = 90 - distance * 2;

  const spread = segmentWpmStdDev(words, segments);
  if (spread !== null && spread >= 8 && spread <= 35) score += 10;

  return clamp(score);
}

function segmentWpmStdDev(words: Word[], segments: Segment[]): number | null {
  const rates: number[] = [];
  for (const s of segments) {
    const dur = s.end - s.start;
    if (dur < 1) continue;
    const count = words.filter(
      (w) => w.start >= s.start - 0.05 && w.start < s.end
    ).length;
    if (count > 0) rates.push((count / dur) * 60);
  }
  if (rates.length < 3) return null;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance =
    rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  return Math.sqrt(variance);
}

/** Crutch words per mechanics.md — vague intensifiers and placeholders. */
const CRUTCH_WORDS = new Set([
  "really",
  "very",
  "good",
  "thing",
  "things",
  "stuff",
  "nice",
  "cool",
]);

/**
 * Range /100 — repetition inverted: distinct-word ratio (scaled for a
 * 60–90s rep), repeated-trigram penalty, crutch-word density penalty.
 */
export function rangeScore(words: Word[]): number {
  const tokens = words.map((w) => normalizeWord(w.word)).filter(Boolean);
  if (tokens.length < 10) return 50; // too short to judge range

  const ttr = new Set(tokens).size / tokens.length;
  // Spoken 60–90s reps land around 0.45–0.65 TTR; 0.6 maps to full marks.
  let score = 30 + Math.round(70 * Math.min(1, ttr / 0.6));

  // Repeated trigrams: each distinct phrase said 2+ times costs 5 (cap 20).
  const seen = new Map<string, number>();
  for (let i = 0; i < tokens.length - 2; i++) {
    const tri = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    seen.set(tri, (seen.get(tri) ?? 0) + 1);
  }
  const repeated = [...seen.values()].filter((n) => n >= 2).length;
  score -= Math.min(20, repeated * 5);

  // Crutch density: 4 points per crutch word beyond one per 30 words.
  const crutches = tokens.filter((t) => CRUTCH_WORDS.has(t)).length;
  const allowance = Math.ceil(tokens.length / 30);
  score -= Math.min(30, Math.max(0, crutches - allowance) * 4);

  return clamp(score);
}

export function tier1Scores(
  metrics: RepMetrics,
  words: Word[],
  segments: Segment[]
): Tier1Scores {
  return {
    pause: pauseScore(metrics.pauses, metrics.durationS, words, metrics.fillers),
    fillers: fillerScore(metrics.disfluenciesPerMin),
    pace: paceScore(metrics.wpm, words, segments),
    range: rangeScore(words),
  };
}

/** Hedges per mechanics.md — counted, not vibes-judged. */
const HEDGE_PHRASES = ["i guess", "maybe", "sort of", "i feel like"];

export function countHedges(transcript: string): number {
  const t = ` ${transcript.toLowerCase().replace(/[^a-z' ]/g, " ")} `;
  let count = 0;
  for (const phrase of HEDGE_PHRASES) {
    count += t.split(` ${phrase} `).length - 1;
  }
  return count;
}

/**
 * Restarts / self-corrections.
 *
 * The v1 version only caught a doubled word ("the the") and a handful of
 * explicit markers, which misses the commonest repair by far: you say a
 * phrase, hear it come out wrong, and run the phrase again with one word
 * swapped. Reported by Timothy — "ease the days rest", then immediately
 * "ease the days problems" — which scored as clean speech because
 * nothing was literally doubled.
 *
 * So this looks for a repeated n-gram whose two occurrences sit almost
 * on top of each other. That is what a repair sounds like: the run-up
 * repeats, the landing changes. Distant repetition is a different thing
 * (`rangeScore` handles that) and is deliberately not counted here.
 */
const CORRECTION_MARKERS = ["i mean", "wait no", "sorry"];

export function countRestarts(words: Word[], transcript: string): number {
  let count = detectRepairs(words);
  const t = ` ${transcript.toLowerCase().replace(/[^a-z' ]/g, " ")} `;
  for (const marker of CORRECTION_MARKERS) {
    count += t.split(` ${marker} `).length - 1;
  }
  return count;
}

export function tier2Anchors(words: Word[], transcript: string): Tier2Anchors {
  return {
    hedgeCount: countHedges(transcript),
    restartCount: countRestarts(words, transcript),
  };
}

/**
 * The composite: weighted sum /1000 across all eight dimensions.
 * Returns null when any judged score is missing — a partial index would
 * quietly redefine what the number means.
 */
export function ethosIndex(
  tier1: Tier1Scores,
  tier2: Record<Tier2Dimension, number> | null
): number | null {
  if (!tier2) return null;
  const all: Record<string, number> = { ...tier1, ...tier2 };
  let total = 0;
  for (const [dim, weight] of Object.entries(INDEX_WEIGHTS)) {
    const score = all[dim];
    if (typeof score !== "number" || Number.isNaN(score)) return null;
    total += dimensionPoints(clamp(score), weight);
  }
  return total;
}

/**
 * One dimension's contribution, rounded HERE rather than at the end.
 *
 * The results screen lists each dimension against its own denominator
 * (132/150, not 88/100) so the eight numbers visibly add up to the
 * Index. Rounding once at the end instead of per dimension made the
 * displayed parts miss the displayed total by a point or two — a score
 * that doesn't add up in front of you is worse than no breakdown at
 * all. Both sides call this, so they agree by construction.
 */
export function dimensionPoints(score: number, weight: number): number {
  return Math.round((clamp(score) / 100) * weight);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
