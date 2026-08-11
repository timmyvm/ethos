/**
 * Tips while you're actually speaking.
 *
 * The frame step already teaches shape ("Shape it like this", before the
 * clock). This is the other half: the two or three things that are only
 * actionable *mid-rep*, delivered at the moment they apply.
 *
 * Three rules, and they're what makes this not-intrusive rather than a
 * banner:
 *
 * 1. **Timed, not rotating.** A carousel of advice is noise you learn to
 *    ignore. These fire at points in the arc of a rep — the opening beat,
 *    the first place a point has landed, the middle where the ums live,
 *    the last ten seconds — so a tip is either relevant now or absent.
 * 2. **One line, short enough to read in a glance.** You cannot read and
 *    speak at the same time (the same reason notes disappear when the
 *    clock starts). Anything over ~40 characters is a distraction, not a
 *    tip, so the test enforces the ceiling.
 * 3. **They yield.** A live nudge ("Eyes down") is about the rep in
 *    progress and always wins; a tip never competes with it.
 *
 * Content traces to the pause work (DECISIONS #97 / Goldman-Eisler):
 * juncture pauses — before you start, after a point lands, at a topic
 * change, and in place of an "um" — are the ones that score. Nothing
 * here is generic public-speaking advice; every line names something the
 * scorer actually measures.
 */

export interface LiveTip {
  /** Fraction of the cap this becomes relevant at. */
  at: number;
  text: string;
  /** Only shown when the camera is on. */
  video?: boolean;
}

/** How long one tip stays up. Long enough to read once, not to re-read. */
export const TIP_HOLD_S = 6;

/**
 * The arc. Positions are fractions so a 45-second drill and a 90-second
 * one both get the opening beat early and the closing line at the end,
 * rather than the short drill getting only the first tip.
 */
export const LIVE_TIPS: LiveTip[] = [
  { at: 0.02, text: "Start with one beat of silence." },
  { at: 0.22, text: "Point landed? Stop for a second." },
  { at: 0.45, text: "An “um” coming? Close your mouth." },
  { at: 0.62, text: "Changing subject? Pause first.", video: false },
  { at: 0.62, text: "Let your hands finish the sentence.", video: true },
  { at: 0.85, text: "Last line is the one they keep." },
];

/**
 * The tip to show right now, or null.
 *
 * Deliberately a pure function of elapsed time rather than a scheduler
 * with its own state: the rep screen already owns a clock, and a second
 * source of truth for "where are we" is how a tip ends up on screen
 * during the results view.
 */
export function liveTipAt(
  elapsed: number,
  cap: number,
  video: boolean,
  tips: LiveTip[] = LIVE_TIPS
): string | null {
  if (cap <= 0 || elapsed < 0) return null;
  const fraction = elapsed / cap;
  // Latest tip whose moment has passed and hasn't expired. Latest, not
  // first: near the end of a long rep several are behind us, and the
  // closing line is the one that matters.
  let best: LiveTip | null = null;
  for (const tip of tips) {
    if (tip.video !== undefined && tip.video !== video) continue;
    if (tip.at > fraction) continue;
    const shownAt = tip.at * cap;
    if (elapsed - shownAt > TIP_HOLD_S) continue;
    if (!best || tip.at > best.at) best = tip;
  }
  return best?.text ?? null;
}
