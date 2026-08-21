/**
 * Traits — the nine Index dimensions as levels on the profile.
 *
 * The mechanic is use-based skill leveling with the attendance taken
 * out. Duolingo's crown levels are the cautionary reference: per-skill
 * levels that rose by finishing lessons rewarded repetition and stood
 * up a second progression competing with the path, and both faults got
 * them retired. So a trait here levels only on measured PERFORMANCE
 * (the same #10 rule stars live by), and levels are a mirror, not a
 * ladder: they gate nothing, buy nothing and feed nothing — not XP,
 * not stars, not the Index. Elevate's EPQ (Me → Performance, a score
 * per skill, your best named) is the display reference; its habit of
 * mixing play-frequency into the number is exactly what this refuses.
 *
 * The rule, checkable per rep: the rep's best-scoring dimension levels
 * +1 when it clears LEVEL_AT (of its 100), +2 when it clears DOUBLE_AT.
 * One trait per rep, because "what did this rep do best" is one answer.
 * Below the bar, nothing levels — a level is earned or it isn't.
 *
 * Levels are DERIVED from stored reps, never incremented (the #132
 * lesson: a stored counter can silently rot; a derivation can only be
 * wrong out loud). Substance is re-checked from the stored transcript
 * with the engine's own gate, so a rep that wasn't enough to score
 * (#55) can never level a trait either.
 */

import { INDEX_WEIGHTS, type Tier1Scores } from "./index-score";
import { isScorable, substance } from "./metrics";

export type TraitKey = keyof typeof INDEX_WEIGHTS;

/**
 * Canonical order: the Index's own, measured tier first. Ties in a
 * rep's best dimension break toward the earlier entry, so the same
 * stored rep always levels the same trait.
 */
export const TRAITS: { key: TraitKey; name: string }[] = [
  { key: "pause", name: "Pause" },
  { key: "fillers", name: "Fillers" },
  { key: "repairs", name: "Self-corrections" },
  { key: "pace", name: "Pace" },
  { key: "range", name: "Range" },
  { key: "structure", name: "Structure" },
  { key: "credibility", name: "Credibility" },
  { key: "engagement", name: "Engagement" },
  // Stored key stays `confidence` (#87); the label is the display's.
  { key: "confidence", name: "Steadiness" },
];

/** A dimension levels its trait at 70 of its 100. */
export const LEVEL_AT = 70;
/** At 90 the level-up doubles: rare on purpose, and it says why. */
export const DOUBLE_AT = 90;

export interface TraitGain {
  key: TraitKey;
  name: string;
  /** The /100 score that earned it, so the moment can name its number. */
  score: number;
  levels: 1 | 2;
}

/**
 * The one trait this set of dimension scores levels, if any.
 * Scores are /100 per dimension; absent dimensions (no judge ran, an
 * old rep with no repairs score) simply aren't candidates.
 */
export function traitGain(
  scores: Partial<Record<TraitKey, number>>
): TraitGain | null {
  let best: { key: TraitKey; name: string; score: number } | null = null;
  for (const t of TRAITS) {
    const s = scores[t.key];
    if (typeof s !== "number" || Number.isNaN(s)) continue;
    if (!best || s > best.score) best = { ...t, score: s };
  }
  if (!best || best.score < LEVEL_AT) return null;
  return { ...best, levels: best.score >= DOUBLE_AT ? 2 : 1 };
}

/** The slice of a rep the derivation reads — RepRow satisfies it. */
export interface TraitRep {
  transcript: string;
  dimensions: {
    tier1: Tier1Scores;
    tier2: Partial<Record<TraitKey, { score: number }>> | null;
  } | null;
}

/** Every /100 dimension score a stored rep carries, judged included. */
function repScores(rep: TraitRep): Partial<Record<TraitKey, number>> {
  if (!rep.dimensions) return {};
  const out: Partial<Record<TraitKey, number>> = { ...rep.dimensions.tier1 };
  for (const [key, dim] of Object.entries(rep.dimensions.tier2 ?? {})) {
    if (dim && typeof dim.score === "number") out[key as TraitKey] = dim.score;
  }
  return out;
}

export function repTraitGain(rep: TraitRep): TraitGain | null {
  if (!rep.dimensions) return null;
  // The engine's own substance gate, re-run on the stored transcript:
  // "I don't know" eight times has a clean pace, and must level nothing.
  if (!isScorable(substance(rep.transcript))) return null;
  return traitGain(repScores(rep));
}

export interface TraitLevel {
  key: TraitKey;
  name: string;
  level: number;
}

/** All nine traits with their derived levels, in canonical order. */
export function traitLevels(reps: TraitRep[]): TraitLevel[] {
  const levels = new Map<TraitKey, number>(TRAITS.map((t) => [t.key, 0]));
  for (const rep of reps) {
    const gain = repTraitGain(rep);
    if (gain) levels.set(gain.key, (levels.get(gain.key) ?? 0) + gain.levels);
  }
  return TRAITS.map((t) => ({ ...t, level: levels.get(t.key) ?? 0 }));
}

/** Best first; ties keep canonical order, so the ranking is stable. */
export function rankedTraits(levels: TraitLevel[]): TraitLevel[] {
  return [...levels].sort((a, b) => b.level - a.level);
}
