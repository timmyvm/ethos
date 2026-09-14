import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every screen you can reach by tapping has a way back off it
 * (DECISIONS #279).
 *
 * The bug this exists to stop: `components/Nav.tsx` keeps a `BARE` list
 * of routes that draw no tab bar, on the good argument that one
 * instruction and one button should not sit under three ways to not
 * press it. `components/LessonScreen.tsx` renders its back row only
 * when `onBack` is truthy. Put those two together on a screen whose
 * `onBack` is `undefined` and the only control on the page is the one
 * that goes deeper: the browser gesture becomes the product's back
 * button.
 *
 * That is what `/practice/<trait>` shipped with. `back` was
 * `i > 0 ? () => go(i - 1) : undefined`, so the FIRST screen, the one
 * you land on from a tap on Today, was the one with no exit.
 *
 * Source-level rather than rendered, because the failure is structural:
 * a screen that forgets the prop, not a screen that renders it wrong.
 */

/** Routes in Nav's BARE list that a tap from inside the app can reach. */
const TAPPABLE_BARE_SCREENS = [
  "app/practice/[trait]/page.tsx",
  "app/lesson/[unit]/page.tsx",
  "app/boss/page.tsx",
  "app/hostile/page.tsx",
];

describe("no screen is a dead end", () => {
  it("keeps the BARE list in sync with this test's own list", () => {
    const nav = readFileSync("components/Nav.tsx", "utf8");
    const bare = nav.slice(nav.indexOf("const BARE"), nav.indexOf("export function Nav"));
    for (const file of TAPPABLE_BARE_SCREENS) {
      // "app/practice/[trait]/page.tsx" -> "/practice"
      const route = `/${file.split("/")[1]}`;
      expect(bare, `${route} is no longer in BARE`).toContain(`"${route}"`);
    }
  });

  for (const file of TAPPABLE_BARE_SCREENS) {
    it(`gives ${file} a control that leaves it`, () => {
      const source = readFileSync(file, "utf8");
      /*
       * Any of the three spellings the app actually uses: LessonScreen's
       * onBack prop, a Link back to a tab, or a router push to one.
       */
      const hasExit =
        /onBack=\{/.test(source) ||
        /href="\/(|games|history|you|lessons)"/.test(source) ||
        /router\.push\("\/(|games|history|you|lessons)"\)/.test(source);
      expect(hasExit, `${file} has no way out`).toBe(true);
    });
  }

  /**
   * The specific regression: a conditional back whose false branch is
   * `undefined` leaves the first step of a walk with nothing on it.
   */
  it("never hands LessonScreen an undefined back on the first step", () => {
    for (const file of TAPPABLE_BARE_SCREENS) {
      const source = readFileSync(file, "utf8");
      expect(
        /const back =[^;]*:\s*undefined/.test(source),
        `${file} falls back to undefined, so its first screen has no exit`
      ).toBe(false);
    }
  });
});
