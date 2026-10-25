/**
 * The theme's boot script: inlined into the document head by the root
 * layout, it runs before paint and before React hydrates, which is what
 * stops a light flash on a dark-mode load. `ThemeSync`
 * (components/Theme.tsx) keeps the attribute in step after that.
 *
 * It lives here, in a plain module, and NOT in components/Theme.tsx. That
 * file is "use client", and a value a server component imports from a
 * client module reaches the browser as a reference to that module's
 * chunk, not as the string. So the head's first <script> could not render
 * until the chunk had loaded. When hydration reached <head> first, it
 * suspended there, and React (19.2) replayed the head without putting its
 * place back. <body> then hydrated against the head's first tag and threw
 * React #418, on any page, about one load in fifty. As a plain string it
 * is in the page's payload and the head never waits.
 *
 * Kept deliberately tiny and dependency-free.
 */
export const themeBootScript = `
(function(){try{
  var p = JSON.parse(localStorage.getItem('ethos.prefs')||'{}');
  // Anything this device did not explicitly choose follows the OS
  // (#286). Kept in step with readTheme in lib/prefs.ts.
  var t = p.theme === 'dark' || p.theme === 'light' ? p.theme : 'system';
  if (t === 'system') {
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
  // Motion answers before paint too, or the first sheet slides for
  // someone who asked it not to.
  var r = !!p.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.setAttribute('data-motion', r ? 'reduce' : 'full');
  // The browser chrome is part of the room. Setting it here rather than
  // after hydration is the difference between a dark app under a cream
  // status bar for one frame and never seeing it at all.
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#121212' : '#ffffff');
}catch(e){}})();
`;
