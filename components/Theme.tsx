"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readPrefs, type Theme } from "@/lib/prefs";
import { applyGraphics, liteGraphics, markAlive, markGone } from "@/lib/graphics";

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
  // Lite graphics is the reduced-motion app too (#412).
  document.documentElement.setAttribute(
    "data-motion",
    reduced || os || liteGraphics() ? "reduce" : "full"
  );
}

export function ThemeSync() {
  const path = usePathname();
  // The mark names the screen it died on, so it follows the route.
  useEffect(() => {
    if (document.visibilityState === "visible") markAlive(path ?? location.pathname);
  }, [path]);
  useEffect(() => {
    const prefs = readPrefs();
    applyTheme(prefs.theme);
    applyGraphics(liteGraphics());
    applyMotion(prefs.reducedMotion);
    /* The alive mark (#412, lib/graphics.ts): up while a page is on
       screen, down the moment it hides or goes. A page the phone kills on
       screen (out of memory, its graphics lost) never takes it down, and
       the next open's boot script reads that as a crash and draws lite. */
    const onShow = () => {
      if (document.visibilityState === "visible") markAlive(location.pathname);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") markGone();
    };
    document.addEventListener("visibilitychange", onShow);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", markGone);
    window.addEventListener("pageshow", onShow);
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
      document.removeEventListener("visibilitychange", onShow);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", markGone);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
  return null;
}
