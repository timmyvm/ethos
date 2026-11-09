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

import { insideQuietHours, readPrefs, writePrefs, type Prefs } from "./prefs";
import { reminderCopy, takeLine, type LastTake } from "./reminder-copy";
import { deviceZone, PUSH_ACK_KEY } from "./reminders-zone";
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
 * What Settings draws under the hours while a reminder is on: the ask
 * for permission, the browser's block, or the next time it rings. With
 * no Notification API at all (an iPhone's Safari tab, an app's own
 * browser) it is the way to get one: the ask drawn there could do
 * nothing, however often it was tapped.
 */
export type ReminderLine = "ask" | "blocked" | "unsupported" | "armed";

export function reminderLine(perm: string, canNotify: boolean): ReminderLine {
  if (!canNotify) return "unsupported";
  if (perm === "granted") return "armed";
  return perm === "denied" ? "blocked" : "ask";
}

/** The way to a reminder from a browser with no notifications, inside an app's own (`app`) or not. */
export function noNotificationsNote(app: string | null): string {
  return app
    ? `Notifications don't work inside ${app}. Open Ethos in your browser.`
    : reminderTierNote("unsupported");
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
  /** Callers still pass it; the words no longer name it (#430). */
  streak?: number;
  didToday: boolean;
  /** The last take worth quoting, when the caller has it. */
  last?: LastTake | null;
}

/**
 * The body, the same words the server sends (lib/reminder-copy.ts, #430):
 * a number from the last take, never the streak. No sad mascot, no shame
 * state (DECISIONS #26).
 */
export function reminderBody(ctx: ReminderContext): string {
  return takeLine(ctx.last ?? null);
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
    return (await postSubscription(sub, prefs.reminderHour, prefs)).ok;
  } catch {
    return false;
  }
}

/**
 * POST this device's subscription with the hour, its zone and its quiet
 * hours; on the server's 200, write the acknowledgement. The one place a
 * subscription reaches the server, for a re-arm and for a tap alike.
 */
async function postSubscription(
  sub: PushSubscription,
  hour: number,
  prefs: Prefs
): Promise<{ ok: true } | { ok: false; why: "no-session" | "offline" | "server"; status?: number }> {
  const token = await ensureSession().catch(() => null);
  if (!token) return { ok: false, why: "no-session" };
  // The zone itself, so the server follows its daylight-saving changes
  // without waiting for this device to re-arm (0019).
  const tz = deviceZone();
  let res: Response;
  try {
    res = await fetch("/api/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        reminderHour: hour,
        tzOffset: new Date().getTimezoneOffset(),
        tz,
        quietFrom: prefs.quietFrom,
        quietTo: prefs.quietTo,
      }),
    });
  } catch {
    return { ok: false, why: "offline" };
  }
  if (!res.ok) return { ok: false, why: "server", status: res.status };
  writeAck({ endpoint: sub.endpoint, hour, tz });
  return { ok: true };
}

/** Why a reminder could not be turned on, in the words the screens choose from. */
export type ArmFail =
  /** No Notification or PushManager here: an iPhone's Safari tab, an app's own browser. */
  | "unsupported"
  /** Blocked: only the phone's or the browser's settings can change it. */
  | "denied"
  /** The prompt was closed without an answer (a desktop browser can). */
  | "dismissed"
  /** No service worker answered in time. */
  | "no-worker"
  /** The build has no VAPID key. */
  | "no-key"
  /** The browser refused the subscription for another reason. */
  | "subscribe"
  /** No session could be made to own the subscription. */
  | "no-session"
  /** The request never reached the server. */
  | "offline"
  /** The server answered, and not with a 200. */
  | "server";

export type ArmResult = { ok: true; hour: number } | { ok: false; why: ArmFail; status?: number };

/** How long a missing service worker is waited for before the tap says so. */
export const WORKER_WAIT_MS = 6000;

/**
 * This page's service worker registration, or null once `ms` pass with
 * none: `serviceWorker.ready` never settles where the worker never
 * registered, and a tap that waited on it hung with no word (#430).
 */
