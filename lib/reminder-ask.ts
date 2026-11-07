/**
 * The reminder ask on the way out (DECISIONS #427). The last step's
 * Tomorrow section asked "Pick a time and Demos reminds you once a day."
 * on every take until an hour was set, beside "Practice 2 of 3", which
 * means keep going now. The ask now comes on an exit that leaves, once a
 * day on this device, and only where a reminder can work: the browser
 * has notifications and they are not blocked. Asking for something the
 * browser cannot do would only be in the way out.
 *
 * The pick itself is unchanged (DECISIONS #136): the hour is saved, then
 * the browser's permission is asked, then the reminder is armed.
 */

/** The day key the ask was last shown on, on this device. */
export const ASKED_KEY = "ethos.reminder.asked";

/** What the browser can do about a notification. */
export type NotificationState = "default" | "granted" | "denied" | "unsupported";

export function reminderDue(p: {
  /** The reminder hour already set (prefs), or null. */
  hour: number | null;
  /** The day key the ask was last shown on, or null. */
  askedOn: string | null;
  today: string;
  /** The exit leaves the session (the header's back, Back to the lesson, Next lesson, Go again). */
  leaves: boolean;
  notifications: NotificationState;
}): boolean {
  if (!p.leaves) return false;
  if (p.hour !== null) return false;
  if (p.notifications === "unsupported" || p.notifications === "denied") return false;
  return p.askedOn !== p.today;
}

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

/** The day the ask was last shown, or null; storage that throws reads as never. */
export function askedOn(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(ASKED_KEY);
  } catch {
    return null;
  }
}

/** Shown is shown, whatever is tapped: it waits for tomorrow. Never throws. */
export function markAsked(today: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(ASKED_KEY, today);
  } catch {
    /* Private mode or blocked storage: it may ask again, which is all. */
  }
}
