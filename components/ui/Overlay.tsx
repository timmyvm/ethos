"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { openLayer } from "@/lib/overlay-layers";
import { prefersReducedMotion } from "@/lib/prefs";
import { SHEET_LEAN_PX, SHEET_SLOP_PX, sheetClaim } from "@/lib/sheet-gesture";
import {
  SPRING,
  animateSpring,
  project,
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
  const drag = useRef<{
    id: number;
    /** Where the finger went down, for which way it is going. */
    x0: number;
    y0: number;
    from: number;
    y: number;
    samples: { t: number; y: number }[];
    /** Something under the finger scrolls: an upward move is its. */
    scrolls: boolean;
    /** Past the hysteresis. A ref, not the state: pointer events land
     *  faster than React re-renders, and a flick is over before the
     *  state would say it began. */
    active: boolean;
  } | null>(null);
  /** A press that began on the scrim itself, so only a tap there closes:
   *  a drag that starts in the sheet and ends over the scrim is a drag. */
  const downOnScrim = useRef(false);
  const [dragging, setDragging] = useState(false);
  // The latest handler, read at close time: the parent passes a fresh
  // arrow every render, and re-running the setup effect for each one
  // re-focused the panel mid-form.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const leaving = useRef(false);
  const closed = useRef(false);

  /** Said once, as the exit starts. */
  const startLeaving = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    leaveRef.current?.();
  }, []);

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
   * The browser's pan, refused while the finger is the sheet's (notes1).
   * A touch the page does not refuse becomes the browser's scroll the
   * moment it moves, and the browser says so with pointercancel: the
   * drag below died ten pixels in, from every part of the paywall, at
   * every scroll, because each of them sits in (or over) something the
   * browser could pan. So a touchmove that the sheet claims, by the same
   * rule the pointer uses (lib/sheet-gesture.ts) but sooner, is
   * cancelled before a pan can start. React's onTouchMove is passive and
   * cannot cancel anything, so this is the DOM's own listener. A touch
   * that started in scrolled content never has a drag here, and scrolls.
   */
  useEffect(() => {
    const el = panel.current;
    if (!el || variant !== "sheet") return;
    function onTouchMove(e: TouchEvent) {
      const d = drag.current;
      if (!d || e.touches.length !== 1) return;
      if (!d.active) {
        const t = e.touches[0];
        const claim = sheetClaim(t.clientX - d.x0, t.clientY - d.y0, d.scrolls, SHEET_LEAN_PX);
        if (claim === "undecided") return;
        if (claim === "content") {
          drag.current = null;
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

  /** Only from the top of the panel's own scroll, or a long list can
   *  never be scrolled up. */
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!sheet || closing) return;
    const el = panel.current;
    if (!el) return;
    // A pointer that started on a field is that field's, not the
    // sheet's: a drag must not swallow a caret placed in the invite code.
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    /*
     * The panel itself rarely scrolls — the paywall puts its own
     * `overflow-y-auto` on the card inside it — so the check walks from
     * whatever was touched up to the panel looking for anything already
     * scrolled. Dragging a sheet whose content is scrolled down is how
     * you close a sheet you were trying to read.
     */
    let scrolls = false;
    for (
      let node: HTMLElement | null = e.target as HTMLElement;
      node && node !== el.parentElement;
      node = node.parentElement
    ) {
      if (node.scrollTop > 0) return;
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) {
        scrolls = true;
      }
    }
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      from: e.clientY,
      y: 0,
      samples: [{ t: e.timeStamp, y: 0 }],
      scrolls,
      active: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = panel.current;
    if (!d || d.id !== e.pointerId || !el) return;
    if (!d.active) {
      // Hysteresis (§10): ten pixels of intent before the sheet is
      // yours, so a tap stays a tap. Upward is the sheet's too (it
      // gives and pulls back) unless there is content to scroll, and
      // sideways is never the sheet's (the stair's scrub).
      const claim = sheetClaim(e.clientX - d.x0, e.clientY - d.y0, d.scrolls, SHEET_SLOP_PX);
      if (claim === "undecided") return;
      if (claim === "content") {
        drag.current = null;
        return;
      }
      d.active = true;
      // A mouse drag has been selecting text for its first ten pixels;
      // left selected, the next press drags the selection instead.
      window.getSelection()?.removeAllRanges();
      // Grabbed mid-flight, it is held where it IS, and tracks from
      // there with the offset the finger took it at (§2, §3).
      d.y = takeHold();
      d.from = e.clientY - d.y;
      setDragging(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks; the drag works without it.
      }
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
    drag.current = null;
    const el = panel.current;
    if (!d.active || !el) return;
    setDragging(false);
    const velocity = releaseVelocity(d.samples);
    // Where the throw would come to rest. Past half the panel, it goes;
    // and a clear upward flick keeps it whatever the position.
    const rest = d.y + project(velocity);
    if (velocity > -300 && rest > el.offsetHeight * 0.5) {
      leave(velocity);
      return;
    }
    // Home, carrying the finger's speed. A real throw earns the small
    // overshoot; a slow release settles without one.
    void animateSpring(el, {
      from: d.y,
      to: 0,
      velocity,
      spring: Math.abs(velocity) > 600 ? SPRING.thrown : SPRING.sheet,
      reduced: prefersReducedMotion(),
    }).then(() => {
      if (panel.current) panel.current.style.transform = "";
    });
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
        onClick={(e) => e.stopPropagation()}
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
