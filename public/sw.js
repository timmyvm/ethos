/**
 * Service worker. The daily loop has to survive a train tunnel: the
 * shell and brand assets are cached so the app opens offline, but
 * /api/analyze is never cached — a rep that can't reach the engine
 * should fail honestly rather than return stale numbers.
 */
const CACHE = "ethos-v3";

const SHELL = [
  "/",
  "/path",
  "/history",
  "/you",
  "/boss",
  "/settings",
  "/demos.webp",
  "/demos-speaking.webp",
  "/demos-listening.webp",
  "/demos-celebrate.webp",
  "/demos-workout.webp",
  "/demos-asleep.webp",
  "/icon-192.webp",
  "/icon-512.webp",
  "/coin/coin.svg",
  "/coin/coin-stack.svg",
  "/coin/coin-burst.svg",
  "/coin/coin-empty.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * A tapped reminder goes straight to the rep — the notification exists
 * to start one, so it can't land on a menu.
 */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/rep";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Never serve a cached score, and never cache someone's audio.
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return;
  }

  /*
   * The on-device pose runtime is ~25MB of WASM plus a 5.5MB model.
   * Left to the rules below it would land in the cache whole — a
   * quota error on a mid-range phone, and an eviction that takes the
   * shell down with it. The browser's own HTTP cache handles repeat
   * loads perfectly well; a first video rep in a tunnel simply reports
   * Voice + Video as unavailable, which is the honest answer.
   */
  if (url.pathname.startsWith("/pose/")) return;

  // Network-first for pages so a deploy is picked up immediately;
  // cache-first for static assets.
  const isAsset = /\.(webp|png|svg|woff2?|css|js)$/.test(url.pathname);

  if (isAsset) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
      )
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/")))
  );
});
