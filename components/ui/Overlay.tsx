"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { openLayer } from "@/lib/overlay-layers";
import { prefersReducedMotion } from "@/lib/prefs";
import {
  MOMENTUM_REST_PX_S,
  SHEET_SLOP_PX,
  edgeFromPast,
  edgeSpring,
  glideStep,
  handOff,
  handOffEnd,
  handOffFrom,
  handOffLine,
  pastFromEdge,
  sheetClaim,
  sheetDismisses,
  sheetHoldsTouch,
  sheetTakesScrolledTouch,
  sheetTakesTopTouch,
  type HandOff,
} from "@/lib/sheet-gesture";
import {
  SPRING,
  animateSpring,
  releaseVelocity,
  rubberband,
  springMs,
  springStateAt,
} from "@/lib/spring";

/**
 * Every layer that sits over the app: the paywall sheet, the mods sheet,
 * the celebration. Checkpoint 1 found the dialog semantics in exactly one
 * of them (the paywall handled Escape and `role="dialog"`, nothing else
 * did), which is how a pattern rots — one screen is correct and the next
 * four are copies of the version before the fix. So the behaviour lives
 * here once and no screen hand-rolls it again.
 *
 * What it guarantees (DESIGN-RULES.md, Definition of Done #6):
 *  - `role="dialog"`, `aria-modal`, a name
 *  - Escape closes, and the key is captured so the page under it never
 *    also acts on the same press
 *  - focus moves in on open, is trapped while open, and returns to
 *    whatever opened it on close — a keyboard user who dismisses a sheet
 *    lands back on the button they pressed, not at the top of the page
 *  - the page behind stops scrolling
 *
 * And the motion (DECISIONS #222): a sheet rises from the bottom edge
 * and goes back the way it came. Every way of closing (Escape, the
 * scrim, a button inside) goes through `requestClose`, which plays the
 * exit with the sheet still mounted and only then calls `onClose`, so
 * the parent's conditional render unmounts a sheet that has already
 * left. A full-screen layer fades in and leaves on its own terms (the
 * celebration owns its slow fade), so it closes at once.
 */

/**
 * The sheet's own way out, for a button inside it ("Done"): the same
 * exit Escape and the scrim play, so a sheet never cuts to nothing.
 * Outside an Overlay it answers `fallback`.
 */
