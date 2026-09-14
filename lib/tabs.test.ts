import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAB_HREFS } from "./tabs";

/**
 * One tab bar, two files, and the bug that was waiting (#275).
 *
 * `components/Nav.tsx` draws the bar. `components/PageTransition.tsx`
 * decides which way a page slides in, and it used to hold its own
 * hardcoded copy of the same list. A tab in the first and not the
 * second reads as `depth() === 1` instead of 0, so it pushes in from
 * the right like a deeper screen and reverses on the way back. Nothing
 * in review catches that; it only shows up in the hand.
 *
 * The hrefs now live in lib/tabs.ts. These tests hold the two consumers
 * to it, in order, because the ORDER is the thing PageTransition reads.
 */
describe("the tab bar is one list", () => {
  it("draws Nav's tabs in the order lib/tabs.ts declares", () => {
    const nav = readFileSync("components/Nav.tsx", "utf8");
    const block = nav.slice(nav.indexOf("const TABS"), nav.indexOf("const BARE"));
    const hrefs = [...block.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([...TAB_HREFS]);
  });

  it("leaves PageTransition no second copy to drift", () => {
    const pt = readFileSync("components/PageTransition.tsx", "utf8");
    expect(pt).toContain("TAB_HREFS");
    /* A literal array of routes in this file is the old bug spelled
       out: anything of the shape ["/", "/games", …] is a second list. */
    expect(pt).not.toMatch(/\[\s*"\/"\s*,/);
  });

  it("never puts a tab route in the list of screens that hide the bar", () => {
    const nav = readFileSync("components/Nav.tsx", "utf8");
    const bare = nav.slice(nav.indexOf("const BARE"), nav.indexOf("export function Nav"));
    for (const href of TAB_HREFS) {
      if (href === "/") continue;
      expect(bare, `${href} is both a tab and BARE`).not.toContain(`"${href}"`);
    }
  });

  /**
   * `/lesson` is in BARE and `/lessons` is a tab. BARE matches on
   * `path === b || path.startsWith(b + "/")`, which is what keeps the
   * two apart; a plain `startsWith` would hide the bar on the whole
   * Lessons section.
   */
  it("does not let /lesson swallow /lessons", () => {
    const nav = readFileSync("components/Nav.tsx", "utf8");
    expect(nav).toContain('path === b || path.startsWith(`${b}/`)');
  });
});
