import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPRING, project, rubberband } from "./spring";
import {
  MOMENTUM_REST_PX_S,
  SCROLL_DECELERATION,
  SHEET_SLOP_PX,
  edgeFromPast,
  edgeSpring,
  glideStep,
  handOff,
  handOffLine,
  pastFromEdge,
  handOffEnd,
  handOffFrom,
  sheetClaim,
  sheetDismisses,
  sheetHoldsTouch,
  sheetTakesScrolledTouch,
  sheetTakesTopTouch,
  slopCrossing,
  type HandOff,
} from "./sheet-gesture";

/*
 * Whose a finger on a sheet is (notes1, Timothy: "I cant reliably
 * scroll down the paywall, to move it away"). A touch that starts where
 * nothing is scrolled is asked, as it moves, whether it is the sheet's
 * drag or the content's own gesture (a scroll, the stair's scrub).
 */
describe("sheetClaim", () => {
  it("waits until the finger has moved past the slop", () => {
    expect(sheetClaim(0, 0, false, SHEET_SLOP_PX)).toBe("undecided");
    expect(sheetClaim(3, 9, false, SHEET_SLOP_PX)).toBe("undecided");
    expect(sheetClaim(0, -9, true, SHEET_SLOP_PX)).toBe("undecided");
  });

  it("gives a downward drag to the sheet, scrollable content or not: at the top there is nothing to scroll down to", () => {
    expect(sheetClaim(0, 12, false, SHEET_SLOP_PX)).toBe("sheet");
    expect(sheetClaim(0, 12, true, SHEET_SLOP_PX)).toBe("sheet");
    expect(sheetClaim(4, 40, true, SHEET_SLOP_PX)).toBe("sheet");
  });

  it("gives an upward drag to the content when the content scrolls", () => {
    expect(sheetClaim(0, -12, true, SHEET_SLOP_PX)).toBe("content");
  });

  it("keeps an upward drag on a sheet with nothing to scroll (it gives and pulls back)", () => {
    expect(sheetClaim(0, -12, false, SHEET_SLOP_PX)).toBe("sheet");
  });

  it("never takes a sideways drag from a control that owns sideways moves: the stair's scrub", () => {
    expect(sheetClaim(12, 4, false, SHEET_SLOP_PX, true)).toBe("content");
    expect(sheetClaim(-30, 20, true, SHEET_SLOP_PX, true)).toBe("content");
    expect(sheetClaim(14, -3, false, SHEET_SLOP_PX, true)).toBe("content");
  });

  /*
   * A thumb's swipe down arcs (notes1, round 3): its first ten pixels can
   * lean more sideways than down. Nothing on a sheet but the stair does
   * anything sideways, so everywhere else that start is the sheet's, as
   * on an iOS sheet, which follows the finger's height from any angle.
   */
  it("gives an arcing swipe down to the sheet wherever nothing owns sideways moves", () => {
    expect(sheetClaim(16, 8, false, SHEET_SLOP_PX, false)).toBe("sheet");
    expect(sheetClaim(-16, 8, true, SHEET_SLOP_PX, false)).toBe("sheet");
    expect(sheetClaim(12, 0, false, SHEET_SLOP_PX, false)).toBe("sheet");
  });

  it("still gives an arcing swipe up into content that scrolls to the scroll", () => {
    expect(sheetClaim(16, -8, true, SHEET_SLOP_PX, false)).toBe("content");
    expect(sheetClaim(16, -8, false, SHEET_SLOP_PX, false)).toBe("sheet");
  });
});

/*
 * The browser's pan, refused on the FIRST move that could be the sheet's
 * (notes1, round 2). iOS Safari decides whether a touch scrolls on its
 * first touchmove, and one it lets through is a scroll (or a rubber band
 * at the top) for the rest of the touch, with the pointer cancelled under
 * it. Waiting four pixels to see which way the finger leans was a bet
 * that the first touchmove comes later than that. So a touch is held from
 * its first move with any downward lean, at any distance; whose it is
 * stays sheetClaim's call, at the slop.
 */
