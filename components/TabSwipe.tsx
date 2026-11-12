"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { DURATION } from "@/lib/motion";
import { prefersReducedMotion } from "@/lib/prefs";
import { SPRING, animateSpring, releaseVelocity, rubberband } from "@/lib/spring";
import { tabPlace } from "@/lib/tab-places";
import { keepPage, standInFor, wantFirstPaint } from "@/lib/tab-stand-in";
import {
  SWIPE_EDGE_PX,
  SWIPE_SLOP_PX,
  setSwipeHeading,
  swipeArrival,
  swipeAxis,
  swipeCommits,
  swipeNeighbour,
  swipeTabIndex,
  wellAt,
} from "@/lib/tab-swipe";
import { TAB_HREFS } from "@/lib/tabs";

/**
 * The swipe between the tabs (Timothy, 11 Nov: "swipe between screens
 * add"; DECISIONS #457).
 *
 * Put a finger on Today, Lessons, Practice, Log or You and pull
 * sideways: the page comes with it 1:1, its neighbour along the bar
 * comes in beside it, and the bar's well slides under the same thumb.
 * Let go and the three land together at the speed they were going, on
 * the neighbour if the throw would carry that far and back home if not;
 * past either end of the bar the page gives a little and returns (the
 * apple-design skill §2, §5, §6, §9).
 *
 * Three things make it this shape.
 *
 * The app does not move until the motion lands. While anything is in
 * the air there is no navigation to take back, so a finger can catch the
 * page mid-flight and turn it round (§3), and a swipe let go early has
 * changed nothing.
 *
 * The neighbour is a picture until then (lib/tab-stand-in.ts): the tab
 * as it was last left, at the place it was left (#443), or its first
 * paint. Its own code runs only once the app has moved, under the
 * picture, which fades when the page under it has what it was waiting
 * for.
 *
 * A tap on the bar is the other way between tabs, and it swaps in place
 * with no travel (#443, Apple's tab bar). The two do not disagree: here
 * the page moves because a finger is moving it.
 *
 * And it is the lesson walk's swipe (LessonScreen `useSwipe`), not a
 * second idea of one: pointer events on a page that keeps
 * `touch-action: pan-y`, ten pixels to decide the axis, a vertical start
 * left to the scroll, the same rule for go or stay (lib/tab-swipe.ts).
 * Everything moves by transform written straight to the element, never
 * through React: a render per pointer event is how a drag stutters.
 */

/** Where a sideways drag is somebody else's: a field's caret, a slider, an opt-out. */
const NO_SWIPE = "input, textarea, select, [contenteditable], [role='slider'], [data-no-swipe]";

/** Past the end of the bar the page gives this share of its width, as the lesson walk does. */
const BAND = 0.4;

/** The longest the picture waits for the page under it to finish loading. */
const HANDOFF_MAX_MS = 900;

/** A move that never came (offline, nothing cached): put the screen back. */
const ARRIVAL_MAX_MS = 4000;

type Drag = {
  id: number;
  x0: number;
  y0: number;
  /** The column's width: one page of travel. */
  w: number;
  locked: boolean;
  /** Where the page is asked to be, px from rest. */
  dx: number;
  /** Where it is drawn: `dx`, or less past the end of the bar. */
  shown: number;
  samples: { t: number; y: number }[];
  /** Reduced motion: nothing follows the finger, the release still counts. */
  reduced: boolean;
  well: HTMLElement | null;
  /** One tab's width on the bar, px: the well's travel per page. */
  step: number;
};

/** An element's live sideways offset, px: where it IS, mid-spring or not (§3). */
function liveX(el: HTMLElement): number {
  return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41 || 0;
}

/** Stop whatever is moving `el` and leave it exactly where it is. */
function hold(el: HTMLElement | null, keepTransitions = false): number {
  if (!el) return 0;
  const x = liveX(el);
  el.style.transform = `translateX(${x}px)`;
  el.getAnimations().forEach((a) => {
    // The well's press swell is a CSS transition and stays its own.
    if (keepTransitions && typeof CSSTransition !== "undefined" && a instanceof CSSTransition) return;
    a.cancel();
  });
  return x;
}

