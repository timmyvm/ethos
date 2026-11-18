/**
 * Traits: the nine Index dimensions as levels on the profile, filled
 * with trait XP (#498).
 *
 * Timothy, 18 Nov: "xp that fills with practice". Every scored recording
 * pays each trait it read that trait's score on it, 0 to 100, as trait
 * XP: practice fills the bar, a strong recording fills it faster, a
 * trait read at 0 gets 0, and a take too short to score pays nothing,
 * so attendance alone never levels anything (CLAUDE.md: stars, streaks
 * and scores are earned). Level n costs LEVEL_STEP × n XP, so level 1 is
 * one Strong read (70) and each level after takes a few more strong
 * recordings than the last (lib/traits.test.ts draws the curve over
 * synthetic accounts from the production percentiles).
 *
 * This replaced #159's rule (a take's best row levels its trait at 70,
 * twice from 90) and #482's closest-try bar on it. Levels renumbered.
 *
 * Levels are still DERIVED from stored reps, never stored or incremented
 * (the #132 lesson: a stored counter can silently rot; a derivation can
 * only be wrong out loud), so every account renumbers on its next load
 * and nothing migrates. A trait's XP only ever grows with another
 * recording, so no level goes down between two loads of the same
 * history. Substance is re-checked from the stored transcript with the
 * engine's own gate, so a take that wasn't enough to score (#55) pays
 * nothing either.
 *
 * Trait XP is never a total and never shown outside its trait (You's
 * rows draw only the level and its bar; the sheet says the XP under the
 * trait's own name). Account XP (#485, lib/xp.ts, purple, 10 a
 * recording) is the one XP with a total.
 */

import { INDEX_WEIGHTS, type Tier1Scores } from "./index-score";
import { isScorable, substance } from "./metrics";

export type TraitKey = keyof typeof INDEX_WEIGHTS;

/**
 * Canonical order: the Index's own, measured tier first. Ties anywhere
 * (the ranking, the level-up moment) break toward the earlier entry.
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

/** Level n costs LEVEL_STEP × n trait XP: 70 for level 1, 140 for level 2, 490 for level 7. */
export const LEVEL_STEP = 70;

/** The XP level `level` costs, from the level under it. */
export function levelCost(level: number): number {
  return LEVEL_STEP * Math.max(1, Math.floor(level));
}

/** The trait XP it takes to reach `level` from nothing: 70, 210, 420, 700, 1050 ... */
export function xpFor(level: number): number {
  const n = Math.max(0, Math.floor(level));
  return (LEVEL_STEP * n * (n + 1)) / 2;
}

/** Where a trait's XP stands: its level, the XP into it and what the next one costs. */
export function standing(xp: number): { level: number; into: number; cost: number } {
  const total = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = 0;
  while (xpFor(level + 1) <= total) level++;
  return { level, into: total - xpFor(level), cost: levelCost(level + 1) };
}

/** The slice of a rep the derivation reads: RepRow satisfies it. */
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

/**
 * The trait XP one stored recording pays: each trait it read, its score
 * rounded and held to 0 to 100. Nothing at all for a take with no stored
 * dimensions or not enough to score: the engine's own substance gate,
 * re-run on the stored transcript ("I don't know" eight times has a
 * clean pace, and must pay nothing). A trait the take did not read (no
 * judge ran, an old rep with no repairs score) is absent, not 0.
 */
export function repTraitXp(rep: TraitRep): Partial<Record<TraitKey, number>> {
  if (!rep.dimensions) return {};
  if (!isScorable(substance(rep.transcript))) return {};
  const scores = repScores(rep);
  const out: Partial<Record<TraitKey, number>> = {};
  for (const t of TRAITS) {
    const s = scores[t.key];
    if (typeof s !== "number" || Number.isNaN(s)) continue;
    out[t.key] = Math.round(Math.max(0, Math.min(100, s)));
  }
  return out;
}

export interface TraitLevel {
  key: TraitKey;
  name: string;
  level: number;
  /** Every recording's trait XP for this trait, added up. Never shown as a total. */
  xp: number;
  /** The XP into the level. */
  into: number;
  /** What the next level costs: `into` of `cost` is the bar. */
  cost: number;
  /** How far into the level, in whole percent rounded down, 0 to 99: the bar's fill. */
  percent: number;
  /** What the newest recording that read the trait paid it; null when none has. */
  last: number | null;
}

