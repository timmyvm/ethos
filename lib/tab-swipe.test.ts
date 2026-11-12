import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { project } from "./spring";
import {
  SWIPE_EDGE_PX,
  SWIPE_SLOP_PX,
  arrivedBySwipe,
  onSwipeHeading,
  setSwipeHeading,
  swipeArrival,
  swipeAxis,
  swipeCommits,
  swipeHeading,
  swipeNeighbour,
  swipeTabIndex,
  wellAt,
} from "./tab-swipe";
import { TAB_HREFS } from "./tabs";

/**
 * The swipe between the tabs (#457), as numbers. What a finger's travel
 * means is decided here with no page under it; the hand that uses these
 * is components/TabSwipe.tsx, and `scripts/check-swipe.mjs` drives that
 * with a real touch against a build.
 */

/** A phone's width, px: one page of travel. */
const W = 390;

describe("which screens swipe", () => {
  it("is the five tabs, in the bar's order", () => {
    expect(TAB_HREFS.map(swipeTabIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("is nothing a step in from a tab", () => {
    // Settings and the Shop light You's tab but leave by their back link.
    for (const path of ["/settings", "/shop", "/lessons/the-cold-open", "/rep", "/history/abc", "/you/words"]) {
      expect(swipeTabIndex(path), path).toBe(-1);
    }
  });
});

describe("whose the finger is", () => {
  it("is nobody's inside the slop", () => {
    expect(swipeAxis(0, 0)).toBeNull();
    expect(swipeAxis(SWIPE_SLOP_PX - 1, 0)).toBeNull();
    expect(swipeAxis(0, -(SWIPE_SLOP_PX - 1))).toBeNull();
    expect(swipeAxis(6, 6)).toBeNull();
  });

  it("is the swipe's when it goes clearly sideways", () => {
    expect(swipeAxis(SWIPE_SLOP_PX, 0)).toBe("x");
    expect(swipeAxis(-14, 3)).toBe("x");
    expect(swipeAxis(30, -20)).toBe("x");
  });

  it("is the scroll's when it goes up, down or along a thumb's arc", () => {
    expect(swipeAxis(0, 12)).toBe("y");
    expect(swipeAxis(4, -30)).toBe("y");
    // Even, and a hair more across than down: a scroll's arc, not a swipe.
    expect(swipeAxis(12, 12)).toBe("y");
    expect(swipeAxis(12, 10)).toBe("y");
    expect(swipeAxis(-13, 10)).toBe("x");
  });

  it("leaves the screen's edges to the system's own gestures", () => {
    expect(SWIPE_EDGE_PX).toBeGreaterThanOrEqual(20);
    expect(SWIPE_EDGE_PX).toBeLessThan(W * 0.1);
  });
});

describe("the tab a pull makes room for", () => {
  it("is the next along the bar on a pull to the left, the one before on a pull to the right", () => {
    expect(swipeNeighbour(0, -40)).toBe(1);
    expect(swipeNeighbour(2, -1)).toBe(3);
    expect(swipeNeighbour(2, 1)).toBe(1);
    expect(swipeNeighbour(4, 200)).toBe(3);
  });

  it("is none past either end of the bar", () => {
    expect(swipeNeighbour(0, 40)).toBeNull();
    expect(swipeNeighbour(TAB_HREFS.length - 1, -40)).toBeNull();
  });

  it("is none at rest, and none on a screen that is not a tab", () => {
    expect(swipeNeighbour(2, 0)).toBeNull();
    expect(swipeNeighbour(-1, -40)).toBeNull();
    expect(swipeNeighbour(-1, 40)).toBeNull();
  });
});

describe("go or stay", () => {
  /* #465, Timothy: "lower the distance and velocity needed to swipe".
     A sixth of the width, a throw resting past 30%, or a 300 px/s flick
     toward the neighbour; it was a quarter, half and nothing. */
  it("goes once 15% of the width has been dragged, however slowly", () => {
    expect(swipeCommits({ dx: -(W * 0.15 + 1), velocity: 0, width: W })).toBe(true);
    expect(swipeCommits({ dx: W * 0.15 + 1, velocity: 0, width: W })).toBe(true);
    // A quarter, the old line, goes with room to spare.
    expect(swipeCommits({ dx: -(W * 0.25 - 1), velocity: 0, width: W })).toBe(true);
  });

  it("stays on a short slow drag", () => {
    expect(swipeCommits({ dx: -(W * 0.15 - 1), velocity: 0, width: W })).toBe(false);
    expect(swipeCommits({ dx: 30, velocity: 40, width: W })).toBe(false);
    expect(swipeCommits({ dx: -30, velocity: -40, width: W })).toBe(false);
  });

  it("goes on a quick flick toward the neighbour from any distance", () => {
    expect(swipeCommits({ dx: -12, velocity: -300, width: W })).toBe(true);
    expect(swipeCommits({ dx: 12, velocity: 300, width: W })).toBe(true);
    expect(swipeCommits({ dx: -30, velocity: -900, width: W })).toBe(true);
  });

  it("goes on a slower throw that would come to rest past 30%", () => {
    const dx = -40;
    const velocity = -250;
    expect(Math.abs(dx + project(velocity))).toBeGreaterThan(W * 0.3);
    expect(swipeCommits({ dx, velocity, width: W })).toBe(true);
  });

  it("stays on a slow nudge that would not", () => {
    const dx = -20;
    const velocity = -60;
    expect(Math.abs(dx + project(velocity))).toBeLessThan(W * 0.3);
    expect(swipeCommits({ dx, velocity, width: W })).toBe(false);
  });

  it("stays on a flick back the other way, wherever the page is", () => {
    // Dragged most of the way to the next tab, then thrown home.
    expect(swipeCommits({ dx: -300, velocity: 400, width: W })).toBe(false);
    expect(swipeCommits({ dx: 300, velocity: -400, width: W })).toBe(false);
  });

  it("does not read a finger's drift at the lift as a flick back", () => {
    // Past the line, lifting with a little backward drift: still goes.
    expect(swipeCommits({ dx: -200, velocity: 120, width: W })).toBe(true);
    expect(swipeCommits({ dx: 200, velocity: -120, width: W })).toBe(true);
  });

  it("stays at rest and on a page with no width", () => {
    expect(swipeCommits({ dx: 0, velocity: 2000, width: W })).toBe(false);
    expect(swipeCommits({ dx: -200, velocity: -900, width: 0 })).toBe(false);
  });
});

describe("the well under the finger", () => {
  it("sits on its tab at rest", () => {
    for (let i = 0; i < TAB_HREFS.length; i++) expect(wellAt(i, 0, W)).toBe(i);
  });

  it("goes the share of a tab the page has gone of its width", () => {
    expect(wellAt(1, -W / 2, W)).toBeCloseTo(1.5);
    expect(wellAt(1, W / 4, W)).toBeCloseTo(0.75);
    expect(wellAt(3, -W, W)).toBe(4);
    expect(wellAt(3, W, W)).toBe(2);
  });

  it("stays put on a page with no width", () => {
    expect(wellAt(2, -100, 0)).toBe(2);
  });
});

describe("a tab a swipe carried in", () => {
  afterEach(() => {
    swipeArrival.path = null;
    swipeArrival.landed = false;
  });

  it("is no tab until a swipe lands", () => {
    for (const path of TAB_HREFS) expect(arrivedBySwipe(path)).toBe(false);
  });

  it("is the one the swipe is taking the app to, and only that one", () => {
    swipeArrival.path = "/lessons";
    expect(arrivedBySwipe("/lessons")).toBe(true);
    expect(arrivedBySwipe("/")).toBe(false);
    expect(arrivedBySwipe("/games")).toBe(false);
  });
});

describe("the tab a let-go swipe is heading to", () => {
  afterEach(() => setSwipeHeading(null));

  it("is none at rest", () => {
    expect(swipeHeading()).toBeNull();
  });

  it("tells the bar once for each change, and not at all for the same tab twice", () => {
    let told = 0;
    const off = onSwipeHeading(() => told++);
    setSwipeHeading(1);
    expect(swipeHeading()).toBe(1);
    setSwipeHeading(1);
    expect(told).toBe(1);
    setSwipeHeading(null);
    expect(swipeHeading()).toBeNull();
    expect(told).toBe(2);
    off();
    setSwipeHeading(3);
    expect(told).toBe(2);
  });
});

/**
 * The two animations a tab change already has stand down for a swipe,
 * and the layers stack so the picture is under the bar. These are pinned
 * in the source because nothing but a phone in the hand shows them
 * otherwise: a page that pushes in after the finger already brought it,
 * a well that travels twice, a picture that slides over the tab bar.
 */
describe("the swipe and what it stands beside", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const pt = readFileSync("components/PageTransition.tsx", "utf8");
  const nav = readFileSync("components/Nav.tsx", "utf8");
  const hook = readFileSync("components/TabSwipe.tsx", "utf8");

  it("plays no push on a page a swipe brought in, because tab to tab is a swap for everyone", () => {
    // #443: a tab change has no travel, however it was made, so the page
    // transition does not need to know a swipe brought this tab in.
    expect(pt).toContain('if (a !== -1 && b !== -1) return "swap";');
    expect(pt).toMatch(/const still = cold \|\| direction === "swap" \|\|/);
    expect(pt).toMatch(/\$\{still \? "" : direction === "right" \? "push-right" : "push-left"\}/);
    expect(pt).not.toContain("arrivedBySwipe");
  });

  it("lands where the tab was left, and shows its picture there", () => {
    // #443 (lib/tab-places.ts): the bar restores a tab's place, so the
    // swipe asks the router to leave the scroll alone, both times.
    expect(hook.match(/router\.push\([^)]*\{ scroll: false \}\)/g)).toHaveLength(2);
    // The pane is scrolled to that place, which also sticks the picture's bar.
    expect(hook).toContain("el.scrollTop = tabPlace(TAB_HREFS[to]);");
    const drop = hook.slice(hook.indexOf("const dropPane = () => {"), hook.indexOf("/** Put `to`'s picture in the pane"));
    expect(drop).toContain("el.scrollTop = 0;");
    // And the bar still does the restoring: a tab link and its own slide leave the scroll too.
    expect(nav).toContain("const y = tabPlace(path, room);");
    expect(nav).toContain("scroll={false}");
  });

  it("holds a picture until the page under it has loaded, and stands in for its entrance only when it was whole", () => {
    // #434: a page's placeholders draw nothing for 300ms, so a picture
    // of placeholders let go at once fell to a bare page.
    expect(hook).toContain('const waits = el.dataset.kind !== "blank";');
    expect(hook).toContain('const whole = el.dataset.settled === "1";');
    expect(hook).toContain("if (waits && !loaded && performance.now() - since < HANDOFF_MAX_MS) {");
    expect(hook).toContain("if (whole && loaded) arrive(fresh);");
  });

  it("does not send the bar's well a second time", () => {
    expect(nav).toContain("if (arrivedBySwipe(path)) return;");
  });

  it("lights the tab a swipe is let go toward, and still names the page the app is on", () => {
    expect(nav).toContain("useSyncExternalStore(onSwipeHeading, swipeHeading, () => null)");
    expect(nav).toContain("const active = i === (heading ?? current);");
    expect(nav).toContain('aria-current={i === current ? "page" : undefined}');
    // The well's resting place is the route's, never the heading's: React
    // must not write the well's transform while a swipe is moving it.
    expect(nav).toContain("style={{ transform: `translateX(${current * 100}%)` }}");
    // Set at the lift; cleared on a catch, on a landing that came home
    // or was taken, on arrival and when the move never comes.
    expect(hook).toContain("setSwipeHeading(to);");
    expect(hook.match(/setSwipeHeading\(null\);/g)).toHaveLength(4);
  });

  it("only tab screens take a sideways touch from the browser", () => {
    expect(pt).toMatch(/swipeTabIndex\(path\) < 0 \? "" : "tab-swipe"/);
    expect(css).toMatch(/\.tab-swipe \{[^}]*touch-action: pan-y pinch-zoom;/);
    // The root itself never sets touch-action: a recording screen keeps its own.
    expect(css.match(/\.swipe-root \{[^}]*\}/)?.[0]).not.toContain("touch-action");
  });

  it("stacks the picture over the page's bar and under the tab bar and every sheet", () => {
    const z = (block: RegExp) => Number(css.match(block)?.[1]);
    const pane = z(/\.swipe-clip \{[^}]*z-index: (\d+);/);
    const bar = z(/\.screen-bar \{[^}]*z-index: (\d+);/);
    const dock = Number(nav.match(/nav-dock fixed bottom-0 left-1\/2 z-(\d+)/)?.[1]);
    const sheet = Number(
      readFileSync("components/ui/Overlay.tsx", "utf8").match(/fixed inset-0 z-(\d+)/)?.[1]
    );
    expect(bar).toBeLessThan(pane);
    expect(pane).toBeLessThan(dock);
    expect(dock).toBeLessThan(sheet);
  });

  it("moves the app only once the motion has landed", () => {
    // One navigation for a landed swipe, and it is inside the landing's
    // own promise; the other is reduced motion's, which has no landing.
    const pushes = [...hook.matchAll(/router\.push\(/g)];
    expect(pushes).toHaveLength(2);
    const landing = hook.slice(hook.indexOf("Promise.all([pageRun, paneRun, wellRun])"), hook.indexOf("/* A tab's page, kept"));
    expect(landing).toContain("router.push(href, { scroll: false })");
    expect(landing.indexOf("!pageLanded || !paneLanded")).toBeGreaterThan(-1);
    expect(landing.indexOf("!pageLanded || !paneLanded")).toBeLessThan(landing.indexOf("router.push(href, { scroll: false })"));
  });

  it("lands the page whoever takes the bar's well mid-landing", () => {
    // The well's run is asked how it ended and never decides the landing:
    // only a finger on the page (flight replaced) or the page's own run can.
    const landing = hook.slice(hook.indexOf("Promise.all([pageRun, paneRun, wellRun])"), hook.indexOf("/* A tab's page, kept"));
    expect(landing.length).toBeGreaterThan(0);
    expect(landing).toContain("if (flight.current !== f) return;");
    expect(landing).toContain("const well = wellLanded ? s.well : null;");
    expect(landing).toContain("if (to === null || !pageLanded || !paneLanded) {");
    expect(landing).not.toMatch(/!wellLanded\)? return/);
  });

  it("shows a neighbour as a picture that cannot be touched, read or run", () => {
    expect(hook).toMatch(/className="swipe-clip" hidden aria-hidden/);
    expect(hook).toMatch(/className="swipe-pane" inert/);
    expect(css).toMatch(/\.swipe-clip \{[^}]*pointer-events: none;/);
    const standIn = readFileSync("lib/tab-stand-in.ts", "utf8");
    expect(standIn).toContain('"script, video, audio, iframe, [role=\'dialog\'], .sheet-scrim"');
  });

  it("asks for a tab's first paint in a deployed build only", () => {
    const standIn = readFileSync("lib/tab-stand-in.ts", "utf8");
    expect(standIn).toContain('if (process.env.NODE_ENV !== "production") return;');
  });

  it("leaves a mouse, a field, a slider and an open sheet alone", () => {
    expect(hook).toContain('e.pointerType === "mouse"');
    expect(hook).toContain("[role='slider']");
    expect(hook).toContain("[data-no-swipe]");
    expect(hook).toContain("[role='dialog'][aria-modal='true']");
  });
});
