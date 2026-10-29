import { project } from "@/lib/spring";

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
 * Two questions per move. Overlay's touchmove asks `sheetHoldsTouch`
 * from the first pixel, so the browser's own pan is refused before it can
 * start (a pan that starts cancels the pointer, and the drag with it);
 * its pointermove asks `sheetClaim` at `SHEET_SLOP_PX` before the sheet
 * moves, so a tap stays a tap.
 */

/** Ten pixels of intent before the sheet moves (apple-design §10). */
export const SHEET_SLOP_PX = 10;

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

/**
 * Should this touchmove be kept from the browser? Asked on every move
 * until the pointer has decided, from the first one, at any distance:
 * iOS Safari settles whether a touch scrolls on its first touchmove, and
 * one it lets through stays a scroll (or a rubber band at the top) for
 * the rest of the touch. Holding a move decides nothing else: the
 * pointer still reaches the sheet and the stair, and `sheetClaim` still
 * says whose the finger is at the slop.
 */
export function sheetHoldsTouch(dx: number, dy: number, scrolls: boolean): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Not moved yet: where nothing scrolls, the browser has nothing to do.
  if (ax === 0 && ay === 0) return !scrolls;
  // Sideways is the stair's scrub, and its own touch-action already says so.
  if (ax > ay) return false;
  // Any downward lean, from the top: the sheet's, whatever is under it.
  if (dy > 0) return true;
  // Up is the content's scroll, when it has one.
  return !scrolls;
}

/** The least a finger must take the sheet before the room rule counts. */
const DISMISS_MIN_TRAVEL_PX = 16;

/**
 * Does a released drag close the sheet? `travel`: how far the finger
 * moved it since it took hold (down is positive). `from`: where the sheet
 * was when the finger took it (0 at rest). `velocity`: the finger's speed
 * at release, px/s. `height`: the panel's. `room`: the screen under the
 * finger when it took hold, to the bottom edge.
 *
 * Where the throw would carry the sheet decides most releases: past half
 * its height, it goes (apple-design §6). But a thumb on the tap shelf has
 * 40 to 110px of glass under it, and only a hard flick carried that far,
 * so a finger that took the sheet three quarters of the way to the edge
 * has said "go" too. An upward flick keeps it, wherever it is.
 */
export function sheetDismisses({
  travel,
  from = 0,
  velocity,
  height,
  room,
}: {
  travel: number;
  from?: number;
  velocity: number;
  height: number;
  room: number;
}): boolean {
  if (velocity <= -300) return false;
  if (from + travel + project(velocity) > height * 0.5) return true;
  return travel >= Math.max(room * 0.75, DISMISS_MIN_TRAVEL_PX);
}
