"use client";

import { usePathname } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTabSwipe } from "@/components/TabSwipe";
import { finishEntrances } from "@/lib/entrances";
import { reuseHeld } from "@/lib/held";
import { historyMove, settleHistory, watchHistory } from "@/lib/back";
import { PAGE_ATTR } from "@/lib/tab-stand-in";
import { swipeTabIndex } from "@/lib/tab-swipe";
import { TAB_HREFS } from "@/lib/tabs";

/**
 * Page changes push, they never cut (DECISIONS #242).
 *
 * The app has a left and a right. Moving along the tab bar goes the way
 * the tabs go; going deeper (the shop out of You, the recording out of
 * the floor) comes from the right; coming back comes from the left. By
 * the time the direction is wrong, so is the user's model of where they
 * are, which is the whole "you're never lost" half of premium.
 *
 * This is the incoming half of a push. React has already unmounted the
 * outgoing screen by the time the new one paints, and the real
 * two-sided version needs the View Transitions API, which React 19
 * stable does not expose through Next's `viewTransition` flag yet (the
 * component lives on the experimental channel). What ships is 24px of
 * travel with the opacity ramp finished in the first third: it reads as
 * motion with a direction, not as a dissolve. When the API lands, this
 * component is the one place that changes.
 *
 * Two moves do not push (#442, #443, from Apple's motion and tab bar
 * guidance: no motion on what people do constantly, and never the same
 * step drawn twice).
 *
 *  - Tab to tab is a swap in place. An iPhone's tab bar changes the
 *    content without travel; the well's slide along the bar is the
 *    answer to the tap. With each tab drawn whole in its first frame
 *    (#433) the push was the only wait left, and it promised a thumb a
 *    swipe the tabs did not have. They have one since #457
 *    (components/TabSwipe.tsx): there the page moves because a finger
 *    is moving it, and a tap on the bar still swaps in place. This
 *    breaks #242's "moving along the tab bar goes the way the tabs go".
 *  - A back the phone made (the edge swipe, a hardware key, the
 *    browser's buttons) has already been drawn by the system, so the
 *    screen it lands on is simply there. A back the chevron made slides
 *    in from the left, as before.
 */

/**
 * The tab bar, in the order it is drawn. Moving along it is lateral.
 *
 * Read from lib/tabs.ts rather than typed again here (#275): this file
 * used to keep its own copy, and a tab present in Nav and missing from
 * that copy slid in from the wrong side in both directions.
 */
const TABS: readonly string[] = TAB_HREFS;

/**
 * Depth, for everything that is not a tab. A bigger number is further
 * in, so the comparison decides which way the screen comes from without
 * anyone maintaining a graph of routes.
 */
function depth(path: string): number {
  const tab = TABS.indexOf(path);
  if (tab !== -1) return 0;
  // A unit intro, a recording, a boss: the deepest the app goes. Matched
  // on whole segments: a bare prefix put one lesson (/lessons/<id>, one
  // step in from its tab) at the recording's depth, so coming back from
  // the recording to it slid in from the right, as if deeper again.
  if (/^\/(rep|lesson|boss|hostile|calibrate|upload)(\/|$)/.test(path)) return 2;
  return 1;
}

/**
 * The tabs drawn this visit (#467). Coming back to one is not its
 * arrival: what it held is drawn in its first frame (#433), so its rows
 * do not fade and stagger in again on every swipe or tap back to it.
 * What it reads afterwards that is new still arrives as new.
 */
const drawn = new Set<string>();
/** How long a return holds its late arrivals to the rule. */
const RETURN_SETTLE_MS = 900;

function directionFor(from: string | null, to: string): "left" | "right" | "swap" {
  if (from === null) return "right";
  const a = TABS.indexOf(from);
  const b = TABS.indexOf(to);
  // Both are tabs: a swap in place, no travel.
  if (a !== -1 && b !== -1) return "swap";
  const da = depth(from);
  const db = depth(to);
  if (db === da) return "right";
  return db > da ? "right" : "left";
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const previous = useRef<string | null>(null);
  const [direction, setDirection] = useState<"left" | "right" | "swap">("right");

  useEffect(() => watchHistory(), []);
  useEffect(() => {
    previous.current = path;
    settleHistory();
  }, [path]);

  /*
   * Computed during render rather than in the effect: the effect runs
   * AFTER paint, so reading the direction there would animate the first
   * frame of every navigation in the previous direction.
   */
  const next = directionFor(previous.current, path);
  /* Set as this screen draws, before its reads start in its effects:
     tab to tab hands back what was read a moment ago (lib/held.ts, #467). */
  reuseHeld(
    previous.current !== null && TABS.includes(previous.current) && TABS.includes(path)
  );
  if (next !== direction) setDirection(next);

  /*
   * The first paint of a cold load is not a navigation. Pushing the
   * whole app in from the right on open would put a 300ms animation
   * between the user and the first thing they came to do.
   */
  const cold = previous.current === null;
  /* The phone's own back or forward: the system drew the move. */
  const move = historyMove();
  const still = cold || direction === "swap" || (move !== null && !move.own);

  /*
   * The swipe between the tabs (components/TabSwipe.tsx, #457). The
   * element a finger pulls is this page's wrapper; the one that hears
   * the finger is the element around it, which stays put when the page
   * has gone from under the thumb. A tab a swipe brought in arrived
   * under the finger, and tab to tab is a swap for everyone (#443), so
   * it is simply there: nothing here needs to know how it came.
   */
  const page = useRef<HTMLDivElement>(null);
  const swipe = useTabSwipe(path, page);

  /* Before the first paint, so a return never shows a frame of rows
     at the start of their entrance. What lands a beat later (the streak
     and coin syncs answer after the first frame) is held to the same
     rule for a moment: a mutation is seen before the frame it would
     paint in, and whatever it set going is run to its end. */
  useLayoutEffect(() => {
    if (!TABS.includes(path)) return;
    const el = page.current;
    const returning = drawn.has(path);
    drawn.add(path);
    if (!returning || !el) return;
    finishEntrances(el);
    const settle = new MutationObserver(() => finishEntrances(el));
    settle.observe(el, { subtree: true, childList: true, attributes: true });
    const done = setTimeout(() => settle.disconnect(), RETURN_SETTLE_MS);
    return () => {
      clearTimeout(done);
      settle.disconnect();
    };
  }, [path]);

  /* overflow-x: clip (B10): the 24px the push starts from widened the
     page to 414px for a frame, and a phone can zoom out to show it.
     `clip`, not `hidden`, so the wrapper never becomes a scroll
     container and the sticky header and shelf still stick.

     The keyed fragment is load-bearing (React #418). `children` is
     Next's router element, which waits on its error and not-found chunks
     on a cold load. Straight under the div, the div itself waited, and
     React (19.2) replays a waiting element from inside it: the div then
     looked for itself among its own children and threw a hydration
     error, about one cold load in fifty. Under a fragment, the fragment
     waits and the div keeps its place. Keyed, because React unwraps an
     unkeyed fragment that is the only child. */
  return (
    <div
      className={`swipe-root ${swipeTabIndex(path) < 0 ? "" : "tab-swipe"}`}
      {...swipe.handlers}
    >
      <div
        key={path}
        ref={page}
        {...{ [PAGE_ATTR]: path }}
        className={`overflow-x-clip ${still ? "" : direction === "right" ? "push-right" : "push-left"}`}
      >
        <Fragment key="page">{children}</Fragment>
      </div>
      {swipe.pane}
    </div>
  );
}
