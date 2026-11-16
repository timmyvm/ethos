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

/**
 * The recording that came closest to leveling a trait (#482): the
 * trait's score on it, and the score that recording needed of it to
 * level it, which is LEVEL_AT, or the take's best other row when that
 * was higher (the level goes to the best row, so it had to beat it).
 */
export interface ClosestTry {
  score: number;
  need: number;
}

export interface TraitLevel {
  key: TraitKey;
  name: string;
  level: number;
  /**
   * How far into its level the trait is, in whole percent, 0 to 99
   * (#482): its closest try since the level, as a share of what that
   * try needed (`levelPercent`). A level is one recording (#159), so
   * nothing else is kept between two levels; this is how near one came.
   */
  percent: number;
  /** That try; null when no scored recording has read the trait since its level. */
  closest: ClosestTry | null;
}

/**
 * The score `key` had to reach on a take with these scores to level:
 * LEVEL_AT, or the best other row when that is higher. A tie with an
 * earlier trait keeps the level there (traitGain), which `levelPercent`
 * answers by never reaching 100.
 */
export function needToLevel(key: TraitKey, scores: Partial<Record<TraitKey, number>>): number {
  let need = LEVEL_AT;
  for (const t of TRAITS) {
    if (t.key === key) continue;
    const s = scores[t.key];
    if (typeof s === "number" && !Number.isNaN(s) && s > need) need = s;
  }
  return need;
}

/**
 * The closest try as a level's bar, in whole percent: rounded down, so
 * it never says more than the try did, and at most 99, because a try
 * that reached what it needed leveled the trait and emptied the bar.
 */
export function levelPercent(closest: ClosestTry | null): number {
  if (!closest || !(closest.need > 0) || !(closest.score > 0)) return 0;
  return Math.min(99, Math.floor((100 * closest.score) / closest.need + 1e-9));
}

/**
 * All nine traits with their derived levels, in canonical order, and
 * how near each has come to its next one (#482). `reps` oldest first,
 * as fetchReps returns them: a level empties the trait's closest try,
 * and every scored take after it that read the trait can set a closer
 * one. Derived, like the level, so it is never stored and never rots.
 */
export function traitLevels(reps: TraitRep[]): TraitLevel[] {
  const levels = new Map<TraitKey, number>(TRAITS.map((t) => [t.key, 0]));
  const closest = new Map<TraitKey, ClosestTry | null>(TRAITS.map((t) => [t.key, null]));
  for (const rep of reps) {
    // repTraitGain's gate: no stored dimensions, or not enough to score,
    // levels nothing and is no try at anything either.
    if (!rep.dimensions || !isScorable(substance(rep.transcript))) continue;
    const scores = repScores(rep);
    const gain = traitGain(scores);
    for (const t of TRAITS) {
      const score = scores[t.key];
      if (typeof score !== "number" || Number.isNaN(score)) continue;
      if (gain?.key === t.key) {
        levels.set(t.key, (levels.get(t.key) ?? 0) + gain.levels);
        closest.set(t.key, null);
        continue;
      }
      const need = needToLevel(t.key, scores);
      const best = closest.get(t.key) ?? null;
      if (!best || score / need > best.score / best.need) closest.set(t.key, { score, need });
    }
  }
  return TRAITS.map((t) => {
    const c = closest.get(t.key) ?? null;
    return { ...t, level: levels.get(t.key) ?? 0, percent: levelPercent(c), closest: c };
  });
}

/**
 * Best first, and at one level the one further into it (#482: the bar
 * beside the number says which); full ties keep canonical order, so the
 * ranking is stable.
 */
export function rankedTraits(levels: TraitLevel[]): TraitLevel[] {
  return [...levels].sort((a, b) => b.level - a.level || b.percent - a.percent);
}

/** What a trait's level says wherever it shows (#482): You's rows and the trait's sheet. */
export interface LevelLine {
  /** The value as drawn: "Level 6", or "Not yet" at level 0 with nothing toward 1. */
  value: string;
  /** The bar's fill in whole percent; null draws no bar. */
  percent: number | null;
  /** What a screen reader is told: "Level 6, 40% of the way to level 7". */
  said: string;
}

export function levelLine(t: Pick<TraitLevel, "level" | "percent">): LevelLine {
  if (t.level === 0 && t.percent === 0) {
    return { value: "Not yet", percent: null, said: "Not yet at level 1" };
  }
  return {
    value: `Level ${t.level}`,
    percent: t.percent,
    said: `Level ${t.level}, ${t.percent}% of the way to level ${t.level + 1}`,
  };
}

/**
 * The closest try, said under the level on its sheet (#482), so the bar
 * traces to a number: "Closest since level 6: 28 of the 70 it needed."
 * An empty bar after a level says why ("Closest since level 1: none
 * yet."); null where nothing has read the trait at all, which "Not yet"
 * has said.
 */
export function closestLine(t: Pick<TraitLevel, "level" | "closest">): string | null {
  const since = t.level > 0 ? `Closest since level ${t.level}` : "Closest yet";
  if (!t.closest) return t.level > 0 ? `${since}: none yet.` : null;
  return `${since}: ${Math.round(t.closest.score)} of the ${Math.round(t.closest.need)} it needed.`;
}
