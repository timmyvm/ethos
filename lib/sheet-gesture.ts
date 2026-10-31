import { SPRING, project, rubberband } from "@/lib/spring";

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
 * Whose a touch on content already scrolled is, by a move: the
 * hand-off's ("sheet"), the browser's own scroll ("browser"), the
 * control under it that owns sideways moves, for now ("sideways"), or
 * not yet said ("undecided").
 */
export type ScrolledTouch = "sheet" | "browser" | "sideways" | "undecided";

/** A pointer reading closer than this to the press has no direction yet. */
const HANDOFF_READ_PX = 3;

/**
 * Is a touch on content already scrolled the sheet's to drive? Its first
 * touchmove says, for good (`touchmove`): iOS settles the browser's
 * scroll on that move, and a scroll it starts cannot be taken back. Up,
 * at any angle, is the browser's native scroll, momentum and all.
 * Anything else is the hand-off's: down at any angle, and also level or
 * still (handoff review), because iOS reads a touch in whole pixels a
 * pixel or three in, so a thumb's swipe down that arcs can read (1, 0)
 * first and a press that settles (0, 0); the hand-off drives the content
 * both ways, so taking a reading with no direction costs nothing. A
 * sideways move on a control that owns sideways moves (the stair) is the
 * control's for now, scrolled or not; the slop decides whether it scrubs.
 * A pointermove (`touchmove` false) can come first, closer in: within a
 * few pixels of the press it says nothing, and the touchmove answers.
 */
export function sheetTakesScrolledTouch(
  dx: number,
  dy: number,
  sideways = false,
  touchmove = true
): ScrolledTouch {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (sideways && ax > ay) return "sideways";
  if (!touchmove && Math.max(ax, ay) < HANDOFF_READ_PX) return "undecided";
  return dy < 0 ? "browser" : "sheet";
}

/**
 * A first touchmove on content at its top that has more below, which
 * sheetHoldsTouch leaves to the browser when it reads level or still
 * (handoff review): on iOS that reading makes the whole touch the
 * browser's scroll, which at the top only rubber-bands the content, so a
 * swipe down that arcs, read (1, 0) first, never moved the sheet. Taken
 * ("sheet"), the hand-off drives it from scroll 0: up scrolls the
 * content, down pulls the sheet. A first move the stair held (sideways
 * on it) has already turned the browser's scroll off for the touch, so
 * it waits on the slop ("sideways"): a scrub, or the hand-off's. Null:
 * down is the sheet's own drag, and up the browser's scroll, as before.
 */
export function sheetTakesTopTouch(dx: number, dy: number, sideways = false): "sheet" | "sideways" | null {
  if (sideways && Math.abs(dx) > Math.abs(dy)) return "sideways";
  return dy === 0 ? "sheet" : null;
}

/**
 * Where a hand-off grabbed at `scroll` starts, or null when the sheet is
 * off its rest by `sheet` px (still rising, or springing home). Then the
 * sheet's own motion owns the finger, as on a UIKit sheet: the drag is
 * the sheet's from where it is, and the content stays put. Starting the
 * line there instead spent the sheet's offset and the scroll in one move.
 */
export function handOffFrom(scroll: number, sheet: number): HandOff | null {
  if (Math.abs(sheet) > 0.5) return null;
  return { scroll, sheet: 0 };
}

/**
 * Where, and when, a finger crossed the slop (handoff review): on the
 * straight line from its last reading inside the slop (`from`, or the
 * press) to the first outside it (`to`), where it left the square of
 * `slop` px around the `press` that sheetClaim reads. The hand-off's
 * content follows the finger from there: started from the move that
 * crossed it instead, the content lost all that move ran past the slop,
 * which in Chromium (its first touchmove comes 12 to 48px in) was up to
 * 70px of a quick swipe, and a flick that reached the page as one move
 * scrolled nothing and threw nothing. The browser's own scroll starts
 * from the slop too.
 */
export function slopCrossing(
  press: { x: number; y: number },
  from: { t: number; x: number; y: number },
  to: { t: number; x: number; y: number },
  slop = SHEET_SLOP_PX
): { t: number; y: number } {
  if (Math.max(Math.abs(from.x - press.x), Math.abs(from.y - press.y)) >= slop) return { t: from.t, y: from.y };
  let s = 1;
  for (const [a, b, c] of [
    [from.x, to.x, press.x],
    [from.y, to.y, press.y],
  ]) {
    const d = b - a;
    if (d === 0) continue;
    const k = (c + Math.sign(d) * slop - a) / d;
    if (k >= 0 && k < s) s = k;
  }
  return { t: from.t + s * (to.t - from.t), y: from.y + s * (to.y - from.y) };
}

/**
 * Where a finger on scrolled content has put the three: the content's
 * scrollTop, the sheet's offset (down is positive), and how far the
 * finger has run up past the content's end (`past`, shown with
 * resistance, edgeFromPast), when it has.
 */
export type HandOff = { scroll: number; sheet: number; past?: number };

/** Where the finger is on the line the three share: a move changes it by exactly the move (the release speed is read along it). */
export function handOffLine(at: HandOff): number {
  return at.sheet - at.scroll - (at.past ?? 0);
}

/**
 * A finger move of `dy` px (down is positive) split between the content
 * and the sheet. They sit on one line: the sheet's offset above zero and
 * the content's scroll below it, so a move down spends the scroll first
 * and gives the rest to the sheet, and a move up brings the sheet to rest
 * first and then scrolls the content again. Never both at once, and
 * finger travel is always scroll travelled plus sheet offset. Up past
 * the content's end (`max`) the line goes on as `past` (handoff review:
 * the content stopped dead there for the rest of the swipe), and a move
 * back down spends that first.
 */
