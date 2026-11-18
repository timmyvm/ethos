import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * #493, the morning tour (docs/look/tour/06-every-number-pause-320-light.png):
 * under 640pt "Every number" took the paywall's rule and its head, Done
 * with it, scrolled away with the body. Its head is 44px, and it stays at
 * every height; check-sheets section 5 holds it in a browser at 320x568.
 */
describe("Every number's head (#493)", () => {
  const src = readFileSync("components/rep/WholeRecording.tsx", "utf8");

  it("never asks the screen's height whether the head may stay", () => {
    expect(src).not.toMatch(/usePaywallHeadStays|paywall-head"/);
    expect(src).not.toMatch(/headStays/);
  });

  it("draws the title and Done in the fixed head, outside the scroll", () => {
    const head = src.indexOf("data-sheet-head");
    const scroll = src.indexOf("data-sheet-scroll");
    const title = src.indexOf("{title}", head);
    expect(head).toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(head);
    expect(title).toBeLessThan(scroll);
    expect(src.indexOf("{title}", scroll)).toBe(-1);
    expect(src).toMatch(/min-h-11 items-center justify-between/);
  });
});
