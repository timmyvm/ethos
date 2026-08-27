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
import { ensureSession } from "./supabase-browser";

/**
 * "push" (DECISIONS #186) outranks them all: the server sends it, so it
 * rings with the site closed, on every platform that grants permission.
 * The local tiers stay as the fallback for a browser with no push, and
 * as the offline answer.
 */
export type ReminderTier = "push" | "scheduled" | "open-tab" | "unsupported";

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
    case "push":
      return "Sent from our server. It rings on this device with Ethos closed.";
    case "scheduled":
      return "Scheduled with your OS. It fires whether Ethos is open or not.";
    case "open-tab":
      return "Your browser can only fire this while Ethos is open in a tab. Install it to the home screen for a real alarm.";
    case "unsupported":
      return "This browser can't show notifications. Add Ethos to your home screen first.";
  }
}

/**
 * Next occurrence of `hour` in local time, skipping quiet hours.
 *
 * When today's rep is already done, today's occurrence would ask for a
 * thing that already happened — a wrong reminder teaches people to
 * disable the channel — so the next honest occurrence is tomorrow's.
 */
export function nextFireTime(
  hour: number,
  now = new Date(),
  prefs: Prefs = readPrefs(),
  didToday = false
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
  else if (didToday) next.setDate(next.getDate() + 1);
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
  if (ctx.streak >= 2) return `${ctx.streak} days. Five minutes keeps it.`;
  if (ctx.streak === 1) return "Day two is the one that makes it a habit.";
  return "Five minutes. One prompt. Take the floor.";
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function firedToday(now: Date): boolean {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return false;
    return sameLocalDay(new Date(raw), now);
  } catch {
    return false;
  }
}

function markFired(now: Date): void {
  try {
    localStorage.setItem(LAST_KEY, now.toISOString());
  } catch {}
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function vapidKey(): Uint8Array | null {
  const raw = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!raw) return null;
  const pad = "=".repeat((4 - (raw.length % 4)) % 4);
  const b64 = (raw + pad).replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Register (or refresh) this browser's push subscription. Re-running is
 * the sync mechanism: hour, timezone and quiet-hour changes ride the
 * same upsert. True = the server holds a current subscription.
 */
export async function armPush(prefs: Prefs = readPrefs()): Promise<boolean> {
  if (!pushSupported() || prefs.reminderHour === null) return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  const key = vapidKey();
  if (!key) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      }));
    const token = await ensureSession();
    if (!token) return false;
    const res = await fetch("/api/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        reminderHour: prefs.reminderHour,
        tzOffset: new Date().getTimezoneOffset(),
        quietFrom: prefs.quietFrom,
        quietTo: prefs.quietTo,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Reminder off: drop the subscription on both sides. */
export async function disarmPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const token = await ensureSession();
    if (token) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
    }
    await sub.unsubscribe().catch(() => {});
  } catch {}
}

/** The tier that is ACTUALLY live for this browser right now. */
export async function currentTier(): Promise<ReminderTier> {
  if (
    pushSupported() &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (await reg.pushManager.getSubscription()) return "push";
    } catch {}
  }
  return reminderTier();
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
  if (prefs.reminderHour === null) {
    void disarmPush();
    return null;
  }
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "granted") return null;

  /*
   * The server-sent tier first (#186). When it holds, the local tiers
   * stay dark — the server already applies quiet hours and the
   * done-today rule (#143) against the reps table, and a second local
   * notification would double-ring the same day.
   */
  if (await armPush(prefs)) return "push";

  // ctx.didToday matters at the OS tier too: a scheduled notification
  // can't check anything at fire time, so the honest day is chosen here.
  const fireAt = nextFireTime(prefs.reminderHour, now, prefs, ctx.didToday);
  if (!fireAt) return null;

  const tier = reminderTier();
  const payload = {
    tag: TAG,
    body: reminderBody(ctx),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
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
    // didToday was true of the ARM day; a timer that lives into
    // tomorrow (fireAt is tomorrow's hour) is firing about a new day.
    if (ctx.didToday && sameLocalDay(at, now)) return;
    try {
      new Notification("Ethos", payload);
      markFired(at);
    } catch {}
  }, Math.max(0, delay));

  return "open-tab";
}
