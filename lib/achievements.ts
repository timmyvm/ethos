/**
 * Achievements — earned from measured facts only, same rule as stars
 * (DECISIONS #10). Every badge names the number that unlocked it, so
 * none of them are participation trophies. Copy stays coach register:
 * no "amazing", no "you're crushing it".
 */

import type { RepRow } from "./client-data";
import { computeStreak } from "./streak";

export interface Achievement {
  id: string;
  name: string;
  /** What it took — always a number the user can verify. */
  requirement: string;
  earned: boolean;
  /** Progress toward it, 0–1, for the not-yet-earned ones. */
  progress: number;
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
  const bestIndex = reps.reduce(
    (a, r) => Math.max(a, r.ethos_index ?? 0),
    0
  );

  const list: Achievement[] = [
    {
      id: "first",
      name: "First rep",
      requirement: "Take the floor once",
      earned: reps.length >= 1,
      progress: Math.min(1, reps.length),
    },
    {
      id: "week",
      name: "Seven straight",
      requirement: "7-day streak",
      earned: streak.longest >= 7,
      progress: Math.min(1, streak.longest / 7),
    },
    {
      id: "fortnight",
      name: "Fourteen straight",
      requirement: "14-day streak — the north star",
      earned: streak.longest >= 14,
      progress: Math.min(1, streak.longest / 14),
    },
    {
      id: "clean",
      name: "Clean run",
      requirement: "A rep under 3 fillers/min",
      earned: cleanest < 3,
      progress: cleanest === Infinity ? 0 : Math.min(1, 3 / Math.max(cleanest, 0.01)),
    },
    {
      id: "silence",
      name: "Comfortable silence",
      requirement: "5 composed pauses in one rep",
      earned: best(composed) >= 5,
      progress: Math.min(1, best(composed) / 5),
    },
    {
      id: "held",
      name: "Held the room",
      requirement: "8 held pauses in one rep",
      earned: best(heldPauses) >= 8,
      progress: Math.min(1, best(heldPauses) / 8),
    },
    {
      id: "zone",
      name: "In the zone",
      requirement: "5 reps at 130–160 wpm",
      earned: inZone >= 5,
      progress: Math.min(1, inZone / 5),
    },
    {
      id: "seven",
      name: "Ethos 700",
      requirement: "Score 700 or higher",
      earned: bestIndex >= 700,
      progress: Math.min(1, bestIndex / 700),
    },
    {
      id: "eight",
      name: "Ethos 800",
      requirement: "Score 800 or higher",
      earned: bestIndex >= 800,
      progress: Math.min(1, bestIndex / 800),
    },
    {
      id: "thirty",
      name: "Thirty reps",
      requirement: "30 reps logged",
      earned: reps.length >= 30,
      progress: Math.min(1, reps.length / 30),
    },
  ];

  return list;
}
