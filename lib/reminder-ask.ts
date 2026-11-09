/**
 * The reminder ask on the glance (DECISIONS #430, moved from #427's exit).
 *
 * #427 asked on an exit that leaves, behind the save wall, the taste and
 * Since day one, and only while no hour was set. People glance at the
 * score and swipe the app away, so it was rarely seen; and an hour picked
 * in the introduction (or restored on a new phone) switched it off for
 * good, though nothing had ever been armed. Now it asks on the results
 * themselves, on the person's first scored take of the day, whenever this
 * phone holds no reminder the server has acknowledged:
 *
 *   ask      one tap, "Remind me at 6 pm", the hour they just practised
 *            (or the hour they already chose) and a picker to change it;
 *            Not now. Once a day; two Not nows rest it for a week.
 *   install  an iPhone's Safari tab, where there is no notification API to
 *            ask with: the two steps to the Home Screen, once, never a
 *            button that cannot work.
 *   denied   notifications blocked: where to turn them on, once. Never
 *            asked again on this phone.
 *
 * Never where a reminder is on here, where the person turned it off in
 * Settings or answered Off in the introduction, on a take too short to
 * score, or on a later take the same day.
 */

import { appleMobileIn } from "./pose-client";
import { readOnboarding } from "./answers";
import { insideQuietHours, type Prefs } from "./prefs";

/** The day key the ask was last shown on, on this device. */
export const ASKED_KEY = "ethos.reminder.asked";
/** Not now's count and the day the ask may come back, after the second. */
export const NOT_NOW_KEY = "ethos.reminder.notnow";
/** The install steps were shown on this phone. */
export const INSTALL_TOLD_KEY = "ethos.reminder.install";
/** Where to unblock notifications was said on this phone. */
export const DENIED_TOLD_KEY = "ethos.reminder.denied";
/** The reminder was switched off in Settings: the glance does not ask. */
export const OFF_KEY = "ethos.reminder.off";

/** Days the ask rests after the second Not now. */
export const REST_DAYS = 7;

/** What the browser can do about a notification. */
export type NotificationState = "default" | "granted" | "denied" | "unsupported";

export type AskKind = "ask" | "install" | "denied";

export function reminderAsk(p: {
  /** This take was scored. */
  scored: boolean;
  /** No scored take earlier today. */
  firstToday: boolean;
  /** The server holds a reminder for this phone at its hour (lib/reminders.ts armedHere). */
  armed: boolean;
  /** Turned off in Settings, or Off in the introduction. */
  declined: boolean;
  notifications: NotificationState;
  /** A service worker and PushManager exist. */
  push: boolean;
  /** An iPhone or iPad, and whether Ethos runs from its Home Screen. */
  ios: boolean;
  standalone: boolean;
  askedOn: string | null;
  today: string;
  /** The day the ask may come back after two Not nows, or null. */
  restUntil: string | null;
  installTold: boolean;
  deniedTold: boolean;
}): AskKind | null {
  if (!p.scored || !p.firstToday) return null;
  if (p.armed || p.declined) return null;
  if (p.askedOn === p.today) return null;
  if (p.notifications === "denied") return p.deniedTold ? null : "denied";
  if (p.notifications === "unsupported" || !p.push) {
    return p.ios && !p.standalone && !p.installTold ? "install" : null;
  }
  if (p.restUntil !== null && p.today < p.restUntil) return null;
  return "ask";
}

/**
 * No scored take earlier today, from the recordings read before this one
 * (the rep screen's baseline): a take with an Index is a scored one. A
 * baseline that never loaded, or one read before midnight, says yes; the
 * once-a-day mark still holds the ask to one showing.
 */
