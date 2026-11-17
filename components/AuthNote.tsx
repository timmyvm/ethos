"use client";

import { useEffect, useState } from "react";
import { takeAuthNote } from "@/lib/auth-landing";
import { DURATION } from "@/lib/motion";

/** Long enough to read twice, short enough to be gone before the first tap. */
export const AUTH_NOTE_MS = 4000;

/**
 * What a sign-in did, said once on the page it landed on (#497): "Signed
 * in to your account.", "That email already has an account, so you're
 * signed in." or "Account created." (lib/auth-landing.ts). The undo
 * toast's ink capsule with no action, under the top edge, gone by
 * itself; a reload says nothing, since the note is taken as it is read.
 *
 * The polite status is in the page from the first paint and the line
 * arrives in it, so a screen reader says it.
 */
export function AuthNote() {
  const [note, setNote] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setNote(takeAuthNote());
  }, []);

  useEffect(() => {
    if (!note) return;
    const go = window.setTimeout(() => setLeaving(true), AUTH_NOTE_MS);
    const gone = window.setTimeout(() => setNote(null), AUTH_NOTE_MS + DURATION.base);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(gone);
    };
  }, [note]);

  return (
    <div className="toast-dock" data-at="top" role="status">
      {note && (
        <div className="toast" data-note="" data-leaving={leaving || undefined}>
          <span className="toast-text">{note}</span>
        </div>
      )}
    </div>
  );
}
