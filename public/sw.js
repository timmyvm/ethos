/**
 * Service worker. The daily loop has to survive a train tunnel: the
 * shell and brand assets are cached so the app opens offline, but
 * /api/analyze is never cached — a rep that can't reach the engine
 * should fail honestly rather than return stale numbers.
 */
const CACHE = "ethos-v1";

const SHELL = [
  "/",
  "/path",
  "/history",
  "/you",
  "/demos.webp",
  "/demos-speaking.webp",
  "/demos-listening.webp",
  "/demos-celebrate.webp",
  "/demos-workout.webp",
  "/demos-asleep.webp",
  "/icon-192.webp",
  "/icon-512.webp",
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

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Never serve a cached score, and never cache someone's audio.
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return;
  }

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
