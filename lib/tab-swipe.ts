/**
 * The swipe between the tabs (Timothy, 11 Nov: "swipe between screens
 * add"): what a finger's travel means, as numbers, with no DOM in it.
 * components/TabSwipe.tsx is the hand that uses them.
 *
 * The five tabs are peers along the bar, so a sideways drag on one pulls
 * its neighbour in beside it and the bar's well goes with the finger.
 * The rules are the ones the lesson walk's swipe already keeps
 * (components/LessonScreen.tsx `useSwipe`; the apple-design skill §6,
 * §10), so a swipe means the same thing wherever the app has one.
 */
import { project } from "./spring";
import { TAB_HREFS } from "./tabs";

/** Ten pixels of intent before a touch becomes a swipe (§10). */
export const SWIPE_SLOP_PX = 10;

/**
 * A touch that starts this close to either side of the screen is the
 * system's. An installed iPhone app goes back and forward from its
 * edges and Android's back gesture starts there too; a swipe that
 * fought them would lose, and lose differently on every phone.
 */
export const SWIPE_EDGE_PX = 24;

/**
 * The tab a path IS, or -1. Only the five tab screens swipe. Settings
 * and the Shop light You's tab (lib/tabs.ts) but are a step in from it:
 * their way out is their back link, and one lesson's is too.
 */
export function swipeTabIndex(path: string): number {
  return (TAB_HREFS as readonly string[]).indexOf(path);
}

export type SwipeAxis = "x" | "y" | null;

/**
 * Whose the finger is, once it has gone the slop: sideways is the
 * swipe's, anything else the page's own scroll. Sideways has to win
 * clearly, a fifth more across than down, because a tab is mostly
 * scrolled and a thumb's scroll arcs.
 */
export function swipeAxis(dx: number, dy: number, slop = SWIPE_SLOP_PX): SwipeAxis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;
  return ax > ay * 1.2 ? "x" : "y";
}

/**
 * The tab a page drawn `dx` px from rest is making room for: a pull to
 * the left brings in the next one along the bar, a pull to the right
 * the one before. Null at rest and past either end of the bar.
 */
export function swipeNeighbour(current: number, dx: number): number | null {
  if (dx === 0 || current < 0) return null;
  const to = dx < 0 ? current + 1 : current - 1;
  return to >= 0 && to < TAB_HREFS.length ? to : null;
}

/**
 * Does a released drag go to the neighbour? By where the throw would
 * come to REST (§6): a short quick flick carries the page past the
 * halfway line and goes, a long slow haul that stops short stays. A
 * quarter of the width dragged counts by itself, and a flick back the
 * other way cancels whatever the position. `dx`: where the page is, px
 * from rest. `velocity`: the finger's at the lift, px/s.
 */
export function swipeCommits({
  dx,
  velocity,
  width,
}: {
  dx: number;
  velocity: number;
  width: number;
}): boolean {
  if (dx === 0 || width <= 0) return false;
  const reversing = Math.sign(velocity) === -Math.sign(dx) && Math.abs(velocity) > 150;
  if (reversing) return false;
  const carried =
    Math.sign(velocity) === Math.sign(dx) && Math.abs(dx + project(velocity)) > width * 0.5;
  return Math.abs(dx) > width * 0.25 || carried;
}

/**
 * Where the bar's well sits, in tabs, while the page is drawn `shown`
 * px from rest: a page pulled a third of the way left has the well a
 * third of the way to the next tab, so the bar says where the finger is
 * taking you before it gets there (§8).
 */
export function wellAt(current: number, shown: number, width: number): number {
  return width > 0 ? current - shown / width : current;
}

/**
 * The tab a swipe is taking the app to (`landed` false) or has just
 * taken it to. The finger already moved the page and the well there, so
 * the two things that animate a tab change read this and stand down:
 * the page transition plays no push, and the bar's well does not travel
 * a second time. It clears when the app next moves on from that tab.
 */
export const swipeArrival: { path: string | null; landed: boolean } = {
  path: null,
  landed: false,
};

/**
 * The tab a let-go swipe is on its way to, or null. It is known the
 * moment the finger lifts, a third of a second before the app moves, and
 * the bar lights that tab at once: its own slide does (a thumb let go on
 * a tab lights it there and then), and a well that has reached Lessons
 * under a still-lit Today reads as the bar being late. Null again when a
 * finger catches the page mid-flight, and when the app has moved.
 */
let heading: number | null = null;
const headingListeners = new Set<() => void>();

export function setSwipeHeading(tab: number | null): void {
  if (tab === heading) return;
  heading = tab;
  headingListeners.forEach((l) => l());
}

export function swipeHeading(): number | null {
  return heading;
}

export function onSwipeHeading(listener: () => void): () => void {
  headingListeners.add(listener);
  return () => {
    headingListeners.delete(listener);
  };
}

/** Is `path` on screen, or about to be, because a swipe carried it in? */
export function arrivedBySwipe(path: string): boolean {
  return swipeArrival.path === path;
}
