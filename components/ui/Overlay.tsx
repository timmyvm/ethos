"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION } from "@/lib/motion";

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
   * The drag (DECISIONS #242). A sheet you can pull down is the
   * difference between a thing that appeared on your screen and a thing
   * you are holding: while the pointer is down the panel tracks it
   * exactly, with no easing, because a panel that lags your thumb is a
   * panel you are not dragging.
   */
  const drag = useRef<{ id: number; from: number; at: number; y: number } | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
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

  const requestClose = useCallback(() => {
    if (variant !== "sheet") {
      finish();
      return;
    }
    setClosing(true);
  }, [variant, finish]);

  // The exit's end is the animation's end; the timer is the floor under
  // it, for the one browser that never fires the event.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(finish, DURATION.base + 80);
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
    for (
      let node: HTMLElement | null = e.target as HTMLElement;
      node && node !== el.parentElement;
      node = node.parentElement
    ) {
      if (node.scrollTop > 0) return;
    }
    drag.current = { id: e.pointerId, from: e.clientY, at: Date.now(), y: 0 };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.from;
    // Down only. Up is where the sheet already is.
    if (dy <= 0 && d.y === 0) return;
    d.y = Math.max(0, dy);
    if (!dragging && d.y > 4) {
      setDragging(true);
      panel.current?.setPointerCapture(e.pointerId);
    }
    if (panel.current) {
      panel.current.style.transform = `translateY(${d.y}px)`;
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const el = panel.current;
    const travelled = d.y;
    const speed = travelled / Math.max(1, Date.now() - d.at);
    setDragging(false);
    if (!el) return;
    // A flick counts as much as a haul: past a fifth of the panel, or
    // faster than half a pixel a millisecond, and it goes.
    if (travelled > el.offsetHeight * 0.2 || speed > 0.5) {
      el.style.transform = "";
      requestClose();
      return;
    }
    // Otherwise it springs home.
    setSettling(true);
    el.style.transform = "";
    setTimeout(() => setSettling(false), DURATION.base);
  }

  const sheet = variant === "sheet";
  const position = sheet
    ? "sheet-scrim flex items-end justify-center bg-stage/50 backdrop-blur-[2px]"
    : "flex flex-col items-center justify-center";

  return (
    <div
      className={`fixed inset-0 z-50 ${position}`}
      data-closing={closing || undefined}
      onClick={requestClose}
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
        data-settling={settling || undefined}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onAnimationEnd={(e) => {
          if (closing && e.target === panel.current) finish();
        }}
        className={`outline-none ${sheet ? "sheet-panel" : "arrive"} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
