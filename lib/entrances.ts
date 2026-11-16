/**
 * Run everything `el` was going to play to its end: entrances, staggers,
 * the fade its content arrives with. A loop (a placeholder's sweep, an
 * idle) has no end and is left alone.
 *
 * The element's own motion is not its content's: a page a finger is
 * moving, or one still landing from a swipe, keeps its slide.
 *
 * Used where a screen has already been seen: a tab a swipe brought in
 * under its own picture (components/TabSwipe.tsx), and a tab come back
 * to this visit (components/PageTransition.tsx, #467).
 */
export function finishEntrances(el: HTMLElement): void {
  for (const a of el.getAnimations({ subtree: true })) {
    const end = Number(a.effect?.getComputedTiming().endTime);
    if (a.playState !== "running" || !Number.isFinite(end)) continue;
    if ((a.effect as KeyframeEffect | null)?.target === el) continue;
    try {
      a.finish();
    } catch {
      // Gone between the look and the call: nothing left to finish.
    }
  }
}
