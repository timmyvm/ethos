/**
 * Every number off the glance, readable at a glance (DECISIONS #471).
 *
 * The 14-day test (2 to 15 Nov) said the rows did not read: "Tbh i didnt
 * get what it meant half the time if i got high or low in a certain
 * category. Like did it mean i was good in it or bad in it" (FT). The
 * sheet listed Pausing 138/150, Fillers 88/100, Restarts 45/50: rows
 * named for the fault read as a count of it, three maxima on one list,
 * and every bar the same sage at any value.
 *
 * So each row is now:
 *  - its score out of 100, the one scale every row shares (the Index's
 *    own per-dimension score; nothing is rescored, and the Index is the
 *    same number, said once at the top of the page since #484);
 *  - one word for how it went, from the row's share of its max (`band`);
 *  - named for the skill where the trait is named for the fault
 *    (content/traits.ts `skill`: Filler control, Restart control since #490).
 *
 * Pure: the rows, the words and the headline are computed here and
 * drawn by components/DimensionList.tsx and You's trait rows.
 */

import { TRAIT, type TraitId } from "@/content/traits";
import { dimensionPoints, INDEX_WEIGHTS, type Tier1Scores } from "./index-score";
import { measured } from "./trait-readings";
import type { TraitKey } from "./traits";

/** How a row went, in one word. */
export type Band = "strong" | "okay" | "work";

/**
 * Strong from 70 of 100. Since #498 a trait levels on XP, every row's
 * score paid to its trait, so no row has to read Strong to count; a
 * Strong read is still worth a trait's whole first level (lib/traits.ts
 * LEVEL_STEP, also 70).
 */
export const STRONG_AT = 70;
/** Okay from half the scale; under half is the one to work on. */
export const OKAY_AT = 50;

export const BAND_WORD: Record<Band, string> = {
  strong: "Strong",
  okay: "Okay",
  work: "Work on this",
};

/**
 * The band from a row's share of its max, 0 to 1. Every row is out of
 * 100 now, so this is score / 100; the share keeps it right for any max
 * (a weighted 132/150 is the same 88% and the same Strong).
 */
export function band(share: number): Band {
  const pct = Math.round(Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0)) * 100);
  if (pct >= STRONG_AT) return "strong";
  if (pct >= OKAY_AT) return "okay";
  return "work";
}

/** A score out of 100's band. */
export function bandOf(score: number, max = 100): Band {
  return band(max > 0 ? score / max : 0);
}

/** The four the coach judges, by their stored keys. */
export type JudgedKey = "structure" | "credibility" | "engagement" | "confidence";

/**
 * A dimension's name wherever its score shows. The measured five take
 * their trait's skill name; the judged four are skills already. The
 * stored key `confidence` reads Steadiness (#87, §8 bans the word).
 */
export const DIMENSION_NAME: Record<TraitKey, string> = {
  pause: TRAIT.pause.skill,
  fillers: TRAIT.fillers.skill,
  repairs: TRAIT.repairs.skill,
  pace: TRAIT.pace.skill,
  range: TRAIT.range.skill,
  structure: "Structure",
  credibility: "Credibility",
  engagement: "Engagement",
  confidence: "Steadiness",
};

/** The measured five, the traits content/traits.ts teaches. */
export function isTraitKey(key: string): key is TraitId {
  return key in TRAIT;
}

export interface DimensionRow {
  key: TraitKey;
  name: string;
  /** Out of 100, rounded and clamped as the Index reads it. */
  score: number;
  /** What it counts toward the 1000. */
  weight: number;
  /** Its points in the Index, rounded per row so the rows sum to it (#101). */
  points: number;
  band: Band;
}

const ORDER: TraitKey[] = [
  "pause",
  "fillers",
  "repairs",
  "pace",
  "range",
  "structure",
  "credibility",
  "engagement",
  "confidence",
];

/**
 * The rows a take has, in the Index's own order: the measured five (a
 * recording from before the split has no repairs score and gets no row)
 * and, when the coach judged it, the four.
 */
