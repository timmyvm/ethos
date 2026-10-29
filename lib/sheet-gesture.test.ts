import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHEET_LEAN_PX, SHEET_SLOP_PX, sheetClaim } from "./sheet-gesture";

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

  it("never takes a sideways drag: that is the stair's scrub", () => {
    expect(sheetClaim(12, 4, false, SHEET_SLOP_PX)).toBe("content");
    expect(sheetClaim(-30, 20, true, SHEET_SLOP_PX)).toBe("content");
  });

  it("leans earlier than it commits, so the browser's pan never starts first", () => {
    expect(SHEET_LEAN_PX).toBeLessThan(SHEET_SLOP_PX);
    expect(sheetClaim(0, SHEET_LEAN_PX, true, SHEET_LEAN_PX)).toBe("sheet");
    expect(sheetClaim(0, SHEET_LEAN_PX, true, SHEET_SLOP_PX)).toBe("undecided");
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
  it("asks sheetClaim, on the pointer and on the touch, so both sides agree", () => {
    expect(src.match(/sheetClaim\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("the stair hands a vertical touch to the sheet", () => {
  const src = readFileSync("components/premium/Stair.tsx", "utf8");
  it("stops a press from reaching the sheet only for a mouse or a pen", () => {
    expect(src).toMatch(/if \(e\.pointerType !== "touch"\) e\.stopPropagation\(\)/);
  });
});
