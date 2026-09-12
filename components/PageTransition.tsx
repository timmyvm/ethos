"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
 */

/** The tab bar, in the order it is drawn. Moving along it is lateral. */
const TABS = ["/", "/games", "/history", "/you"];

/**
 * Depth, for everything that is not a tab. A bigger number is further
 * in, so the comparison decides which way the screen comes from without
 * anyone maintaining a graph of routes.
 */
function depth(path: string): number {
  const tab = TABS.indexOf(path);
  if (tab !== -1) return 0;
  // A lesson, a recording, a boss: the deepest the app goes.
  if (/^\/(rep|lesson|boss|hostile|calibrate|upload)/.test(path)) return 2;
  return 1;
}

function directionFor(from: string | null, to: string): "left" | "right" {
  if (from === null) return "right";
  const a = TABS.indexOf(from);
  const b = TABS.indexOf(to);
  // Both are tabs: follow the tab bar.
  if (a !== -1 && b !== -1) return b > a ? "right" : "left";
  const da = depth(from);
  const db = depth(to);
  if (db === da) return "right";
  return db > da ? "right" : "left";
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const previous = useRef<string | null>(null);
  const [direction, setDirection] = useState<"left" | "right">("right");

  useEffect(() => {
    previous.current = path;
  }, [path]);

  /*
   * Computed during render rather than in the effect: the effect runs
   * AFTER paint, so reading the direction there would animate the first
   * frame of every navigation in the previous direction.
   */
  const next = directionFor(previous.current, path);
  if (next !== direction) setDirection(next);

  /*
   * The first paint of a cold load is not a navigation. Pushing the
   * whole app in from the right on open would put a 300ms animation
   * between the user and the first thing they came to do.
   */
  const cold = previous.current === null;

  return (
    <div
      key={path}
      className={cold ? undefined : direction === "right" ? "push-right" : "push-left"}
    >
      {children}
    </div>
  );
}