export function dimensionRows(
  tier1: Tier1Scores,
  tier2: Partial<Record<JudgedKey, { score: number }>> | null
): DimensionRow[] {
  const scores: Partial<Record<TraitKey, number>> = { ...tier1 };
  for (const k of ["structure", "credibility", "engagement", "confidence"] as const) {
    const s = tier2?.[k]?.score;
    if (typeof s === "number") scores[k] = s;
  }
  const out: DimensionRow[] = [];
  for (const key of ORDER) {
    const raw = scores[key];
    if (typeof raw !== "number" || Number.isNaN(raw)) continue;
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const weight = INDEX_WEIGHTS[key];
    out.push({ key, name: DIMENSION_NAME[key], score, weight, points: dimensionPoints(score, weight), band: bandOf(score) });
  }
  return out;
}

/** "A, B and C". */
export function listWords(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/*
 * #471's `weightLine` ("Rows are out of 100. In the Index, Pausing,
 * Structure and Credibility count up to 150 each, ...") is gone with the
 * rows' foot (#484, Timothy 16 Nov: underlined, remove). The weights it
 * said are still the Index's own (INDEX_WEIGHTS), and each row's `weight`
 * and `points` still sum to the stored Index.
 */

/**
 * What a Strong row says the take did, after "You": the plan's "one
 * headline in words, numbers underneath" (docs/plan-next.md §7, "You
 * sounded steady and got to the point"). Each names its row, which
 * stands right under it with its number.
 */
export const STRONG_PHRASE: Record<TraitKey, string> = {
  /* "let your points land" (#490): what a Strong Pausing row measured,
     in the house's words for it. */
  pause: "paused between sentences",
  /* "down", never "out": Strong is up to 2.4 fillers a minute, so the
     row under it can say "2 in 60 seconds" (#471 review). */
  fillers: "kept fillers down",
  repairs: "finished your sentences",
  pace: "spoke at a good pace",
  range: "varied your words",
  structure: "got to the point",
  credibility: "backed up your points",
  engagement: "held attention",
  confidence: "sounded steady",
};

/**
 * The rows' headline (#471): the two strongest Strong rows as what you
 * did, then the lowest row by name, as the one to work on (under half)
 * or the one with the most room (Okay). Every clause is a row on the
 * card under it, so the words trace to its numbers.
 *
 *   "You got to the point and sounded steady. Pausing is the one to work on."
 *   "You spoke at a good pace. Variety has the most room to grow."
 *   "Pausing is the one to work on."            (nothing Strong)
 *   "You spoke at a good pace and kept fillers down. Strong on all 9."
 */
export function rowsHeadline(rows: DimensionRow[]): string {
  if (rows.length === 0) return "";
  const byScore = [...rows].sort((a, b) => b.score - a.score || ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const strong = byScore.filter((r) => r.band === "strong").slice(0, 2);
  const lowest = [...rows].sort((a, b) => a.score - b.score || ORDER.indexOf(a.key) - ORDER.indexOf(b.key))[0];
  const said: string[] = [];
  if (strong.length > 0) said.push(`You ${listWords(strong.map((r) => STRONG_PHRASE[r.key]))}.`);
  if (lowest.band === "work") said.push(`${lowest.name} is the one to work on.`);
  else if (lowest.band === "okay") said.push(`${lowest.name} has the most room to grow.`);
  else said.push(`Strong on all ${rows.length}.`);
  return said.join(" ");
}

/**
 * A count against the take's length, as people feel it (§7: "about one
 * 'um' every 20 seconds"). Null under two, where "one every 62 seconds"
 * is the length again. Under 10 seconds to the second, under a minute to
 * the nearest 5, then in minutes.
 */
export function everyLine(count: number, durationS: number): string | null {
  if (!(count >= 2) || !(durationS > 0)) return null;
  const s = durationS / count;
  if (s < 10) return `about one every ${Math.max(1, Math.round(s))} seconds`;
  if (s < 60) return `about one every ${Math.round(s / 5) * 5} seconds`;
  if (s < 90) return "about one a minute";
  return `about one every ${Math.round(s / 60)} minutes`;
}

/** The pace zone the Pace row is held to (index-score.ts paceScore). */
export const PACE_ZONE = { lo: 130, hi: 160 } as const;

/** "155 words a minute, inside the 130 to 160 zone." and its two sides. */
export function paceWords(wpm: number): string {
  const w = Math.round(wpm);
  const { lo, hi } = PACE_ZONE;
  if (w > hi) return `${w} words a minute, ${w - hi} over the ${lo} to ${hi} zone.`;
  if (w < lo) return `${w} words a minute, ${lo - w} under the ${lo} to ${hi} zone.`;
  return `${w} words a minute, inside the ${lo} to ${hi} zone.`;
}

/** "62 different words in every 100 you said.", from the take's own distinct-word share. */
export function varietyWords(distinctRatio: number | null | undefined): string | null {
  if (typeof distinctRatio !== "number" || !Number.isFinite(distinctRatio) || distinctRatio <= 0) return null;
  return `${Math.round(distinctRatio * 100)} different words in every 100 you said.`;
}

/** "1 restarted phrase", "3 restarted phrases". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The slice of a stored recording the trend reads; RepRow satisfies it. */
export interface RateTake {
  created_at: string;
  filler_count: number;
  duration_s: number;
  transcript: string | null;
}

const WEEK_MS = 7 * 86_400_000;
const rate1 = (count: number, durationS: number) => Math.round(((count * 60) / durationS) * 10) / 10;
const fmt1 = (n: number) => n.toFixed(1).replace(/\.0$/, "");

/**
 * The trend in words (§7: "Half the ums of your first week"), for the
 * Filler control row: this take's fillers a minute (every filler, the
 * rate the row's score runs on) against the median of the first week's,
 * said as words with both numbers after them, so the sentence still
 * points to a number. A minute against a minute, so a longer take is no
 * excuse and a shorter one no gift.
 *
 *   "About half your first week's fillers a minute: 3.9, from 7.6."
 *
 * Null where there is nothing honest to say: this take too short to
 * score (`now.scorable` false: it measured nothing, #55), the first week
 * not wholly in what was read (`complete` false), a take inside that first week,
 * a first week without a measured take, or one with no fillers to
 * compare against. The takes too short to score are skipped, as every
 * reading of a stored row skips them (lib/trait-readings `measured`).
 */
export function fillerTrend(p: {
  /** The account's stored recordings, any order, this take's own row or not. */
  reps: RateTake[];
  /** Whether `reps` reaches back to the account's first recording. */
  complete: boolean;
  now: { fillerCount: number; durationS: number; scorable?: boolean };
  /** When this take was made. */
  at: Date;
}): string | null {
  if (!p.complete || p.now.scorable === false || !(p.now.durationS > 0) || p.reps.length === 0) return null;
  const sorted = [...p.reps].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const end = Date.parse(sorted[0].created_at) + WEEK_MS;
  if (!(p.at.getTime() >= end)) return null;
  const week = sorted
    .filter((r) => Date.parse(r.created_at) < end && r.duration_s > 0 && measured(r))
    .map((r) => rate1(r.filler_count, r.duration_s))
    .sort((a, b) => a - b);
  if (week.length === 0) return null;
  const mid = week.length >> 1;
  const then = Math.round((week.length % 2 ? week[mid] : (week[mid - 1] + week[mid]) / 2) * 10) / 10;
  if (!(then > 0)) return null;
  const now = rate1(p.now.fillerCount, p.now.durationS);
  const r = now / then;
  const lead =
    r < 0.35
      ? "Under a third of your first week's"
      : r < 0.6
        ? "About half your first week's"
        : r < 0.85
          ? "Fewer than your first week's"
          : r <= 1.15
            ? "About your first week's"
            : "More than your first week's";
  return `${lead} fillers a minute: ${fmt1(now)}, from ${fmt1(then)}.`;
}
