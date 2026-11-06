/**
 * The recording screen's half of a game round (the games plan, items 1,
 * 2, 5 and 9; proposals F1 and M2, M4). Pure, so the scheduler and every
 * line the idle screen says are testable without a microphone.
 *
 * The phone stages; the server measures (lib/round.ts). Nothing here
 * decides a verdict, a star or a rung: it decides when Demos cuts in,
 * with which line, and what the screen says before Record.
 */

import { bestFor, type LadderRow } from "./ladder";
import { clampLevel, type LevelN } from "./games";

/** How long his line stays up after he cuts in (F1). */
export const CUT_IN_HOLD_S = 3.5;

/** One cut-in the level stages, and what became of it on this take. */
export interface CutInPlan {
  /** The second he starts listening for a word to cut into. */
  aim: number;
  /** The second he cuts in anyway, if you are silent then. */
  forceBy: number;
  /** When he cut in, seconds from the recorder's start; null until he does. */
  at: number | null;
  line: string | null;
}

/**
 * One plan per window `[aimLo, forceBy]` (lib/games.ts GameLevel.cutIns):
 * the aim is drawn uniformly from the window's first half, so there is
 * always the second half left to find a word in before he is forced.
 * `rand` is injected, as the draw's is.
 */
export function planCutIns(
  windows: readonly (readonly [number, number])[],
  rand: () => number = Math.random
): CutInPlan[] {
  return windows
    .map(([lo, hi]) => {
      const forceBy = Math.max(lo, hi);
      const aim = lo + Math.max(0, forceBy - lo) * 0.5 * clamp01(rand());
      return { aim: round2(aim), forceBy, at: null, line: null };
    })
    .sort((a, b) => a.aim - b.aim);
}

/**
 * Should this cut-in fire on this frame? On the first frame at or after
 * its aim where the meter hears speech, so he cuts in mid-word; at its
 * `forceBy` whatever the meter says. Never twice.
 */
export function cutInDue(plan: CutInPlan, elapsed: number, voiced: boolean): boolean {
  if (plan.at !== null || !Number.isFinite(elapsed)) return false;
  if (elapsed >= plan.forceBy) return true;
  return elapsed >= plan.aim && voiced;
}

/** The next cut-in to fire, or null: they fire in order, one per frame. */
export function nextCutIn(
  plans: readonly CutInPlan[],
  elapsed: number,
  voiced: boolean
): CutInPlan | null {
  const pending = plans.find((p) => p.at === null);
  if (!pending) return null;
  // A later cut-in never jumps an earlier one still waiting.
  return cutInDue(pending, elapsed, voiced) ? pending : null;
}

/**
 * A line he has not said yet this round: lines never repeat within a
 * round. Once every line is spent (a pool smaller than the cut-ins) any
 * line but the last one said.
 */
export function pickLine(
  lines: readonly string[],
  used: readonly (string | null)[],
  rand: () => number = Math.random
): string | null {
  if (lines.length === 0) return null;
  const fresh = lines.filter((l) => !used.includes(l));
  const last = used.length ? used[used.length - 1] : null;
  const pool = fresh.length ? fresh : lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return pool[Math.floor(clamp01(rand()) * pool.length) % pool.length];
}

/** What the phone sends with the take, in `round`'s `cutIns` (lib/round.ts CutInClaim). */
export function firedCutIns(plans: readonly CutInPlan[]): { at: number; line: string }[] {
  return plans
    .filter((p): p is CutInPlan & { at: number } => p.at !== null)
    .map((p) => ({ at: p.at, line: p.line ?? "" }));
}

/* ------------------------------------------------------------------ *
 * The idle screen's numbers (M4): the best at this level, and the run
 * Speed rush is on. Read from the stored rounds only.
 * ------------------------------------------------------------------ */

/**
 * The best before this take, captured as the idle screen opens (beside
 * the screen's baseline, #53), so a take compares against what stood
 * before it and the results can say what it broke.
 */
export interface GameBestSnapshot {
  game: string;
  level: LevelN;
  /** `bestFor` at this level: seconds clean (Q&A), landed in a row (Speed rush), the Index (Interview). */
  best: number | null;
  /** Speed rush: counted rounds in a row at this level right now. 0 for the others. */
  chain: number;
}

