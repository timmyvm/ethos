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
  // B10: the two auth screens off the bar, each with its literal back.
  "app/auth/forgot/page.tsx",
  "app/auth/reset/page.tsx",
  // B11: the marketing pages find their way back (A2's matcher reads
  // the route group out of the path).
  "app/(marketing)/about/page.tsx",
  "app/(marketing)/privacy/page.tsx",
  "app/(marketing)/terms/page.tsx",
];

/**
 * The route a page file serves: route groups (`(marketing)`) are not in
 * the URL, so they drop out, and the BARE list holds first segments.
 *   "app/practice/[trait]/page.tsx" -> "/practice"
 *   "app/(marketing)/about/page.tsx" -> "/about"
 */
function routeOf(file: string): string {
  const segments = file
    .split("/")
    .slice(1, -1)
    .filter((s) => !/^\(.*\)$/.test(s));
  return `/${segments[0] ?? ""}`;
}

/** Where a way out may go: a tab, or a screen people leave from. */
const DESTINATIONS = "(|games|history|you|lessons|settings|signin|about)";

/**
 * Any of the spellings the app actually uses: LessonScreen's onBack
 * prop, a Link back to a tab or a known screen, a router push to one,
 * ScreenHeader's `back={{ href: "/…" }}`, or a `<BackLink href="/…">`.
 */
function hasWayOut(source: string): boolean {
  return (
    /onBack=\{/.test(source) ||
    new RegExp(`href="\\/${DESTINATIONS}"`).test(source) ||
    new RegExp(`router\\.push\\("\\/${DESTINATIONS}"\\)`).test(source) ||
    /back=\{\{\s*href:\s*["'`]\/[^"'`]*["'`]/.test(source) ||
    /<BackLink\b[^>]*\bhref=(?:["'`]\/|\{)/.test(source)
  );
}

describe("the way-out reader", () => {
  it("drops route groups from the route", () => {
    expect(routeOf("app/practice/[trait]/page.tsx")).toBe("/practice");
    expect(routeOf("app/(marketing)/about/page.tsx")).toBe("/about");
    expect(routeOf("app/(auth)/signin/page.tsx")).toBe("/signin");
  });

  it("reads every spelling of a way back", () => {
    expect(hasWayOut('<ScreenHeader title="Shop" back={{ href: "/you", label: "You" }} />')).toBe(true);
    expect(hasWayOut('<BackLink href="/lessons" label="Lessons" />')).toBe(true);
    expect(hasWayOut("<BackLink href={backTo} label={label} />")).toBe(true);
    expect(hasWayOut('<Link href="/settings">Settings</Link>')).toBe(true);
    expect(hasWayOut('<Link href="/signin">Sign in</Link>')).toBe(true);
    expect(hasWayOut('<Link href="/about">Ethos</Link>')).toBe(true);
    expect(hasWayOut('router.push("/history")')).toBe(true);
    expect(hasWayOut('<Link href="/rep">Record</Link>')).toBe(false);
  });
});

describe("no screen is a dead end", () => {
  it("keeps the BARE list in sync with this test's own list", () => {
    const nav = readFileSync("components/Nav.tsx", "utf8");
    const bare = nav.slice(nav.indexOf("const BARE"), nav.indexOf("export function Nav"));
    for (const file of TAPPABLE_BARE_SCREENS) {
      const route = routeOf(file);
      expect(bare, `${route} is no longer in BARE`).toContain(`"${route}"`);
    }
  });

  for (const file of TAPPABLE_BARE_SCREENS) {
    it(`gives ${file} a control that leaves it`, () => {
      const source = readFileSync(file, "utf8");
      const hasExit = hasWayOut(source);
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
