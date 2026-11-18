/**
 * The first minute, before any JavaScript (#508, the speed audit's fixes
 * 13 and 14). Two plain strings the root layout inlines into <head>, as
 * lib/theme-boot.ts and components/Splash.tsx do, for the same reason:
 * they run before paint and before React.
 *
 * `firstRunBootScript` (fix 14) runs before the splash's script. A phone
 * that has never opened Ethos lands on `/` (the manifest's start_url);
 * Today's page used to load all of its code, start its reads and only
 * then send a first run to the room (app/page.tsx, which stays as the
 * fallback). This sends it before anything of Today's loads. The test is
 * lib/onboarding.ts `isFirstRun`, the same keys: no `ethos.welcomed` and
 * no stored session. A `?splash` asked of `/` is carried along. The
 * graphics boot (lib/graphics.ts) has already marked `/` alive by then,
 * and a page sent on before its code loads never says it went: the mark
 * is taken down here, or the room would read a crash, run lite and
 * reduced, and report it (a page leaving on purpose is an end the app
 * saw, as `markGone` has it).
 *
 * `walkBootScript` (fix 13) runs after it, on /welcome only. The room's
 * door is now drawn by the server (app/welcome/page.tsx), so a first run
 * sees it at the first paint instead of after 415 KB of code. A walk the
 * room is not for (a deep link, a walk part way through or finished)
 * must never see the door flash (#497), so this marks the page before it
 * paints:
 *
 *  - `data-walk="room"` only when the room is certainly due: no `?step=`,
 *    and no stored walk, or one at its very start that is not finished
 *    (lib/onboarding.ts `roomDue`, read conservatively: anything else is
 *    `resume`, and the door stays hidden until the walk decides);
 *  - `data-walk="resume"` otherwise: app/globals.css hides the server's
 *    door, and the page is the plain ground until React draws the screen
 *    the walk resumes on, as it always was;
 *  - `data-room-account` when an account's session is stored: the door's
 *    Sign in and Tester code are hidden before paint (#497), as the room
 *    drops them once React runs;
 *  - on a door it drew, a press made before the app's code has run is
 *    kept (`window.__roomPress`, the final pass of 18 Nov): the door is
 *    seen about two seconds before it can be held on a phone, and a finger
 *    put down in that gap and kept there was lost, the fill never moving.
 *    The hold (components/room/Room.tsx HoldToStep) takes a press still
 *    down when it wakes and fills from the moment the finger landed.
 *
 * On a door it drew, it also lifts the app-open splash the way
 * components/SplashLift.tsx does (the floor, the fonts, then `out` and
 * gone), since nothing under it waits for React any more. SplashLift does
 * nothing on a splash that is no longer `on`.
 */

import { ALIVE_KEY } from "./graphics";
import { WELCOMED_KEY } from "./onboarding";
import { SPLASH_FLOOR_MS } from "./splash-timing";

/** The walk's own key (lib/answers.ts `KEY`). */
export const ONBOARDING_KEY = "ethos.onboarding";

export const firstRunBootScript = `
(function(){try{
  if (location.pathname !== '/') return;
  var keys = [];
  for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  if (keys.indexOf(${JSON.stringify(WELCOMED_KEY)}) >= 0) return;
  for (var j = 0; j < keys.length; j++) if (/^sb-.+-auth-token$/.test(keys[j] || '')) return;
  localStorage.removeItem(${JSON.stringify(ALIVE_KEY)});
  location.replace('/welcome' + (/[?&]splash\\b/.test(location.search) ? '?splash' : ''));
}catch(e){}})();
`;

export const walkBootScript = `
(function(){try{
  if (location.pathname !== '/welcome') return;
  var root = document.documentElement;
  var due = !/[?&]step=/.test(location.search);
  if (due) {
    var raw = localStorage.getItem(${JSON.stringify(ONBOARDING_KEY)});
    if (raw) {
      var w = JSON.parse(raw);
      due = !!w && typeof w === 'object' && w.done !== true && (w.step === undefined || w.step === 0);
    }
  }
  root.setAttribute('data-walk', due ? 'room' : 'resume');
  if (!due) return;
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i) || '';
    if (!/^sb-.+-auth-token$/.test(k)) continue;
    try {
      var s = JSON.parse(localStorage.getItem(k) || 'null');
      if (s && typeof s.access_token === 'string' && s.user && s.user.is_anonymous !== true) root.setAttribute('data-room-account', '');
    } catch (e) {}
  }
  try {
    var press = window.__roomPress = { down: false, at: 0, type: '' };
    var awake = function () { return window.__roomAwake === true; };
    document.addEventListener('pointerdown', function (e) {
      if (awake() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var t = e.target;
      if (!t || !t.closest || !t.closest('[data-room-hold]')) return;
      press.down = true; press.at = performance.now(); press.type = e.pointerType || 'touch';
    }, true);
    var lift = function () { if (!awake()) press.down = false; };
    document.addEventListener('pointerup', lift, true);
    document.addEventListener('pointercancel', lift, true);
  } catch (e) {}
  if (root.getAttribute('data-splash') !== 'on') return;
  var floor = new Promise(function (r) { setTimeout(r, Math.max(0, ${SPLASH_FLOOR_MS} - performance.now())); });
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.all([floor, fonts]).then(function () {
    if (root.getAttribute('data-splash') !== 'on') return;
    root.setAttribute('data-splash', 'out');
    setTimeout(function () { root.removeAttribute('data-splash'); }, 360);
  });
}catch(e){}})();
`;