/**
 * Speed rush's current run at one level: a counted round adds one, a
 * scorable round that did not count ends it, an unscorable take is
 * skipped (lib/ladder.ts keeps the same rule for the open level).
 */
export function chainAt(rows: readonly LadderRow[], gameId: string, level: unknown): number {
  const n = clampLevel(level);
  let current = 0;
  const mine = rows
    .filter((r) => r.round && r.round.game === gameId && r.round.level === n)
    .map((r) => ({ round: r.round!, t: new Date(r.created_at).getTime() }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  for (const { round } of mine) {
    if (!round.scorable) continue;
    current = round.counted ? current + 1 : 0;
  }
  return current;
}

export function gameBestSnapshot(
  rows: readonly LadderRow[],
  gameId: string,
  level: unknown
): GameBestSnapshot {
  const n = clampLevel(level);
  return {
    game: gameId,
    level: n,
    best: bestFor(rows, gameId, n),
    chain: gameId === "rush" ? chainAt(rows, gameId, n) : 0,
  };
}

/** Seconds as the best line says them: whole from 10, one decimal under. */
function secondsLabel(s: number): string {
  return s >= 10 ? `${Math.round(s)}s` : `${Math.round(s * 10) / 10}s`;
}

/**
 * The one line under the direction before Record, once a best exists at
 * this level (M4). Null with no best.
 *   Q&A        "Your best at level 2: 31s clean after the cut-in."
 *   Speed rush "Your best at level 2: 4 landed in a row. You're on 2."
 *   Interview  "Your best at level 2: 712."
 */
export function bestLine(snap: GameBestSnapshot | null): string | null {
  if (!snap || snap.best === null || !Number.isFinite(snap.best)) return null;
  const head = `Your best at level ${snap.level}:`;
  if (snap.game === "qa") return `${head} ${secondsLabel(snap.best)} clean after the cut-in.`;
  if (snap.game === "rush") {
    const on = snap.chain > 0 ? ` You're on ${snap.chain}.` : "";
    return `${head} ${Math.round(snap.best)} landed in a row.${on}`;
  }
  if (snap.game === "interview") return `${head} ${Math.round(snap.best)}.`;
  return null;
}

/**
 * The same best, split for the plaque the idle screen draws it on
 * (Timothy, 6 Nov: "make your best stand out more, it is an important
 * milestone"): a head, the number on its own so it can be set large,
 * the rest of the sentence, and Speed rush's current run as a note.
 * `bestLine` stays the sentence a screen reader hears.
 *   Q&A        "Your best at level 2" / "31s" / "clean after the cut-in"
 *   Speed rush "Your best at level 2" / "4" / "landed in a row" / "You're on 2."
 *   Interview  "Your best at level 2" / "712" / "Index"
 */
export interface BestParts {
  head: string;
  value: string;
  rest: string;
  note: string | null;
}

export function bestParts(snap: GameBestSnapshot | null): BestParts | null {
  if (!snap || snap.best === null || !Number.isFinite(snap.best)) return null;
  const head = `Your best at level ${snap.level}`;
  if (snap.game === "qa") {
    return { head, value: secondsLabel(snap.best), rest: "clean after the cut-in", note: null };
  }
  if (snap.game === "rush") {
    const note = snap.chain > 0 ? `You're on ${snap.chain}.` : null;
    return { head, value: String(Math.round(snap.best)), rest: "landed in a row", note };
  }
  if (snap.game === "interview") {
    return { head, value: String(Math.round(snap.best)), rest: "Index", note: null };
  }
  return null;
}

/** The levels the idle screen draws: the opened ones only, never a locked one. */
export function levelChoices(open: LevelN): LevelN[] {
  return ([1, 2, 3] as const).filter((n) => n <= open);
}

/** The XP a level pays when its staging runs, as the chip says it; null at ×1. */
export function xpLabel(multiplier: number): string | null {
  if (!Number.isFinite(multiplier) || multiplier <= 1) return null;
  return `×${Math.round(multiplier * 100) / 100} XP`;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(0.999999, Math.max(0, n)) : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