/** The finger travel that draws a banded page at `shown`: rubberband, read backwards. */
function unband(shown: number, dimension: number, c = 0.55): number {
  const x = Math.min(Math.abs(shown), dimension * 0.98);
  return (Math.sign(shown) * (x * dimension)) / (c * (dimension - x));
}

/** Does anything from `from` up to `root` scroll sideways by itself? */
function scrollsSideways(from: Element, root: Element): boolean {
  for (let n: Element | null = from; n && n !== root; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) {
      return true;
    }
  }
  return false;
}

/**
 * Run everything `el` was going to play to its end: entrances, staggers,
 * the fade its content arrives with. A loop (a placeholder's sweep, an
 * idle) has no end and is left alone.
 */
function arrive(el: HTMLElement) {
  for (const a of el.getAnimations({ subtree: true })) {
    const end = Number(a.effect?.getComputedTiming().endTime);
    if (a.playState !== "running" || !Number.isFinite(end)) continue;
    try {
      a.finish();
    } catch {
      // Gone between the look and the call: nothing left to finish.
    }
  }
}

/**
 * Eats the one click a drag can end in, and nothing after it: the guard
 * disarms on the next pointerdown, so a swipe that ended in no click
 * never swallows the real tap that follows (LessonScreen's, unchanged).
 */
function swallowClick() {
  const disarm = () => {
    window.removeEventListener("click", stop, { capture: true });
    window.removeEventListener("pointerdown", disarm, { capture: true });
    clearTimeout(timer);
  };
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    disarm();
  };
  window.addEventListener("click", stop, { capture: true });
  window.addEventListener("pointerdown", disarm, { capture: true });
  const timer = setTimeout(disarm, 350);
}

/**
 * `path`: the screen on show. `page`: its wrapper, the element a finger
 * pulls. Returns the handlers for the element around it, which stays put
 * and so still hears a finger when the page has gone from under it, and
 * the pane the neighbour's picture slides in on.
 */