describe("sheetHoldsTouch", () => {
  it("holds the first pixel of a downward move, scrollable content or not", () => {
    expect(sheetHoldsTouch(0, 1, true)).toBe(true);
    expect(sheetHoldsTouch(0, 1, false)).toBe(true);
    expect(sheetHoldsTouch(1, 1, true)).toBe(true);
    expect(sheetHoldsTouch(-2, 6, true)).toBe(true);
  });

  it("lets an upward move into content that scrolls go to the scroll", () => {
    expect(sheetHoldsTouch(0, -1, true)).toBe(false);
    expect(sheetHoldsTouch(1, -8, true)).toBe(false);
  });

  it("holds an upward move where nothing scrolls: the browser has nothing to pan", () => {
    expect(sheetHoldsTouch(0, -1, false)).toBe(true);
  });

  it("leaves a sideways move to the control that owns sideways moves: the stair holds its own scrub", () => {
    expect(sheetHoldsTouch(2, 1, true, true)).toBe(false);
    expect(sheetHoldsTouch(-5, 1, false, true)).toBe(false);
    expect(sheetHoldsTouch(5, -1, false, true)).toBe(false);
  });

  /*
   * An iPhone's first touchmove comes a pixel or three in, and a finger's
   * contact wobbles by about that much as it starts to move (notes1,
   * round 3). A swipe down whose first move read (2, 1), or (1, 0), was
   * left to the browser, which panned the page and cancelled the pointer:
   * the sheet never moved. Where nothing owns sideways moves, a sideways
   * lean decides nothing; any downward lean is held, and a level move is
   * held where nothing scrolls.
   */
  it("holds a downward first move however sideways it leans, where nothing owns sideways moves", () => {
    expect(sheetHoldsTouch(2, 1, true, false)).toBe(true);
    expect(sheetHoldsTouch(-5, 1, false, false)).toBe(true);
    expect(sheetHoldsTouch(1, 0.4, true, false)).toBe(true);
  });

  it("holds a level first move where nothing scrolls, and leaves it to content that scrolls", () => {
    expect(sheetHoldsTouch(1, 0, false, false)).toBe(true);
    expect(sheetHoldsTouch(1, 0, true, false)).toBe(false);
  });

  it("holds an upward first move only where nothing scrolls, however sideways it leans", () => {
    expect(sheetHoldsTouch(3, -1, false, false)).toBe(true);
    expect(sheetHoldsTouch(3, -1, true, false)).toBe(false);
  });

  it("holds a touch that has not moved only where nothing scrolls", () => {
    expect(sheetHoldsTouch(0, 0, false, false)).toBe(true);
    expect(sheetHoldsTouch(0, 0, true, false)).toBe(false);
  });
});

/*
 * Whether a released drag closes the sheet (notes1, round 2). Where the
 * throw would carry the sheet still decides most of them: past half its
 * height, it goes. But a thumb resting on Start or "Not yet" has 40 to
 * 110px of glass under it, and only a hard flick carried that far. So a
 * finger that took the sheet most of the way to the screen's edge has
 * said "go" too, however it let go, unless it flicked back up.
 */
describe("sheetDismisses", () => {
  const tall = { height: 800, room: 760 };

  it("closes when the throw would carry it past half the sheet", () => {
    expect(sheetDismisses({ ...tall, travel: 60, velocity: 900 })).toBe(true);
    expect(sheetDismisses({ ...tall, travel: 420, velocity: 0 })).toBe(true);
  });

  it("springs home from a short slow pull at the top", () => {
    expect(sheetDismisses({ ...tall, travel: 100, velocity: 0 })).toBe(false);
    expect(sheetDismisses({ ...tall, travel: 200, velocity: 300 })).toBe(false);
  });

  it("closes from a finger that started near the bottom and ran most of the way to the edge", () => {
    // Start at 390x844: about 94px of screen under the finger once the sheet takes it.
    expect(sheetDismisses({ height: 800, room: 94, travel: 90, velocity: 0 })).toBe(true);
    expect(sheetDismisses({ height: 800, room: 94, travel: 72, velocity: 120 })).toBe(true);
    // "Not yet": about 32px, less what the finger moved before the sheet
    // took it (a phone's moves come 10 to 16px apart at a swipe's speed).
    expect(sheetDismisses({ height: 800, room: 32, travel: 26, velocity: 0 })).toBe(true);
    expect(sheetDismisses({ height: 800, room: 27, travel: 23, velocity: 0 })).toBe(true);
  });

  it("springs home from a sloppy tap near the bottom", () => {
    expect(sheetDismisses({ height: 800, room: 94, travel: 10, velocity: 400 })).toBe(false);
    expect(sheetDismisses({ height: 800, room: 94, travel: 40, velocity: 100 })).toBe(false);
  });

  it("keeps the sheet on an upward flick, wherever the finger is", () => {
    expect(sheetDismisses({ height: 800, room: 94, travel: 90, velocity: -400 })).toBe(false);
    expect(sheetDismisses({ ...tall, travel: 500, velocity: -400 })).toBe(false);
  });

  it("asks for a real move even when there is almost no room", () => {
    expect(sheetDismisses({ height: 800, room: 8, travel: 7, velocity: 0 })).toBe(false);
  });

  /*
   * The finger's whole run counts, from where it went down (notes1, round
   * 3). A quick swipe off the paywall's last line ("Never money…", about
   * 33px over the edge at 390x844) can reach the page as one 29px move:
   * the sheet takes the finger on that move and has travelled nothing
   * when it lets go, so the room rule, measured from there, kept it open
   * two times in three. Measured from the press, the finger ran 29 of 33.
   */
  it("counts the finger's run from the press, so a swipe off the last line closes even when one move carried it", () => {
    expect(sheetDismisses({ height: 800, room: 33, run: 29, travel: 0, velocity: 0 })).toBe(true);
    expect(sheetDismisses({ height: 800, room: 33, run: 29, travel: 0, velocity: -400 })).toBe(false);
  });

  it("still springs home from a short pull off the last line", () => {
    expect(sheetDismisses({ height: 800, room: 33, run: 20, travel: 8, velocity: 0 })).toBe(false);
    expect(sheetDismisses({ height: 800, room: 120, run: 40, travel: 28, velocity: 200 })).toBe(false);
  });
});

