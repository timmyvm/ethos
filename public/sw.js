/**
 * Service worker. The daily loop has to survive a train tunnel: the
 * shell and brand assets are cached so the app opens offline, but
 * /api/analyze is never cached — a rep that can't reach the engine
 * should fail honestly rather than return stale numbers.
 */
const CACHE = "ethos-v8";

const SHELL = [
  "/",
  "/games",
  "/history",
  "/you",
  "/lessons",
  /* The lesson art is the Lessons page, so it is shell, not extra. */
  "/lessons/the-landing.webp",
  "/lessons/inside-or-after.webp",
  "/lessons/the-long-one.webp",
  "/lessons/the-cold-open.webp",
  "/lessons/closed-mouth.webp",
  "/lessons/the-crutch.webp",
  "/lessons/finish-it.webp",
  "/lessons/know-the-landing.webp",
  "/lessons/or-rather.webp",
  "/lessons/room-to-land.webp",
  "/lessons/one-gear-down.webp",
  "/lessons/change-gear.webp",
  "/lessons/name-it-once.webp",
  "/lessons/short-and-concrete.webp",
  "/lessons/second-pass.webp",
  "/boss",
  "/hostile",
  "/upload",
  "/settings",
  "/demos.webp",
  "/demos-speaking.webp",
  "/demos-listening.webp",
  "/demos-celebrate.webp",
  "/demos-practice.webp",
  "/demos-asleep.webp",
  "/icon-192.png",
  "/icon-512.png",
  "/coin/coin.svg",
  "/coin/coin-stack.svg",
  "/coin/coin-burst.svg",
  "/coin/coin-empty.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      /*
       * One at a time, NOT addAll. addAll is atomic: a single 404 in
       * SHELL rejects the whole thing and the offline shell ends up
       * empty, and the .catch() here used to swallow exactly that.
       * demos-workout.webp had been deleted in #249 and left in this
       * list, so every install since then cached nothing at all.
       */
      .then((c) =>
        Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))
      )
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
 * A server-sent reminder (web push). The payload carries the words; the
 * server already decided the honest day and hour (/api/push/cron), so
 * this only has to show it.
 */
self.addEventListener("push", (e) => {
  let payload = {
    title: "Ethos",
    body: "Five minutes. One prompt. Take the floor.",
    url: "/rep",
  };
  try {
    payload = { ...payload, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ethos-daily",
      data: { url: payload.url },
    })
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
