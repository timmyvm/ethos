/**
 * What a tester's phone sends about the app (consent version 3,
 * migration 0022, docs/testers.md): the event shapes, every cap, and the
 * one cleaner the server runs on each field before anything is written.
 *
 * Three kinds, one table (public.tester_events):
 *   device  `open`: a snapshot of the phone on each open of the app.
 *   usage   `screen` (time on it), `tap` (a button or link by its
 *           visible label or accessible name), `shown` and `hidden`,
 *           `record_start` and `record_stop`.
 *   error   `window`, `rejection`, `boundary` (app/error.tsx), with the
 *           screen and the last few usage events: what was on screen.
 *
 * What is never here, by construction: text typed into a field (a tap
 * is a button's or a link's name; fields are skipped on the phone and
 * nothing here has a slot for a value), the tester code (a path never
 * keeps its query, and the code page's field is a field), anything from
 * outside Ethos (an error's file and stack keep paths only, and lines
 * from other origins go), and anything for a non-tester (the route
 * checks the testers row before it reads a field).
 *
 * Pure, so the route, the collector and the tests share one set of caps.
 */

/** Collection began with the consent that named it. */
export const COLLECTS_FROM_VERSION = 3;

export const EVENT_NAMES = {
  device: ["open"],
  usage: ["screen", "tap", "shown", "hidden", "record_start", "record_stop"],
  error: ["window", "rejection", "boundary"],
} as const;

export type EventKind = keyof typeof EVENT_NAMES;
export type UsageName = (typeof EVENT_NAMES)["usage"][number];
export type ErrorName = (typeof EVENT_NAMES)["error"][number];

export const EVENT_CAPS = {
  /** Events in one request. */
  batch: 40,
  /** Characters in one request's body. */
  body: 32_000,
  /** Events the phone holds while it cannot send; past this the oldest go. */
  queue: 200,
  /** Usage events an error carries as what was on screen. */
  recent: 5,
  screen: 120,
  label: 80,
  message: 300,
  where: 200,
  stack: 1500,
  ua: 400,
  short: 64,
  /** Time on one screen, at most a day (the column's own cap). */
  ms: 86_400_000,
  /** How far back a phone's clock is taken as given (a week offline). */
  past: 7 * 86_400_000,
  /** How far ahead: a phone's clock a little fast. */
  ahead: 5 * 60_000,
  /** Rows one account keeps: about forty times a heavy day of testing. */
  perAccount: 30_000,
} as const;

/** One event as the phone queues it. */
export interface RawEvent {
  kind: EventKind;
  name: string;
  /** When, on the phone's clock (ms since 1970). */
  at: number;
  /** The open it belongs to. */
  open?: string;
  screen?: string;
  label?: string;
  ms?: number;
  data?: Record<string, unknown>;
}

/** One row of public.tester_events, before the route adds the owner and the address. */
export interface EventRow {
  kind: EventKind;
  name: string;
  open_id: string | null;
  screen: string | null;
  label: string | null;
  ms: number | null;
  data: Record<string, unknown>;
  at: string;
}

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** A string cut to `max` characters (never half an emoji), whitespace collapsed; null when empty. */
export function capText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return Array.from(t).slice(0, max).join("").trim() || null;
}

/** A finite number inside [min, max], or null. */
function inRange(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function int(v: unknown, min: number, max: number): number | null {
  const n = inRange(v, min, max);
  return n === null ? null : Math.round(n);
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/** Keys with a value, so a missing field is absent rather than null. */
function present(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}

/**
 * A screen as the report names it: the path alone (no query, no hash,
 * so no code, token or search ever rides along), any host taken off, a
 * recording's id as [id] so the Log's pages count as one screen.
 */
export function screenOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let path = raw.trim().replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
  path = path.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/").replace(UUID_SEGMENT, "/[id]");
  if (path.length > 1) path = path.replace(/\/$/, "");
  return capText(path, EVENT_CAPS.screen);
}

/** Origins off every URL in a string: an error says which file of Ethos, never a host. */
function withoutOrigins(s: string): string {
  return s.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^/\s)]*/gi, "");
}

