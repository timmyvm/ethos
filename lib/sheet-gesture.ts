/**
 * Whose a finger on a sheet is (components/ui/Overlay.tsx).
 *
 * A touch that starts where nothing is scrolled could be three things:
 * the sheet's own drag (down, from anywhere, the way an iOS sheet goes),
 * the content's scroll (up, into content that has more below), or a
 * sideways gesture that belongs to a control (the paywall's stair). A
 * touch that starts in content already scrolled never reaches this:
 * that finger is the scroll's, whichever way it goes.
 *
 * Asked twice per move. Overlay's touchmove asks at `SHEET_LEAN_PX`, so
 * the browser's own pan is refused before it can start (a pan that
 * starts cancels the pointer, and the drag with it); its pointermove
 * asks at `SHEET_SLOP_PX` before the sheet moves, so a tap stays a tap.
 */

/** Ten pixels of intent before the sheet moves (apple-design §10). */
export const SHEET_SLOP_PX = 10;
/** How far a finger goes before the sheet says which way it leans. */
export const SHEET_LEAN_PX = 4;

export type SheetClaim = "sheet" | "content" | "undecided";

/**
 * `dx`, `dy`: how far the finger is from where it went down (down is
 * positive). `scrolls`: something under the finger has content to
 * scroll. `slop`: how far it must go before this answers.
 */
export function sheetClaim(dx: number, dy: number, scrolls: boolean, slop: number): SheetClaim {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return "undecided";
  // Sideways is a control's (the stair's scrub), never the sheet's.
  if (ax > ay) return "content";
  // Up into content with more below is a scroll.
  if (dy < 0 && scrolls) return "content";
  // Down from the top, or up on a sheet with nothing to scroll (it gives
  // and pulls back).
  return "sheet";
}
