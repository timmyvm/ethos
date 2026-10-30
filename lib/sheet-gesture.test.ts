import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { project } from "./spring";
import {
  MOMENTUM_REST_PX_S,
  SCROLL_DECELERATION,
  SHEET_SLOP_PX,
  glideStep,
  handOff,
  handOffEnd,
  sheetClaim,
  sheetDismisses,
  sheetHoldsTouch,
  sheetTakesScrolledTouch,
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
    expect(src).toMatch(/sheetTakesScrolledTouch\([^)]*d\.sideways\)/);
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
    expect(sheetTakesScrolledTouch(0, 1)).toBe(true);
    expect(sheetTakesScrolledTouch(0, 14)).toBe(true);
    expect(sheetTakesScrolledTouch(3, 1)).toBe(true);
    expect(sheetTakesScrolledTouch(-6, 0.5)).toBe(true);
  });

  it("leaves a first move that leans up, or is level, to the browser's own scroll and its momentum", () => {
    expect(sheetTakesScrolledTouch(0, -1)).toBe(false);
    expect(sheetTakesScrolledTouch(2, -14)).toBe(false);
    expect(sheetTakesScrolledTouch(3, 0)).toBe(false);
    expect(sheetTakesScrolledTouch(0, 0)).toBe(false);
  });

  it("leaves a sideways first move on the stair to the stair, scrolled or not", () => {
    expect(sheetTakesScrolledTouch(5, 1, true)).toBe(false);
    expect(sheetTakesScrolledTouch(-12, 4, true)).toBe(false);
    // Down first on the stair is still a swipe down.
    expect(sheetTakesScrolledTouch(1, 3, true)).toBe(true);
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

  it("stops the content at its end, and the next move down moves it at once", () => {
    expect(handOff({ scroll: 140, sheet: 0 }, -30, 150)).toEqual({ scroll: 150, sheet: 0 });
    expect(handOff({ scroll: 150, sheet: 0 }, 5, 150)).toEqual({ scroll: 145, sheet: 0 });
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

  it("stops at the top and at the end, dead, never past them", () => {
    expect(glideStep({ scroll: 10, velocity: -3000 }, 16, 400)).toEqual({ scroll: 0, velocity: 0, done: true });
    expect(glideStep({ scroll: 395, velocity: 3000 }, 16, 400)).toEqual({ scroll: 400, velocity: 0, done: true });
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
});
