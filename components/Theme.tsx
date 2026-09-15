"use client";

import { useEffect } from "react";
import { readPrefs, type Theme } from "@/lib/prefs";

/**
 * Applies the stored theme to <html> before paint.
 *
 * The inline script in the layout does the real work — it runs before
 * React hydrates, which is what stops a cream flash on a dark load.
 * This component only keeps the attribute in step after a change.
 *
 * Two values, not three (#284). The OS used to get a vote through a
 * "System" setting that was also the default, so most people never saw
 * the room the app was designed in. Light is the room; dark is a switch
 * you throw on this device.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#1a1410" : "#f5ead8");
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
    // Motion still follows the OS, and following it means following it
    // when it changes. Colour does not: that answer is ours.
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => applyMotion(readPrefs().reducedMotion);
    motion.addEventListener("change", onMotion);
    return () => motion.removeEventListener("change", onMotion);
  }, []);
  return null;
}

/**
 * Runs before hydration. Kept deliberately tiny and dependency-free —
 * it's inlined into the document head.
 */
export const themeBootScript = `
(function(){try{
  var p = JSON.parse(localStorage.getItem('ethos.prefs')||'{}');
  // Light unless this device chose dark. A stored 'system' from before
  // #284 reads as light, which is what that setting meant on most of
  // the phones that carried it and what the app is designed to be.
  var t = p.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  // Motion answers before paint too, or the first sheet slides for
  // someone who asked it not to.
  var r = !!p.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.setAttribute('data-motion', r ? 'reduce' : 'full');
  // The browser chrome is part of the room. Setting it here rather than
  // after hydration is the difference between a dark app under a cream
  // status bar for one frame and never seeing it at all.
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#1a1410' : '#f5ead8');
}catch(e){}})();
`;
