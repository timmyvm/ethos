"use client";

import { useEffect } from "react";
import { readPrefs, type Theme } from "@/lib/prefs";

/**
 * Applies the stored theme to <html> before paint.
 *
 * The inline script in the layout does the real work — it runs before
 * React hydrates, which is what stops a light flash on a dark-mode load.
 * This component only keeps the attribute in step after a change.
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
    ?.setAttribute("content", resolved === "dark" ? "#211a13" : "#f5ead8");
}

export function ThemeSync() {
  useEffect(() => {
    const prefs = readPrefs();
    applyTheme(prefs.theme);
    if (prefs.theme !== "system") return;
    // Following the OS means following it when it changes, too.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
  var t = p.theme || 'system';
  if (t === 'system') {
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
  // The browser chrome is part of the room. Setting it here rather than
  // after hydration is the difference between a dark app under a cream
  // status bar for one frame and never seeing it at all.
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#211a13' : '#f5ead8');
}catch(e){}})();
`;
