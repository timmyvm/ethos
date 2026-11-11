/**
 * Which push subscriptions the server will send to (security audit,
 * 11 Nov).
 *
 * A subscription's endpoint is a URL the phone hands us, and the server
 * later POSTs to it. Taken as it came, anyone signed in (a guest
 * included) could save any address: the server would knock on it for
 * them, and one that never answered held the hourly sender until its
 * time ran out, so nobody's reminder rang. A real endpoint only ever
 * lives at a browser maker's push service, so those hosts are the list.
 */

/** Exact hosts, and suffixes a push service spreads its endpoints over. */
const HOSTS = new Set([
  "fcm.googleapis.com", // Chrome, Edge on Android, Samsung Internet
  "android.googleapis.com", // Chrome's older endpoints
  "jmt17.google.com", // Chrome's newer ones, on some phones
  "updates.push.services.mozilla.com", // Firefox
]);
const SUFFIXES = [
  ".push.apple.com", // Safari, an installed iPhone app (web.push.apple.com)
  ".notify.windows.com", // Edge on Windows
  ".push.services.mozilla.com",
];

/** Longer than any service issues; Apple's run to about 200. */
const MAX_ENDPOINT = 1024;
/** A P-256 point is 87 base64url characters, the auth secret 22. */
const KEY = /^[A-Za-z0-9_\-+/=]{16,128}$/;

export function pushEndpointOk(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return HOSTS.has(host) || SUFFIXES.some((s) => host.endsWith(s));
}

export function pushKeysOk(p256dh: unknown, auth: unknown): boolean {
  return typeof p256dh === "string" && KEY.test(p256dh) && typeof auth === "string" && KEY.test(auth);
}

/** How long one send may take before the sender moves on, in ms. */
export const PUSH_SEND_TIMEOUT_MS = 8000;
/** Phones and browsers one account can hold reminders on. */
export const MAX_SUBSCRIPTIONS = 8;
