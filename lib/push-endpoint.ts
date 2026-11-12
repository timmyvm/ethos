/**
 * Where a reminder may be sent (#457, the security sweep). A browser's
 * push subscription names the address its maker's push service gave it,
 * and /api/push stored any https address it was handed: the hourly
 * sender then POSTed to it, so a guest could point a row at a server
 * that never answers and stall every reminder after it, or make the
 * server call any host at all. Only the push services browsers use.
 */
const HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung
  /^android\.googleapis\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/, // Safari, iPhone Home Screen apps
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/, // Edge on Windows
];

/** Whether a subscription's endpoint is a real push service's, over https. */
export function pushEndpointAllowed(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && !url.username && !url.password && url.port === "" && HOSTS.some((h) => h.test(url.hostname));
}

/** A subscription's two keys are short base64url strings; anything else is not one. */
export function pushKeyOk(key: unknown, max: number): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= max && /^[A-Za-z0-9_\-=]+$/.test(key);
}

/** How many browsers one account may keep a reminder on. */
export const MAX_SUBSCRIPTIONS = 10;

/** How long one push service gets to answer before the sender moves on, in ms. */
export const PUSH_TIMEOUT_MS = 10_000;
