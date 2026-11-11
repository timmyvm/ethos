"use client";

import { useEffect, useState } from "react";

/**
 * How much of the page a keyboard has to cover before it is one. An
 * iPhone's is 216pt at its smallest; a browser's own bars coming and
 * going move the viewport by far less.
 */
export const KEYBOARD_MIN_PX = 120;

/**
 * Whether the on-screen keyboard is up (#441). On an iPhone the keyboard
 * lies over the page: the layout keeps its height, so nothing written
 * against the viewport's height (a media query, `dvh`) ever hears of it.
 * The visual viewport does: it is the part of the page still in view.
 * A pinch-zoom shrinks it too, so its height is read at the page's scale.
 */
export function keyboardUp(
  visual: { height: number; scale?: number } | null | undefined,
  layoutHeight: number
): boolean {
  if (!visual) return false;
  return layoutHeight - visual.height * (visual.scale ?? 1) > KEYBOARD_MIN_PX;
}

/** True while the keyboard covers part of the page; false on the server and where the browser cannot say. */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;
    const read = () => setUp(keyboardUp(visual, window.innerHeight));
    read();
    visual.addEventListener("resize", read);
    return () => visual.removeEventListener("resize", read);
  }, []);
  return up;
}
