/**
 * Service worker. The daily loop has to survive a tunnel: the shell and
 * brand assets are cached so the app opens offline, but /api/analyze is
 * never cached: a recording that can't reach the engine should fail
 * honestly rather than return stale numbers.
 *
 * CACHE is bumped when pages or scripts cached by an earlier build must
 * never run again offline; activate deletes every other cache. v17
 * (#428 review): a page cached before #428 loads its own cached scripts
 * offline, and those still hold the curated word map that answered
 * "things" in "switch things up" with "points, ideas, parts". v19
 * (#487): the stat icons are 3D files now, and a page cached before
 * them draws the line flame; the files themselves are shell below. v20
 * (#503): the fifteen lesson files are re-cut at their old paths (bold
 * 3D objects in the stat icons' family), and a .webp is served
 * cache-first, so a phone holding v19 would keep the glass ones. v21
 * (#508): the shell is lighter. The manifest's icons are fetched by the
 * phone itself at install and never drawn by the app, and the lesson
 * art's large cuts are cached the first time a screen draws one (the
 * asset rule below), so neither is pre-cached; v21 empties v20 of them.
 * A cut never drawn here is stood in for, offline, by one of the same
 * lesson the phone holds (lessonStandIn), so no CACHE move.
 * The worker itself registers once the first screen is drawn
 * (components/ServiceWorker.tsx), not beside it.
 */
const CACHE = "ethos-v21";

