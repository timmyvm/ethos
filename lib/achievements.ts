/**
 * Achievements — earned from measured facts only, same rule as stars
 * (DECISIONS #10). Every badge names the number that unlocked it, so
 * none of them are participation trophies.
 *
 * Three things make the list feel like a shelf rather than a grid of
 * boxes (DECISIONS #153):
 *
 * 1. **Order is difficulty, easiest first.** No tier labels, no "hard"
 *    chips — the position IS the claim, so the list reads as a ladder
 *    and the last one is the summit. Difficulty is a sort key and never
 *    reaches the screen.
 * 2. **Each one names where you earn it.** A locked badge that only
 *    describes itself is a taunt; this one is a door, and `href` opens
 *    the exact drill that produces the number.
 * 3. **Each one has a mark**, from the app's own icon set, keyed by
 *    what it measures rather than by badge — the flame is streaks
 *    wherever it appears.
 */

import type { RepRow } from "./client-data";
import { computeStreak } from "./streak";

/** Which drawn mark sits beside it. Keyed by the thing measured. */
export type AchievementIcon =
  | "mic"
  | "flame"
  | "wave"
  | "pause"
  | "gauge"
  | "trend";

export interface Achievement {
  id: string;
  name: string;
  /** What it took — always a number the user can verify. Kept short. */
  requirement: string;
  earned: boolean;
  /** Progress toward it, 0–1, for the not-yet-earned ones. */
  progress: number;
  /** Where to go to earn it: the drill that produces the number. */
  href: string;
  icon: AchievementIcon;
}

function heldPauses(r: RepRow): number {
  return (r.pauses ?? []).filter((p) => p.kind !== "beat").length;
}

function composed(r: RepRow): number {
  return (r.pauses ?? []).filter((p) => p.kind === "pre").length;
}

function fpm(r: RepRow): number {
  return r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : 0;
}

export function achievements(reps: RepRow[]): Achievement[] {
  const streak = computeStreak(reps.map((r) => new Date(r.created_at)));
  const best = (fn: (r: RepRow) => number) =>
    reps.length ? Math.max(...reps.map(fn)) : 0;
  const cleanest = reps.length ? Math.min(...reps.map(fpm)) : Infinity;
  const inZone = reps.filter((r) => r.wpm >= 130 && r.wpm <= 160).length;
  const bestIndex = reps.reduce((a, r) => Math.max(a, r.ethos_index ?? 0), 0);

  /*
   * Ordered, hardest last. One rep can win the first four; the last
   * three take weeks, and the fortnight is the north star the whole
   * economy is built around (#28), so it closes the shelf.
   */
  return [
    {
      id: "first",
      name: "First rep",
      requirement: "Take the floor once",
      earned: reps.length >= 1,
      progress: Math.min(1, reps.length),
      href: "/rep",
      icon: "mic",
    },
    {
      id: "clean",
      name: "Clean run",
      requirement: "A rep under 3 fillers a minute",
      earned: cleanest < 3,
      progress:
        cleanest === Infinity ? 0 : Math.min(1, 3 / Math.max(cleanest, 0.01)),
      href: "/rep?lesson=f4",
      icon: "wave",
    },
    {
      id: "silence",
      name: "Comfortable silence",
      requirement: "5 composed pauses in one rep",
      earned: best(composed) >= 5,
      progress: Math.min(1, best(composed) / 5),
      href: "/rep?lesson=h1",
      icon: "pause",
    },
    {
      id: "seven",
      name: "Ethos 700",
      requirement: "Score 700 or higher",
      earned: bestIndex >= 700,
      progress: Math.min(1, bestIndex / 700),
      href: "/rep",
      icon: "trend",
    },
    {
      id: "zone",
      name: "In the zone",
      requirement: "5 reps at 130 to 160 wpm",
      earned: inZone >= 5,
      progress: Math.min(1, inZone / 5),
      href: "/rep?lesson=p1",
      icon: "gauge",
    },
    {
      id: "held",
      name: "Held the room",
      requirement: "8 held pauses in one rep",
      earned: best(heldPauses) >= 8,
      progress: Math.min(1, best(heldPauses) / 8),
      href: "/rep?lesson=h4",
      icon: "pause",
    },
    {
      id: "week",
      name: "Seven straight",
      requirement: "7-day streak",
      earned: streak.longest >= 7,
      progress: Math.min(1, streak.longest / 7),
      href: "/rep",
      icon: "flame",
    },
    {
      id: "eight",
      name: "Ethos 800",
      requirement: "Score 800 or higher",
      earned: bestIndex >= 800,
      progress: Math.min(1, bestIndex / 800),
      href: "/rep",
      icon: "trend",
    },
    {
      id: "thirty",
      name: "Thirty reps",
      requirement: "30 reps logged",
      earned: reps.length >= 30,
      progress: Math.min(1, reps.length / 30),
      href: "/rep",
      icon: "mic",
    },
    {
      id: "fortnight",
      name: "Fourteen straight",
      requirement: "14-day streak",
      earned: streak.longest >= 14,
      progress: Math.min(1, streak.longest / 14),
      href: "/rep",
      icon: "flame",
    },
  ];
}
