/**
 * Lite graphics (#412). Testers' iPhones went black and the app closed on
 * the recording screen (Nick, Vincent, 5 Nov; Alan's page reloaded mid
 * take on 3 Nov), and Timothy: "optimise for low graphics". A phone that
 * runs out of memory or loses its graphics chip mid recording loses the
 * recording, so on a phone that shows it cannot carry the decoration, the
 * decoration goes: Demos stands as his still instead of his WebGL clip,
 * glass turns solid, blurs and looping animations stop (lite implies the
 * reduced-motion stylesheet), and nothing else about the app changes.
 *
 * Lite is on when this device says so in Settings, or, while the setting
 * has never been touched (`liteGraphics: null`), when this device has
 * shown it needs it:
 *   crash   the page died while it was on screen (the boot script finds
 *           the "alive" mark the last page never took down),
 *   gpu     a WebGL context was lost (DemosClip),
 *   device  a phone with little memory: an iPhone drawing at 2x (SE,
 *           XR, 11 and older) or a browser that reports 3 GB or less.
 * Why lite came on is kept in `ethos.lite`; Settings says it, and turning
 * the switch off there is a choice the app keeps.
 *
 * Device-local, like every pref (lib/prefs.ts): it is about this phone.
 */

/** Set while a page of the app is on screen; taken down when it hides. */
export const ALIVE_KEY = "ethos.alive";
/** Why lite came on by itself, when it did. */
export const LITE_WHY_KEY = "ethos.lite";
/** A crash the boot script found, waiting for tester collection to report it. */
export const CRASHED_KEY = "ethos.crashed";

export type LiteWhy = "crash" | "gpu" | "device";

/** The `navigator` and `screen` facts the device guess reads. */
export interface DeviceFacts {
  ua: string;
  dpr: number;
  /** navigator.deviceMemory, where the browser gives it (not Safari). */
  memoryGb?: number;
  maxTouchPoints?: number;
}

/**
 * A phone too small for the decoration. iPhones never report their
 * memory, but every iPhone that draws at 2x is an SE, XR, 11 or older,
 * with 3 or 4 GB shared between iOS, Safari and the page. iPads at 2x
 * have more and are left alone.
 */
export function liteDevice(f: DeviceFacts): boolean {
  if (typeof f.memoryGb === "number" && f.memoryGb > 0 && f.memoryGb <= 3) return true;
  return /\biPhone\b/.test(f.ua) && f.dpr > 0 && f.dpr < 2.5;
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readLiteSetting(s: Storage): boolean | null {
  try {
    const p = JSON.parse(s.getItem("ethos.prefs") ?? "{}") as { liteGraphics?: unknown };
    return p.liteGraphics === true ? true : p.liteGraphics === false ? false : null;
  } catch {
    return null;
  }
}

/** Why this device is lite by itself, or null. */
export function liteWhy(): LiteWhy | null {
  const s = store();
  if (!s) return null;
  try {
    const v = s.getItem(LITE_WHY_KEY);
    return v === "crash" || v === "gpu" || v === "device" ? v : null;
  } catch {
    return null;
  }
}

/** Whether this device draws lite now. */
export function liteGraphics(): boolean {
  const s = store();
  if (!s) return false;
  const chosen = readLiteSetting(s);
  if (chosen !== null) return chosen;
  return liteWhy() !== null;
}

/** Stamp the answer on <html>, where the stylesheet reads it. */
export function applyGraphics(lite: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-graphics", lite ? "lite" : "full");
  if (lite) document.documentElement.setAttribute("data-motion", "reduce");
}

/**
 * The device showed it needs lite. A no-op once the person has chosen in
 * Settings, either way: their switch is theirs.
 */
export function autoLite(why: LiteWhy): void {
  const s = store();
  if (!s || readLiteSetting(s) !== null) return;
  try {
    if (!s.getItem(LITE_WHY_KEY)) s.setItem(LITE_WHY_KEY, why);
  } catch {}
  applyGraphics(true);
}

/** This page is on screen: if it dies before it hides, the next open knows. */
export function markAlive(path: string): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(ALIVE_KEY, JSON.stringify({ path: path.slice(0, 120), at: Date.now() }));
  } catch {}
}

/** The page hid or is going: an end the app saw. */
export function markGone(): void {
  try {
    store()?.removeItem(ALIVE_KEY);
  } catch {}
}

/** A crash the boot script found, once: tester collection reports it. */
export function takeCrash(): { path: string; at: number } | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(CRASHED_KEY);
    if (!raw) return null;
    s.removeItem(CRASHED_KEY);
    const v = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof v.path !== "string" || typeof v.at !== "number") return null;
    return { path: v.path, at: v.at };
  } catch {
    return null;
  }
}

/**
 * The boot half, inlined into <head> by lib/theme-boot.ts so the page a
 * crash reloads is lite from its first paint. Plain ES5 in a string, for
 * the reason theme-boot gives. Reads: the alive mark the last page left
 * up (it died on screen), the setting, the device; writes the why, the
 * crash for tester collection, the alive mark for this page, and
 * `data-graphics` (with `data-motion="reduce"` when lite).
 */
export const graphicsBootScript = `
(function(){try{
  var S = localStorage, d = document.documentElement;
  var p = {}; try { p = JSON.parse(S.getItem('ethos.prefs')||'{}') || {}; } catch(e) {}
  var prev = S.getItem('${ALIVE_KEY}');
  if (prev) {
    var o = {}; try { o = JSON.parse(prev) || {}; } catch(e) {}
    S.setItem('${CRASHED_KEY}', JSON.stringify({ path: String(o.path||'/').slice(0,120), at: +o.at || Date.now() }));
    if (!S.getItem('${LITE_WHY_KEY}')) S.setItem('${LITE_WHY_KEY}', 'crash');
  }
  if (!S.getItem('${LITE_WHY_KEY}')) {
    var n = navigator, ua = n.userAgent || '', r = window.devicePixelRatio || 1, m = n.deviceMemory;
    if ((typeof m === 'number' && m > 0 && m <= 3) || (/\\biPhone\\b/.test(ua) && r < 2.5)) S.setItem('${LITE_WHY_KEY}', 'device');
  }
  var lite = p.liteGraphics === true || (p.liteGraphics !== false && !!S.getItem('${LITE_WHY_KEY}'));
  d.setAttribute('data-graphics', lite ? 'lite' : 'full');
  if (lite) d.setAttribute('data-motion', 'reduce');
  if (document.visibilityState !== 'hidden') S.setItem('${ALIVE_KEY}', JSON.stringify({ path: location.pathname.slice(0,120), at: Date.now() }));
}catch(e){}})();
`;
