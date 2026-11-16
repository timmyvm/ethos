import type { ReactNode } from "react";

/**
 * Two marks in one place, one showing at a time (#474): Hear it back's
 * Play and Pause, a word's Save and Saved. On a change the mark that is
 * leaving blurs as it fades and shrinks a little, and the one arriving
 * sharpens out of the same blur, which is how SF Symbols draws a
 * replace. A cut between two glyphs read as a flicker on the one control
 * a thumb was still on.
 *
 * Both marks stay drawn in one grid cell (`.icon-swap`, globals.css), so
 * the swap is a transition with nothing mounting and the control never
 * changes size. Pictures only: the button's own name says the state, so
 * the pair is hidden from a screen reader. Reduced motion keeps the fade
 * alone; lite graphics drops the blur.
 */
export function IconSwap({ swapped, from, to }: { swapped: boolean; from: ReactNode; to: ReactNode }) {
  return (
    <span aria-hidden className="icon-swap">
      <span data-off={swapped ? "" : undefined}>{from}</span>
      <span data-off={swapped ? undefined : ""}>{to}</span>
    </span>
  );
}