export function firstScoredToday(
  b: { reps: readonly { created_at: string; ethos_index: number | null }[]; at: Date } | null,
  now: Date = new Date()
): boolean {
  if (!b) return true;
  const today = localDay(now);
  if (localDay(b.at) !== today) return true;
  return !b.reps.some((r) => r.ethos_index !== null && localDay(new Date(r.created_at)) === today);
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * The hour the ask offers: the one already chosen (the introduction,
 * Settings, the account), else the hour this take started, rounded down,
 * so tomorrow's nudge lands just before the time they spoke today. Inside
 * quiet hours it moves to the nearer edge: late at night the last hour
 * before them (9 pm by default), early in the morning the first after
 * (7 am).
 */
export function askHour(startedAt: Date, chosen: number | null, prefs: Pick<Prefs, "quietFrom" | "quietTo">): number {
  const quiet = (h: number) => insideQuietHours(h, prefs as Prefs);
  if (chosen !== null && !quiet(chosen)) return chosen;
  const h = startedAt.getHours();
  if (!quiet(h)) return h;
  const into = (h - prefs.quietFrom + 24) % 24;
  const length = (prefs.quietTo - prefs.quietFrom + 24) % 24;
  return into < length / 2 ? (prefs.quietFrom + 23) % 24 : prefs.quietTo;
}

/** The hours the picker offers: every hour outside quiet hours. */
export function askHours(prefs: Pick<Prefs, "quietFrom" | "quietTo">): number[] {
  return Array.from({ length: 24 }, (_, h) => h).filter((h) => !insideQuietHours(h, prefs as Prefs));
}

/** The words, in one place (COPY-RULES: short, no dashes, one line each). */
export const ASK_COPY = {
  fresh: "Same time tomorrow?",
  chosen: (hour: string) => `You picked ${hour}.`,
  button: (hour: string) => `Remind me at ${hour}`,
  notNow: "Not now",
  saved: (hour: string) => `Tomorrow, ${hour}.`,
  failed: "That didn't save.",
  retry: "Try again",
  install: "Add Ethos to your Home Screen to get reminders.",
  installSteps: "Tap Share, then Add to Home Screen.",
  deniedIos: "Notifications are off for Ethos. Turn them on in Settings, Notifications, Ethos.",
  deniedBrowser: "Notifications are blocked for Ethos. Allow them in this browser's site settings.",
  picker: "Reminder hour",
} as const;

export const deniedLine = (ios: boolean) => (ios ? ASK_COPY.deniedIos : ASK_COPY.deniedBrowser);

/* ---- this phone ---------------------------------------------------------- */

/** This browser's notification state; "unsupported" where there is no API. */
export function notificationState(): NotificationState {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    const p = Notification.permission;
    return p === "granted" || p === "denied" ? p : "default";
  } catch {
    return "unsupported";
  }
}

/** iPhone or not, Home Screen or not, push or not: read after mount. */
export function askPlatform(): { ios: boolean; standalone: boolean; push: boolean } {
  try {
    const ios = appleMobileIn(navigator.userAgent, navigator.maxTouchPoints);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const push = "serviceWorker" in navigator && "PushManager" in window;
    return { ios, standalone, push };
  } catch {
    return { ios: false, standalone: false, push: false };
  }
}

function get(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Private mode or blocked storage: it may ask again, which is all. */
  }
}

/** The day the ask was last shown, or null; storage that throws reads as never. */
export function askedOn(): string | null {
  return get(ASKED_KEY);
}

/** Shown is shown, whatever is tapped: it waits for tomorrow. Never throws. */
export function markAsked(today: string): void {
  set(ASKED_KEY, today);
}

/** The day key `days` after `day` ("YYYY-MM-DD"). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The day the ask comes back after its rest, or null when it is not resting. */
export function restUntil(): string | null {
  try {
    const v = JSON.parse(get(NOT_NOW_KEY) ?? "null") as { until?: unknown } | null;
    return typeof v?.until === "string" ? v.until : null;
  } catch {
    return null;
  }
}

/**
 * Not now: the first waits for tomorrow, the second rests the ask for a
 * week, and the count starts again after it.
 */
export function markNotNow(today: string): void {
  let count = 0;
  try {
    const v = JSON.parse(get(NOT_NOW_KEY) ?? "null") as { count?: unknown } | null;
    count = typeof v?.count === "number" ? v.count : 0;
  } catch {}
  count += 1;
  set(NOT_NOW_KEY, JSON.stringify(count >= 2 ? { count: 0, until: addDays(today, REST_DAYS) } : { count, until: null }));
}

/** A reminder turned on clears the rest. */
export function clearNotNow(): void {
  set(NOT_NOW_KEY, null);
}

export const installTold = (): boolean => get(INSTALL_TOLD_KEY) === "1";
export const markInstallTold = (): void => set(INSTALL_TOLD_KEY, "1");
export const deniedTold = (): boolean => get(DENIED_TOLD_KEY) === "1";
export const markDeniedTold = (): void => set(DENIED_TOLD_KEY, "1");

/** Settings' switch: off is an answer the glance respects; on clears it. */
export function markSwitchedOff(off: boolean): void {
  set(OFF_KEY, off ? "1" : null);
}

/** Turned off in Settings, or Off in the introduction. */
export function declined(): boolean {
  if (get(OFF_KEY) === "1") return true;
  try {
    return readOnboarding().answers.time === "off";
  } catch {
    return false;
  }
}
