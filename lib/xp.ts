/**
 * XP, paid and read (#485). One number decides what a recording pays,
 * and the server's save (lib/db.ts `saveRep`) and every screen that says
 * it read this one, so a line on You can never promise a figure the
 * server does not pay.
 *
 * What pays: every recording an account stores that earns a star,
 * Today's practice and a lesson's alike, pays `XP_PER_RECORDING` times
 * its multiplier: 1 for a plain take, more with difficulty turned up
 * (lib/stress-mods.ts), on a game's level (lib/games.ts) or the boss
 * (lib/boss.ts), capped at MAX_XP_MULTIPLIER. A take that earns no star
 * (#504: under 20 words, or one phrase on repeat) pays nothing (#510,
 * Timothy 18 Nov, on "a recording with no stars still earns 10 XP":
 * "drop it"), on every path that stores one: the daily, a lesson, the
 * boss, a game round, Hostile, an upload (`xpForTake`). A take sent with
 * no session is stored nowhere and pays nothing (app/api/analyze).
 *
 * Pure: no React, no network. The level curve is lib/level.ts.
 */

import { levelFromXp } from "./level";
import { MIN_WORDS_TO_SCORE } from "./metrics";

/** XP a plain recording pays, before any multiplier (DECISIONS #16). */
export const XP_PER_RECORDING = 10;

/** What a take with this multiplier pays when it pays: never under 1, as the server rounds it. */
export function xpPaid(multiplier = 1): number {
  const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return Math.max(1, Math.round(XP_PER_RECORDING * m));
}

/**
 * What one stored take pays (#510): nothing for a take that earned no
 * star, else `xpPaid` of its multiplier. The save (lib/db.ts `saveRep`)
 * pays through it and the server's answer carries what it paid, so the
 * round card's "+20 XP" and You's XP today are the same number. Stars
 * are the measured ones (lib/metrics.ts `starsFor`), never the stored
 * column, which says 1 for a 0 until migration 0035 is applied.
 */
export function xpForTake(stars: number, multiplier = 1): number {
  return Number.isFinite(stars) && stars >= 1 ? xpPaid(multiplier) : 0;
}

/** Star 1's goal, as the glance draws it under the star (lib/metrics.ts `starGoals`). */
const PAYING_WORDS = `${MIN_WORDS_TO_SCORE}+ words`;

export interface XpStanding {
  level: number;
  /** XP still to earn before the next level. */
  toNext: number;
  /** The next level's number. */
  next: number;
  /** How full the bar is, 0 to 1. */
  fraction: number;
  /** XP into this level, and the level's whole span, for the bar's name. */
  into: number;
  span: number;
}

/** Where a total stands on the curve, the distance to the next level first. */
export function xpStanding(total: number): XpStanding {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const { level, intoLevel, forNext } = levelFromXp(t);
  return {
    level,
    toNext: forNext - intoLevel,
    next: level + 1,
    fraction: forNext > 0 ? intoLevel / forNext : 0,
    into: intoLevel,
    span: forNext,
  };
}

/**
 * The card's line under the bar: the distance, in XP, to the next level
 * ("10 XP to level 2"). Timothy, 16 Nov, on "40 of 50 to level 2": a
 * first-time reader has to do the sum to know how far it is, so the line
 * says the sum's answer.
 */
export function levelLine(total: number): string {
  const s = xpStanding(total);
  return `${s.toNext} XP to level ${s.next}`;
}

/**
 * What reaches it, from what actually pays (Timothy: "Do this to reach
 * it"). Since #510 a take pays only when it earns a star, so the line
 * names star 1's own goal, in the words the glance draws under it ("20+
 * words"): "Speak 20+ words today for 10 XP." before today is spoken,
 * "again" after. When one recording closes the gap, it says so in the
 * level's own words.
 */
export function reachLine(total: number, spokeToday: boolean): string {
  const s = xpStanding(total);
  const pays = xpPaid(1);
  const when = spokeToday ? "again" : "today";
  if (s.toNext <= pays) return `Speak ${PAYING_WORDS} ${when} to reach level ${s.next}.`;
  return `Speak ${PAYING_WORDS} ${when} for ${pays} XP.`;
}

/** The bar's accessible name: both numbers the line and the bar show. */
export function barLabel(total: number): string {
  const s = xpStanding(total);
  return `Level ${s.level}, ${s.into} of ${s.span} XP. ${s.toNext} XP to level ${s.next}.`;
}

/** XP earned since the start of `now`'s day, on the phone's own calendar. */
export function xpToday(rows: readonly { amount: number; created_at: string }[], now = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return rows.filter((r) => new Date(r.created_at) >= start).reduce((a, r) => a + (Number(r.amount) || 0), 0);
}

/*
 * The three numbers' flames (#485, Timothy: "current streak, greyed out
 * fire, max streak orange fire"). The current streak's flame is grey
 * until today is spoken, then lit; the best streak's is lit once there
 * is one. A zero never lights anything.
 */
export type Flame = "lit" | "grey";

export function streakFlame(current: number, didToday: boolean): Flame {
  return didToday && current > 0 ? "lit" : "grey";
}

export function bestFlame(longest: number): Flame {
  return longest > 0 ? "lit" : "grey";
}
