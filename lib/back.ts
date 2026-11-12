/**
 * Back retraces a step (#442).
 *
 * Every back chevron was a link to the parent screen: a new page pushed
 * on top of the one being left. So the place on the parent was lost
 * (Lessons scrolled to its fifth trait, a lesson opened, back: the top
 * of Lessons), and the phone's own back, the edge swipe, then led
 * forward into the screen just left. Apple's guidance is that the back
 * button and the back gesture are one action: they retrace.
 *
 * Where the browser can say what lies under the current screen (the
 * Navigation API: Chromium, and Safari from 26.2), a back whose target
 * is that entry goes back in history, and the browser puts the parent
 * back as it was, scroll and all. Anywhere else (a cold open on a deep
 * link, an older iPhone) the chevron is the link it always was.
 */

type Entry = { url?: string | null; index?: number };
type Nav = { currentEntry?: Entry | null; entries?: () => Entry[] };

const pathOf = (url: string, base = "http://x"): string | null => {
  try {
    return new URL(url, base).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
};

/** The path of the history entry under the current one, or null where the browser cannot say or there is none. */
export function pathUnder(nav: Nav | null | undefined = (globalThis as { navigation?: Nav }).navigation): string | null {
  try {
    const at = nav?.currentEntry?.index;
    if (typeof at !== "number" || at < 1) return null;
    const under = nav?.entries?.()[at - 1];
    return under?.url ? pathOf(under.url) : null;
  } catch {
    return null;
  }
}

/** Whether going back in history lands on `href`: the entry under this screen is that screen. */
export function backRetraces(href: string, under: string | null = pathUnder()): boolean {
  const target = pathOf(href);
  return target !== null && under !== null && target === under;
}

/*
 * Whose back it was. A chevron's `history.back()` is ours, and the page
 * it lands on slides in from the left like any step back. A back the
 * phone made (the edge swipe, a hardware key) has already been drawn by
 * the system, so the page does not slide in a second time
 * (components/PageTransition.tsx asks `takeOwnBack`).
 */
let ownBack = false;

export function goBack(): void {
  ownBack = true;
  history.back();
}

/** True once for a back the app itself started. */
export function takeOwnBack(): boolean {
  const was = ownBack;
  ownBack = false;
  return was;
}

/*
 * The move through history that brought the screen now being drawn, if
 * one did: `own` when a chevron asked for it, otherwise the phone's
 * (the edge swipe, a hardware back, the browser's own buttons). Set as
 * the move happens, read while the next screen renders, settled once it
 * has.
 */
let move: { own: boolean } | null = null;

/** Hear each move through history. Mounted once, by the page transition. */
export function watchHistory(): () => void {
  const onPop = () => {
    move = { own: takeOwnBack() };
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}

export function historyMove(): { own: boolean } | null {
  return move;
}

export function settleHistory(): void {
  move = null;
}
