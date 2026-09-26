/**
 * The app-open screen: the home-screen icon, the wordmark, then the app.
 *
 * It is plain server markup, painted in the first frame before any
 * JavaScript, and the head script below decides whether it shows at all
 * by stamping `data-splash="on"` on <html> before paint. Without that
 * attribute the CSS keeps it `display: none`, so a marketing page, a
 * crawler or a second tab never sees it.
 *
 * Once a tab. A cold launch of the installed app is a new tab and gets
 * it; a reload or a route change inside the tab does not, because a
 * brand moment on every refresh is a toll, not a welcome.
 *
 * Demos's head sits on the ground itself, no tile, so the same mark
 * belongs to the white room and the dark one (`public/splash-demos.webp`,
 * cut by scripts/make-icons.py: the home-screen icon's own face, so the
 * tap and the screen it opens show one Demos, #310). The wordmark rises
 * under it, then the whole thing lifts off the finished screen. `SplashLift` (components/SplashLift.tsx) lifts it once React
 * has hydrated, the fonts are in and a floor of 900ms has passed, so a
 * fast load still reads as a beat and not a flicker. If that never
 * runs, a CSS fallback fades it out on its own (globals.css, `.splash`).
 */

export function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-mark">
        {/* A plain <img>: the service worker pre-caches this exact path
            (public/sw.js), and next/image would ask for a different one. */}
        <img
          src="/splash-demos.webp"
          alt=""
          width={128}
          height={128}
          fetchPriority="high"
          decoding="sync"
          className="block h-32 w-32"
        />
      </div>
      <span className="splash-word font-display text-[22px] font-extrabold uppercase tracking-[0.02em]">
        ethos
      </span>
    </div>
  );
}

/**
 * Runs in <head> before paint. Skips the pages a stranger lands on (the
 * marketing pages, auth links from an email), a tab that has already
 * seen it, and automated browsers, so the look and check scripts
 * photograph the app rather than the splash. `?splash` brings it back
 * for a camera that wants it.
 */
export const splashBootScript = `
(function(){try{
  var q = /[?&]splash\\b/.test(location.search);
  if (!q) {
    if (/^\\/(about|privacy|terms|auth)(\\/|$)/.test(location.pathname)) return;
    if (sessionStorage.getItem('ethos.splash')) return;
    if (navigator.webdriver) return;
  }
  sessionStorage.setItem('ethos.splash', '1');
  document.documentElement.setAttribute('data-splash', 'on');
}catch(e){}})();
`;
