"use client";

import { useSyncExternalStore } from "react";
import { PREFS_CHANGED, readPrefs } from "./prefs";

/**
 * The tap's tick, on an iPhone (#449).
 *
 * An iPhone gives a page no vibration to ask for: `navigator.vibrate`
 * has never shipped there, so every `buzz()` in the app is silent on the
 * phone most of its people hold. The one haptic a page can reach is the
 * tick iOS plays when a native switch (`<input type="checkbox" switch>`)
 * is toggled, and since iOS 26.5 only a person's own tap may toggle it:
 * a click made in script is not trusted, and WebKit plays nothing for
 * it. So the tick cannot be asked for. It can only be stood under a
 * finger: a transparent label over a button, wired to a hidden switch,
 * forwards the real tap to the switch as a trusted click, and the phone
 * ticks (components/ui/TapTick.tsx; the technique is ios-haptics', MIT,
 * as it has shipped since its September 2026 rewrite).
 *
 * What that means for the product: one fixed tick, at the tap, on the
 * controls that carry a TapTick. No patterns, nothing after an `await`,
 * nothing for a moment that is not a tap (the streak's landing, a ring
 * closing). Android and anything else with a Vibration API keeps
 * `buzz()`, patterns and all, and never draws a TapTick.
 */

export type TickEnv = {
  ua: string;
  /** `navigator.vibrate` exists: the Vibration API does the work, and better. */
  vibrates: boolean;
};

/**
 * iOS's major version as a Safari user agent states it ("CPU iPhone OS
 * 18_6 like Mac OS X"), or null. Since iOS 26 the string is frozen at
 * 18_6, which is still the answer wanted here: 18 or later.
 */
export function iosMajor(ua: string): number | null {
  const m = /\bOS (\d+)[._]\d+/.exec(ua);
  return m ? Number(m[1]) : null;
}

/**
 * Whether a tap can tick on this device: an iPhone on iOS 18 or later
 * with no vibration to ask for. Not an iPad (no Taptic Engine), not
 * iOS 17 (the switch is there from 17.4 and its haptic from 18), and
 * never where `navigator.vibrate` exists.
 */
export function tapTickOffered(env: TickEnv): boolean {
  if (env.vibrates) return false;
  if (!/\b(iPhone|iPod)\b/.test(env.ua)) return false;
  const major = iosMajor(env.ua);
  return major !== null && major >= 18;
}

/** This device, asked once: a phone does not change what it is mid-visit. */
let here: boolean | null = null;
export function tapTickHere(): boolean {
  if (here !== null) return here;
  if (typeof navigator === "undefined") return false;
  try {
    here = tapTickOffered({ ua: navigator.userAgent, vibrates: typeof navigator.vibrate === "function" });
  } catch {
    here = false;
  }
  return here;
}

/** Whether this device can give any haptic at all: a vibration, or the tap's tick. Settings' row asks. */
export function hapticsHere(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.vibrate === "function" || tapTickHere();
}

/* The switch in Settings, read once and again whenever it changes. */
let on: boolean | null = null;
const read = (): boolean => {
  if (on === null) on = tapTickHere() && readPrefs().haptics;
  return on;
};
function subscribe(changed: () => void): () => void {
  const heard = () => {
    on = null;
    changed();
  };
  window.addEventListener(PREFS_CHANGED, heard);
  window.addEventListener("storage", heard);
  return () => {
    window.removeEventListener(PREFS_CHANGED, heard);
    window.removeEventListener("storage", heard);
  };
}

/**
 * True where a TapTick should be drawn: this phone can tick and Haptics
 * is on. False on the server and while the server's page hydrates, so
 * the markup always agrees; the overlay arrives a frame later.
 */
export function useTapTick(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** Tests only. */
export function resetTapTick(): void {
  here = null;
  on = null;
}
