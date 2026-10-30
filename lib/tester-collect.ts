/**
 * Tester collection on the phone (consent version 3, migration 0022,
 * docs/testers.md): a device snapshot on each open, what happens on
 * screen, and what breaks, batched and sent to app/api/tester/collect.
 *
 * Loaded only for a tester on consent version 3 or later:
 * components/tester/TesterLayer.tsx reads the account's testers row
 * (and only on a device that last saw it as a tester) before it
 * imports this file at all, so nobody else's phone runs a line of it.
 * The server checks the row again before it keeps anything.
 *
 * What it never takes: text typed into a field (a tap on a field is
 * skipped, and a tap is a control's name, never a value), the tester
 * code (screens are paths without their query; the code is typed into
 * a field), anything outside Ethos (errors from another origin's script
 * are skipped, and the server keeps paths only), and anything once
 * testing stops (sign out, or the server answering stop).
 *
 * Batches go every 20 seconds while there is something to send, and as
 * the page hides (navigator.sendBeacon, which outlives the page). While
 * the phone is offline they wait, up to 200 events, the oldest let go
 * first; nothing is written to storage, so a closed app keeps nothing.
 */

import { capText, EVENT_CAPS, ownStack, screenOf, type ErrorName, type RawEvent, type UsageName } from "./tester-events";
import { setTesterSink, takeEarly, type EarlyError, type RecordSignal } from "./tester-signal";

/** How often a waiting batch is sent. */
export const SEND_EVERY_MS = 20_000;
/** Errors one open reports: a loop that throws every frame says it twenty times, not thousands. */
export const ERRORS_PER_OPEN = EVENT_CAPS.errorsPerOpen;
/** Room left in a body for the token the hiding batch carries. */
const TOKEN_ROOM = 4_000;

/** What the collector needs from the page; the browser's in startCollecting, a fake in the tests. */
export interface CollectorEnv {
  now(): number;
  /** The current path. */
  path(): string;
  online(): boolean;
  /** A fresh access token, or null with no session. */
  token(): Promise<string | null>;
  /** POST the body with the token; resolves to the status (0 for no answer). */
  send(body: string, token: string): Promise<number>;
  /** navigator.sendBeacon: true when the browser took it. */
  beacon(body: string): boolean;
}