export function handOff(at: HandOff, dy: number, max: number): HandOff {
  const end = Math.max(0, max);
  const line = handOffLine(at) + dy;
  if (line >= 0) return { scroll: 0, sheet: line };
  if (-line <= end) return { scroll: -line, sheet: 0 };
  return { scroll: end, sheet: 0, past: -line - end };
}

/** UIScrollView's normal deceleration rate: the speed kept each millisecond. */
export const SCROLL_DECELERATION = 0.998;

/** Slower than this (px/s, a third of a pixel a frame at 60Hz) a glide has stopped. */
export const MOMENTUM_REST_PX_S = 20;

/**
 * One frame of a glide: content let go while it still had scroll keeps
 * the finger's speed (`velocity`, px/s along scrollTop) and loses it at
 * `rate` a millisecond, the series `project` sums. Any frame length gives
 * the same path. Its scrollTop stops at the top and at the end (`max`),
 * and the speed it met the edge with (`impact`, px/s) and what was left
 * of the frame then (`overMs`) go on into the bounce (edgeSpring); a
 * glide that reaches the top never pulls the sheet, because a fling
 * closes a sheet only when the sheet itself was being dragged.
 */
export function glideStep(
  at: { scroll: number; velocity: number },
  ms: number,
  max: number,
  rate = SCROLL_DECELERATION
): { scroll: number; velocity: number; done: boolean; impact?: number; overMs?: number } {
  const span = Math.max(0, ms);
  const kept = Math.pow(rate, span);
  const reach = ((at.velocity / 1000) * rate) / (1 - rate);
  const scroll = at.scroll + reach * (1 - kept);
  const velocity = at.velocity * kept;
  const edge = scroll <= 0 ? 0 : scroll >= max ? Math.max(0, max) : null;
  if (edge !== null) {
    // The speed left at the edge: v0 * rate^t where the path crosses it.
    const keptThere = reach === 0 ? 1 : Math.min(1, Math.max(kept, 1 - (edge - at.scroll) / reach));
    const impact = at.velocity * keptThere;
    const overMs = span - Math.log(keptThere) / Math.log(rate);
    return { scroll: edge, velocity: 0, done: true, impact, overMs: Math.max(0, overMs) };
  }
  if (Math.abs(velocity) < MOMENTUM_REST_PX_S) return { scroll, velocity: 0, done: true };
  return { scroll, velocity, done: false };
}

/** The most speed a bounce takes in, px/s: a hard flick's, about 41px past the edge at the peak. */
const EDGE_MAX_PX_S = 2000;

/**
 * Content past its top or its end, `ms` after it set off from `offset`
 * px past the edge at `velocity` px/s (positive is further past), on a
 * critically damped SPRING.base (handoff review, apple-design §9): a
 * glide that meets an edge goes on past it a little and comes back, and
 * content a finger let go of past its end comes back from there, with
 * no wobble and never through the edge. Moves the content only.
 */
export function edgeSpring(
  offset: number,
  velocity: number,
  ms: number
): { offset: number; velocity: number; done: boolean } {
  const w0 = (2 * Math.PI) / SPRING.base.response;
  const v0 = Math.max(-EDGE_MAX_PX_S, Math.min(EDGE_MAX_PX_S, velocity));
  const t = Math.max(0, ms) / 1000;
  const decay = Math.exp(-w0 * t);
  const b = v0 + w0 * offset;
  const x = (offset + b * t) * decay;
  const v = (v0 - w0 * b * t) * decay;
  if (t > 0 && Math.abs(x) < 0.25 && Math.abs(v) < MOMENTUM_REST_PX_S) return { offset: 0, velocity: 0, done: true };
  return { offset: x, velocity: v, done: false };
}

/**
 * A finger's run `past` the content's end, as the content shows it: with
 * the rubber band's resistance against the scroller's `dimension`, and
 * the finger's `velocity` (px/s, down positive) as the speed the shown
 * offset was moving further past at, for edgeSpring to carry on.
 */
export function edgeFromPast(past: number, velocity: number, dimension: number): { offset: number; velocity: number } {
  if (past <= 0) return { offset: 0, velocity: 0 };
  const offset = rubberband(past, dimension);
  // The band's give at `past`: d/dx of x·D·c / (D + c·x).
  const c = 0.55;
  const give = (c * dimension * dimension) / Math.pow(dimension + c * past, 2);
  return { offset, velocity: -velocity * give };
}

/** The run past the end that shows as `offset` (edgeFromPast's, read back): a finger that catches content on its way back takes it from there. */
export function pastFromEdge(offset: number, dimension: number): number {
  if (offset <= 0) return 0;
  const shown = Math.min(offset, dimension * 0.999);
  return (shown * dimension) / (0.55 * (dimension - shown));
}

/**
 * What letting go of a hand-off does. The sheet moved: its own rules
 * decide ("close" or "home"), with the travel, the run and the room all
 * counted from the hand-off point, where it started to move: the finger
 * is there plus the sheet's offset, 1:1. Counted from the press, a long
 * swipe that spent most of itself scrolling read as a long pull. The
 * sheet still at rest: the content glides (`glideStep`), or, let go past
 * its end, comes back to it ("back", edgeSpring).
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
}): "close" | "home" | "glide" | "back" {
  if ((at.past ?? 0) > 0) return "back";
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
