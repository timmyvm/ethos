/**
 * Device preferences. Deliberately localStorage, not the database:
 * these describe this device (haptics, notification hour, reduced
 * motion), not the account, and they must be readable synchronously on
 * first paint without a round trip.
 */

export type Theme = "light" | "dark";

/**
 * The app is a light room (#284). Dark is a choice, never an inference:
 * a phone on auto-dark used to decide what Ethos looked like, and the
 * cream ground is the product's face. `"system"` was a stored value for
 * most of the app's life, so anything that is not the word `dark` reads
 * as light rather than as garbage.
 */
function readTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

/** Voice, or Voice + Video (decisions 11 Aug, §1). */
export type CaptureMode = "voice" | "voice_video";

export interface Prefs {
  /**
   * Sticky per lesson type, remembered separately for daily lessons and
   * boss modes — the two have opposite right answers, so one shared
   * setting would be wrong half the time.
   */
  captureMode: Record<"daily" | "boss", CaptureMode>;
  /** Local hour 0–23 for the one daily reminder, or null for off. */
  reminderHour: number | null;
  quietFrom: number;
  quietTo: number;
  haptics: boolean;
  /** Synthesized celebration sound (lib/sfx.ts). Never fires mid-rep. */
  sound: boolean;
  verbatim: boolean;
  /** Optional 30s think-time before the rep (DECISIONS #35). */
  frameStep: boolean;
  /** Skip a unit's teaching screen on the way in (#232: set by the
   *  introduction for people who already present often). */
  skipIntros: boolean;
  /** Honour prefers-reduced-motion overrides for the celebration. */
  reducedMotion: boolean;
  /** Light, or dark. Light unless this device asked for dark. */
  theme: Theme;
  /**
   * Which bought Demos pose sits on the floor card, or null for the
   * default. Device-local on purpose and consistent with the rest of
   * this file: what a cosmetic *is* lives on the server (the ledger
   * proves you bought it), what you're currently looking at is a
   * property of the screen you're looking at.
   */
  pose: string | null;
}

export const DEFAULT_PREFS: Prefs = {
  /**
   * A daily lesson defaults to video OFF: the value of the daily loop is
   * that it works on a tram with headphones, and nagging for a camera
   * there costs the habit. Boss modes default ON — being watched is the
   * point of a boss.
   */
  captureMode: { daily: "voice", boss: "voice_video" },
  reminderHour: null,
  quietFrom: 22,
  quietTo: 7,
  haptics: true,
  sound: true,
  verbatim: true,
  frameStep: false,
  skipIntros: false,
  reducedMotion: false,
  theme: "light",
  pose: null,
};

const KEY = "ethos.prefs";

export function readPrefs(): Prefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const stored = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...stored, theme: readTheme(stored.theme) };
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

export function readCaptureMode(kind: "daily" | "boss"): CaptureMode {
  return readPrefs().captureMode?.[kind] ?? DEFAULT_PREFS.captureMode[kind];
}

export function writeCaptureMode(
  kind: "daily" | "boss",
  mode: CaptureMode
): void {
  const current = readPrefs().captureMode ?? DEFAULT_PREFS.captureMode;
  writePrefs({ captureMode: { ...current, [kind]: mode } });
}

/**
 * What the toggle says, from the first recording (DECISIONS #211).
 *
 * There used to be an override here forcing recording one to audio, on
 * the theory that camera permission before the product has visibly
 * worked is the most expensive ask in the funnel. The ask was never the
 * problem: the RULE was, because a rule has to be explained, and the
 * sentence explaining it sat on the screen whose one job is the Record
 * tap. The default already does the protecting — a daily lesson starts
 * on Voice, so nothing asks for a camera nobody chose.
 */
export function captureModeFor(kind: "daily" | "boss"): CaptureMode {
  return readCaptureMode(kind);
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
