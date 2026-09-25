"use client";

import { useCallback, useEffect, useState } from "react";
import { GOOGLE_PENDING_MS, signInWithGoogle } from "@/lib/auth";

/**
 * The Google button's state, shared by /signup, /signin and the
 * introduction's account ask so there is one copy of it.
 *
 * A tap holds the button (no double tap mid-redirect), and ANY sign that
 * the person is back on this page without having finished gives it
 * back: the page restored from the back/forward cache (`pageshow` with
 * `persisted`), the tab or app shown again (`visibilitychange`), the
 * window refocused after an OAuth sheet is dismissed (`focus`), or, if
 * none of those ever fires, a bounded timeout. Before this, only an
 * error returned from the call released it, and a person who backed out
 * of Google came back to a dead button (Timothy's partner, 25 Sep).
 *
 * `pending` is the Google button's alone. It must never disable the
 * email form beside it: that was the second half of the same bug.
 */
export function useGoogleSignIn(mode: "signup" | "signin") {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const release = () => setPending(false);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) release();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") release();
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", release);
    const timer = window.setTimeout(release, GOOGLE_PENDING_MS);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", release);
      window.clearTimeout(timer);
    };
  }, [pending]);

  const start = useCallback(async () => {
    setError(null);
    setPending(true);
    const result = await signInWithGoogle(mode).catch(() => ({
      ok: false,
      error: undefined,
    }));
    // Success means the browser is leaving for Google; only a failure
    // lands back here with something to say.
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "Google didn't answer. Try again.");
    }
  }, [mode]);

  return { pending, error, start };
}
