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
        onClick={(e) => e.stopPropagation()}
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
