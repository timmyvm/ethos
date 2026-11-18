/**
 * When the app-open splash lifts (components/SplashLift.tsx, #508).
 *
 * The floor keeps a fast open a beat, never a flicker: 600 ms from
 * navigation start, down from 900, because the splash now waits for a
 * drawn Today and a beat spent on top of that is a wait. The cap is how
 * long it will wait for Today's numbers: past it the splash lifts onto
 * whatever is there, as it did before, and it sits under the CSS
 * fallback (`.splash`'s 2.6 s in app/globals.css) so the two never race.
 */
export const SPLASH_FLOOR_MS = 600;
export const SPLASH_WAIT_CAP_MS = 2500;