export function readyRegistration(ms = WORKER_WAIT_MS): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    navigator.serviceWorker.ready.then(
      (reg) => {
        clearTimeout(t);
        resolve(reg);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      }
    );
  });
}

/**
 * Turn the reminder on from a tap (#430), and say so only when the server
 * has it. Call it straight from the tap's handler with nothing awaited
 * before it: on an iPhone the tap's permission to raise the Allow prompt
 * ends at the first await, so `pushManager.subscribe` is that first await,
 * on the registration the screen fetched when it mounted. Subscribing
 * raises the prompt and subscribes in one step. Without a registration
 * yet, the permission is asked first, in the tap, and the worker is
 * waited for (never forever) before subscribing.
 *
 * On the server's 200: the hour is this device's, the acknowledgement is
 * written, and the hour goes on the account too (onboarding.reminder_hour)
 * so a new phone or the installed app can offer it in one tap.
 */
export function armInTap(
  hour: number,
  reg: ServiceWorkerRegistration | null,
  onAccount: (hour: number) => Promise<unknown> = async () => {}
): Promise<ArmResult> {
  if (typeof Notification === "undefined" || !pushSupported()) {
    return Promise.resolve({ ok: false, why: "unsupported" });
  }
  if (Notification.permission === "denied") return Promise.resolve({ ok: false, why: "denied" });
  const key = vapidKey();
  if (!key) return Promise.resolve({ ok: false, why: "no-key" });
  const opts = { userVisibleOnly: true, applicationServerKey: key as BufferSource };
  // The first await, in the tap: nothing above this line waits.
  let subscribing: Promise<PushSubscription> | null = null;
  let asking: Promise<NotificationPermission> | null = null;
  try {
    if (reg) subscribing = reg.pushManager.subscribe(opts);
    else if (Notification.permission === "default") asking = Notification.requestPermission();
  } catch {
    subscribing = null;
  }
  return finishArm(hour, reg, subscribing, asking, opts, onAccount);
}

async function finishArm(
  hour: number,
  reg: ServiceWorkerRegistration | null,
  subscribing: Promise<PushSubscription> | null,
  asking: Promise<NotificationPermission> | null,
  opts: PushSubscriptionOptionsInit,
  onAccount: (hour: number) => Promise<unknown>
): Promise<ArmResult> {
  const refused = (): ArmResult | null => {
    const p = Notification.permission;
    if (p === "denied") return { ok: false, why: "denied" };
    if (p === "default") return { ok: false, why: "dismissed" };
    return null;
  };
  let sub: PushSubscription | null = null;
  if (subscribing) {
    try {
      sub = await subscribing;
    } catch {
      const no = refused();
      if (no) return no;
    }
  } else if (asking) {
    const p = await asking.catch(() => Notification.permission);
    if (p !== "granted") return { ok: false, why: p === "denied" ? "denied" : "dismissed" };
  }
  if (!sub) {
    // Granted, but no subscription yet: the worker the screen did not
    // have, or one held under an old key. No prompt can come now.
    const r = reg ?? (await readyRegistration());
    if (!r) return { ok: false, why: "no-worker" };
    try {
      sub = await r.pushManager.subscribe(opts);
    } catch {
      try {
        const old = await r.pushManager.getSubscription();
        if (old) await old.unsubscribe();
        sub = await r.pushManager.subscribe(opts);
      } catch {
        return refused() ?? { ok: false, why: "subscribe" };
      }
    }
  }
  const prefs = readPrefs();
  const posted = await postSubscription(sub, hour, prefs);
  if (!posted.ok) return posted;
  writePrefs({ reminderHour: hour });
  void onAccount(hour).catch(() => {});
  return { ok: true, hour };
}

/** What Settings' "Send a test" came to (#430, POST /api/push/test). */
export type TestOutcome = "sent" | "wait" | "gone" | "failed";

