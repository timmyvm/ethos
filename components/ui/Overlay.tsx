"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/prefs";
import {
  SPRING,
  animateSpring,
  project,
  releaseVelocity,
  rubberband,
  springMs,
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Overlay({
  label,
  onClose,
  variant = "sheet",
  className = "",
  style,
  children,
}: {
  /** Names the dialog for screen readers. */
  label: string;
  onClose: () => void;
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
  const closed = useRef(false);

  const finish = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    closeRef.current();
  }, []);

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

  /** Out the bottom from wherever it is, at `velocity` px/s. */
  const leave = useCallback(
    (velocity = 0) => {
      const el = panel.current;
      setClosing(true);
      if (!el || prefersReducedMotion()) return; // the CSS fade handles it
      const from = takeHold();
      void animateSpring(el, {
        from,
        to: el.offsetHeight + 24,
        velocity,
        spring: SPRING.base,
      }).then(finish);
    },
    [takeHold, finish]
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

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
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
    // opens with "Start with annual" already focused is one stray Enter
    // away from a purchase nobody asked for.
    panel.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [requestClose]);

  /** Only from the top of the panel's own scroll, or a long list can
   *  never be scrolled up. */
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!sheet || closing) return;
    const el = panel.current;
    if (!el) return;
    // A pointer that started on a control is that control's, not the
    // sheet's: a drag must not swallow the tap on "Start with annual".
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
    const raw = e.clientY - d.from;
    if (!d.active) {
      // Hysteresis (§10): ten pixels of intent before the sheet is
      // yours, so a tap stays a tap. Upward is the sheet's too (it
      // gives and pulls back) unless there is content to scroll.
      if (Math.abs(raw) < 10) return;
      if (raw < 0 && d.scrolls) {
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
        className={`outline-none ${sheet ? "sheet-panel" : "arrive"} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
