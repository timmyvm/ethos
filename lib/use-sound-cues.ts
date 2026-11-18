"use client";

import { useEffect, useRef } from "react";
import { CueRunner } from "./sound";
import type { Cue } from "./sound-recipes";

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