/*
 * The browser cancels a pointer the moment it takes the touch for a pan
 * (pointercancel), and a pan starts on every vertical move the page
 * does not refuse: the paywall's drag died ten pixels in, from every
 * region, at every scroll. Only a touchmove listener that is NOT
 * passive can refuse it (React's onTouchMove is passive), so Overlay
 * registers its own.
 */
describe("Overlay refuses the browser's pan while a drag is the sheet's", () => {
  const src = readFileSync("components/ui/Overlay.tsx", "utf8");
  it("listens to touchmove with passive: false", () => {
    expect(src).toMatch(/addEventListener\(\s*"touchmove"[\s\S]{0,80}passive:\s*false/);
  });
  it("asks sheetHoldsTouch on the touch and sheetClaim on the pointer", () => {
    expect(src).toMatch(/sheetHoldsTouch\(/);
    expect(src).toMatch(/sheetClaim\(/);
  });
  it("measures the throw from where the sheet started following, not from the press", () => {
    // The press's own sample (y 0, before the slop) made a short flick from
    // the tap shelf read slow: half its samples were the finger standing still.
    expect(src).toMatch(/d\.samples = \[\{ t: e\.timeStamp, y: d\.y \}\];/);
  });
  it("lets sheetDismisses decide a release, with the room the finger had and how far it ran", () => {
    expect(src).toMatch(/sheetDismisses\(\{/);
    expect(src).toMatch(/room:/);
    expect(src).toMatch(/run:/);
  });
  it("asks whether something under the finger owns sideways moves, and tells both questions", () => {
    expect(src).toMatch(/sheetHoldsTouch\([^)]*d\.sideways\)/);
    expect(src).toMatch(/sheetClaim\([^)]*d\.sideways\)/);
  });
});

/*
 * The hand-off in Overlay (handoff). The rules above are only the sheet's
 * if Overlay asks them: on scrolled content a touch is taken from its
 * first move, by a touch only (a mouse there selects and the wheel
 * scrolls), the finger's moves are split by handOff, the release asks
 * handOffEnd, and a let-go content glides on glideStep until a press
 * stops it on its way down to whatever is under it.
 */
describe("Overlay drives a swipe on scrolled content through the hand-off", () => {
  const src = readFileSync("components/ui/Overlay.tsx", "utf8");
  it("takes a touch on scrolled content by its first move, and a touch only", () => {
    expect(src).toMatch(/sheetTakesScrolledTouch\([^)]*d\.sideways/);
    expect(src).toMatch(/node\.scrollTop > 0[\s\S]{0,80}e\.pointerType !== "touch"\) return;/);
  });
  it("splits the finger's moves with handOff and lets handOffEnd decide the release", () => {
    expect(src).toMatch(/handOff\(under\.at, e\.clientY - under\.lastY/);
    expect(src).toMatch(/handOffEnd\(\{/);
  });
  it("glides with glideStep, and a press stops the glide before anything under it hears the press", () => {
    expect(src).toMatch(/glideStep\(/);
    expect(src).toMatch(/onPointerDownCapture=\{onPointerDownCapture\}/);
  });
  /*
   * The review's findings, held where a touch cannot show them (the
   * browser gate, scripts/check-sheet-touch.mjs, shows the rest).
   */
  it("swallows a press only on the gliding content: Start and Not yet, outside it, still press", () => {
    expect(src).toMatch(/content\.contains\(e\.target as Node\)/);
  });
  it("reads the release speed at the moment the finger lifted, so a held finger throws nothing", () => {
    expect(src).toMatch(/releaseVelocity\(d\.samples, e\.timeStamp\)/);
  });
  it("asks content at its top the same on the first touchmove, and hands a level one to the hand-off", () => {
    expect(src).toMatch(/first && d\.scroller \? sheetTakesTopTouch\(dx, dy, d\.sideways\)/);
  });
  it("starts a hand-off only with the sheet at rest", () => {
    expect(src).toMatch(/handOffFrom\(/);
  });
  it("starts the content from where the finger crossed the slop, and the throw's first sample there", () => {
    expect(src).toMatch(/slopCrossing\(\{ x: d\.x0, y: d\.y0 \}, before, d\.last\)/);
    expect(src).toMatch(/under\.lastY = cross\.y;/);
    expect(src).toMatch(/d\.samples = \[\{ t: cross\.t, y: handOffLine\(start\) \}\];/);
  });
  it("clears the panel's transform only after a spring home that landed", () => {
    expect(src).toMatch(/\.then\(\(landed\) =>/);
  });
  it("bounces a glide that meets an edge with speed, and shows a finger's run past the end with resistance", () => {
    expect(src).toMatch(/settleEdge\(content, impact < 0 \? 1 : -1/);
    expect(src).toMatch(/showEdge\(content, -edgeFromPast\(past/);
    expect(src).toMatch(/edgeSpring\(offset, velocity, now - t0\)/);
  });
});

/*
 * The stair holds its own scrub (notes1, round 3). Overlay leaves a
 * sideways move on it to the stair; once a finger's move there leans
 * sideways the stair refuses the browser's pan itself, so a scrub that
 * drifts up or down on its way across never turns into a scroll that
 * cancels it.
 */
describe("the stair refuses the browser's pan while a finger scrubs it", () => {
  const src = readFileSync("components/premium/Stair.tsx", "utf8");
  it("listens to touchmove with passive: false", () => {
    expect(src).toMatch(/addEventListener\(\s*"touchmove"[\s\S]{0,80}passive:\s*false/);
  });
  it("says it owns sideways moves, the way Overlay asks, only where it scrubs", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.stair\[data-mode="slider"\] \{[^}]*touch-action: pan-y;/);
    /*
     * A picture or a stage (the manage sheet, the price drop) does nothing
     * sideways: claiming sideways moves there kept an arcing swipe off the
     * manage sheet's stair from closing it.
     */
    const plain = css.slice(css.indexOf("\n.stair {"), css.indexOf("}", css.indexOf("\n.stair {")));
    expect(plain).not.toMatch(/touch-action/);
  });
});

describe("the stair hands a vertical touch to the sheet", () => {
  const src = readFileSync("components/premium/Stair.tsx", "utf8");
  it("stops a press from reaching the sheet only for a mouse or a pen", () => {
    expect(src).toMatch(/if \(e\.pointerType !== "touch"\) e\.stopPropagation\(\)/);
  });
});

/*
 * One finger, one gesture (handoff, Timothy: "Yea add that"). A touch on
 * content already scrolled whose first move leans down is the sheet's
 * from that first move, as a UIKit sheet over a scroll view: the finger
 * scrolls the content back to its top and the rest of the same swipe
 * pulls the sheet. Before this the browser scrolled it and stopped at
 * the top, and closing the sheet took a second swipe.
 */
describe("sheetTakesScrolledTouch", () => {
  it("takes a first move that leans down, at any angle", () => {
    expect(sheetTakesScrolledTouch(0, 1)).toBe("sheet");
    expect(sheetTakesScrolledTouch(0, 14)).toBe("sheet");
    expect(sheetTakesScrolledTouch(3, 1)).toBe("sheet");
    expect(sheetTakesScrolledTouch(-6, 0.5)).toBe("sheet");
  });

  it("leaves a first move that leans up to the browser's own scroll and its momentum", () => {
    expect(sheetTakesScrolledTouch(0, -1)).toBe("browser");
    expect(sheetTakesScrolledTouch(2, -14)).toBe("browser");
    expect(sheetTakesScrolledTouch(1, -1)).toBe("browser");
  });

  /*
   * iOS hands a touch's points over in whole pixels and settles the
   * browser's scroll on the first touchmove, a pixel or three in (handoff
   * review): a thumb's swipe down that arcs reads (1, 0) or (-1, 0) about
   * a fifth of the time, and a press that settles reads (0, 0). Left to
   * the browser, each was the old two swipes. The hand-off drives the
   * content both ways, so a reading with no direction costs nothing taken.
   */
  it("takes a first touchmove that reads level or still: it may be a swipe down, and up is the hand-off's to drive too", () => {
    expect(sheetTakesScrolledTouch(1, 0)).toBe("sheet");
    expect(sheetTakesScrolledTouch(-1, 0)).toBe("sheet");
    expect(sheetTakesScrolledTouch(3, 0)).toBe("sheet");
    expect(sheetTakesScrolledTouch(0, 0)).toBe("sheet");
  });

  it("lets a pointer reading within a few pixels of the press say nothing: the touchmove answers", () => {
    expect(sheetTakesScrolledTouch(1, 0, false, false)).toBe("undecided");
    expect(sheetTakesScrolledTouch(0, -1, false, false)).toBe("undecided");
    expect(sheetTakesScrolledTouch(2, -2, false, false)).toBe("undecided");
    expect(sheetTakesScrolledTouch(0, 3, false, false)).toBe("sheet");
    expect(sheetTakesScrolledTouch(1, -3, false, false)).toBe("browser");
  });

  it("gives a sideways first move on the stair to the stair for now, scrolled or not: the slop decides", () => {
    expect(sheetTakesScrolledTouch(5, 1, true)).toBe("sideways");
    expect(sheetTakesScrolledTouch(-12, 4, true)).toBe("sideways");
    expect(sheetTakesScrolledTouch(1, 0, true)).toBe("sideways");
    // Down first on the stair is still a swipe down, and up still a scroll.
    expect(sheetTakesScrolledTouch(1, 3, true)).toBe("sheet");
    expect(sheetTakesScrolledTouch(1, -3, true)).toBe("browser");
  });
});

/*
 * The same reading on content at its top that has more below (handoff
 * review, the twin of a level first move on scrolled content). Left to
 * the browser there, a level or still first touchmove made the whole
 * touch iOS's scroll, which at the top only rubber-bands: a swipe down
 * that arced never moved the sheet. And a first move the stair held kept
 * the browser's scroll off for the whole touch, so up was nobody's. Both
 * become the hand-off from scroll 0, which drives the content up and the
 * sheet down; down and up readings keep their paths.
 */
describe("sheetTakesTopTouch", () => {
  it("takes a first touchmove that reads level or still", () => {
    expect(sheetTakesTopTouch(1, 0)).toBe("sheet");
    expect(sheetTakesTopTouch(-1, 0)).toBe("sheet");
    expect(sheetTakesTopTouch(3, 0)).toBe("sheet");
    expect(sheetTakesTopTouch(0, 0)).toBe("sheet");
    expect(sheetTakesTopTouch(0, 0, true)).toBe("sheet");
  });

  it("leaves a downward reading to the sheet's own drag and an upward one to the browser", () => {
    expect(sheetTakesTopTouch(0, 1)).toBeNull();
    expect(sheetTakesTopTouch(2, 1)).toBeNull();
    expect(sheetTakesTopTouch(0, -1)).toBeNull();
    expect(sheetTakesTopTouch(1, -3)).toBeNull();
    expect(sheetTakesTopTouch(1, 3, true)).toBeNull();
  });

  it("waits on the slop for a first move the stair held: sideways it scrubs, up or down it is the hand-off's", () => {
    expect(sheetTakesTopTouch(5, 1, true)).toBe("sideways");
    expect(sheetTakesTopTouch(1, 0, true)).toBe("sideways");
    expect(sheetTakesTopTouch(-3, -1, true)).toBe("sideways");
  });
});

/*
 * Where the finger crossed the slop (handoff review). The content used to
 * start from the move that crossed it, and Chromium sends its first
 * touchmove 12 to 48px in: everything past the slop on that move was
 * lost, so a quick swipe spent up to 70px before the content moved, and a
 * flick that reached the page as one move scrolled nothing and threw
 * nothing. From the crossing, the content follows the finger 1:1 past
 * the slop (the browser's own scroll does the same), and the throw has a
 * first sample there.
 */
describe("slopCrossing", () => {
  const press = { x: 100, y: 200 };
  it("finds where a straight move down left the slop, and when", () => {
    const at = slopCrossing(press, { t: 1000, x: 100, y: 200 }, { t: 1034, x: 100, y: 234 });
    expect(at.y).toBeCloseTo(210, 6);
    expect(at.t).toBeCloseTo(1010, 6);
  });
  it("reads between the last reading inside the slop and the first outside it, not from the press", () => {
    const at = slopCrossing(press, { t: 1500, x: 101, y: 201 }, { t: 1516, x: 101, y: 234 });
    expect(at.y).toBeCloseTo(210, 6);
    expect(at.t).toBeCloseTo(1500 + (16 * 9) / 33, 6);
  });
  it("reads the slop as sheetClaim does, a square: a move that left it sideways crossed where x reached it", () => {
    const at = slopCrossing(press, { t: 0, x: 100, y: 200 }, { t: 30, x: 130, y: 215 });
    expect(at.y).toBeCloseTo(205, 6);
    expect(at.t).toBeCloseTo(10, 6);
    const up = slopCrossing(press, { t: 0, x: 100, y: 200 }, { t: 20, x: 100, y: 180 });
    expect(up.y).toBeCloseTo(190, 6);
    expect(sheetClaim(0, 9.99, false, SHEET_SLOP_PX)).toBe("undecided");
  });
  it("is the reading itself when the finger was already past the slop, or never left it", () => {
    expect(slopCrossing(press, { t: 5, x: 100, y: 214 }, { t: 21, x: 100, y: 230 })).toEqual({ t: 5, y: 214 });
    expect(slopCrossing(press, { t: 5, x: 100, y: 202 }, { t: 21, x: 100, y: 205 })).toEqual({ t: 21, y: 205 });
  });
  it("gives a one-move flick the speed it had: the line from the crossing to the move", () => {
    const at = slopCrossing(press, { t: 0, x: 100, y: 200 }, { t: 50, x: 100, y: 250 });
    expect((250 - at.y) / ((50 - at.t) / 1000)).toBeCloseTo(1000, 6);
  });
});

/*
 * Where a hand-off starts (handoff review). Grabbed while the sheet is
 * still rising or springing home, the content scrolled, the first move
 * collapsed the sheet's offset into the scroll: a 5px move took the
 * sheet 33px up and the content 39px with it. A UIKit sheet's own
 * motion owns a finger that lands on it, so the drag is the sheet's,
 * from where it is, and the content stays put.
 */
describe("handOffFrom", () => {
  it("starts the hand-off from the content's scroll with the sheet at rest", () => {
    expect(handOffFrom(120, 0)).toEqual({ scroll: 120, sheet: 0 });
    expect(handOffFrom(120, 0.3)).toEqual({ scroll: 120, sheet: 0 });
  });

  it("leaves a sheet caught off its rest, below it or above it, to the sheet's own drag", () => {
    expect(handOffFrom(120, 30)).toBeNull();
    expect(handOffFrom(35, 10)).toBeNull();
    expect(handOffFrom(80, -4)).toBeNull();
  });

  it("never moves more than the finger, from any start it gives", () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2000; i++) {
      const start = handOffFrom(rnd() * 300, rnd() < 0.5 ? 0 : rnd());
      if (!start) continue;
      const dy = (rnd() * 2 - 1) * 40;
      const next = handOff(start, dy, 300);
      expect(Math.abs(next.scroll - start.scroll) + Math.abs(next.sheet - start.sheet)).toBeLessThanOrEqual(Math.abs(dy) + 1e-9);
    }
  });
});

describe("handOff", () => {
  /** A swipe as moves of `step` px, from `at`, returning every state on the way. */
  const walk = (at: HandOff, moves: number[], max: number) => {
    const states: HandOff[] = [];
    for (const dy of moves) {
      at = handOff(at, dy, max);
      states.push(at);
    }
    return states;
  };

  it("scrolls the content toward its top first, 1:1 with the finger", () => {
    expect(handOff({ scroll: 150, sheet: 0 }, 40, 150)).toEqual({ scroll: 110, sheet: 0 });
    expect(handOff({ scroll: 150, sheet: 0 }, 150, 150)).toEqual({ scroll: 0, sheet: 0 });
  });

  it("gives what is left of the move to the sheet once the content is at its top, with no gap", () => {
    expect(handOff({ scroll: 30, sheet: 0 }, 50, 150)).toEqual({ scroll: 0, sheet: 20 });
    expect(handOff({ scroll: 0, sheet: 20 }, 15, 150)).toEqual({ scroll: 0, sheet: 35 });
  });

  it("keeps finger travel equal to the scroll travelled plus the sheet's offset at every move", () => {
    const moves = [13, 27, 26, 27, 26, 27, 26, 27, 26, 27, 26, 27, 26, 27];
    let finger = 0;
    for (const [i, at] of walk({ scroll: 150, sheet: 0 }, moves, 150).entries()) {
      finger += moves[i];
      expect(150 - at.scroll + at.sheet).toBeCloseTo(finger, 6);
    }
  });

  it("never moves both at once: while the sheet is off its rest the content is at its top", () => {
    const states = walk({ scroll: 90, sheet: 0 }, [40, 40, 40, -30, -30, -30, -30, 25, 25, 25], 150);
    for (const at of states) expect(at.sheet > 0 && at.scroll > 0).toBe(false);
  });

  it("runs both ways in one touch: back up, the sheet comes to rest first, then the content scrolls down again", () => {
    const [down, , up1, up2] = walk({ scroll: 20, sheet: 0 }, [80, -40, -10, -30], 150);
    expect(down).toEqual({ scroll: 0, sheet: 60 });
    expect(up1).toEqual({ scroll: 0, sheet: 10 });
    expect(up2).toEqual({ scroll: 20, sheet: 0 });
  });

  /*
   * Past the content's end the finger keeps going (handoff review: the
   * content stopped dead there for the rest of the swipe, where a
   * UIScrollView rubber-bands). What it runs past the end is `past`,
   * shown with resistance, and a move back down spends it first.
   */
  it("carries a finger past the content's end as `past`, which a move back down spends first", () => {
    expect(handOff({ scroll: 140, sheet: 0 }, -30, 150)).toEqual({ scroll: 150, sheet: 0, past: 20 });
    expect(handOff({ scroll: 150, sheet: 0, past: 20 }, -10, 150)).toEqual({ scroll: 150, sheet: 0, past: 30 });
    expect(handOff({ scroll: 150, sheet: 0, past: 20 }, 5, 150)).toEqual({ scroll: 150, sheet: 0, past: 15 });
    expect(handOff({ scroll: 150, sheet: 0, past: 20 }, 25, 150)).toEqual({ scroll: 145, sheet: 0 });
    // At the end with no past, the first move down moves the content at once.
    expect(handOff({ scroll: 150, sheet: 0 }, 5, 150)).toEqual({ scroll: 145, sheet: 0 });
  });

  it("keeps finger travel equal to scroll + sheet + past on a walk that runs both ends", () => {
    const moves = [-30, -30, -30, 20, 40, 60, 80, 60, -50, -90, -70, 30];
    let finger = 0;
    for (const [i, at] of walk({ scroll: 120, sheet: 0 }, moves, 150).entries()) {
      finger += moves[i];
      const past = at.past ?? 0;
      expect(120 - at.scroll - past + at.sheet).toBeCloseTo(finger, 6);
      // One of the three at a time: past the end, scrolling, or the sheet.
      if (past > 0) expect([at.scroll, at.sheet]).toEqual([150, 0]);
      if (at.sheet > 0) expect([at.scroll, past]).toEqual([0, 0]);
    }
  });

  it("never lifts the sheet above its rest: up is the content's", () => {
    expect(handOff({ scroll: 0, sheet: 0 }, -12, 150)).toEqual({ scroll: 12, sheet: 0 });
  });
});

/*
 * A finger that lets go while the content still has scroll leaves it
 * gliding, as a UIScrollView does: the finger's speed, decaying by the
 * normal deceleration rate every millisecond, stopped at either end.
 * A glide that reaches the top stops there and never pulls the sheet:
 * a fling closes a sheet only when the sheet itself was being dragged.
 */
describe("glideStep", () => {
  it("decays the speed by 0.998 a millisecond", () => {
    expect(SCROLL_DECELERATION).toBe(0.998);
    const next = glideStep({ scroll: 300, velocity: 1000 }, 16, 2000);
    expect(next.velocity).toBeCloseTo(1000 * 0.998 ** 16, 6);
    expect(next.done).toBe(false);
  });

  it("comes to rest where the momentum projection says, whatever the frame rate", () => {
    for (const ms of [8, 16, 33]) {
      let at = { scroll: 1000, velocity: -1200, done: false };
      let frames = 0;
      while (!at.done && frames < 2000) {
        at = glideStep(at, ms, 5000);
        frames++;
      }
      expect(at.done).toBe(true);
      // Stopped a few px short at most: the last of it is slower than a third of a pixel a frame.
      expect(Math.abs(at.scroll - (1000 + project(-1200)))).toBeLessThan(12);
    }
  });

  it("travels the same distance in one long step as in two short ones", () => {
    const one = glideStep({ scroll: 400, velocity: -900 }, 32, 2000);
    const two = glideStep(glideStep({ scroll: 400, velocity: -900 }, 16, 2000), 16, 2000);
    expect(one.scroll).toBeCloseTo(two.scroll, 6);
  });

  /*
   * A glide meets an edge with speed left (handoff review: 430 to
   * 1030px/s at the top, stopped dead in one frame where a UIScrollView
   * bounces). It stops at the edge, never past it in scrollTop, and says
   * how fast it was going there and how much of the frame was left, so
   * the bounce (edgeSpring) starts on the same instant at that speed.
   */
  it("stops at the top and at the end, never past them, with the speed it met them at", () => {
    const top = glideStep({ scroll: 10, velocity: -3000 }, 16, 400);
    expect(top).toMatchObject({ scroll: 0, velocity: 0, done: true });
    // 10px at 0.998 a millisecond takes 20px/s off: v0 - d * (1 - r) / r.
    expect(top.impact).toBeCloseTo(-3000 + (10 * 1000 * 0.002) / 0.998, 6);
    const crossed = Math.log(top.impact! / -3000) / Math.log(0.998);
    expect(top.overMs).toBeCloseTo(16 - crossed, 6);
    const end = glideStep({ scroll: 395, velocity: 3000 }, 16, 400);
    expect(end).toMatchObject({ scroll: 400, velocity: 0, done: true });
    expect(end.impact).toBeCloseTo(3000 - (5 * 1000 * 0.002) / 0.998, 6);
  });

  it("meets no edge when it rests short of one", () => {
    const short = glideStep({ scroll: 200, velocity: -300 }, 2000, 400);
    expect(short.done).toBe(true);
    expect(short.impact).toBeUndefined();
  });

  it("stops once it is slower than a third of a pixel a frame", () => {
    const slow = glideStep({ scroll: 200, velocity: MOMENTUM_REST_PX_S - 1 }, 16, 400);
    expect(slow.done).toBe(true);
    expect(slow.velocity).toBe(0);
  });
});

/*
 * Letting go of a hand-off. Once the sheet has moved, the sheet's own
 * rules decide, counted from where it started to move (the hand-off
 * point, where the content reached its top), not from the press: a long
 * swipe that spent most of itself scrolling must not read as a long
 * pull. Before the sheet moved, the content glides.
 */
describe("handOffEnd", () => {
  const screen = 667;
  const height = 651;

  it("glides when the sheet never left its rest", () => {
    expect(handOffEnd({ at: { scroll: 40, sheet: 0 }, velocity: 900, height, screen, fingerY: 560 })).toBe("glide");
    expect(handOffEnd({ at: { scroll: 0, sheet: 0 }, velocity: 900, height, screen, fingerY: 560 })).toBe("glide");
  });

  it("closes a swipe that reached the top and kept going with speed", () => {
    expect(handOffEnd({ at: { scroll: 0, sheet: 120 }, velocity: 800, height, screen, fingerY: 640 })).toBe("close");
  });

  it("closes a slow pull that took the sheet past half its height", () => {
    expect(handOffEnd({ at: { scroll: 0, sheet: 340 }, velocity: 0, height, screen, fingerY: 660 })).toBe("close");
  });

  it("closes a pull that ran most of the room it had from the hand-off point", () => {
    // Handed off at y 500: 167px to the edge, and the sheet ran 130 of them.
    expect(handOffEnd({ at: { scroll: 0, sheet: 130 }, velocity: 0, height, screen, fingerY: 630 })).toBe("close");
  });

  it("springs home from a short slow pull past the top", () => {
    expect(handOffEnd({ at: { scroll: 0, sheet: 40 }, velocity: 60, height, screen, fingerY: 400 })).toBe("home");
  });

  it("counts the run from the hand-off point, not the press: scrolling first never makes a short pull long", () => {
    // Pressed at y 300 and let go at 600: a 300px run from the press, which
    // counted from there would close (three quarters of 367). Only the last
    // 40 moved the sheet, and from the hand-off at 560 that is 40 of 107.
    expect(handOffEnd({ at: { scroll: 0, sheet: 40 }, velocity: 0, height, screen, fingerY: 600 })).toBe("home");
  });

  it("keeps the sheet on an upward flick", () => {
    expect(handOffEnd({ at: { scroll: 0, sheet: 200 }, velocity: -500, height, screen, fingerY: 600 })).toBe("home");
  });

  it("brings content let go past its end back to the end, and glides nothing", () => {
    expect(handOffEnd({ at: { scroll: 150, sheet: 0, past: 30 }, velocity: -400, height, screen, fingerY: 200 })).toBe("back");
    expect(handOffEnd({ at: { scroll: 150, sheet: 0, past: 30 }, velocity: 400, height, screen, fingerY: 200 })).toBe("back");
  });
});

/*
 * The bounce at an edge (handoff review, apple-design §9: a hard stop
 * reads as frozen). Content that meets its top or its end with speed
 * goes past it a little and comes back, and content let go past its end
 * comes back from there, on a critically damped spring (SPRING.base):
 * the speed carried in, no wobble, settled in about half a second. It
 * moves the content only, never the sheet, and it runs under Reduce
 * Motion too, as iOS keeps a scroll's bounce there.
 */
describe("edgeSpring", () => {
  const w0 = (2 * Math.PI) / SPRING.base.response;

  it("carries a glide's speed past the edge and back, peaking where the spring says", () => {
    const peakMs = 1000 / w0;
    const peak = edgeSpring(0, 800, peakMs);
    expect(peak.offset).toBeCloseTo(800 / (Math.E * w0), 6);
    expect(Math.abs(peak.velocity)).toBeLessThan(1e-6);
    // About 16px at 800px/s, 41px at the fastest it takes.
    expect(peak.offset).toBeGreaterThan(14);
    expect(peak.offset).toBeLessThan(18);
    expect(peak.done).toBe(false);
  });

  it("never swings to the other side, and settles in about half a second", () => {
    let settled = Infinity;
    for (let ms = 0; ms <= 1200; ms += 4) {
      const at = edgeSpring(0, 1500, ms);
      expect(at.offset).toBeGreaterThanOrEqual(0);
      if (at.done && settled === Infinity) settled = ms;
    }
    expect(settled).toBeGreaterThan(300);
    expect(settled).toBeLessThan(700);
    expect(edgeSpring(0, 1500, settled)).toMatchObject({ offset: 0, velocity: 0, done: true });
  });

  it("starts at the speed it was handed, with no jump", () => {
    const start = edgeSpring(0, 900, 0);
    expect(start.offset).toBe(0);
    expect(start.velocity).toBeCloseTo(900, 6);
    const pulled = edgeSpring(24, 0, 0);
    expect(pulled.offset).toBe(24);
  });

  it("brings content let go past its edge straight back, with no overshoot", () => {
    let last = 24;
    for (let ms = 4; ms <= 800; ms += 4) {
      const at = edgeSpring(24, 0, ms);
      expect(at.offset).toBeLessThanOrEqual(last + 1e-9);
      expect(at.offset).toBeGreaterThanOrEqual(0);
      last = at.offset;
    }
    expect(last).toBe(0);
  });

  it("takes at most the speed of a hard flick, so a bounce stays small", () => {
    expect(edgeSpring(0, 20000, 1000 / w0).offset).toBeCloseTo(edgeSpring(0, 2000, 1000 / w0).offset, 6);
  });
});

describe("edgeFromPast", () => {
  it("shows a finger's run past the end with resistance, and carries its speed in", () => {
    const h = 300;
    const shown = edgeFromPast(40, -500, h);
    expect(shown.offset).toBeCloseTo(rubberband(40, h), 6);
    // Still going up (the finger's -500px/s), further past the end, at the band's give there.
    const give = rubberband(40.5, h) - rubberband(39.5, h);
    expect(shown.velocity).toBeCloseTo(500 * give, 1);
    // Coming back down when it let go: back toward the end.
    expect(edgeFromPast(40, 500, h).velocity).toBeLessThan(0);
    expect(edgeFromPast(0, -500, h)).toEqual({ offset: 0, velocity: 0 });
  });

  it("reads back the run a shown offset stands for, so a finger that catches it moves nothing", () => {
    for (const past of [0, 3, 40, 180, 900]) expect(pastFromEdge(edgeFromPast(past, 0, 300).offset, 300)).toBeCloseTo(past, 6);
    expect(pastFromEdge(0, 300)).toBe(0);
  });
});

describe("handOffLine", () => {
  it("is the finger's place on the one line the content, the sheet and the past share", () => {
    expect(handOffLine({ scroll: 120, sheet: 0 })).toBe(-120);
    expect(handOffLine({ scroll: 0, sheet: 30 })).toBe(30);
    expect(handOffLine({ scroll: 150, sheet: 0, past: 12 })).toBe(-162);
    // A move changes it by exactly the move, whatever it spends.
    for (const at of [{ scroll: 120, sheet: 0 }, { scroll: 0, sheet: 30 }, { scroll: 150, sheet: 0, past: 12 }]) {
      for (const dy of [-200, -7, 7, 200]) expect(handOffLine(handOff(at, dy, 150)) - handOffLine(at)).toBeCloseTo(dy, 6);
    }
  });
});