/**
 * All nine traits with their derived levels, in canonical order. `reps`
 * oldest first, as fetchReps returns them (only `last` reads the order).
 */
export function traitLevels(reps: readonly TraitRep[]): TraitLevel[] {
  const xp = new Map<TraitKey, number>(TRAITS.map((t) => [t.key, 0]));
  const last = new Map<TraitKey, number | null>(TRAITS.map((t) => [t.key, null]));
  for (const rep of reps) {
    for (const [key, paid] of Object.entries(repTraitXp(rep)) as [TraitKey, number][]) {
      xp.set(key, (xp.get(key) ?? 0) + paid);
      last.set(key, paid);
    }
  }
  return TRAITS.map((t) => {
    const total = xp.get(t.key) ?? 0;
    const s = standing(total);
    return {
      ...t,
      level: s.level,
      xp: total,
      into: s.into,
      cost: s.cost,
      percent: Math.min(99, Math.floor((100 * s.into) / s.cost)),
      last: last.get(t.key) ?? null,
    };
  });
}

/** Most XP first, which is the higher level, then further into it; ties keep canonical order. */
export function rankedTraits(levels: TraitLevel[]): TraitLevel[] {
  return [...levels].sort((a, b) => b.xp - a.xp);
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
 * The trait's XP, said under its level on its sheet, so the bar traces
 * to numbers: "370 XP to level 7. Last recording +45." The XP still to
 * go, as You's card says its own (#485: "40 of 50 to level 2" failed the
 * two-second test), then what the newest recording that read the trait
 * paid it, which is that recording's score here. A trait nothing has
 * read says only the first.
 */
export function xpLine(t: Pick<TraitLevel, "level" | "into" | "cost" | "last">): string {
  const toGo = `${t.cost - t.into} XP to level ${t.level + 1}.`;
  return t.last === null ? toGo : `${toGo} Last recording +${t.last}.`;
}

/** A level one recording crossed: from where it stood to where it stands. */
export interface LevelUp {
  key: TraitKey;
  from: number;
  to: number;
  /** What the recording paid the trait. */
  paid: number;
}

/**
 * What one recording crossed: the traits whose level is higher after it
 * than before, under the same rule on both sides, so nothing can read as
 * a level going down and a recording that crossed nothing returns [].
 * Biggest first: the most levels crossed, then the higher level reached,
 * then the more XP paid, then canonical order. `shown` keeps only the
 * traits the screen the person goes to can show (a free account's You
 * folds the four the Index only reads).
 */
export function levelUps(
  before: readonly TraitLevel[],
  after: readonly TraitLevel[],
  shown: (key: TraitKey) => boolean = () => true
): LevelUp[] {
  const was = new Map(before.map((t) => [t.key, t]));
  const out: (LevelUp & { order: number })[] = [];
  after.forEach((t, order) => {
    const b = was.get(t.key);
    const from = b?.level ?? 0;
    if (t.level <= from || !shown(t.key)) return;
    out.push({ key: t.key, from, to: t.level, paid: t.xp - (b?.xp ?? 0), order });
  });
  out.sort((a, b) => b.to - b.from - (a.to - a.from) || b.to - a.to || b.paid - a.paid || a.order - b.order);
  return out.map(({ key, from, to, paid }) => ({ key, from, to, paid }));
}

/**
 * The level-up moment, in words: at most two named, biggest first, the
 * rest counted. "Pace reached level 3", "Pace reached level 3, Pausing
 * level 2", "Pace reached level 3, Variety level 3 and 3 more". `short`
 * is what stays when the glance's budget cuts the tail. Null for none.
 */
export function levelUpLine(
  ups: readonly LevelUp[],
  nameOf: (key: TraitKey) => string
): { text: string; short: string | null } | null {
  if (ups.length === 0) return null;
  const [first, second] = ups;
  const head = `${nameOf(first.key)} reached level ${first.to}`;
  if (!second) return { text: head, short: null };
  const more = ups.length - 2;
  return {
    text: `${head}, ${nameOf(second.key)} level ${second.to}${more > 0 ? ` and ${more} more` : ""}`,
    short: head,
  };
}
