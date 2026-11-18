"use client";

import { useEffect, useRef } from "react";
import { CueRunner, canSound, playSound } from "./sound";
import { countTicks, xpTicksOwed, type Cue } from "./sound-recipes";

/**
 * Plays a moment's sounds on its clock (#505): each cue at its time from
 * the first render that has cues, a later read replacing only what has
 * not played (`CueRunner`), and whatever is still waiting dropped when
 * the screen goes. Pass null until the moment starts.
 */
export function useSoundCues(cues: readonly Cue[] | null): void {
  const runner = useRef<CueRunner | null>(null);
  const key = cues ? cues.map((c) => `${c.slot}:${c.sound}@${c.atMs}`).join("|") : "";
  useEffect(() => {
    if (!cues || cues.length === 0) return;
    if (!runner.current) runner.current = new CueRunner();
    runner.current.run(cues);
    // The key is the cues: a re-render with the same cues changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => runner.current?.cancel(), []);
}

/**
 * A count's ticks (CountUp's `onClimb`): a click each step the shown
 * number passes, or one as it lands when there is no climb (reduced
 * motion). Returns the stop.
 */
export function tickClimb(from: number, to: number, durationMs: number): () => void {
  if (durationMs <= 0) {
    playSound("tick");
    return () => {};
  }
  const runner = new CueRunner();
  runner.run(countTicks(from, to, durationMs));
  return () => runner.cancel();
}

const HEARD = "ethos.xp.heard";

/**
 * XP today's ticks are owed once per climb this phone has not heard
 * (`xpTicksOwed`): read and marked in one go, so a second visit to You
 * with the same XP is quiet.
 */
export function claimXpTicks(today: number, day: string): boolean {
  /* Nothing can sound yet (no tap this visit, or Sound off): the climb
     stays owed for a visit that can hear it. */
  if (!canSound()) return false;
  let heard: { day: string; xp: number } | null = null;
  try {
    const raw = localStorage.getItem(HEARD);
    heard = raw ? (JSON.parse(raw) as { day: string; xp: number }) : null;
  } catch {}
  const owed = xpTicksOwed(today, day, heard);
  if (owed) {
    try {
      localStorage.setItem(HEARD, JSON.stringify({ day, xp: today }));
    } catch {}
  }
  return owed;
}