/** Stack lines from another origin (an extension, an injected script) are not Ethos's: they go. */
export function cleanStack(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const lines = raw
    .split("\n")
    .filter((l) => !/(chrome|moz|safari|safari-web)-extension:|webkit-masked-url:/i.test(l))
    .map((l) => withoutOrigins(l).trimEnd())
    .filter(Boolean);
  const out = lines.join("\n");
  return out ? Array.from(out).slice(0, EVENT_CAPS.stack).join("") : null;
}

const DISPLAY = ["standalone", "fullscreen", "minimal-ui", "browser"] as const;

/**
 * The phone's operating system and browser, read from what it sent: the
 * user agent, and the client hints where the browser gives them (Chrome
 * on Android gives the model and the real version; Safari gives none).
 */
export function describeDevice(d: {
  ua?: string | null;
  platform?: string | null;
  platform_version?: string | null;
  model?: string | null;
  brands?: string | null;
}): { os: string | null; browser: string | null; model: string | null } {
  const ua = d.ua ?? "";
  let os: string | null = null;
  const ios = ua.match(/\b(iPhone|iPad|iPod)\b.*? OS (\d+)[_.](\d+)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const major = d.platform_version?.split(".")[0];
  if (ios) os = `iOS ${ios[2]}.${ios[3]}`;
  else if (android || d.platform === "Android") os = `Android ${major && major !== "0" ? major : (android?.[1] ?? "")}`.trim();
  else if (/Windows NT/.test(ua) || d.platform === "Windows") os = "Windows";
  else if (/Mac OS X/.test(ua) || d.platform === "macOS") os = "macOS";
  else if (/CrOS/.test(ua) || d.platform === "Chrome OS") os = "ChromeOS";
  else if (/Linux/.test(ua) || d.platform === "Linux") os = "Linux";

  const pick: [RegExp, string][] = [
    [/EdgA?\/(\d+)/, "Edge"],
    [/EdgiOS\/(\d+)/, "Edge"],
    [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/CriOS\/(\d+)/, "Chrome"],
    [/FxiOS\/(\d+)/, "Firefox"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/OPR\/(\d+)/, "Opera"],
    [/Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+(?:\.\d+)?).*Safari/, "Safari"],
  ];
  let browser: string | null = null;
  for (const [re, name] of pick) {
    const m = ua.match(re);
    if (m) {
      browser = `${name} ${m[1]}`;
      break;
    }
  }
  // A home-screen app on an iPhone sends no Safari token at all.
  if (!browser && ios) browser = "Safari (home screen)";

  const model = capText(d.model, EVENT_CAPS.short) ?? (ios ? ios[1] : null);
  return { os: capText(os, EVENT_CAPS.short), browser: capText(browser, EVENT_CAPS.short), model };
}

/** The device snapshot, field by field: anything not named here is not kept. */
export function cleanDevice(raw: Record<string, unknown>): Record<string, unknown> {
  const s = (k: string, max: number = EVENT_CAPS.short) => capText(raw[k], max);
  const base = {
    ua: s("ua", EVENT_CAPS.ua),
    platform: s("platform"),
    platform_version: s("platform_version"),
    model: s("model"),
    brands: s("brands", 120),
    mobile: bool(raw.mobile),
    screen_w: int(raw.screen_w, 0, 20_000),
    screen_h: int(raw.screen_h, 0, 20_000),
    viewport_w: int(raw.viewport_w, 0, 20_000),
    viewport_h: int(raw.viewport_h, 0, 20_000),
    dpr: inRange(raw.dpr, 0.1, 10),
    lang: s("lang", 35),
    langs: Array.isArray(raw.langs)
      ? raw.langs.map((l) => capText(l, 35)).filter((l): l is string => !!l).slice(0, 5)
      : null,
    tz: s("tz"),
    tz_offset: int(raw.tz_offset, -900, 900),
    display: DISPLAY.find((m) => m === raw.display) ?? null,
    home_screen: bool(raw.home_screen),
    connection: s("connection", 20),
    effective: s("effective", 10),
    downlink: inRange(raw.downlink, 0, 10_000),
    rtt: int(raw.rtt, 0, 60_000),
    save_data: bool(raw.save_data),
  };
  const described = describeDevice({
    ua: base.ua,
    platform: base.platform,
    platform_version: base.platform_version,
    model: base.model,
    brands: base.brands,
  });
  return present({ ...base, ...described, langs: base.langs?.length ? base.langs : null });
}