const SHELL = [
  "/",
  "/games",
  "/history",
  "/you",
  "/lessons",
  /* The lesson art is the Lessons page, so it is shell, not extra.
     These are the URLs the page actually asks for: the cards use a
     plain <img> at the file's own path rather than next/image, whose
     /_next/image?url=…&w=… varies per device and could never be
     pre-cached (#274). */
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
  /* Each lesson's own screen, Today's card and the recorder draw the
     560 cut (public/lessons/large/, #448), cached on first view rather
     than here (#508): fifteen of them on the first open's link is
     280 KB for the one or two a day draws. Offline, a cut not yet
     drawn is answered by the best one of its lesson the phone holds,
     the thumbnail above at worst (lessonStandIn). */
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
  "/splash-demos.webp",
  "/coin/coin.svg",
  "/coin/coin-stack.svg",
  "/coin/coin-burst.svg",
  "/coin/coin-empty.svg",
  /* The stat icons (#487): Today's streak chip is on the first screen
     a returning phone opens, so the flame is shell, and its four
     siblings with it (a few KB each). Hostile Q&A's and the weekly
     boss's marks (#503) lead Today's two games' rows, so they are too. */
  "/icons/3d/streak.webp",
  "/icons/3d/best.webp",
  "/icons/3d/freeze.webp",
  "/icons/3d/xp.webp",
  "/icons/3d/trophy.webp",
  "/icons/3d/hostile.webp",
  "/icons/3d/boss.webp",
  /* The streak moment's flame, cut large (#496): the moment plays on the
     way out of a take, which may be offline. A new path, so no CACHE bump. */
  "/icons/3d/streak-large.webp",
  /* Demos's busts (#488): a picture worn as a pose is in Today's corner,
     the first screen a returning phone opens. New paths, so no CACHE
     bump; a re-cut keeps its path and moves CACHE. */
  "/demos-bust/hello.webp",
  "/demos-bust/speaking.webp",
  "/demos-bust/clock.webp",
  "/demos-bust/celebrate.webp",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      /*
       * One at a time, NOT addAll. addAll is atomic: a single 404 in
       * SHELL rejects the whole thing and the offline shell ends up
       * empty, and the .catch() here used to swallow exactly that.
       * One of Demos's poses had been deleted in #249 and left in this
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
  // The fallback says what lib/reminder-copy.ts says with no take to quote.
  let payload = {
    title: "Today's practice",
    body: "It takes about a minute.",
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
 * A tapped reminder goes straight to the recording screen: the
 * notification exists to start one, so it can't land on a menu.
 */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // Only ever a page of this app, whatever the payload said.
  let url = "/rep";
  try {
    const u = new URL((e.notification.data && e.notification.data.url) || "/rep", self.location.origin);
    if (u.origin === self.location.origin) url = u.pathname + u.search + u.hash;
  } catch {}
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

/*
 * A lesson opened in a tunnel still has its picture (#448), at no cost to
 * the install (the final pass of 18 Nov). Since v21 the large cuts are not
 * shell: each is kept the first time a screen draws it (the asset rule
 * below), and a 3x phone draws Today's object from /lessons/hero/ (#508),
 * so a lesson never opened on this phone, or opened only from Today, had
 * no picture offline. A cut the phone has never fetched is answered, with
 * no network, by the best cut of the same lesson it does hold: the 720,
 * the 560, then the 360 the shell always holds. Only a lesson's own art;
 * anything else missing offline fails as it always did.
 */
const LESSON_ART = /^\/lessons\/(?:(large|hero)\/)?([\w-]+)\.webp$/;

function lessonStandIn(pathname) {
  const m = LESSON_ART.exec(pathname);
  if (!m) return Promise.resolve(undefined);
  const id = m[2];
  const cuts = [`/lessons/hero/${id}.webp`, `/lessons/large/${id}.webp`, `/lessons/${id}.webp`].filter((u) => u !== pathname);
  return cuts.reduce((found, u) => found.then((hit) => hit || caches.match(u)), Promise.resolve(undefined));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Only this app's own files are ever kept. Another origin's answer
  // (the Supabase project's data and signed recordings) goes straight to
  // the network. The test used to be the word "supabase" in the host,
  // which a project on its own domain would not have had.
  if (url.origin !== self.location.origin) return;
  // Never serve a cached score.
  if (url.pathname.startsWith("/api/")) return;

  /*
   * Vercel's own endpoints (Speed Insights' script and its vitals
   * beacon). Telemetry is not app shell: cached, the script would
   * outlive every deploy that fixed it, and an offline miss here should
   * be a dropped measurement rather than a rejected request.
   */
  if (url.pathname.startsWith("/_vercel/")) return;

  /*
   * The on-device pose runtime is ~25MB of WASM plus a 5.5MB model.
   * Left to the rules below it would land in the cache whole: a
   * quota error on a mid-range phone, and an eviction that takes the
   * shell down with it. The browser's own HTTP cache handles repeat
   * loads perfectly well; a first video recording in a tunnel simply
   * reports Voice + Video as unavailable, which is the honest answer.
   */
  if (url.pathname.startsWith("/pose/")) return;

  /*
   * Demos's idle clips (#316). A video is fetched in ranges, Safari
   * refuses a video answered with anything but a real 206, and a cache
   * cannot store a 206 at all. The browser's HTTP cache serves repeats;
   * offline, he stands still, which is what the clip falls back to.
   */
  if (url.pathname.startsWith("/idle/")) return;

  // Network-first for pages so a deploy is picked up immediately;
  // cache-first for static assets.
  const isAsset = /\.(webp|png|svg|woff2?|css|js)$/.test(url.pathname);

  if (isAsset) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request)
            .then((res) => {
              // Only a good answer is kept: a 404 or 500 stored here was
              // served from the cache until the next version.
              if (res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copy));
              }
              return res;
            })
            .catch((err) => lessonStandIn(url.pathname).then((alt) => alt || Promise.reject(err)))
      )
    );
    return;
  }

  // A page opened with something in its query (a sign-in link's ?email=)
  // is served and never kept: the cache would hold that address on a
  // shared phone. Offline it falls back to the page without the query.
  // Next's own ?_rsc= requests are payloads, kept as before.
  const keep = !url.search || url.searchParams.has("_rsc");
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && keep) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then((hit) => hit || (keep ? undefined : caches.match(url.pathname)))
          .then((hit) => hit || caches.match("/"))
      )
  );
});
