/**
 * Device preferences. Deliberately localStorage, not the database:
 * these describe this device (haptics, notification hour, reduced
 * motion), not the account, and they must be readable synchronously on
 * first paint without a round trip.
 */

export type Theme = "system" | "light" | "dark";

export interface Prefs {
  /** Local hour 0–23 for the one daily reminder, or null for off. */
  reminderHour: number | null;
  quietFrom: number;
  quietTo: number;
  haptics: boolean;
  verbatim: boolean;
  /** Optional 30s think-time before the rep (DECISIONS #35). */
  frameStep: boolean;
  /** Honour prefers-reduced-motion overrides for the celebration. */
  reducedMotion: boolean;
  /** Light, dark, or follow the OS. */
  theme: Theme;
}

export const DEFAULT_PREFS: Prefs = {
  reminderHour: null,
  quietFrom: 22,
  quietTo: 7,
  haptics: true,
  verbatim: true,
  frameStep: false,
  reducedMotion: false,
  theme: "system",
};

const KEY = "ethos.prefs";

export function readPrefs(): Prefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** Haptics — opt-out lives in settings; silently absent on desktop. */
export function buzz(pattern: number | number[]): void {
  try {
    if (!readPrefs().haptics) return;
    navigator.vibrate?.(pattern);
  } catch {}
}

/** True when the user (or the OS) has asked for less movement. */
export function prefersReducedMotion(): boolean {
  if (readPrefs().reducedMotion) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** mechanics.md: nothing fires inside quiet hours. Wraps midnight. */
export function insideQuietHours(hour: number, prefs = readPrefs()): boolean {
  const { quietFrom, quietTo } = prefs;
  if (quietFrom === quietTo) return false;
  return quietFrom < quietTo
    ? hour >= quietFrom && hour < quietTo
    : hour >= quietFrom || hour < quietTo;
}
