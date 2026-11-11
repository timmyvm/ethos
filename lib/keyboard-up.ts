"use client";

import { useEffect, useState } from "react";
import { appliedTextZoom } from "./text-size";

/**
 * How much of the page a keyboard has to cover before it is one, in
 * points. An iPhone's is 216pt at its smallest; a browser's own bars
 * coming and going move the viewport by far less.
 */
export const KEYBOARD_MIN_PX = 120;

type Visual = { height: number; width?: number; scale?: number };
type Layout = {
  height: number;
  /** The layout's width: with the visual viewport's, how far the page is pinched in. */
  width?: number;
  /** How much larger than its layout the page is shown from the start (lib/text-size.ts), 1 by default. */
  zoom?: number;
};

/**
 * Whether the on-screen keyboard is up (#441). On an iPhone the keyboard
 * lies over the page: the layout keeps its height, so nothing written
 * against the viewport's height (a media query, `dvh`) ever hears of it.
 * The visual viewport does: it is the part of the page still in view.
 *
 * A pinch-zoom shrinks it too, so its height is read as if unpinched.
 * How far the page is pinched is the layout's width over the width in
 * view, which a keyboard never changes. The viewport's own `scale` is
 * not used where the widths are known: on a page shown larger from the
 * start (#451) browsers disagree about whether `scale` counts that, and
 * the widths mean one thing everywhere. The threshold is in points, so
 * on such a page it is that many points of the page's own pixels.
 */
export function keyboardUp(visual: Visual | null | undefined, layout: number | Layout): boolean {
  if (!visual) return false;
  const l: Layout = typeof layout === "number" ? { height: layout } : layout;
  const pinch = visual.width && l.width ? l.width / visual.width : (visual.scale ?? 1);
  return l.height - visual.height * pinch > KEYBOARD_MIN_PX / (l.zoom && l.zoom > 1 ? l.zoom : 1);
}

/** True while the keyboard covers part of the page; false on the server and where the browser cannot say. */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;
    const read = () => {
      const root = document.documentElement;
      setUp(
        keyboardUp(visual, {
          // The layout viewport: steady under a pinch and under the keyboard.
          height: root.clientHeight || window.innerHeight,
          width: root.clientWidth || window.innerWidth,
          zoom: appliedTextZoom(),
        })
      );
    };
    read();
    visual.addEventListener("resize", read);
    return () => visual.removeEventListener("resize", read);
  }, []);
  return up;
}
