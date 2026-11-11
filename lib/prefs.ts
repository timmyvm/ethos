/**
 * Device preferences. Deliberately localStorage, not the database:
 * these describe this device (haptics, notification hour, reduced
 * motion), not the account, and they must be readable synchronously on
 * first paint without a round trip.
 */

import { liteGraphics } from "./graphics";

export type Theme = "system" | "light" | "dark";

/**
 * #284 cut this to two values and made light the default; #286 put the
 * OS back, because a phone that has already answered the question
 * should not be asked it again. The narrowing left `"light"` and
 * `"dark"` in storage on devices that never chose either, so an
 * unrecognised value reads as the default rather than as garbage.
 */
function readTheme(value: unknown): Theme {
  return value === "dark" || value === "light" ? value : "system";
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
  /**
   * Which of the two the person picked on the toggle, as against a
   * default `writePrefs` stored along with every other preference. The
   * boss's default moved to Voice (the games plan, item 16), and every
   * device that ever saved a preference holds the old Video default for
   * it, so only a boss mode picked since is kept.
   */
  captureChosen?: Partial<Record<"daily" | "boss", boolean>>;
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
  /**
   * Lite graphics (#412, lib/graphics.ts): true or false once chosen in
   * Settings; null until then, when the device decides (a crash, a lost
   * graphics context, a small iPhone).
   */
  liteGraphics: boolean | null;
  /** Light, dark, or follow the OS. */
  theme: Theme;
  /**
   * Which bought Demos pose stands on You's stage, or null for his
   * hello. This device's copy, for the first paint: the account's
   * `equipped_pose` wins when it answers (#175), and what a cosmetic
   * *is* lives on the server (the ledger proves you bought it).
   */
  pose: string | null;
}

export const DEFAULT_PREFS: Prefs = {
  /**
   * A daily lesson defaults to video OFF: the value of the daily loop is
   * that it works on a tram with headphones, and nagging for a camera
   * there costs the habit. The boss defaults to Voice too since the games
   * plan (item 16): Video asked for the camera at the moment of the take,
   * and the one tester who recorded a boss never got past 6 seconds.
   * Video stays one tap away, and sticks once picked.
   */
  captureMode: { daily: "voice", boss: "voice" },
  reminderHour: null,
  quietFrom: 22,
  quietTo: 7,
  haptics: true,
  sound: true,
  verbatim: true,
  frameStep: false,
  skipIntros: false,
  reducedMotion: false,
  liteGraphics: null,
  theme: "system",
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

/**
 * Said on the window each time a preference is written, for the few
 * things on screen that read one while they stand (the tap's tick,
 * lib/tap-tick.ts: Haptics switched off stops it at once, on the screen
 * that switched it).
 */
export const PREFS_CHANGED = "ethos:prefs";

export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  try {
    window.dispatchEvent(new Event(PREFS_CHANGED));
  } catch {}
  return next;
}

export function readCaptureMode(kind: "daily" | "boss"): CaptureMode {
  const prefs = readPrefs();
  // A boss mode nobody picked is the old default, stored with the rest.
  if (kind === "boss" && prefs.captureChosen?.boss !== true) {
    return DEFAULT_PREFS.captureMode.boss;
  }
  return prefs.captureMode?.[kind] ?? DEFAULT_PREFS.captureMode[kind];
}

export function writeCaptureMode(
  kind: "daily" | "boss",
  mode: CaptureMode
): void {
  const prefs = readPrefs();
  const current = prefs.captureMode ?? DEFAULT_PREFS.captureMode;
  writePrefs({
    captureMode: { ...current, [kind]: mode },
    captureChosen: { ...prefs.captureChosen, [kind]: true },
  });
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

/**
 * Haptics, where the browser has a Vibration API. The opt-out lives in
 * Settings; it is silently absent on a desktop. An iPhone has no such
 * API: there the haptic is the tick under a tap, which cannot be asked
 * for and is drawn into the controls that carry it (lib/tap-tick.ts,
 * #449), under the same switch.
 */
export function buzz(pattern: number | number[]): void {
  try {
    if (!readPrefs().haptics) return;
    navigator.vibrate?.(pattern);
  } catch {}
}

/**
 * True when the user (or the OS) has asked for less movement, or the
 * device draws lite (#412): lite is the reduced-motion app with its glass
 * made solid, so Demos's WebGL clip, the count-ups and the celebration's
 * flourishes all stand down through this one answer.
 */
export function prefersReducedMotion(): boolean {
  if (readPrefs().reducedMotion || liteGraphics()) return true;
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