/** An id for one open of the app: every event from this page load carries it. */
function openId(now: number): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${now.toString(36)}-${rand}`;
}

type Pushed = Omit<RawEvent, "at" | "open"> & { at?: number };

export class Collector {
  private queue: RawEvent[] = [];
  /** The last few usage events, for an error's "what was on screen". */
  private recent: RawEvent[] = [];
  private readonly open: string;
  private screen: string;
  /** When the current screen became visible, or null while hidden. */
  private since: number | null;
  private acc = 0;
  private cont = false;
  private errors = 0;
  private lastError: { message: string; at: number } | null = null;
  private token: string | null = null;
  private sending = false;
  stopped = false;

  constructor(
    private readonly env: CollectorEnv,
    visible: boolean
  ) {
    const now = env.now();
    this.open = openId(now);
    this.screen = screenOf(env.path()) ?? "/";
    this.since = visible ? now : null;
  }

  /** What is waiting to go (the tests read it). */
  get waiting(): readonly RawEvent[] {
    return this.queue;
  }

  private push(e: Pushed): void {
    if (this.stopped) return;
    const ev: RawEvent = { ...e, at: e.at ?? this.env.now(), open: this.open };
    this.queue.push(ev);
    if (this.queue.length > EVENT_CAPS.queue) this.queue.splice(0, this.queue.length - EVENT_CAPS.queue);
    if (ev.kind === "usage") this.recent = [...this.recent, ev].slice(-EVENT_CAPS.recent);
  }

  /** The phone, once per open. */
  device(data: Record<string, unknown>): void {
    this.push({ kind: "device", name: "open", screen: this.screen, data });
  }

  /** Time on the current screen since it was last counted, as one segment. */
  private segment(): void {
    const now = this.env.now();
    const ms = this.acc + (this.since !== null ? now - this.since : 0);
    if (ms > 0) {
      this.push({ kind: "usage", name: "screen", screen: this.screen, ms, data: this.cont ? { cont: true } : {} });
      this.cont = true;
    }
    this.acc = 0;
    if (this.since !== null) this.since = now;
  }

  /** A new screen: the last one's time is counted first. */
  route(path: string): void {
    const next = screenOf(path) ?? "/";
    if (next === this.screen) return;
    this.segment();
    this.screen = next;
    this.cont = false;
  }

  tap(label: string | null, role: string | null): void {
    this.push({ kind: "usage", name: "tap", screen: this.screen, label: label ?? undefined, data: role ? { role } : {} });
  }

  record(name: RecordSignal, data?: Record<string, unknown>): void {
    this.push({ kind: "usage", name: name as UsageName, screen: this.screen, data: data ?? {} });
  }

  hidden(): void {
    if (this.stopped) return;
    this.push({ kind: "usage", name: "hidden", screen: this.screen });
    this.segment();
    this.since = null;
    this.beaconFlush();
  }

  shown(): void {
    if (this.stopped) return;
    if (this.since === null) this.since = this.env.now();
    this.push({ kind: "usage", name: "shown", screen: this.screen });
    // Back from a pause that may have outlasted the session's token: the
    // batch handed to the beacon as it hides again carries a fresh one.
    void this.primeToken();
  }

  /** The page is going: count the screen and send what is left. */
  leaving(): void {
    if (this.stopped) return;
    this.segment();
    this.beaconFlush();
  }

  /**
   * An error, on the current screen, or on the screen and at the time it
   * happened when that is known (a boundary caught mid-navigation, or one
   * held from before the collector listened).
   */
  error(
    name: ErrorName,
    e: { message?: string | null; where?: string | null; stack?: string | null; digest?: string | null },
    at?: { screen?: string; at?: number }
  ): void {
    if (this.stopped || this.errors >= ERRORS_PER_OPEN) return;
    const now = at?.at ?? this.env.now();
    const message = capText(e.message ?? "", EVENT_CAPS.message) ?? "";
    // The same error again within five seconds is the same error.
    if (this.lastError && this.lastError.message === message && Math.abs(now - this.lastError.at) < 5000) return;
    this.lastError = { message, at: now };
    this.errors++;
    const before = this.recent
      .filter((r) => r.at <= now)
      .map((r) => ({ name: r.name, screen: r.screen, label: r.label, ms: r.ms, ago: now - r.at }));
    this.push({
      kind: "error",
      name,
      at: now,
      screen: (at?.screen && screenOf(at.screen)) || this.screen,
      data: { message, where: e.where ?? undefined, stack: e.stack ?? undefined, digest: e.digest ?? undefined, before },
    });
  }

  /** Up to a batch of the oldest events whose body fits, leaving room for a token. */
  private take(): RawEvent[] {
    const out: RawEvent[] = [];
    let size = 20;
    for (const e of this.queue) {
      if (out.length >= EVENT_CAPS.batch) break;
      const n = JSON.stringify(e).length + 1;
      if (size + n > EVENT_CAPS.body - TOKEN_ROOM) break;
      out.push(e);
      size += n;
    }
    // One event past the cap on its own (it never is: the server's caps
    // are smaller) would block the rest; it goes.
    if (out.length === 0 && this.queue.length) this.queue.shift();
    else this.queue.splice(0, out.length);
    return out;
  }

  private requeue(batch: RawEvent[]): void {
    this.queue = [...batch, ...this.queue].slice(-EVENT_CAPS.queue);
  }

  /** The timer's send: one batch, with the session's token in its header. */
  async flush(): Promise<void> {
    if (this.stopped || this.sending) return;
    // A quiet tick still keeps the token fresh for the next beacon.
    if (this.queue.length === 0) return this.primeToken();
    if (!this.env.online()) return;
    this.sending = true;
    try {
      const token = await this.env.token().catch(() => null);
      this.token = token;
      if (!token || this.stopped) return;
      const batch = this.take();
      if (!batch.length) return;
      const status = await this.env.send(JSON.stringify({ events: batch }), token).catch(() => 0);
      if (status === 403) this.stop();
      else if (status === 200 || status === 400 || status === 413) return;
      else this.requeue(batch);
    } finally {
      this.sending = false;
    }
  }

  /** As the page hides: what is waiting, by beacon, with the last token known. */
  private beaconFlush(): void {
    if (this.stopped || !this.token || !this.env.online()) return;
    for (let i = 0; i < 2 && this.queue.length; i++) {
      const batch = this.take();
      if (!batch.length) break;
      if (!this.env.beacon(JSON.stringify({ events: batch, token: this.token }))) {
        this.requeue(batch);
        break;
      }
    }
  }

  /** Testing stopped here: nothing more is taken, and what waits is let go. */
  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.recent = [];
  }

  /** Refresh the token the hiding batch will carry. */
  async primeToken(): Promise<void> {
    this.token = await this.env.token().catch(() => null);
  }
}

// ---- The page's side ---------------------------------------------------------

/** Never a field: what is typed there is the tester's, not a tap. */
const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
const CONTROL =
  'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="radio"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"]';

/** The part of an element a tap reads (a DOM Element, or a fake in the tests). */
export interface TapTarget {
  tagName: string;
  closest(selector: string): TapTarget | null;
  getAttribute(name: string): string | null;
  textContent: string | null;
  innerText?: string;
  ownerDocument?: { getElementById(id: string): { textContent: string | null } | null } | null;
}

/**
 * A tap, as the consent names it: the control that was tapped, by its
 * accessible name or visible label, and its role. Nothing for a field,
 * for a tap on no control, or for a control marked
 * `data-tester-private` (its name is left out, the tap still counts).
 */
export function tapOf(target: TapTarget | null): { label: string | null; role: string } | null {
  if (!target || typeof target.closest !== "function") return null;
  if (target.closest(FIELD)) return null;
  const el = target.closest(CONTROL);
  if (!el) return null;
  const role = el.getAttribute("role") ?? (el.tagName.toLowerCase() === "a" ? "link" : el.tagName.toLowerCase());
  if (el.closest("[data-tester-private]")) return { label: null, role };
  const by = el.getAttribute("aria-labelledby");
  const labelled = by
    ? by
        .split(/\s+/)
        .map((id) => el.ownerDocument?.getElementById(id)?.textContent ?? "")
        .join(" ")
    : null;
  const label =
    capText(el.getAttribute("aria-label"), EVENT_CAPS.label) ??
    capText(labelled, EVENT_CAPS.label) ??
    capText(el.innerText ?? el.textContent, EVENT_CAPS.label) ??
    capText(el.getAttribute("title"), EVENT_CAPS.label);
  return { label, role };
}

type UAData = {
  platform?: string;
  mobile?: boolean;
  brands?: { brand: string; version: string }[];
  getHighEntropyValues?: (hints: string[]) => Promise<{
    model?: string;
    platformVersion?: string;
    fullVersionList?: { brand: string; version: string }[];
  }>;
};
type Connection = { type?: string; effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };

/** The phone, as the consent names it, from what the browser gives. */
export async function deviceSnapshot(): Promise<Record<string, unknown>> {
  const nav = navigator as Navigator & { userAgentData?: UAData; connection?: Connection; standalone?: boolean };
  const uad = nav.userAgentData;
  let hints: Awaited<ReturnType<NonNullable<UAData["getHighEntropyValues"]>>> = {};
  try {
    if (uad?.getHighEntropyValues) {
      hints =
        (await Promise.race([
          uad.getHighEntropyValues(["model", "platformVersion", "fullVersionList"]),
          new Promise<undefined>((r) => setTimeout(() => r(undefined), 1000)),
        ])) ?? {};
    }
  } catch {}
  const media = (q: string) => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  const display =
    (["fullscreen", "standalone", "minimal-ui"] as const).find((m) => media(`(display-mode: ${m})`)) ?? "browser";
  const conn = nav.connection;
  const brands = (hints.fullVersionList ?? uad?.brands ?? [])
    .filter((b) => !/not.?a.?brand/i.test(b.brand))
    .map((b) => `${b.brand} ${b.version}`)
    .join(", ");
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  return {
    ua: nav.userAgent,
    platform: uad?.platform || nav.platform || undefined,
    platform_version: hints.platformVersion || undefined,
    model: hints.model || undefined,
    brands: brands || undefined,
    mobile: uad?.mobile,
    screen_w: window.screen?.width,
    screen_h: window.screen?.height,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio,
    lang: nav.language,
    langs: Array.from(nav.languages ?? []).slice(0, 5),
    tz,
    tz_offset: new Date().getTimezoneOffset(),
    display,
    home_screen: display === "standalone" || display === "fullscreen" || nav.standalone === true,
    connection: conn?.type,
    effective: conn?.effectiveType,
    downlink: conn?.downlink,
    rtt: conn?.rtt,
    save_data: conn?.saveData,
  };
}

/** A path from a script URL on this origin, or null for one that is not Ethos's. */
function ownPath(file: string | undefined, origin: string): string | null | undefined {
  if (!file) return undefined;
  try {
    const u = new URL(file, origin);
    return u.origin === origin ? u.pathname : null;
  } catch {
    return null;
  }
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

function describe(e: unknown): { message: string; stack: string | null } {
  if (e instanceof Error) return { message: `${e.name}: ${e.message}`, stack: e.stack ?? null };
  if (typeof e === "string") return { message: e, stack: null };
  try {
    return { message: JSON.stringify(e)?.slice(0, EVENT_CAPS.message) ?? String(e), stack: null };
  } catch {
    return { message: String(e), stack: null };
  }
}

type Report = { message: string; where?: string | null; stack: string | null };

/**
 * A window error as Ethos reports it, or null when it is not Ethos's: a
 * script on another origin (an extension, a cross-origin "Script
 * error."), or a stack that names only other sites. The file keeps its
 * path only, and the stack only this origin's lines.
 */
export function windowReport(
  ev: { message?: string | null; filename?: string | null; lineno?: number; colno?: number; error?: unknown },
  origin: string
): Report | null {
  const path = ownPath(ev.filename ?? undefined, origin);
  if (path === null || (!ev.filename && /^script error\.?$/i.test(ev.message ?? ""))) return null;
  const d = describe(ev.error ?? ev.message);
  const own = ownStack(d.stack, hostOf(origin));
  if (own.foreign) return null;
  return {
    message: ev.message || d.message,
    where: path ? `${path}:${ev.lineno ?? 0}:${ev.colno ?? 0}` : null,
    stack: own.stack,
  };
}

/**
 * An unhandled rejection as Ethos reports it, or null when its stack
 * names only other sites (a browser extension's, say: review P5). One
 * with no stack to tell by is kept (a failed fetch has none).
 */
export function rejectionReport(reason: unknown, origin: string): Report | null {
  const d = describe(reason);
  const own = ownStack(d.stack, hostOf(origin));
  return own.foreign ? null : { message: d.message, stack: own.stack };
}

/** What broke before the collector listened (lib/tester-signal.ts), reported now, each on its own screen and time. */
export function replayEarly(c: Collector, held: readonly EarlyError[], origin: string): void {
  for (const e of held) {
    const at = { screen: e.screen, at: e.at };
    if (e.name === "boundary") {
      const d = describe(e.error);
      c.error("boundary", { ...d, stack: ownStack(d.stack, hostOf(origin)).stack, digest: e.digest ?? null }, at);
      continue;
    }
    const r =
      e.name === "window"
        ? windowReport({ message: e.message, filename: e.file, lineno: e.line, colno: e.col, error: e.error }, origin)
        : rejectionReport(e.error, origin);
    if (r) c.error(e.name, r, at);
  }
}

export interface Collecting {
  route(path: string): void;
  stop(): void;
}

/**
 * Start on this page: listeners, the timer, the device snapshot, and the
 * sink the recording screen and the error boundary call. Returns the
 * route hook and the stop.
 */
export function startCollecting({
  token,
  endpoint = "/api/tester/collect",
}: {
  token: () => Promise<string | null>;
  endpoint?: string;
}): Collecting {
  const env: CollectorEnv = {
    now: () => Date.now(),
    path: () => window.location.pathname,
    online: () => navigator.onLine !== false,
    token,
    send: async (body, t) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body,
          keepalive: true,
        });
        return res.status;
      } catch {
        return 0;
      }
    },
    beacon: (body) => {
      try {
        return typeof navigator.sendBeacon === "function" && navigator.sendBeacon(endpoint, body);
      } catch {
        return false;
      }
    },
  };
  const c = new Collector(env, document.visibilityState !== "hidden");
  void c.primeToken();
  void deviceSnapshot().then((d) => c.device(d));

  const onClick = (ev: MouseEvent) => {
    const tap = tapOf(ev.target as unknown as TapTarget | null);
    if (tap) c.tap(tap.label, tap.role);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") c.hidden();
    else c.shown();
  };
  const onLeave = () => c.leaving();
  const origin = window.location.origin;
  // Another origin's script (an extension, a cross-origin "Script
  // error.", Google's sign-in) is not Ethos's to report.
  const onError = (ev: ErrorEvent) => {
    const r = windowReport(ev, origin);
    if (r) c.error("window", r);
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    const r = rejectionReport(ev.reason, origin);
    if (r) c.error("rejection", r);
  };

  document.addEventListener("click", onClick, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onLeave);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  const timer = window.setInterval(() => void c.flush(), SEND_EVERY_MS);
  setTesterSink({
    record: (name, data) => c.record(name, data),
    boundary: (error, digest, screen) => {
      const d = describe(error);
      c.error("boundary", { ...d, stack: ownStack(d.stack, hostOf(origin)).stack, digest: digest ?? null }, { screen });
    },
  });
  // What broke before this ran: the first screen's crash among it.
  replayEarly(c, takeEarly(), origin);

  return {
    route: (path) => c.route(path),
    stop: () => {
      c.stop();
      setTesterSink(null);
      window.clearInterval(timer);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    },
  };
}
