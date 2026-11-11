"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAppleKeyboard, isTyping, modOnly, shortcutLabel } from "@/lib/keys";
import { DURATION } from "@/lib/motion";

/** How long the offer stands: long enough to read and reach, short enough to be gone. */
export const UNDO_MS = 6000;
/** What is left when a finger or a focus lets go of it, at least. */
export const UNDO_MIN_LEFT_MS = 2000;

/**
 * The undo toast (#435). A reversible action happens at once, with no
 * "are you sure", and for a few seconds the screen offers to take it
 * back: one line saying what happened and one Undo, floating over the
 * tab bar. It leaves by itself. While a pointer rests on it or the
 * keyboard is in it, it waits; ⌘Z (Ctrl Z) undoes from anywhere on the
 * page that is not a field.
 *
 * A status, not an alert: it says what was done, politely, and never
 * takes focus. The caller keys it by the action, so a second action
 * replaces the first's offer rather than stacking a second toast.
 */
export function UndoToast({
  message,
  onUndo,
  onDone,
  ms = UNDO_MS,
}: {
  message: string;
  onUndo: () => void;
  /** The offer has lapsed (or was taken): the caller forgets it. */
  onDone: () => void;
  ms?: number;
}) {
  const [leaving, setLeaving] = useState(false);
  const [apple, setApple] = useState<boolean | null>(null);
  const left = useRef(ms);
  const since = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone);
  const undo = useRef(onUndo);
  // The caller's newest handlers, kept in step after every render.
  useEffect(() => {
    done.current = onDone;
    undo.current = onUndo;
  });

  const leave = useCallback(() => {
    setLeaving(true);
    timer.current = setTimeout(() => done.current(), DURATION.base);
  }, []);

  const run = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    since.current = Date.now();
    timer.current = setTimeout(leave, left.current);
  }, [leave]);

  const hold = useCallback(() => {
    if (leaving) return;
    if (timer.current) clearTimeout(timer.current);
    left.current = Math.max(UNDO_MIN_LEFT_MS, left.current - (Date.now() - since.current));
  }, [leaving]);

  useEffect(() => {
    setApple(isAppleKeyboard());
    run();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  useEffect(() => {
    if (apple === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || !modOnly(e, apple) || isTyping(e.target)) return;
      e.preventDefault();
      undo.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apple]);

  return (
    <div className="toast-dock">
      <div
        role="status"
        className="toast"
        data-leaving={leaving || undefined}
        onPointerEnter={hold}
        onPointerLeave={() => !leaving && run()}
        onFocus={hold}
        onBlur={() => !leaving && run()}
      >
        <span className="toast-text">{message}</span>
        <button type="button" className="toast-action press" onClick={() => undo.current()}>
          Undo
          {apple !== null && (
            <kbd aria-hidden className="toast-key">
              {shortcutLabel("Z", apple)}
            </kbd>
          )}
        </button>
      </div>
    </div>
  );
}
