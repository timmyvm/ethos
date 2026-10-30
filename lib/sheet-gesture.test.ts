import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHEET_SLOP_PX, sheetClaim, sheetDismisses, sheetHoldsTouch } from "./sheet-gesture";

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
