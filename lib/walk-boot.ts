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
 * no stored session. A `?splash` asked of `/` is carried along.
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
 *    drops them once React runs.
 *
 * On a door it drew, it also lifts the app-open splash the way
 * components/SplashLift.tsx does (the floor, the fonts, then `out` and
 * gone), since nothing under it waits for React any more. SplashLift does
 * nothing on a splash that is no longer `on`.
 */

import { WELCOMED_KEY } from "./onboarding";

/** The walk's own key (lib/answers.ts `KEY`). */
export const ONBOARDING_KEY = "ethos.onboarding";

export const firstRunBootScript = `
(function(){try{
  if (location.pathname !== '/') return;
  var keys = [];
  for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  if (keys.indexOf(${JSON.stringify(WELCOMED_KEY)}) >= 0) return;
  for (var j = 0; j < keys.length; j++) if (/^sb-.+-auth-token$/.test(keys[j] || '')) return;
  location.replace('/welcome' + (/[?&]splash\\b/.test(location.search) ? '?splash' : ''));
}catch(e){}})();
`;