const CloseContext = createContext<(() => void) | null>(null);
export function useOverlayClose(fallback: () => void): () => void {
  return useContext(CloseContext) ?? fallback;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
 * Two sheets can be up at once (the price drop landing over a trait
 * sheet). Only the top one hears Escape and Tab, so one Escape closes
 * one sheet; and the page's scroll lock is counted, so it lifts when the
 * last sheet goes, whichever order they leave in. A sheet that saved
 * and restored `overflow` on its own put back the "hidden" the sheet
 * under it had set, and the page never scrolled again.
 */
const openSheets: object[] = [];
let locks = 0;
let unlockedOverflow = "";


/**
 * A computed `touch-action` that keeps sideways moves for the page: the
 * element handles them itself (the stair's `pan-y`, or `none`).
 */
function ownsSideways(touchAction: string): boolean {
  if (touchAction === "none") return true;
  return /pan-y|pan-up|pan-down/.test(touchAction) && !/pan-x|pan-left|pan-right|manipulation|auto/.test(touchAction);
}

/**
 * Content already scrolled under a touch (handoff). A UIKit sheet over a
 * scroll view takes a swipe down there as one gesture: the content back
 * to its top, then the sheet. The touch's first move says whether it is
 * that (`taken`, null until then); taken, the sheet drives the content's
 * scroll itself, because the browser cannot hand its own scroll back
 * mid-swipe.
 */
type ScrolledUnder = {
  el: HTMLElement;
  taken: boolean | null;
  /**
   * The first touchmove leaned sideways on the stair, which held it from
   * the browser: the browser's scroll is gone for this touch, so the slop
   * says whether it is the stair's scrub or the hand-off's.
   */
  sideways: boolean;
  /** Where the finger has put the content and the sheet. */
  at: HandOff;
  /** Where the finger was at the last move the hand-off spent. */
  lastY: number;
};

/** A finger, a mouse or a pen on the panel, from its press to its release. */
type Grip = {
  id: number;
  /** Where the finger went down, for which way it is going. */
  x0: number;
  y0: number;
  from: number;
  y: number;
  samples: { t: number; y: number }[];
  /** Something under the finger scrolls: an upward move is its. */
  scrolls: boolean;
  /** Something under the finger owns sideways moves (the stair's
   *  scrub): a sideways move is its. */
  sideways: boolean;
  /** Where the finger is now, for how far it has run from the press. */
  yNow: number;
  /** Where the sheet was when the finger took it. */
  held: number;
  /** Past the hysteresis. A ref, not the state: pointer events land
   *  faster than React re-renders, and a flick is over before the
   *  state would say it began. */
  active: boolean;
  /** A touch on content already scrolled: the hand-off's, or nobody's. */
  under: ScrolledUnder | null;
  /** The nearest content under the finger that has more to scroll, at its top or not. */
  scroller: HTMLElement | null;
  /** A touchmove has been seen: iOS settles the browser's scroll on the first. */
  touched: boolean;
};

/**
 * Is a touch on scrolled content the hand-off's, with the finger at `x`,
 * `y`? Null until a move says (sheetTakesScrolledTouch), then for good.
 * The first touchmove (`move`) always says, unless the stair held it,
 * when the slop does (moveUnder); a pointermove only once it is a few
 * pixels out. A first touchmove the browser will not let us hold (it is
 * scrolling already, as Chromium is just after its own fling) stays the
 * browser's: the two swipes of before the hand-off, and nothing jumps.
 */
function handOffTakes(d: Grip, x: number, y: number, move?: TouchEvent): boolean | null {
  const under = d.under;
  if (!under) return false;
  if (under.taken !== null || under.sideways) return under.taken;
  const said = sheetTakesScrolledTouch(x - d.x0, y - d.y0, d.sideways, move !== undefined);
  if (said === "undecided") return null;
  if (said === "sideways") {
    if (move) under.sideways = true;
    return null;
  }
  under.taken = said === "sheet" && (move?.cancelable ?? true);
  return under.taken;
}

/** A spring of ours is moving the panel (home, after a pull). The CSS rise is not one. */
function springing(el: HTMLElement): boolean {
  return el
    .getAnimations()
    .some((a) => a.playState === "running" && !(typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation));
}

/**
 * Content shown `px` past its top (down, positive) or its end (up,
 * negative): its children move inside the scroller, which clips them, so
 * the scroller and the sheet stay where they are (handoff review). The
 * `translate` property, so a child's own transform is left alone.
 */
function showEdge(content: HTMLElement, px: number) {
  const value = Math.abs(px) < 0.05 ? "" : `0 ${px}px`;
  for (const child of Array.from(content.children)) {
    if (child instanceof HTMLElement && child.style.translate !== value) child.style.translate = value;
  }
}

/** How fast a sheet's CSS rise is moving it right now, px/s (up is negative); null once it has landed. */
function riseVelocity(el: HTMLElement): number | null {
  const rise = el
    .getAnimations()
    .find(
      (a) =>
        typeof CSSAnimation !== "undefined" &&
        a instanceof CSSAnimation &&
        a.animationName === "sheet-in" &&
        a.playState === "running"
    );
  const ms = rise?.currentTime;
  if (typeof ms !== "number") return null;
  return springStateAt({ from: el.offsetHeight, to: 0, velocity: 0, spring: SPRING.sheet }, ms / 1000).velocity;
}

export function Overlay({
  label,
  onClose,
  onLeave,
  variant = "sheet",
  className = "",
  style,
  children,
}: {
  /** Names the dialog for screen readers. */
  label: string;
  onClose: () => void;
  /**
   * The moment the sheet starts to leave, by any way out (Escape, the
   * scrim, a drag, a button inside): before the exit plays, where
   * `onClose` comes after it. A request the sheet started is abandoned
   * here, so nothing it answers can act on a sheet already going.
   */
  onLeave?: () => void;
  /** `sheet` rises from the bottom edge; `full` owns the viewport. */
  variant?: "sheet" | "full";
  className?: string;
  /** For the one value a class can't carry: a duration from motion.ts. */
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  /*
   * The drag (DECISIONS #242, rebuilt on the apple-design skill). While
   * the pointer is down the panel tracks it exactly, and up past its
   * resting place it resists instead of stopping dead (§9). On release
   * it keeps the finger's speed (§5), and whether it goes or stays is
   * decided by where that speed would CARRY it (§6), so a short flick
   * dismisses and a long slow haul that stops short springs back.
   */
  const drag = useRef<Grip | null>(null);
  const letGoRef = useRef<(d: Grip) => void>(() => {});
  /*
   * Content a hand-off let go of while it still had scroll keeps the
   * finger's speed and decelerates as a UIScrollView does (glideStep),
   * frame by frame. Under Reduce Motion too: iOS keeps scroll momentum
   * there. A new press stops it where it is, and that press was the
   * glide's: as on a scroll view, it presses nothing under it.
   */
  const glide = useRef<number | null>(null);
  /** The content the glide is moving: only a press on it is the glide's. */
  const glideEl = useRef<HTMLElement | null>(null);
  /**
   * Content coming back from past an edge (edgeSpring): the bounce of a
   * glide that met the top or the end with speed, or content a finger let
   * go of past its end. Not the glide's: a press does not stop it (it is
   * over in half a second), and it moves the content only.
   */
  const edge = useRef<{ raf: number; content: HTMLElement; side: 1 | -1; offset: number } | null>(null);
  const stopEdge = useCallback(() => {
    if (edge.current) cancelAnimationFrame(edge.current.raf);
    edge.current = null;
  }, []);
  const pressStoppedGlide = useRef(false);
  const stopGlide = useCallback((): boolean => {
    glideEl.current = null;
    if (glide.current === null) return false;
    cancelAnimationFrame(glide.current);
    glide.current = null;
    return true;
  }, []);
  /**
   * A press caught the sheet springing home and holds it where it was
   * (handoff review), until the press drags it or lets go of it.
   */
  const caught = useRef(false);
  useEffect(
    () => () => {
      stopGlide();
      stopEdge();
    },
    [stopGlide, stopEdge]
  );
  /** A press that began on the scrim itself, so only a tap there closes:
   *  a drag that starts in the sheet and ends over the scrim is a drag. */
  const downOnScrim = useRef(false);
  const [dragging, setDragging] = useState(false);
  /*
   * Once a finger has held the sheet, its rise is over for good. The rise
   * is CSS (`sheet-in`), which a drag turns off; turned back on at the
   * release, it started again from off screen and the sheet blinked out
   * for a frame before the spring home covered it (notes1, round 2).
   */
  const [held, setHeld] = useState(false);
  // The latest handler, read at close time: the parent passes a fresh
  // arrow every render, and re-running the setup effect for each one
  // re-focused the panel mid-form.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const leaving = useRef(false);
  const closed = useRef(false);

  /**
   * Said once, as the exit starts. The exit has the sheet from here: a
   * finger still on it (Escape pressed mid-pull) lets go of nothing, and
   * its release no longer cut the exit short (handoff review).
   */
  const startLeaving = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    drag.current = null;
    caught.current = false;
    stopGlide();
    setDragging(false);
    leaveRef.current?.();
  }, [stopGlide]);

  const finish = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    startLeaving();
    closeRef.current();
  }, [startLeaving]);

  /**
   * Where the panel is ON SCREEN right now, mid-animation or not, and
   * stop whatever was moving it. Every motion starts from here, so a
   * sheet closed while it is still rising turns round where it is
   * instead of jumping to the top first (§3).
   */
  const takeHold = useCallback((): number => {
    const el = panel.current;
    if (!el) return 0;
    const y = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 || 0;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transform = `translateY(${y}px)`;
    return y;
  }, []);

  /**
   * Out the bottom from wherever it is, at `velocity` px/s: a finger's,
   * when a drag threw it. Without one it keeps the speed it already had
   * (#388): closed while it is still rising, it carries on up for a
   * moment and turns, the way a grabbed spring does, instead of stopping
   * dead. The rise is CSS (`sheet-in`, SPRING.sheet from the panel's
   * height to 0), so its speed is read off that curve before takeHold
   * stops it; any other run of ours is inherited by animateSpring.
   */
  const leave = useCallback(
    (velocity?: number) => {
      const el = panel.current;
      startLeaving();
      setClosing(true);
      if (!el || prefersReducedMotion()) return; // the CSS fade handles it
      const rising = velocity === undefined ? riseVelocity(el) : null;
      const from = takeHold();
      void animateSpring(el, {
        from,
        to: el.offsetHeight + 24,
        velocity: velocity ?? rising ?? undefined,
        spring: SPRING.base,
      }).then(finish);
    },
    [takeHold, finish, startLeaving]
  );

  const requestClose = useCallback(() => {
    if (variant !== "sheet") {
      finish();
      return;
    }
    if (closing) return;
    leave();
  }, [variant, finish, closing, leave]);

  // The floor under the exit, for the one browser whose animation
  // promise never settles.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(finish, springMs(SPRING.base) + 150);
    return () => clearTimeout(t);
  }, [closing, finish]);

  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  // Once per sheet: into the stack, the page's scroll locked, focus in;
  // and out of all three when it goes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const me = {};
    openSheets.push(me);
    // Up over the page, so what moves for its own sake under it rests.
    const closeLayer = panel.current ? openLayer(panel.current) : () => {};

    function onKey(e: KeyboardEvent) {
      // A sheet under another one leaves the key to the top one.
      if (openSheets[openSheets.length - 1] !== me) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        requestCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        panel.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Focus that fell out of the sheet (a control that went disabled
      // or unmounted under it lands on <body>) comes back in, rather
      // than walking on to the page behind a modal.
      if (!active || !panel.current.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);

    // Focus the panel itself rather than its first control: a sheet that
    // opens with the paywall's "Start at A$12.99" already focused is one
    // stray Enter away from a purchase nobody asked for.
    // The panel is a container, never a control: no ring (`outline-none!`
    // beats the global :focus-visible, which a sheet opened without a
    // tap, like the monthly price drop, would otherwise draw on its edge).
    panel.current?.focus();

    if (locks++ === 0) {
      unlockedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKey, true);
      closeLayer();
      const at = openSheets.indexOf(me);
      if (at >= 0) openSheets.splice(at, 1);
      if (--locks <= 0) {
        locks = 0;
        document.body.style.overflow = unlockedOverflow;
      }
      opener?.focus?.();
    };
  }, []);

  /*
   * The browser's pan, refused while the finger could be the sheet's
   * (notes1). A touch the page does not refuse becomes the browser's
   * scroll the moment it moves, and the browser says so with
   * pointercancel: the drag below died ten pixels in, from every part of
   * the paywall, at every scroll, because each of them sits in (or over)
   * something the browser could pan. So from the first touchmove, at any
   * distance (iOS settles a scroll on that first one), a move with a
   * downward lean, at any angle, is cancelled before a pan can start
   * (sheetHoldsTouch; a sideways lean is only the stair's to keep);
   * whose the finger is stays the pointer's call, at the slop. React's
   * onTouchMove is passive and cannot cancel anything, so this is the
   * DOM's own listener.
   *
   * A touch that started in scrolled content is asked once, on that
   * same first move (handoff): up, it is the browser's scroll for good,
   * momentum and all; down, level or still, it is the hand-off's and
   * every move of it is held from the browser. The pointer may have
   * asked first (a pointermove comes before its touchmove), once it is a
   * few pixels out. A first move the stair held (sideways on its slider)
   * waits for the slop, held here unless it leans sideways.
   *
   * Content at its top with more below is asked the same on that first
   * move (sheetTakesTopTouch): down is the sheet's own drag and up the
   * browser's scroll, as before, but a level or still reading, which iOS
   * would make the browser's scroll for the whole touch (only a rubber
   * band at the top), is the hand-off's from scroll 0, as is a first move
   * the stair held, which has turned the browser's scroll off already.
   *
   * A second finger on a sheet the first is moving changes nothing: no
   * pinch or pan starts under the first (handoff review).
   */
  useEffect(() => {
    const el = panel.current;
    if (!el || variant !== "sheet") return;
    function onTouchMove(e: TouchEvent) {
      const d = drag.current;
      if (!d) return;
      if (e.touches.length !== 1) {
        if (d.active && e.cancelable) e.preventDefault();
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - d.x0;
      const dy = t.clientY - d.y0;
      if (d.under) {
        const taken = handOffTakes(d, t.clientX, t.clientY, e);
        // Not the hand-off's, or the browser is scrolling it already and
        // will not let go: the browser's scroll, and nobody's drag.
        if (taken === false || (!e.cancelable && !d.active)) {
          letGoRef.current(d);
          return;
        }
        if (taken === null && Math.abs(dx) > Math.abs(dy)) return;
      } else if (!d.active) {
        const first = !d.touched;
        d.touched = true;
        // Content at its top with more below, read level or still, or
        // held by the stair: the hand-off's from scroll 0 (handoff review).
        const top = first && d.scroller ? sheetTakesTopTouch(dx, dy, d.sideways) : null;
        if (d.scroller && (top === "sideways" || (top === "sheet" && e.cancelable))) {
          d.under = {
            el: d.scroller,
            taken: top === "sheet" ? true : null,
            sideways: top === "sideways",
            at: { scroll: d.scroller.scrollTop, sheet: 0 },
            lastY: d.y0,
          };
          if (top === "sideways") return;
        } else if (!sheetHoldsTouch(dx, dy, d.scrolls, d.sideways)) {
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [variant]);

  /**
   * A press stops a glide where it is, the way a grabbed spring stops
   * (#388). On the gliding content it is the glide's: as on a scroll
   * view, the control under it never hears the press (it stops here, on
   * the way down) and the click that follows is swallowed, while the
   * sheet still hears it, so the same finger can go on to scroll or pull.
   * Anywhere else (Start, Not yet, the grabber) it is an ordinary press:
   * UIKit leaves a press outside a decelerating scroll view alone, and
   * swallowing it made the paywall's two buttons need a second tap for a
   * second after every flick (handoff review).
   */
  function onPointerDownCapture(e: React.PointerEvent<HTMLDivElement>) {
    const content = glideEl.current;
    pressStoppedGlide.current = false;
    if (!stopGlide() || !content || !content.contains(e.target as Node)) return;
    pressStoppedGlide.current = true;
    e.stopPropagation();
    onPointerDown(e);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!sheet || closing || leaving.current) return;
    const el = panel.current;
    if (!el) return;
    // A second finger while the first has the sheet is nobody's: the
    // first keeps it, as a UIKit pan keeps its first touch. Taking the
    // grip over stranded the sheet mid-pull, still marked as dragged
    // (handoff review).
    const holding = drag.current;
    if (holding && holding.id !== e.pointerId && holding.active) return;
    // A pointer that started on a field is that field's, not the
    // sheet's: a drag must not swallow a caret placed in the invite code.
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    /*
     * The panel itself rarely scrolls — the paywall puts its own
     * `overflow-y-auto` on the card inside it — so the check walks from
     * whatever was touched up to the panel looking for anything already
     * scrolled. Dragging a sheet whose content is scrolled down is how
     * you close a sheet you were trying to read, so a mouse or a pen
     * there is the content's (a selection, the wheel), and a finger is
     * the hand-off's unless it starts up: the content back to its top
     * first, and the sheet after (handoff). The nearest scrolled content
     * is the one the finger scrolls.
     *
     * The same walk asks whether anything there owns sideways moves: a
     * control that takes them for itself (`touch-action: pan-y` or
     * `none`, the stair) or a row that scrolls sideways. Only there does
     * a sideways move mean something other than the sheet (notes1,
     * round 3); everywhere else a swipe down is the sheet's at any angle.
     */
    let scrolls = false;
    let sideways = false;
    let scrolled: HTMLElement | null = null;
    let scroller: HTMLElement | null = null;
    for (
      let node: HTMLElement | null = e.target as HTMLElement;
      node && node !== el.parentElement;
      node = node.parentElement
    ) {
      if (node.scrollTop > 0 && !scrolled) {
        if (e.pointerType !== "touch") return;
        scrolled = node;
      }
      const style = getComputedStyle(node);
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(style.overflowY)) {
        scrolls = true;
        scroller ??= node;
      }
      if (
        (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) ||
        ownsSideways(style.touchAction)
      ) {
        sideways = true;
      }
    }
    // A finger on a sheet still springing home catches it where it is
    // (§3), so a tap lands on what is under the finger and not on what
    // the sheet carries there by the lift: a tap on Start 120ms after a
    // spring home pressed Not yet (handoff review). A touch only: its
    // pointer stays with the panel to its lift, which lets go of it.
    if (e.pointerType === "touch" && springing(el)) {
      takeHold();
      caught.current = true;
    }
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      from: e.clientY,
      y: 0,
      samples: [{ t: e.timeStamp, y: 0 }],
      scrolls,
      sideways,
      yNow: e.clientY,
      held: 0,
      active: false,
      under: scrolled
        ? { el: scrolled, taken: null, sideways: false, at: { scroll: scrolled.scrollTop, sheet: 0 }, lastY: e.clientY }
        : null,
      scroller: e.pointerType === "touch" ? scroller : null,
      touched: false,
    };
  }

  /**
   * The grip is nobody's now: the browser scrolls, the stair scrubs, or
   * the press was a tap. A sheet the press caught springing home goes
   * home from where it holds it.
   */
  function letGo(d: Grip) {
    if (drag.current === d) drag.current = null;
    const el = panel.current;
    if (!caught.current || !el) return;
    caught.current = false;
    if (!leaving.current) home(el, takeHold(), 0);
  }
  // The touchmove listener is set up once; it lets go through this.
  letGoRef.current = letGo;

  /**
   * The finger has the sheet, past the slop: held where it IS (grabbed
   * mid-flight, it tracks from there with the offset the finger took it
   * at, §2, §3), its rise spent, and the pointer captured.
   */
  function grab(d: Grip, e: React.PointerEvent<HTMLDivElement>, el: HTMLDivElement) {
    d.active = true;
    caught.current = false;
    // A mouse drag has been selecting text for its first ten pixels;
    // left selected, the next press drags the selection instead.
    window.getSelection()?.removeAllRanges();
    d.y = takeHold();
    // The throw is measured from here, where the sheet starts to
    // follow: the press's own sample, from before the slop, made a short
    // flick off the tap shelf read as half standing still.
    d.samples = [{ t: e.timeStamp, y: d.y }];
    d.held = d.y;
    d.from = e.clientY - d.y;
    setDragging(true);
    setHeld(true);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the drag works without it.
    }
  }

  /**
   * A finger on content already scrolled (handoff). Past the slop it
   * moves the content toward its top 1:1, from where the slop was
   * crossed, and what is left of the move moves the sheet: finger travel
   * is scroll travelled plus sheet offset at every move (handOff). Back
   * up, the sheet comes to rest first and the content scrolls again. The
   * samples follow the finger across both, so a release carries its speed
   * into whichever it lets go of. Caught off its rest (still rising, or
   * springing home), the sheet is the finger's from where it is, and the
   * content stays put (handOffFrom).
   */
  function moveUnder(d: Grip, under: ScrolledUnder, e: React.PointerEvent<HTMLDivElement>, el: HTMLDivElement) {
    if (handOffTakes(d, e.clientX, e.clientY) === false) {
      letGo(d);
      return;
    }
    const content = under.el;
    if (!d.active) {
      // Up or down both drive the content now that the browser's scroll
      // is refused; only sideways on the stair is the stair's.
      const claim = sheetClaim(e.clientX - d.x0, e.clientY - d.y0, false, SHEET_SLOP_PX, d.sideways);
      if (claim === "undecided") return;
      if (claim === "content") {
        letGo(d);
        return;
      }
      under.taken = true;
      grab(d, e, el);
      const start = handOffFrom(content.scrollTop, d.y);
      if (!start) {
        d.under = null;
        return;
      }
      // Content still coming back from past its end is the finger's from
      // where it shows, so the grab moves nothing.
      const back = edge.current;
      if (back && back.content === content && back.side === -1) {
        stopEdge();
        start.past = pastFromEdge(back.offset, content.clientHeight);
      }
      under.at = start;
      under.lastY = e.clientY;
      d.samples = [{ t: e.timeStamp, y: handOffLine(start) }];
      return;
    }
    const was = under.at.past ?? 0;
    under.at = handOff(under.at, e.clientY - under.lastY, content.scrollHeight - content.clientHeight);
    under.lastY = e.clientY;
    content.scrollTop = under.at.scroll;
    // Up past the content's end, it gives with resistance, as a scroll
    // view does, where it stopped dead (handoff review).
    const past = under.at.past ?? 0;
    if (past > 0 || was > 0) showEdge(content, -edgeFromPast(past, 0, content.clientHeight).offset);
    el.style.transform = `translateY(${under.at.sheet}px)`;
    d.samples.push({ t: e.timeStamp, y: handOffLine(under.at) });
    if (d.samples.length > 8) d.samples.shift();
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = panel.current;
    if (!d || d.id !== e.pointerId || !el) return;
    d.yNow = e.clientY;
    if (d.under) {
      moveUnder(d, d.under, e, el);
      return;
    }
    if (!d.active) {
      // Hysteresis (§10): ten pixels of intent before the sheet is
      // yours, so a tap stays a tap. Upward is the sheet's too (it
      // gives and pulls back) unless there is content to scroll, and
      // sideways is the sheet's only where nothing owns it (the stair's
      // scrub does).
      const claim = sheetClaim(e.clientX - d.x0, e.clientY - d.y0, d.scrolls, SHEET_SLOP_PX, d.sideways);
      if (claim === "undecided") return;
      if (claim === "content") {
        letGo(d);
        return;
      }
      grab(d, e, el);
      return;
    }
    const dy = e.clientY - d.from;
    // Down is 1:1. Up is past where a sheet lives, so it gives a
    // little and pulls back, the way a real thing at its limit does.
    d.y = dy >= 0 ? dy : rubberband(dy, el.offsetHeight);
    d.samples.push({ t: e.timeStamp, y: d.y });
    if (d.samples.length > 8) d.samples.shift();
    el.style.transform = `translateY(${d.y}px)`;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.active) {
      letGo(d);
      return;
    }
    drag.current = null;
    const el = panel.current;
    if (!el) return;
    setDragging(false);
    // Read at the lift: a finger that stopped and held still before it
    // let go throws nothing (handoff review: a pull held 400ms closed the
    // paywall, and content held still glided on to its top).
    const velocity = releaseVelocity(d.samples, e.timeStamp);
    if (d.under) {
      letGoUnder(d.under, velocity, d.yNow, el);
      return;
    }
    // Where the throw would come to rest: past half the panel, it goes.
    // So does a finger that ran most of the way to the screen's edge from
    // where it went down (the tap shelf, where a thumb rests); a clear
    // upward flick keeps it whatever the position.
    if (
      sheetDismisses({
        travel: d.y - d.held,
        from: d.held,
        velocity,
        height: el.offsetHeight,
        room: Math.max(0, window.innerHeight - d.y0),
        run: d.yNow - d.y0,
      })
    ) {
      leave(velocity);
      return;
    }
    home(el, d.y, velocity);
  }

  /** Home, carrying the finger's speed. A real throw earns the small
   *  overshoot; a slow release settles without one. */
  function home(el: HTMLDivElement, from: number, velocity: number) {
    void animateSpring(el, {
      from,
      to: 0,
      velocity,
      spring: Math.abs(velocity) > 600 ? SPRING.thrown : SPRING.sheet,
      reduced: prefersReducedMotion(),
    }).then((landed) => {
      // Caught on its way by a finger, the sheet and its transform are
      // that finger's: wiped here, the sheet flashed to its rest for a
      // few frames under the grab (handoff review).
      if (landed && panel.current) panel.current.style.transform = "";
    });
  }

  /**
   * A hand-off let go. The sheet moved: the sheet's own rules, counted
   * from where it started to move (handOffEnd), close it or spring it
   * home. It never moved: the content glides on at the finger's speed.
   */
  function letGoUnder(under: ScrolledUnder, velocity: number, fingerY: number, el: HTMLDivElement) {
    const end = handOffEnd({ at: under.at, velocity, height: el.offsetHeight, screen: window.innerHeight, fingerY });
    if (end === "back") {
      const from = edgeFromPast(under.at.past ?? 0, velocity, under.el.clientHeight);
      settleEdge(under.el, -1, from.offset, from.velocity, performance.now());
      return;
    }
    if (end === "close") {
      leave(velocity);
      return;
    }
    if (end === "home") {
      home(el, under.at.sheet, velocity);
      return;
    }
    el.style.transform = "";
    startGlide(under.el, under.at.scroll, -velocity);
  }

  /** The content on at `velocity` px/s along its scrollTop, slowing as a UIScrollView does, until it rests or meets an end. */
  function startGlide(content: HTMLElement, from: number, velocity: number) {
    stopGlide();
    let at = { scroll: from, velocity };
    let wrote = content.scrollTop;
    let last = performance.now();
    const frame = (now: number) => {
      // Moved by anything else (the wheel, the keyboard, a scrollTo):
      // that motion wins, from where it put the content.
      if (!content.isConnected || Math.abs(content.scrollTop - wrote) > 1) {
        stopGlide();
        return;
      }
      const next = glideStep(at, Math.max(0, now - last), content.scrollHeight - content.clientHeight);
      last = now;
      at = next;
      content.scrollTop = next.scroll;
      wrote = content.scrollTop;
      if (!next.done) {
        glide.current = requestAnimationFrame(frame);
        return;
      }
      stopGlide();
      // Met the top or the end with speed: on past it and back, from the
      // instant it got there (handoff review: it stopped dead in a frame).
      const impact = next.impact ?? 0;
      if (Math.abs(impact) >= MOMENTUM_REST_PX_S) {
        settleEdge(content, impact < 0 ? 1 : -1, 0, Math.abs(impact), now - (next.overMs ?? 0));
      }
    };
    glideEl.current = content;
    glide.current = requestAnimationFrame(frame);
  }

  /**
   * The content on its way back from past an edge (`side` 1 its top, -1
   * its end), `offset` px past it at `velocity` px/s further out, on the
   * clock from `t0`: shown at once, then every frame until it rests.
   */
  function settleEdge(content: HTMLElement, side: 1 | -1, offset: number, velocity: number, t0: number) {
    stopEdge();
    const frame = (now: number) => {
      if (!content.isConnected) {
        edge.current = null;
        return;
      }
      const at = edgeSpring(offset, velocity, now - t0);
      showEdge(content, side * at.offset);
      edge.current = at.done ? null : { raf: requestAnimationFrame(frame), content, side, offset: at.offset };
    };
    frame(performance.now());
  }

  const sheet = variant === "sheet";
  const position = sheet
    ? "sheet-scrim flex items-end justify-center"
    : "flex flex-col items-center justify-center";

  return (
    <div
      className={`fixed inset-0 z-50 ${position}`}
      data-closing={closing || undefined}
      onPointerDown={(e) => {
        downOnScrim.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnScrim.current) requestClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={panel}
        tabIndex={-1}
        style={style}
        data-closing={closing || undefined}
        data-dragging={dragging || undefined}
        data-held={held || undefined}
        onClick={(e) => e.stopPropagation()}
        onClickCapture={(e) => {
          // The press that stopped a glide presses nothing (a keyboard's
          // click has no detail, and always goes through).
          if (!pressStoppedGlide.current || e.detail === 0) return;
          pressStoppedGlide.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDownCapture={onPointerDownCapture}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onAnimationEnd={(e) => {
          // Only the reduced-motion fade ends this way; the spring
          // resolves its own promise.
          if (closing && e.target === panel.current && prefersReducedMotion()) finish();
        }}
        className={`outline-none! ${sheet ? "sheet-panel" : "arrive"} ${className}`}
      >
        <CloseContext.Provider value={requestClose}>{children}</CloseContext.Provider>
      </div>
    </div>
  );
}