function cleanUsageData(name: UsageName, raw: Record<string, unknown>): Record<string, unknown> {
  if (name === "screen") return raw.cont === true ? { cont: true } : {};
  if (name === "tap") return present({ role: capText(raw.role, 20) });
  if (name === "record_start") return present({ video: bool(raw.video) });
  if (name === "record_stop") {
    return present({ seconds: inRange(raw.seconds, 0, 3600), discarded: bool(raw.discarded) });
  }
  return {};
}

/** What was on screen before an error: the last few usage events, names and labels only. */
function cleanBefore(raw: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  const usage = EVENT_NAMES.usage as readonly string[];
  const out = raw
    .slice(-EVENT_CAPS.recent)
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .filter((e) => typeof e.name === "string" && usage.includes(e.name))
    .map((e) =>
      present({
        name: e.name,
        screen: screenOf(e.screen),
        label: capText(e.label, EVENT_CAPS.label),
        ms: int(e.ms, 0, EVENT_CAPS.ms),
        ago: int(e.ago, 0, EVENT_CAPS.past),
      })
    );
  return out.length ? out : null;
}

function cleanErrorData(raw: Record<string, unknown>): Record<string, unknown> {
  return present({
    message: capText(typeof raw.message === "string" ? withoutOrigins(raw.message) : null, EVENT_CAPS.message),
    where: capText(typeof raw.where === "string" ? withoutOrigins(raw.where) : null, EVENT_CAPS.where),
    stack: cleanStack(raw.stack),
    digest: capText(raw.digest, 40),
    before: cleanBefore(raw.before),
  });
}

/** Bytes, as the column's size check counts them (near enough: jsonb adds a little). */
function bytes(o: unknown): number {
  return new TextEncoder().encode(JSON.stringify(o)).length;
}

/**
 * Data that fits the column (0022: 6000 bytes) with room to spare: an
 * error long in four-byte characters gives up its stack first, then
 * what was on screen, never the row.
 */
export function fitted(data: Record<string, unknown>, max = 5000): Record<string, unknown> {
  let out = data;
  for (const key of ["stack", "before", "ua", "brands"]) {
    if (bytes(out) <= max) return out;
    if (key in out) {
      const { [key]: _gone, ...rest } = out;
      out = rest;
    }
  }
  return bytes(out) <= max ? out : {};
}

/** One event, every field checked and capped, or null when it is not one Ethos sends. */
export function cleanEvent(raw: unknown, now: Date): EventRow | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const kind = typeof e.kind === "string" && Object.hasOwn(EVENT_NAMES, e.kind) ? (e.kind as EventKind) : null;
  if (!kind) return null;
  const names = EVENT_NAMES[kind] as readonly string[];
  const name = typeof e.name === "string" && names.includes(e.name) ? e.name : null;
  if (!name) return null;
  const data = e.data && typeof e.data === "object" && !Array.isArray(e.data) ? (e.data as Record<string, unknown>) : {};

  const t = now.getTime();
  const at = typeof e.at === "number" && e.at >= t - EVENT_CAPS.past && e.at <= t + EVENT_CAPS.ahead ? e.at : t;
  const open = typeof e.open === "string" && /^[A-Za-z0-9-]{1,40}$/.test(e.open) ? e.open : null;

  return {
    kind,
    name,
    open_id: open,
    screen: screenOf(e.screen),
    label: kind === "usage" && name === "tap" ? capText(e.label, EVENT_CAPS.label) : null,
    ms:
      kind === "usage" && name === "screen" && typeof e.ms === "number" && Number.isFinite(e.ms)
        ? Math.min(EVENT_CAPS.ms, Math.max(0, Math.round(e.ms)))
        : null,
    data: fitted(
      kind === "device"
        ? cleanDevice(data)
        : kind === "usage"
          ? cleanUsageData(name as UsageName, data)
          : cleanErrorData(data)
    ),
    at: new Date(at).toISOString(),
  };
}

/** A batch from the phone: at most `batch` events, each cleaned; the ones that are not events go. */
export function cleanEvents(raw: unknown, now = new Date()): EventRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, EVENT_CAPS.batch)
    .map((e) => cleanEvent(e, now))
    .filter((e): e is EventRow => e !== null);
}
