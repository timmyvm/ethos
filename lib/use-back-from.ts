"use client";

import { useLayoutEffect, useState } from "react";
import { backFrom, type From } from "./back-from";

/**
 * The parent a pushed screen's back names (D18), read from `?from=`
 * before the first paint of a screen reached by a tap (#478: Today opens
 * Hostile Q&A and the boss, which Practice owns). Read from the location
 * rather than `useSearchParams`, which would make these static pages
 * paint a Suspense fallback on a cold open: the server's paint names
 * the owning tab, and a client navigation swaps it before the browser
 * paints the screen.
 */
export function useBackFrom(fallback: From): ReturnType<typeof backFrom> {
  const [parent, setParent] = useState(() => backFrom(null, fallback));
  useLayoutEffect(() => {
    setParent(backFrom(new URLSearchParams(window.location.search).get("from"), fallback));
  }, [fallback]);
  return parent;
}
