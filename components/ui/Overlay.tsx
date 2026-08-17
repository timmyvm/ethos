"use client";

import { useEffect, useRef } from "react";

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
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Overlay({
  label,
  onClose,
  variant = "sheet",
  className = "",
  children,
}: {
  /** Names the dialog for screen readers. */
  label: string;
  onClose: () => void;
  /** `sheet` rises from the bottom edge; `full` owns the viewport. */
  variant?: "sheet" | "full";
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
  }, [onClose]);

  const position =
    variant === "sheet"
      ? "flex items-end justify-center bg-stone-900/45"
      : "flex flex-col items-center justify-center";

  return (
    <div
      className={`fixed inset-0 z-50 ${position}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
