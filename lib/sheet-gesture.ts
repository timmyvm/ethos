import { project } from "@/lib/spring";

/**
 * Whose a finger on a sheet is (components/ui/Overlay.tsx).
 *
 * A touch that starts where nothing is scrolled could be three things:
 * the sheet's own drag (down, from anywhere, at any angle, the way an iOS
 * sheet follows a thumb's arc), the content's scroll (up, into content
 * that has more below), or a sideways gesture that belongs to a control
 * that owns sideways moves (the paywall's stair, which says so with
 * `touch-action: pan-y`).
 *
 * Two questions per move. Overlay's touchmove asks `sheetHoldsTouch`
 * from the first pixel, so the browser's own pan is refused before it can
 * start (a pan that starts cancels the pointer, and the drag with it);
 * its pointermove asks `sheetClaim` at `SHEET_SLOP_PX` before the sheet
 * moves, so a tap stays a tap.
 *
 * A touch that starts in content already scrolled is the hand-off's
 * (handoff, below): its first move says whether the sheet drives the
 * scroll and then itself, or the browser scrolls it as before.
 */

/** Ten pixels of intent before the sheet moves (apple-design §10). */
export const SHEET_SLOP_PX = 10;

export type SheetClaim = "sheet" | "content" | "undecided";

/**
 * `dx`, `dy`: how far the finger is from where it went down (down is
 * positive). `scrolls`: something under the finger has content to
 * scroll. `slop`: how far it must go before this answers. `sideways`:
 * something under the finger owns sideways moves (the stair's scrub, a
 * row that scrolls sideways).
 */
export function sheetClaim(
  dx: number,
  dy: number,
  scrolls: boolean,
  slop: number,
  sideways = false
): SheetClaim {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return "undecided";
  // Sideways on a control that owns it (the stair's scrub), never the sheet's.
  if (sideways && ax > ay) return "content";
  // Up into content with more below is a scroll, at any angle.
  if (dy < 0 && scrolls) return "content";
  // Down from the top at any angle (a thumb's swipe arcs, and its first
  // ten pixels can lean more sideways than down), or up on a sheet with
  // nothing to scroll (it gives and pulls back). The sheet follows the
  // finger's height alone.
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
 *
 * That first move comes a pixel or three in, and a finger's contact
 * wobbles by about as much as it starts to move, so its sideways part
 * says nothing about the swipe (notes1, round 3): a swipe down that
 * read (2, 1) was left to the browser, which panned the page and
 * cancelled the pointer. Only a control that owns sideways moves makes
 * sideways mean something, and it holds its own (the stair).
 */
export function sheetHoldsTouch(dx: number, dy: number, scrolls: boolean, sideways = false): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Sideways on a control that owns sideways moves: the control's call.
  if (sideways && ax > ay) return false;
  // Any downward lean, at any angle, from the top: the sheet's, whatever
  // is under it.
  if (dy > 0) return true;
  // Still, level or up: the content's scroll when it has one; where
  // nothing scrolls the browser has nothing to pan.
  return !scrolls;
}

/** The least a finger must take the sheet before the room rule counts. */
const DISMISS_MIN_TRAVEL_PX = 16;

/**
 * Does a released drag close the sheet? `travel`: how far the finger
 * moved it since it took hold (down is positive). `from`: where the sheet
 * was when the finger took it (0 at rest). `velocity`: the finger's speed
 * at release, px/s. `height`: the panel's. `room`: the screen under the
 * finger where it went down, to the bottom edge. `run`: how far down the
 * finger went from there (`travel` when not given).
 *
 * Where the throw would carry the sheet decides most releases: past half
 * its height, it goes (apple-design §6). But a thumb on the tap shelf has
 * 30 to 110px of glass under it, and only a hard flick carried that far,
 * so a finger that ran three quarters of the way to the edge has said
 * "go" too. That run counts from the press, slop and all (notes1, round
 * 3): a quick swipe off the last line can reach the page as one move,
 * which the sheet takes and has travelled nothing on when it lets go.
 * An upward flick keeps it, wherever it is.
 */
export function sheetDismisses({
  travel,
  from = 0,
  velocity,
  height,
  room,
  run = travel,
}: {
  travel: number;
  from?: number;
  velocity: number;
  height: number;
  room: number;
  run?: number;
}): boolean {
  if (velocity <= -300) return false;
  if (from + travel + project(velocity) > height * 0.5) return true;
  return run >= Math.max(room * 0.75, DISMISS_MIN_TRAVEL_PX);
}