/**
 * Send this phone's reminder now, through the whole path the daily one
 * takes. "gone" when the server or the browser no longer holds this
 * phone's subscription: the acknowledgement goes with it, so the screens
 * stop saying the reminder is on.
 */
export async function sendTestPush(reg: ServiceWorkerRegistration | null): Promise<TestOutcome> {
  try {
    const r = reg ?? (await readyRegistration());
    const sub = r ? await r.pushManager.getSubscription() : null;
    if (!sub) {
      writeAck(null);
      return "gone";
    }
    const token = await ensureSession().catch(() => null);
    if (!token) return "failed";
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (res.ok) return "sent";
    if (res.status === 429) return "wait";
    if (res.status === 404 || res.status === 410) {
      writeAck(null);
      return "gone";
    }
    return "failed";
  } catch {
    return "failed";
  }
}

/**
 * Whether the server holds a reminder for this phone at its hour, as far
 * as this phone can tell without asking: notifications granted, and the
 * server's last acknowledgement names the hour set here (#430). An hour
 * picked in the introduction, or restored from the account, is set and
 * not armed, so the ask still comes.
 */
export function armedHere(prefs: Prefs = readPrefs()): boolean {
  try {
    if (prefs.reminderHour === null) return false;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    const ack = JSON.parse(localStorage.getItem(ACK_KEY) ?? "null") as { hour?: unknown; endpoint?: unknown } | null;
    return !!ack && typeof ack.endpoint === "string" && ack.hour === prefs.reminderHour;
  } catch {
    return false;
  }
}

/**
 * The same, checked against the browser's own subscription: an
 * acknowledgement for an endpoint the browser no longer holds (the app
 * removed and added back) is no reminder.
 */
export async function armedHereChecked(reg: ServiceWorkerRegistration | null, prefs: Prefs = readPrefs()): Promise<boolean> {
  if (!armedHere(prefs) || !reg) return false;
  try {
    const sub = await reg.pushManager.getSubscription();
    const ack = JSON.parse(localStorage.getItem(ACK_KEY) ?? "null") as { endpoint?: string } | null;
    return !!sub && sub.endpoint === ack?.endpoint;
  } catch {
    return false;
  }
}

/**
 * What the server last acknowledged holding for this device: its push
 * endpoint and hour. A re-arm that fails (a 502, offline) leaves that row
 * in place, still ringing at its hour, so a local tier on top of it would
 * ring the same day twice (#186). A local subscription alone proves
 * nothing: armPush subscribes before it posts, so a first post that
 * failed leaves a subscription the server never heard of. The zone it
 * was sent with rides along: a tester's days are counted in it
 * (lib/reminders-zone.ts).
 */
const ACK_KEY = PUSH_ACK_KEY;

function writeAck(ack: { endpoint: string; hour: number; tz?: string } | null): void {
  try {
    if (ack) localStorage.setItem(ACK_KEY, JSON.stringify(ack));
    else localStorage.removeItem(ACK_KEY);
  } catch {}
}

async function serverStillHolds(hour: number): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const ack = JSON.parse(localStorage.getItem(ACK_KEY) ?? "null") as {
      endpoint?: string;
      hour?: number;
    } | null;
    return !!sub && ack?.endpoint === sub.endpoint && ack?.hour === hour;
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
    writeAck(null);
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
  // The post failed, but the server may still hold this device at this
  // hour from the last arm that worked: it will ring, so stay dark.
  if (await serverStillHolds(prefs.reminderHour)) return "push";

  // ctx.didToday matters at the OS tier too: a scheduled notification
  // can't check anything at fire time, so the honest day is chosen here.
  const fireAt = nextFireTime(prefs.reminderHour, now, prefs, ctx.didToday);
  if (!fireAt) return null;

  const tier = reminderTier();
  const { title } = reminderCopy({ hour: prefs.reminderHour, onTime: true, last: ctx.last ?? null });
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
      await reg.showNotification(title, {
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
      new Notification(title, payload);
      markFired(at);
    } catch {}
  }, Math.max(0, delay));

  return "open-tab";
}