export function useTabSwipe(path: string, page: RefObject<HTMLDivElement | null>) {
  const router = useRouter();
  const current = swipeTabIndex(path);
  const pane = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  /** A landing in the air. Null at rest, and once the app has been told to move. */
  const flight = useRef<{ banded: boolean } | null>(null);
  /** The tab whose picture is in the pane, or null. */
  const shownTab = useRef<number | null>(null);
  /** The app has been told to move and the new page is not up yet. */
  const leaving = useRef(false);
  const timers = useRef<{ arrival?: ReturnType<typeof setTimeout>; fade?: ReturnType<typeof setTimeout>; frame?: number }>({});

  /** The pane, emptied and put away: at rest the layer does not exist. */
  const dropPane = () => {
    const t = timers.current;
    clearTimeout(t.fade);
    if (t.frame !== undefined) cancelAnimationFrame(t.frame);
    t.frame = undefined;
    shownTab.current = null;
    const el = pane.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.replaceChildren();
    el.removeAttribute("data-leaving");
    el.style.transform = "";
    el.scrollTop = 0;
    if (el.parentElement) el.parentElement.hidden = true;
  };

  /** Put `to`'s picture in the pane, or put the pane away for null. */
  const showStandIn = (to: number | null) => {
    const el = pane.current;
    if (!el || to === shownTab.current) return;
    if (to === null) {
      dropPane();
      return;
    }
    const standIn = standInFor(TAB_HREFS[to]);
    el.removeAttribute("data-leaving");
    el.replaceChildren(...(standIn ? [standIn.el] : []));
    el.dataset.kind = standIn?.kind ?? "blank";
    // The picture is the tab, whole: a page left mid-load is a picture of placeholders.
    el.dataset.settled = standIn?.kind === "seen" && !standIn.el.querySelector(".skeleton") ? "1" : "";
    shownTab.current = to;
    if (el.parentElement) el.parentElement.hidden = false;
    /* A tab comes back where it was left (#443, lib/tab-places.ts), so
       its picture stands there too: the pane is scrolled to the tab's
       place, which also sticks the picture's own bar to the pane's top
       as the page's sticks to the screen's. Set once the pane is shown
       (a hidden box has nothing to scroll); the pane holds it to what
       the picture can scroll, and 0 is a tab that was at its top. */
    el.scrollTop = tabPlace(TAB_HREFS[to]);
  };

  /** Which side of the page a tab's picture sits on: +1 right, -1 left. */
  const side = (to: number) => (to > current ? 1 : -1);

  const paint = (s: Drag) => {
    const el = page.current;
    if (!el) return;
    el.style.transform = `translate3d(${s.shown}px,0,0)`;
    const to = shownTab.current;
    if (pane.current && to !== null) {
      pane.current.style.transform = `translate3d(${s.shown + side(to) * s.w}px,0,0)`;
    }
    if (s.well) s.well.style.transform = `translateX(${wellAt(current, s.shown, s.w) * s.step}px)`;
  };

  /** Everything back as it was before a finger came: the page at rest, no pane, the well on its tab. */
  const rest = (well: HTMLElement | null) => {
    const el = page.current;
    if (el) {
      el.style.transform = "";
      el.style.willChange = "";
    }
    dropPane();
    if (well && current >= 0) well.style.transform = `translateX(${current * 100}%)`;
  };

  /** The landing: the page, the picture and the well, on one spring, at the finger's speed (§5). */
  const settle = (s: Drag, to: number | null, velocity: number) => {
    const el = page.current;
    if (!el) return;
    const inPane = shownTab.current;
    const pageTo = to === null ? 0 : -side(to) * s.w;
    const banded = inPane === null;
    const f = { banded };
    flight.current = f;
    // The bar lights where this is going from the lift, not the landing.
    setSwipeHeading(to);
    const spring = SPRING.base;
    // Past the end the finger moved further than the page did, so its
    // speed is not the page's: the page comes home from a standstill.
    const v = banded ? 0 : velocity;
    const pageRun = animateSpring(el, { axis: "x", from: s.shown, to: pageTo, velocity: v, spring });
    let paneRun: Promise<boolean> | true = true;
    if (pane.current && inPane !== null) {
      const off = side(inPane) * s.w;
      paneRun = animateSpring(pane.current, {
        axis: "x",
        from: s.shown + off,
        to: pageTo + off,
        velocity: v,
        spring,
      });
    }
    let wellRun: Promise<boolean> | true = true;
    if (s.well && s.step > 0) {
      const px = (shown: number) => wellAt(current, shown, s.w) * s.step;
      wellRun = animateSpring(s.well, {
        axis: "x",
        from: px(s.shown),
        to: px(pageTo),
        velocity: (-v * s.step) / s.w,
        spring,
      });
    }
    void Promise.all([pageRun, paneRun, wellRun]).then(([pageLanded, paneLanded, wellLanded]) => {
      // Caught again mid-flight: the finger owns it now.
      if (flight.current !== f) return;
      flight.current = null;
      /* The well can be taken mid-landing by the bar's own slide (a
         thumb on the bar cancels whatever is moving it, Nav.tsx). It is
         the bar's then: the page still lands, and nothing here writes
         the well again. Counting that as a landing interrupted left the
         page parked off-screen under a picture, with the app never told
         to move. */
      const well = wellLanded ? s.well : null;
      if (to === null || !pageLanded || !paneLanded) {
        // Home, or the page's own run was taken by something that is
        // not a finger on it: back to rest, nothing navigated.
        setSwipeHeading(null);
        rest(well);
        return;
      }
      /* Landed on the neighbour, and only now does the app move. Its
         picture stays over the new page while that page mounts under
         it, and the old page, parked off-screen, goes when the route
         does. */
      const href = TAB_HREFS[to];
      swipeArrival.path = href;
      swipeArrival.landed = false;
      leaving.current = true;
      // The bar puts the tab where it was left (#443); the router leaves the scroll alone.
      router.push(href, { scroll: false });
      clearTimeout(timers.current.arrival);
      timers.current.arrival = setTimeout(() => {
        if (swipeArrival.path !== href || swipeArrival.landed) return;
        swipeArrival.path = null;
        leaving.current = false;
        setSwipeHeading(null);
        rest(well);
      }, ARRIVAL_MAX_MS);
    });
  };

  /* A tab's page, kept as the app leaves it: the picture a later swipe
     back toward it slides in (lib/tab-stand-in.ts). By the time this
     cleanup runs React has let the old wrapper go, which is what makes
     it ours to show. */
  useLayoutEffect(() => {
    const el = page.current;
    if (!el || swipeTabIndex(path) < 0) return;
    return () => keepPage(path, el);
  }, [path, page]);

  /* The neighbours a swipe could reach from here, asked for their first
     paint while the phone is idle, unless it is saving data. A tab
     opened before needs none: it has its own picture. */
  useEffect(() => {
    if (current < 0) return;
    const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saving) return;
    const ask = () => {
      for (const i of [current - 1, current + 1]) {
        if (i >= 0 && i < TAB_HREFS.length) wantFirstPaint(TAB_HREFS[i]);
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(ask, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(ask, 1200);
    return () => clearTimeout(id);
  }, [current]);

  /* The route moved. If a swipe carried the app here, its picture is
     still on top: let the page under it come up, then let the picture
     go. Anything else that moved the app clears what a swipe left. */
  useLayoutEffect(() => {
    drag.current = null;
    flight.current = null;
    // Wherever the app is now, the bar says so itself.
    setSwipeHeading(null);
    if (swipeArrival.path === null) {
      if (shownTab.current !== null) dropPane();
      return;
    }
    if (swipeArrival.path !== path) {
      // Still on the way there, or moved on from where a swipe landed.
      if (swipeArrival.landed) {
        swipeArrival.path = null;
        swipeArrival.landed = false;
        dropPane();
      }
      return;
    }
    swipeArrival.landed = true;
    leaving.current = false;
    clearTimeout(timers.current.arrival);
    const el = pane.current;
    if (!el || shownTab.current === null) return;
    /* A picture waits for the page under it to finish loading, so a
       full screen never fades to placeholders and back. A first paint
       waits too since #434: the page's own placeholders hold their
       height and draw nothing for their first 300ms, so a picture of
       placeholders let go at once fell to a bare page before the words
       came. Bare ground has nothing to wait behind. */
    const waits = el.dataset.kind !== "blank";
    /** The picture was this tab, whole, not a picture of its placeholders. */
    const whole = el.dataset.settled === "1";
    const since = performance.now();
    const t = timers.current;
    const tick = () => {
      t.frame = undefined;
      const fresh = page.current;
      const loaded = fresh !== null && !fresh.querySelector(".skeleton");
      if (waits && !loaded && performance.now() - since < HANDOFF_MAX_MS) {
        t.frame = requestAnimationFrame(tick);
        return;
      }
      /* The picture was this tab, whole, so the tab has arrived already:
         the page under it plays no entrance of its own. Left to play,
         its rows would still be fading in while the picture fades out,
         and for a moment the screen is half of each (the look loop
         caught it: a washed frame 240ms after the lift). */
      if (whole && loaded) arrive(fresh);
      el.setAttribute("data-leaving", "");
      t.fade = setTimeout(dropPane, DURATION.base + 40);
    };
    // Two frames, so the new page's first paint is up under the picture.
    t.frame = requestAnimationFrame(() => {
      t.frame = requestAnimationFrame(tick);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(
    () => () => {
      const t = timers.current;
      clearTimeout(t.arrival);
      clearTimeout(t.fade);
      if (t.frame !== undefined) cancelAnimationFrame(t.frame);
    },
    []
  );

  const end = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = drag.current;
    if (!s || s.id !== e.pointerId) return;
    drag.current = null;
    if (!s.locked) return;
    e.currentTarget.style.userSelect = "";
    delete e.currentTarget.dataset.swiping;
    swallowClick();
    const velocity = cancelled ? 0 : releaseVelocity(s.samples, e.timeStamp);
    const toward = swipeNeighbour(current, s.dx);
    const commit =
      !cancelled && toward !== null && swipeCommits({ dx: s.dx, velocity, width: s.w });
    if (s.reduced) {
      // Reduced motion: no travel to land, so the app simply moves, and
      // the page arrives with the fade every other change gets.
      if (commit) router.push(TAB_HREFS[toward], { scroll: false });
      return;
    }
    settle(s, commit ? toward : null, velocity);
  };

  const handlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (!e.isPrimary || e.pointerType === "mouse") return;
      /* A swipe under way keeps the pointer it captured. A touch that
         never became one is forgotten here: its lift can be missed (a
         pen let go over the bar, which is outside this element), and a
         stale touch must not turn every later one away. */
      if (current < 0 || leaving.current || drag.current?.locked) return;
      // A swipe's picture still over the new page: a touch is for the page.
      if (!flight.current && shownTab.current !== null) dropPane();
      if (!flight.current) {
        if (e.clientX < SWIPE_EDGE_PX || e.clientX > window.innerWidth - SWIPE_EDGE_PX) return;
        const target = e.target as Element | null;
        if (!target || target.closest(NO_SWIPE)) return;
        // A sheet is up: the finger is the sheet's.
        if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
        if (scrollsSideways(target, e.currentTarget)) return;
      }
      const well = document.querySelector<HTMLElement>(".nav-well");
      drag.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        w: e.currentTarget.clientWidth || window.innerWidth,
        locked: false,
        dx: 0,
        shown: 0,
        samples: [],
        reduced: prefersReducedMotion(),
        well,
        step: well ? parseFloat(getComputedStyle(well).width) || 0 : 0,
      };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = drag.current;
      if (!s || s.id !== e.pointerId) return;
      if (!s.locked) {
        const axis = swipeAxis(e.clientX - s.x0, e.clientY - s.y0);
        if (axis === null) return;
        if (axis === "y") {
          // Up or down is the page's own scroll, never hijacked.
          drag.current = null;
          return;
        }
        s.locked = true;
        // The page starts under the finger, not ten pixels behind it.
        s.x0 += Math.sign(e.clientX - s.x0) * SWIPE_SLOP_PX;
        const f = flight.current;
        if (f && !s.reduced) {
          /* Caught mid-landing (§3): everything is held where it IS and
             the finger takes it from there. Past the end of the bar the
             page was drawn short of the finger, so the travel that draws
             it there is read back out of the band. */
          flight.current = null;
          setSwipeHeading(null);
          const at = hold(page.current);
          hold(pane.current);
          hold(s.well, true);
          s.x0 -= f.banded ? unband(at, s.w * BAND) : at;
        }
        e.currentTarget.style.userSelect = "none";
        /* The finger turned out to be swiping, so it is not pressing the
           button it landed on (§10: cancel the losers): the page stops
           answering the pointer until the lift, and the press's dip and
           veil let go at once (globals.css `[data-swiping]`). */
        e.currentTarget.dataset.swiping = "";
        if (page.current && !s.reduced) page.current.style.willChange = "transform";
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // A pointer that already went away; the drag ends on its own.
        }
      }
      s.dx = Math.max(-s.w, Math.min(s.w, e.clientX - s.x0));
      s.samples.push({ t: e.timeStamp, y: s.dx });
      if (s.samples.length > 8) s.samples.shift();
      if (s.reduced) return;
      const toward = swipeNeighbour(current, s.dx);
      showStandIn(toward);
      // Past either end of the bar there is no neighbour: the page gives
      // a little and no more (§9), so a refused swipe was still heard.
      s.shown = toward === null ? rubberband(s.dx, s.w * BAND) : s.dx;
      paint(s);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => end(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => end(e, true),
  };

  return {
    handlers: current < 0 ? {} : handlers,
    /* The layer the neighbour's picture slides in on: fixed over the app
       column, under the bar. Put away (`hidden`) whenever nothing is in
       it, so at rest it is not on the page at all. */
    pane: (
      <div className="swipe-clip" hidden aria-hidden>
        <div ref={pane} className="swipe-pane" inert />
      </div>
    ),
  };
}
