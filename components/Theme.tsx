"use client";

import { useEffect } from "react";
import { readPrefs, type Theme } from "@/lib/prefs";

/**
 * Applies the stored theme to <html> before paint.
 *
 * The inline script in the layout does the real work — it runs before
 * React hydrates, which is what stops a light flash on a dark-mode load.
 * This component only keeps the attribute in step after a change. That
 * script is lib/theme-boot.ts, not this file: this module is "use
 * client", and the layout must import the string, not a client reference.
 *
 * Three values again (#286). `system` is the default and resolves here,
 * so the rest of the app only ever sees `light` or `dark` on the
 * attribute; nothing downstream has to know the setting had a third
 * value.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.setAttribute("data-theme", resolved);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#121212" : "#ffffff");
}

/**
 * The one answer to "less movement?", stamped on <html> as
 * `data-motion` so CSS can read it (DECISIONS #221). The OS preference
 * and the switch in Settings both say yes; the media-query rules the
 * stylesheet used to carry could only hear the first.
 */
export function applyMotion(reduced: boolean): void {
  if (typeof document === "undefined") return;
  const os = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.setAttribute(
    "data-motion",
    reduced || os ? "reduce" : "full"
  );
}

export function ThemeSync() {
  useEffect(() => {
    const prefs = readPrefs();
    applyTheme(prefs.theme);
    applyMotion(prefs.reducedMotion);
    // Following the OS means following it when it changes, too. Both
    // questions are the OS's to answer again mid-session: a phone that
    // flips to dark at sunset is answering the colour one.
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => applyMotion(readPrefs().reducedMotion);
    motion.addEventListener("change", onMotion);
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => {
      if (readPrefs().theme === "system") applyTheme("system");
    };
    theme.addEventListener("change", onTheme);
    return () => {
      motion.removeEventListener("change", onMotion);
      theme.removeEventListener("change", onTheme);
    };
  }, []);
  return null;
}
