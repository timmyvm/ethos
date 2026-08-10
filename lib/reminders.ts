/**
 * The daily reminder, actually scheduled.
 *
 * Browsers give us three tiers and we use whichever is really available
 * rather than claiming the best one:
 *
 *   "scheduled"  — Notification Triggers (TimestampTrigger). The OS
 *                  fires it whether or not Ethos is open. Chromium.
 *   "open-tab"   — a timer inside the page. Fires only while a tab is
 *                  alive, which is honestly most of the day on desktop
 *                  and almost never on mobile.
 *   "unsupported"— no Notification API at all (iOS Safari unless the
 *                  PWA is installed to the home screen).
 *
 * Settings prints the tier in plain words. A reminder that silently
 * never fires is worse than no reminder.
 *
 * mechanics.md rules enforced here, not in copy: one a day maximum,
 * nothing inside quiet hours, coach register — loss-aversion is
 * allowed, guilt is not.
 */

import { insideQuietHours, readPrefs, type Prefs } from "./prefs";

export type ReminderTier = "scheduled" | "open-tab" | "unsupported";

const TAG = "ethos-daily";
const LAST_KEY = "ethos.reminder.last";

interface TriggerCtor {
  new (timestamp: number): unknown;
}

function timestampTrigger(): TriggerCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { TimestampTrigger?: TriggerCtor })
    .TimestampTrigger;
  return typeof ctor === "function" ? ctor : null;
}

export function reminderTier(): ReminderTier {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  if (timestampTrigger() && "serviceWorker" in navigator) return "scheduled";
  return "open-tab";
}

export function reminderTierNote(tier: ReminderTier): string {
  switch (tier) {
    case "scheduled":
      return "Scheduled with your OS — it fires whether Ethos is open or not.";
    case "open-tab":
      return "Your browser can only fire this while Ethos is open in a tab. Install it to the home screen for a real alarm.";
    case "unsupported":
      return "This browser can't show notifications. Add Ethos to your home screen first.";
  }
}

/** Next occurrence of `hour` in local time, skipping quiet hours. */
export function nextFireTime(
  hour: number,
  now = new Date(),
  prefs: Prefs = readPrefs()
): Date | null {
  if (insideQuietHours(hour, prefs)) return null;
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    0,
    0,
    0
  );
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export interface ReminderContext {
  streak: number;
  didToday: boolean;
}

/**
 * Coach register. Names the streak, never scolds. No sad mascot, no
 * shame state (DECISIONS #26).
 */
export function reminderBody(ctx: ReminderContext): string {
  if (ctx.streak >= 2) return `${ctx.streak} days. One rep keeps it.`;
  if (ctx.streak === 1) return "Day two is the one that makes it a habit.";
  return "Five minutes. One prompt. Take the floor.";
}

function firedToday(now: Date): boolean {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return false;
    const last = new Date(raw);
    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

function markFired(now: Date): void {
  try {
    localStorage.setItem(LAST_KEY, now.toISOString());
  } catch {}
}

let openTabTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelReminder(): void {
  if (openTabTimer) {
    clearTimeout(openTabTimer);
    openTabTimer = null;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  void navigator.serviceWorker.ready
    .then((reg) =>
      // includeTriggered isn't in lib.dom yet; without it a pending
      // scheduled notification survives and we'd stack a second one.
      reg.getNotifications({
        tag: TAG,
        includeTriggered: true,
      } as GetNotificationOptions)
    )
    .then((list) => list.forEach((n) => n.close()))
    .catch(() => {});
}

/**
 * Arm the reminder for the user's chosen hour. Safe to call on every
 * app open — it cancels the previous one first, so it can't stack.
 */
export async function armReminder(
  ctx: ReminderContext,
  now = new Date()
): Promise<ReminderTier | null> {
  const prefs = readPrefs();
  cancelReminder();
  if (prefs.reminderHour === null) return null;
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "granted") return null;

  const fireAt = nextFireTime(prefs.reminderHour, now, prefs);
  if (!fireAt) return null;

  const tier = reminderTier();
  const payload = {
    tag: TAG,
    body: reminderBody(ctx),
    icon: "/icon-192.webp",
    badge: "/icon-192.webp",
    data: { url: "/rep" },
  };

  if (tier === "scheduled") {
    const Trigger = timestampTrigger();
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Ethos", {
        ...payload,
        // Not in lib.dom yet — feature-detected above.
        showTrigger: new Trigger!(fireAt.getTime()),
      } as NotificationOptions);
      return "scheduled";
    } catch {
      // Fall through to the timer rather than reporting a lie.
    }
  }

  const delay = fireAt.getTime() - now.getTime();
  // setTimeout saturates past ~24.8 days; a reminder is always < 24h.
  openTabTimer = setTimeout(() => {
    const at = new Date();
    if (firedToday(at)) return;
    if (ctx.didToday) return;
    try {
      new Notification("Ethos", payload);
      markFired(at);
    } catch {}
  }, Math.max(0, delay));

  return "open-tab";
}