/*
 * The hand-off (handoff, Timothy: "Yea add that"). A UIKit sheet over a
 * scroll view takes one finger as one gesture: a swipe down on content
 * scrolled part way scrolls it back to its top, and the rest of the same
 * swipe pulls the sheet, with no second swipe and no seam where one
 * becomes the other. The browser cannot hand a touch from its own scroll
 * to the page mid-swipe (once it scrolls, the pointer is cancelled), so
 * the sheet takes such a touch from its first move and drives both.
 */

/**
 * Is a touch on content already scrolled the sheet's to drive? Asked once,
 * on its first move (iOS settles a scroll there, and the browser's own
 * scroll cannot be taken back later): a move with any downward lean, at
 * any angle, is; a move up or level stays the browser's native scroll,
 * momentum and all. A sideways move on a control that owns sideways moves
 * (the stair) is the control's, scrolled or not.
 */
export function sheetTakesScrolledTouch(dx: number, dy: number, sideways = false): boolean {
  if (sideways && Math.abs(dx) > Math.abs(dy)) return false;
  return dy > 0;
}

/** Where a finger on scrolled content has put the two: the content's scrollTop and the sheet's offset (down is positive). */
export type HandOff = { scroll: number; sheet: number };

/**
 * A finger move of `dy` px (down is positive) split between the content
 * and the sheet. They sit on one line: the sheet's offset above zero and
 * the content's scroll below it, so a move down spends the scroll first
 * and gives the rest to the sheet, and a move up brings the sheet to rest
 * first and then scrolls the content again. Never both at once, and
 * finger travel is always scroll travelled plus sheet offset, except at
 * the content's end (`max`), where the scroll stops; asked move by move,
 * the first move back down moves it at once.
 */
export function handOff(at: HandOff, dy: number, max: number): HandOff {
  const line = at.sheet - at.scroll + dy;
  if (line >= 0) return { scroll: 0, sheet: line };
  return { scroll: Math.min(Math.max(0, max), -line), sheet: 0 };
}

/** UIScrollView's normal deceleration rate: the speed kept each millisecond. */
export const SCROLL_DECELERATION = 0.998;

/** Slower than this (px/s, a third of a pixel a frame at 60Hz) a glide has stopped. */
export const MOMENTUM_REST_PX_S = 20;

/**
 * One frame of a glide: content let go while it still had scroll keeps
 * the finger's speed (`velocity`, px/s along scrollTop) and loses it at
 * `rate` a millisecond, the series `project` sums. Any frame length gives
 * the same path. It stops dead at the top and at the end (`max`); a glide
 * that reaches the top never pulls the sheet, because a fling closes a
 * sheet only when the sheet itself was being dragged.
 */
export function glideStep(
  at: { scroll: number; velocity: number },
  ms: number,
  max: number,
  rate = SCROLL_DECELERATION
): { scroll: number; velocity: number; done: boolean } {
  const kept = Math.pow(rate, Math.max(0, ms));
  const scroll = at.scroll + ((at.velocity / 1000) * rate * (1 - kept)) / (1 - rate);
  const velocity = at.velocity * kept;
  if (scroll <= 0) return { scroll: 0, velocity: 0, done: true };
  if (scroll >= max) return { scroll: Math.max(0, max), velocity: 0, done: true };
  if (Math.abs(velocity) < MOMENTUM_REST_PX_S) return { scroll, velocity: 0, done: true };
  return { scroll, velocity, done: false };
}

/**
 * What letting go of a hand-off does. The sheet moved: its own rules
 * decide ("close" or "home"), with the travel, the run and the room all
 * counted from the hand-off point, where it started to move: the finger
 * is there plus the sheet's offset, 1:1. Counted from the press, a long
 * swipe that spent most of itself scrolling read as a long pull. The
 * sheet still at rest: the content glides (`glideStep`).
 * `velocity` is the finger's, px/s, down positive; `screen` the
 * viewport's height; `fingerY` where the finger let go.
 */
export function handOffEnd({
  at,
  velocity,
  height,
  screen,
  fingerY,
}: {
  at: HandOff;
  velocity: number;
  height: number;
  screen: number;
  fingerY: number;
}): "close" | "home" | "glide" {
  if (at.sheet <= 0) return "glide";
  const handedOff = fingerY - at.sheet;
  return sheetDismisses({
    travel: at.sheet,
    velocity,
    height,
    room: Math.max(0, screen - handedOff),
    run: at.sheet,
  })
    ? "close"
    : "home";
}
