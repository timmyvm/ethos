/**
 * Speed, measured (#499, Timothy 18 Nov: "I wanna really optimise for
 * speed like really well"). A phone on mobile data against a production
 * build, every number written to docs/speed/<label>.json so the next run
 * is compared against this one, not against a feeling.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3951 &
 *   LOOK_BASE=http://localhost:3951 PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/measure-speed.mjs baseline
 *
 * The phone: Chromium at 390x844 and 3x, the CPU slowed 4x (CDP), and
 * every byte through a proxy in this script that holds each request for
 * a round trip (150 ms, two more for a new connection's handshake) and
 * shares 1.6 Mbps down and 750 kbps up between everything in flight.
 * The proxy, not CDP's network throttle, so the service worker's own
 * fetches are slowed too and the bytes counted are the bytes on the wire.
 * Supabase is the look loop's mock (scripts/look-fixtures.mjs), answered
 * by the proxy for http://supabase.local after SUPA_MS of server time.
 *
 * Scenes (ONLY=a,b to run some):
 *   routes   each screen cold (empty cache, no service worker) and warm
 *            (the same screen opened again with the worker installed)
 *   sw       the service worker's install (bytes, time) and an open offline
 *   tabs     Today, Log, You, Lessons, Practice and back, tap to painted
 *   doors    Today's Start to the recorder, Today to Hostile Q&A (its row
 *            under the card since #500, which took the trait tiles), Lessons
 *            to a lesson, the Log to a recording
 *   open     Today as the installed app opens it: the splash, then Today
 *   room     /welcome on a first open, and "/" (start_url) to the room
 *   upload   what a 60 s take weighs as Chromium records it, and the
 *            send's time on the uplink
 *   stop     the wait after Stop, stage by stage, against a server started
 *            with the stubs (scripts/speed-stubs.mjs; STOP_BASE names it)
 *
 * Env: RUNS (3, the median is kept), PROFILE (phone | fast), SUPA_MS (40),
 * ROUTES (route scene names, e.g. today,you), MERGE=1 (keep the rest of an
 * earlier <label>.json and replace only what this run measured),
 * BUILD_DIR (.next-build: the first-load JS table is read from it),
 * STOP_BASE (a stubbed server for the stop scene, skipped without one).
 *
 * "ready" is the first frame in which the screen's own data is drawn and
 * React has taken the page over: no skeleton (in the viewport on Today,
 * You and a recording; anywhere in <main> elsewhere) and the screen's
 * mark of its data present (READY below). It is what a person waits for;
 * FCP and LCP are the browser's own and stand beside it.
 */
import http from "node:http";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { supabaseRoute, session, seed } from "./look-fixtures.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = process.argv[2] ?? "run";
/** An earlier run of this label, read once for MERGE=1 (writeOut). */
let priorRead;
const BASE = (process.env.LOOK_BASE ?? "http://localhost:3951").replace(/\/$/, "");
const RUNS = Math.max(1, Number(process.env.RUNS ?? 3) || 3);
const SUPA_MS = Number(process.env.SUPA_MS ?? 40);
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const want = (scene) => ONLY.length === 0 || ONLY.includes(scene);
const PROFILES = {
  phone: { cpu: 4, downBps: 1.6e6 / 8, upBps: 0.75e6 / 8, rtt: 150, handshakeRtts: 2 },
  fast: { cpu: 1, downBps: Infinity, upBps: Infinity, rtt: 0, handshakeRtts: 0 },
};
const PROFILE_NAME = process.env.PROFILE ?? "phone";
const P = PROFILES[PROFILE_NAME];
if (!P) throw new Error(`PROFILE=${PROFILE_NAME} is not one of ${Object.keys(PROFILES).join(", ")}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const now = () => performance.now();
const median = (xs) => {
  const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const round = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : x ?? null);

// ---- The link: a proxy that is the phone's mobile data ----------------------

/** What a response is, for the bytes table. */
function kindOf(url, type, method) {
  if (method === "OPTIONS") return "preflight";
  if (/supabase\.local/.test(url)) return "data";
  if (/\/api\//.test(url)) return "api";
  if (/_rsc=/.test(url) || /x-component/.test(type)) return "rsc";
  if (/html/.test(type)) return "doc";
  if (/javascript/.test(type) || /\.js(\?|$)/.test(url)) return "js";
  if (/css/.test(type)) return "css";
  if (/font|woff/.test(type) || /\.woff2?$/.test(url)) return "font";
  if (/^image\//.test(type)) return "img";
  if (/^(video|audio)\//.test(type)) return "media";
  return "other";
}

function startLink() {
  const log = [];
  const state = { phase: "idle", warm: new Set(), inflight: 0 };
  const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
  // One downlink shared by everything in flight, round robin.
  const queue = [];
  let tokens = 0;
  let last = now();
  const pump = () => {
    const t = now();
    tokens = Math.min(tokens + ((t - last) / 1000) * P.downBps, P.downBps * 0.05 + 16384);
    last = t;
    while (tokens >= 1 && queue.length) {
      const item = queue.shift();
      const n = Math.min(Math.floor(tokens), item.buf.length - item.off, 8192);
      item.res.write(item.buf.subarray(item.off, item.off + n));
      item.entry.bytes += n;
      item.off += n;
      tokens -= n;
      if (item.off < item.buf.length) queue.push(item);
      else item.done();
    }
  };
  const ticker = setInterval(pump, 4);
  const send = (res, entry, buf) =>
    new Promise((resolve) => {
      if (!buf.length) return resolve();
      if (!Number.isFinite(P.downBps)) {
        res.write(buf);
        entry.bytes += buf.length;
        return resolve();
      }
      queue.push({ res, entry, buf, off: 0, done: resolve });
    });

  const server = http.createServer(async (req, res) => {
    const t0 = now();
    let target;
    try {
      target = new URL(req.url);
    } catch {
      target = new URL(req.url, BASE);
    }
    const entry = {
      phase: state.phase, url: target.href.replace(BASE, ""), host: target.host, method: req.method,
      start: t0, ttfb: null, end: null, bytes: 0, status: 0, type: "", kind: "", handshake: false, upBytes: 0,
    };
    log.push(entry);
    state.inflight++;
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      entry.upBytes = body.length;
      let hold = P.rtt / 2 + (Number.isFinite(P.upBps) ? (body.length / P.upBps) * 1000 : 0);
      if (!state.warm.has(target.host)) {
        state.warm.add(target.host);
        entry.handshake = true;
        hold += P.rtt * P.handshakeRtts;
      }
      await sleep(hold);
      let status, headers, out, stream;
      if (target.hostname === "supabase.local") {
        await sleep(SUPA_MS);
        ({ status, headers, body: out } = await mockSupabase(req, target, body));
      } else {
        ({ status, headers, stream } = await forward(req, target, body, agent));
      }
      await sleep(P.rtt / 2);
      entry.status = status;
      entry.type = String(headers["content-type"] ?? "");
      entry.kind = kindOf(target.href, entry.type, req.method);
      entry.ttfb = now();
      delete headers.connection;
      delete headers["keep-alive"];
      if (out) {
        delete headers["transfer-encoding"];
        headers["content-length"] = String(out.length);
      }
      res.writeHead(status, headers);
      if (out) await send(res, entry, out);
      else {
        // Passed on as it arrives, so a streamed answer (/api/analyze's lines) streams.
        for await (const chunk of stream) await send(res, entry, chunk);
      }
      res.end();
    } catch (e) {
      entry.status = 599;
      entry.error = String(e?.message ?? e);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    } finally {
      entry.end = now();
      state.inflight--;
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: server.address().port,
        log,
        state,
        /** A new open of the app: connections are made again. */
        visit(phase) {
          state.phase = phase;
          state.warm = new Set();
        },
        phase(phase) {
          state.phase = phase;
        },
        async quiet(ms = 1000, cap = 15000) {
          const until = now() + cap;
          let calm = now();
          while (now() < until) {
            if (state.inflight > 0) calm = now();
            else if (now() - calm >= ms) return;
            await sleep(50);
          }
        },
        close() {
          clearInterval(ticker);
          server.close();
          agent.destroy();
        },
      })
    )
  );
}

/** The app's own server, its answer passed on as it comes (compressed as Next sent it). */
function forward(req, target, body, agent) {
  return new Promise((resolve, reject) => {
    const headers = { ...req.headers, host: target.host };
    delete headers["proxy-connection"];
    const r = http.request(
      { host: target.hostname, port: target.port || 80, method: req.method, path: target.pathname + target.search, headers, agent },
      (res) => resolve({ status: res.statusCode, headers: { ...res.headers }, stream: res })
    );
    r.on("error", reject);
    r.end(body);
  });
}

/**
 * The fixtures answer every read with whole rows; PostgREST answers only
 * the columns asked for. A plain `select=a,b,c` is applied here, so the
 * spine's four columns weigh what they would on the wire.
 */
function selected(url, body) {
  const sel = url.searchParams.get("select");
  if (!sel || /[:()>*]/.test(sel) || typeof body !== "string") return body;
  try {
    const cols = sel.split(",").map((c) => c.trim());
    const pick = (row) => (row && typeof row === "object" ? Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]])) : row);
    const data = JSON.parse(body);
    return JSON.stringify(Array.isArray(data) ? data.map(pick) : pick(data));
  } catch {
    return body;
  }
}

/** The look loop's Supabase (scripts/look-fixtures.mjs), behind a Playwright-shaped route. */
function mockSupabase(req, url, body) {
  return new Promise((resolve) => {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const route = {
      request: () => ({
        url: () => url.href,
        method: () => req.method,
        headers: () => headers,
        postData: () => (body.length ? body.toString() : null),
        postDataJSON: () => JSON.parse(body.toString()),
      }),
      fulfill: async (r) => {
        const h = Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
        if (r.contentType) h["content-type"] = r.contentType;
        resolve({ status: r.status ?? 200, headers: h, body: Buffer.from(selected(url, r.body ?? "")) });
      },
      continue: async () => resolve({ status: 204, headers: {}, body: Buffer.alloc(0) }),
      abort: async () => resolve({ status: 599, headers: {}, body: Buffer.alloc(0) }),
    };
    Promise.resolve(supabaseRoute(route)).catch((e) => resolve({ status: 500, headers: {}, body: Buffer.from(String(e)) }));
  });
}

// ---- In the page: the browser's own numbers and "ready" ---------------------

/* Runs before any of the page's scripts in every document (an init
   script), so nothing is missed. READY is keyed by path. */
function pageProbe() {
  if (window.top !== window) return;
  const S = (window.__speed = {
    fcp: null, lcp: null, lcpWhat: null, shifts: [], longtasks: [], ready: null, readyPath: null,
    target: null, tapAt: null, splash: { on: null, out: null, gone: null },
  });
  const describe = (el) => {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    if (tag === "img") return `img ${el.currentSrc.replace(location.origin, "")}`;
    return `${tag}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} "${(el.textContent || "").trim().slice(0, 40)}"`;
  };
  const obs = (type, fn) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true });
    } catch {}
  };
  obs("paint", (e) => e.name === "first-contentful-paint" && (S.fcp = e.startTime));
  obs("largest-contentful-paint", (e) => {
    S.lcp = e.startTime;
    S.lcpWhat = describe(e.element) + (e.url && !/^img/.test(describe(e.element) ?? "") ? ` ${e.url.replace(location.origin, "")}` : "");
  });
  obs("layout-shift", (e) => !e.hadRecentInput && S.shifts.push([e.startTime, e.value]));
  obs("longtask", (e) => S.longtasks.push([e.startTime, e.duration]));
  // documentElement can still be missing when an init script runs: watch the document.
  new MutationObserver(() => {
    const v = document.documentElement?.getAttribute("data-splash") ?? null;
    if (v === "on" && S.splash.on === null) S.splash.on = performance.now();
    if (v === "out" && S.splash.out === null) S.splash.out = performance.now();
    if (v === null && S.splash.on !== null && S.splash.gone === null) S.splash.gone = performance.now();
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-splash"] });

  const inView = (el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
  };
  const skel = () => [...document.querySelectorAll('.skeleton, [aria-busy="true"]')].some(inView);
  const skelAnywhere = () => !!document.querySelector('main .skeleton, main [aria-busy="true"]');
  // React has taken the server's markup over: a tap would now do something.
  const hydrated = () => {
    const m = document.querySelector("main");
    return !!m && Object.keys(m).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
  };
  const main = () => document.querySelector("main");
  const text = () => (main()?.textContent ?? "").replace(/\s+/g, " ");
  const h1 = () => (document.querySelector("main h1, h1")?.textContent ?? "").trim();
  const READY = [
    [/^\/$/, () => h1().length > 1 && !skel() && !!document.querySelector('main a[href^="/rep"]')],
    [/^\/rep$/, () => hydrated() && h1().length > 3 && [...document.querySelectorAll("main button")].some((b) => /^Record/.test((b.getAttribute("aria-label") || b.textContent || "").trim()) && inView(b))],
    [/^\/rep\/[^/]+$/, () => !skel() && /\/\s?1000/.test(text())],
    [/^\/you$/, () => !skel() && /Level \d/.test(text())],
    [/^\/welcome$/, () => /Hold to step in/.test(text())],
    [/^\/(signin|signup)$/, () => hydrated() && !!document.querySelector('main input[type="email"]')],
    [/.*/, () => hydrated() && !skelAnywhere() && h1().length > 1 && text().length > 80],
  ];
  const ready = () => {
    if (S.target && location.pathname !== S.target) return false;
    const rule = READY.find(([re]) => re.test(location.pathname));
    try {
      return rule[1]();
    } catch {
      return false;
    }
  };
  const until = performance.now() + 30000;
  const tick = () => {
    if (S.ready !== null) return;
    if (document.querySelector("main") && ready()) {
      S.ready = performance.now();
      S.readyPath = location.pathname + location.search;
      return;
    }
    if (performance.now() < until + (S.tapAt ?? 0)) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  /** A tap on the tab bar (or on any link a selector finds), timed from the tap to the destination's ready frame. */
  window.__speedTap = (href, selector) => {
    const a = document.querySelector(selector ?? `nav[aria-label="Sections"] a[href="${href}"]`);
    if (!a) return null;
    S.ready = null;
    S.target = new URL(a.getAttribute("href"), location.href).pathname;
    S.tapAt = performance.now();
    a.click();
    requestAnimationFrame(tick);
    return a.getAttribute("href");
  };
}

/** Everything the page knows about this visit, read once it has settled. */
async function readPage(page) {
  return page.evaluate(() => {
    const S = window.__speed;
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = S.fcp;
    // CLS: the largest session window (1 s gaps, 5 s cap), as Chrome reports it.
    let cls = 0, win = 0, first = 0, prev = 0;
    for (const [t, v] of S.shifts) {
      if (win && t - prev < 1000 && t - first < 5000) win += v;
      else (win = v), (first = t);
      prev = t;
      cls = Math.max(cls, win);
    }
    const end = (S.ready ?? performance.now()) + 1000;
    const tbt = S.longtasks.reduce((s, [t, d]) => (t >= (fcp ?? 0) && t <= end ? s + Math.max(0, d - 50) : s), 0);
    const longAll = S.longtasks.reduce((s, [, d]) => s + d, 0);
    const imgs = [...document.querySelectorAll("img")].map((i) => {
      const b = i.getBoundingClientRect();
      return {
        src: (i.currentSrc || i.src).replace(location.origin, ""),
        natural: [i.naturalWidth, i.naturalHeight],
        box: [Math.round(b.width), Math.round(b.height)],
        inView: b.width > 0 && b.bottom > 0 && b.top < innerHeight,
        loading: i.getAttribute("loading"),
        priority: i.getAttribute("fetchpriority"),
        nextImage: /\/_next\/image/.test(i.currentSrc || i.src),
      };
    });
    const media = [...document.querySelectorAll("video, audio")].map((v) => ({
      tag: v.tagName.toLowerCase(), src: (v.currentSrc || v.src || v.querySelector("source")?.src || "").replace(location.origin, ""),
      preload: v.preload, autoplay: v.autoplay, size: [v.videoWidth ?? 0, v.videoHeight ?? 0],
    }));
    const fonts = [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, display: f.display, status: f.status, range: f.unicodeRange.slice(0, 24) }));
    return {
      path: location.pathname + location.search,
      ttfb: nav ? nav.responseStart - nav.startTime : null,
      fromWorker: nav ? nav.workerStart > 0 : null,
      docTransfer: nav ? nav.transferSize : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      load: nav ? nav.loadEventEnd : null,
      fcp,
      lcp: S.lcp,
      lcpWhat: S.lcpWhat,
      cls: Math.round(cls * 1000) / 1000,
      tbt,
      longTasks: S.longtasks.length,
      longTaskMs: longAll,
      ready: S.ready,
      readyPath: S.readyPath,
      tapAt: S.tapAt,
      splash: S.splash,
      imgs,
      media,
      fonts,
    };
  });
}

// ---- The browser -----------------------------------------------------------

const link = await startLink();
const browser = await chromium.launch({
  args: [
    "--font-render-hinting=none",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
  // Loopback too: the app's own server is reached through the link like everything else.
  proxy: { server: `http://127.0.0.1:${link.port}`, bypass: "<-loopback>" },
});

async function newContext({ returning = true, installed = false, expired = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    permissions: ["microphone"],
    serviceWorkers: "allow",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  });
  if (returning) await context.addInitScript(seed, { theme: "light", session });
  /* A phone back the next day: the access token (an hour) has run out, so
     the client asks for a new one before its first read. */
  if (returning && expired)
    await context.addInitScript(() => {
      for (const k of ["sb-supabase-auth-token", "sb-supabase.local-auth-token"]) {
        const s = JSON.parse(localStorage.getItem(k) ?? "null");
        if (s) localStorage.setItem(k, JSON.stringify({ ...s, expires_at: Math.floor(Date.now() / 1000) - 60 }));
      }
    });
  // The installed app's open: the splash's head script skips an automated browser.
  if (installed) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
  await context.addInitScript(pageProbe);
  return context;
}

async function newPage(context) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (P.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: P.cpu });
  const seen = [];
  page.on("request", (r) => seen.push({ url: r.url().replace(BASE, ""), worker: false }));
  page.on("requestfinished", (r) => {
    const s = seen.find((x) => x.url === r.url().replace(BASE, "") && x.worker === false && !x.done);
    if (s) {
      s.done = true;
      s.worker = !!r.serviceWorker?.() || false;
    }
  });
  return { page, cdp, seen };
}

/** The link's log for one phase, as a bytes-and-requests table and a waterfall. */
function traffic(phase, t0) {
  const rows = link.log.filter((e) => e.phase === phase);
  const byKind = {};
  for (const e of rows) {
    const k = e.kind || "other";
    byKind[k] ??= { requests: 0, bytes: 0 };
    byKind[k].requests++;
    byKind[k].bytes += e.bytes;
  }
  const total = rows.reduce((s, e) => s + e.bytes, 0);
  const waterfall = rows.map((e) => ({
    kind: e.kind,
    method: e.method,
    url: e.url.length > 140 ? e.url.slice(0, 140) + "…" : e.url,
    start: round(e.start - t0),
    ttfb: round((e.ttfb ?? e.end) - t0),
    end: round(e.end - t0),
    bytes: e.bytes,
    status: e.status,
    handshake: e.handshake || undefined,
  }));
  return { requests: rows.length, bytes: total, byKind, waterfall };
}

const results = {
  meta: {
    label: LABEL,
    base: BASE,
    when: new Date().toISOString(),
    commit: (() => {
      try {
        return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
      } catch {
        return null;
      }
    })(),
    profile: { name: PROFILE_NAME, ...P, downKbps: P.downBps * 8 / 1000, upKbps: P.upBps * 8 / 1000 },
    supabaseServerMs: SUPA_MS,
    runs: RUNS,
    chromium: browser.version(),
    viewport: "390x844 @3x",
    notes:
      "Times in ms from navigation start (tabs: from the tap). ready = first frame with the screen's own data drawn. Bytes are on the wire (gzip as next start sends it). Cold = empty cache, no service worker; warm = same screen opened again, worker installed.",
  },
};

// ---- The bundle (read from the build, not the browser) ---------------------

function bundleTable() {
  const dir = resolve(ROOT, process.env.BUILD_DIR ?? ".next-build");
  const mf = join(dir, "app-build-manifest.json");
  if (!existsSync(mf)) return null;
  const pages = JSON.parse(readFileSync(mf, "utf8")).pages;
  const sizes = {};
  const size = (f) => (sizes[f] ??= (() => {
    const b = readFileSync(join(dir, f));
    return { raw: b.length, gz: gzipSync(b, { level: 9 }).length };
  })());
  const layout = new Set(pages["/layout"] ?? []);
  const table = {};
  for (const [route, files] of Object.entries(pages)) {
    if (!route.endsWith("/page") || route.startsWith("/workbench")) continue;
    let raw = 0, gz = 0, ownRaw = 0, ownGz = 0;
    for (const f of new Set([...layout, ...files])) {
      if (!f.endsWith(".js")) continue;
      const s = size(f);
      raw += s.raw;
      gz += s.gz;
      if (!layout.has(f)) {
        ownRaw += s.raw;
        ownGz += s.gz;
      }
    }
    table[route.replace(/\/page$/, "") || "/"] = { jsRawKB: +(raw / 1024).toFixed(1), jsGzKB: +(gz / 1024).toFixed(1), beyondLayoutGzKB: +(ownGz / 1024).toFixed(1) };
  }
  let lr = 0, lg = 0;
  for (const f of layout) if (f.endsWith(".js")) (lr += size(f).raw), (lg += size(f).gz);
  const css = (pages["/layout"] ?? []).filter((f) => f.endsWith(".css")).map((f) => ({ file: f, gzKB: +(size(f).gz / 1024).toFixed(1), rawKB: +(size(f).raw / 1024).toFixed(1) }));
  return { layout: { jsRawKB: +(lr / 1024).toFixed(1), jsGzKB: +(lg / 1024).toFixed(1), css }, routes: table };
}
results.bundle = bundleTable();

// ---- Scenes ----------------------------------------------------------------

const ROUTES = [
  ["today", "/"],
  ["recorder", "/rep?ready=1"],
  ["result", "/rep/rep-22"],
  ["log-daily", "/history"],
  ["log-games", "/history?view=games"],
  ["you", "/you"],
  ["lessons", "/lessons"],
  ["practice", "/games"],
  ["boss", "/boss"],
  ["hostile", "/hostile"],
  ["settings", "/settings"],
  ["shop", "/shop"],
  ["signin", "/signin"],
  // Today as a daily user opens it: the token from yesterday has expired.
  ["today-next-day", "/", { expired: true }],
];
const ROUTE_ONLY = (process.env.ROUTES ?? "").split(",").filter(Boolean);

const METRICS = ["ttfb", "fcp", "lcp", "ready", "cls", "tbt", "longTaskMs", "bytes", "requests"];
function summarise(runs) {
  const out = {};
  for (const k of METRICS) out[k] = round(median(runs.map((r) => r[k])) ?? null);
  out.cls = median(runs.map((r) => r.cls));
  return out;
}

/**
 * One open of a screen. What the link carried before the ready frame is
 * the screen's own cost; what it carried after (prefetches, the tabs'
 * stand-ins, the service worker's install) is reported beside it.
 */
async function visit(page, url, phase, base = BASE) {
  link.visit(phase);
  const t0 = now();
  await page.goto(base + url, { waitUntil: "commit", timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => window.__speed && window.__speed.ready !== null, null, { timeout: 30000, polling: 100 }).catch(() => {});
  link.phase(`${phase}:after`);
  await link.quiet(1200, 20000);
  // A page that died part way leaves a hole in the table, not a dead run.
  const m = await readPage(page).catch((e) => ({ error: String(e?.message ?? e).slice(0, 200), imgs: [], media: [], fonts: [], splash: {} }));
  // The page's clock starts at its navigation; the link's at the goto. Close enough to line up.
  const t = traffic(phase, t0);
  const a = traffic(`${phase}:after`, t0);
  return {
    ...m, bytes: t.bytes, requests: t.requests, byKind: t.byKind, waterfall: t.waterfall,
    after: { requests: a.requests, bytes: a.bytes, byKind: a.byKind }, afterWaterfall: a.waterfall,
  };
}

async function swReady(page) {
  const t0 = now();
  link.phase("sw-install");
  const ok = await page
    .evaluate(() =>
      Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise((r) => setTimeout(() => r(false), 60000)),
      ])
    )
    .catch(() => false);
  await link.quiet(1500, 60000);
  return { ok, ms: round(now() - t0) };
}

if (want("routes")) {
  results.routes = {};
  for (const [name, url, opts = {}] of ROUTES) {
    if (ROUTE_ONLY.length && !ROUTE_ONLY.includes(name)) continue;
    const cold = [], warm = [];
    let sw = null;
    for (let i = 0; i < RUNS; i++) {
      const context = await newContext(opts);
      const { page } = await newPage(context);
      cold.push(await visit(page, url, `${name}:cold:${i}`));
      sw = await swReady(page);
      if (i === 0) sw.traffic = traffic("sw-install", 0);
      warm.push(await visit(page, url, `${name}:warm:${i}`));
      await context.close();
      process.stdout.write(`${name} run ${i + 1}: cold ready ${round(cold[i].ready)} lcp ${round(cold[i].lcp)} | warm ready ${round(warm[i].ready)}\n`);
      link.log.length = 0;
    }
    const pick = (runs) => {
      // The median run by ready, kept whole for its waterfall.
      const order = [...runs].sort((a, b) => (a.ready ?? 1e9) - (b.ready ?? 1e9));
      const mid = order[order.length >> 1];
      return {
        median: summarise(runs),
        runs: runs.map((r) => Object.fromEntries(METRICS.map((k) => [k, k === "cls" ? r[k] : round(r[k])]))),
        medianRun: {
          lcpWhat: mid.lcpWhat, fromWorker: mid.fromWorker, docTransfer: mid.docTransfer, readyPath: mid.readyPath,
          domContentLoaded: round(mid.domContentLoaded), load: round(mid.load), longTasks: mid.longTasks,
          byKind: mid.byKind, waterfall: mid.waterfall,
          afterReady: mid.after, afterWaterfall: mid.afterWaterfall,
        },
        imgs: mid.imgs,
        media: mid.media,
        fonts: mid.fonts,
      };
    };
    results.routes[name] = { url, cold: pick(cold), warm: pick(warm), serviceWorker: { ready: sw?.ok, installMs: sw?.ms, precache: sw?.traffic ? { requests: sw.traffic.requests, bytes: sw.traffic.bytes, byKind: sw.traffic.byKind } : null } };
    writeOut();
  }
}

if (want("sw")) {
  // The worker's install on its own: a light page first, then everything
  // the install fetches (public/sw.js SHELL), then an open with no network.
  const shell = (() => {
    try {
      const src = readFileSync(join(ROOT, "public", "sw.js"), "utf8");
      return [...src.slice(src.indexOf("const SHELL"), src.indexOf("];", src.indexOf("const SHELL"))).matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);
    } catch {
      return [];
    }
  })();
  const context = await newContext();
  const { page } = await newPage(context);
  const first = await visit(page, "/settings/help", "sw:page");
  const t0 = now();
  const ready = await swReady(page);
  const install = traffic("sw-install", t0);
  const shellRows = [...link.log.filter((e) => e.phase === "sw:page:after" || e.phase === "sw-install")].filter((e) => shell.includes(e.url));
  const byPath = {};
  for (const e of shellRows) byPath[e.url] = (byPath[e.url] ?? 0) + e.bytes;
  const pages = Object.entries(byPath).filter(([u]) => !/\.(webp|png|svg)$/.test(u));
  const imgs = Object.entries(byPath).filter(([u]) => /\.(webp|png|svg)$/.test(u));
  // Online again, the same screen: does the worker or the network answer the page?
  const again = await visit(page, "/", "sw:revisit");
  await context.setOffline(true);
  const offline = await visit(page, "/", "sw:offline");
  await context.setOffline(false);
  await context.close();
  link.log.length = 0;
  results.serviceWorker = {
    shellEntries: shell.length,
    precache: {
      requests: shellRows.length,
      bytes: shellRows.reduce((s, e) => s + e.bytes, 0),
      pagesBytes: pages.reduce((s, [, b]) => s + b, 0),
      imagesBytes: imgs.reduce((s, [, b]) => s + b, 0),
      startedAfterPageLoadMs: round(first.load),
      installMs: ready.ms,
      installTraffic: { requests: install.requests, bytes: install.bytes },
      largest: Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([u, b]) => ({ url: u, bytes: b })),
    },
    revisitOnline: { ttfb: round(again.ttfb), fromWorker: again.fromWorker, ready: round(again.ready), docFromNetwork: again.waterfall.some((e) => e.kind === "doc" && e.url === "/") },
    offline: { ready: round(offline.ready), readyPath: offline.readyPath, fcp: round(offline.fcp) },
  };
  process.stdout.write(`sw: precache ${results.serviceWorker.precache.bytes} B in ${shellRows.length} requests, offline Today ready ${round(offline.ready)}\n`);
  writeOut();
}

if (want("tabs")) {
  const ORDER = ["/history", "/you", "/lessons", "/games", "/lessons", "/you", "/history", "/"];
  const NAMES = { "/": "Today", "/history": "Log", "/you": "You", "/lessons": "Lessons", "/games": "Practice" };
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await newContext();
    const { page } = await newPage(context);
    await visit(page, "/", `tabs:prime:${i}`);
    await swReady(page);
    await visit(page, "/", `tabs:open:${i}`);
    const steps = [];
    let from = "/";
    for (const href of ORDER) {
      const phase = `tabs:${i}:${from}->${href}`;
      link.phase(phase);
      const t0 = now();
      const ok = await page.evaluate((h) => window.__speedTap(h), href);
      await page.waitForFunction(() => window.__speed.ready !== null, null, { timeout: 20000, polling: 50 }).catch(() => {});
      await link.quiet(800, 10000);
      const m = await page.evaluate(() => ({ ready: window.__speed.ready, tapAt: window.__speed.tapAt, path: location.pathname, longtasks: window.__speed.longtasks }));
      const t = traffic(phase, t0);
      const during = t.waterfall.filter((e) => e.start <= (m.ready - m.tapAt));
      steps.push({
        from: NAMES[from], to: NAMES[href], ok,
        tapToReady: m.ready !== null ? round(m.ready - m.tapAt) : null,
        longTaskMs: round(m.longtasks.filter(([t]) => t >= m.tapAt && t <= (m.ready ?? m.tapAt) ).reduce((s, [, d]) => s + d, 0)),
        beforeReady: during.map((e) => `${e.kind} ${e.method} ${e.url} ${e.start}-${e.end}ms ${e.bytes}B`),
        afterReady: t.waterfall.length - during.length,
        bytes: t.bytes,
      });
      await sleep(400);
      from = href;
    }
    runs.push(steps);
    await context.close();
    link.log.length = 0;
    process.stdout.write(`tabs run ${i + 1}: ${steps.map((s) => `${s.to} ${s.tapToReady}`).join(", ")}\n`);
  }
  results.tabs = {
    order: "Today > Log > You > Lessons > Practice > Lessons > You > Log > Today, warm (worker installed, Today opened again first)",
    median: runs[0].map((s, j) => ({ from: s.from, to: s.to, tapToReady: round(median(runs.map((r) => r[j].tapToReady))), longTaskMs: round(median(runs.map((r) => r[j].longTaskMs))) })),
    runs,
  };
  writeOut();
}

if (want("doors")) {
  // The doors off the tabs a day goes through: a game from Today, a lesson
  // from Lessons, a recording from the Log. Warm, as the tabs are. Today's
  // trait tiles went with #500 and "Today > trait" timed nothing (its href
  // came back null): a door no longer on the screen now stops the run.
  const DOORS = [
    ["Today > Start", "/", "main a.home-start"],
    ["Today > Hostile Q&A", "/", 'main a[href^="/hostile"]'],
    ["Lessons > lesson", "/lessons", 'main a[href^="/lessons/"]'],
    ["Log > recording", "/history", 'main a[href^="/rep/"]'],
  ];
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await newContext();
    const { page } = await newPage(context);
    await visit(page, "/", `doors:prime:${i}`);
    await swReady(page);
    const steps = [];
    for (const [name, from, sel] of DOORS) {
      await visit(page, from, `doors:${i}:open:${name}`);
      const phase = `doors:${i}:${name}`;
      link.phase(phase);
      const t0 = now();
      const href = await page.evaluate(([s]) => window.__speedTap(null, s), [sel]);
      if (!href) throw new Error(`doors: "${name}" found no ${sel} on ${from}, so it would time nothing`);
      await page.waitForFunction(() => window.__speed.ready !== null, null, { timeout: 20000, polling: 50 }).catch(() => {});
      await link.quiet(800, 10000);
      const m = await page.evaluate(() => ({ ready: window.__speed.ready, tapAt: window.__speed.tapAt }));
      const t = traffic(phase, t0);
      const tap = m.ready !== null ? m.ready - m.tapAt : null;
      steps.push({
        door: name, href, tapToReady: round(tap),
        beforeReady: t.waterfall.filter((e) => tap !== null && e.start <= tap).map((e) => `${e.kind} ${e.method} ${e.url} ${e.start}-${e.end}ms ${e.bytes}B`),
      });
    }
    runs.push(steps);
    await context.close();
    link.log.length = 0;
    process.stdout.write(`doors run ${i + 1}: ${steps.map((s) => `${s.door} ${s.tapToReady}`).join(", ")}\n`);
  }
  results.doors = {
    median: runs[0].map((s, j) => ({ door: s.door, href: s.href, tapToReady: round(median(runs.map((r) => r[j].tapToReady))) })),
    runs,
  };
  writeOut();
}

if (want("open")) {
  const cold = [], warm = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await newContext({ installed: true });
    const a = await newPage(context);
    const c = await visit(a.page, "/", `open:cold:${i}`);
    cold.push(c);
    await swReady(a.page);
    // The next open is a new tab: sessionStorage is empty, so the splash shows again.
    const b = await newPage(context);
    const w = await visit(b.page, "/", `open:warm:${i}`);
    warm.push(w);
    await context.close();
    link.log.length = 0;
    process.stdout.write(`open run ${i + 1}: cold splash gone ${round(c.splash.gone)} ready ${round(c.ready)} | warm splash gone ${round(w.splash.gone)}\n`);
  }
  const s = (runs) => ({
    splashOn: round(median(runs.map((r) => r.splash.on))),
    splashLiftStarts: round(median(runs.map((r) => r.splash.out))),
    splashGone: round(median(runs.map((r) => r.splash.gone))),
    todayReady: round(median(runs.map((r) => r.ready))),
    fcp: round(median(runs.map((r) => r.fcp))),
  });
  results.open = { note: "The installed app's cold open of Today: the splash holds until hydration, fonts and 900 ms, then lifts for 360 ms.", cold: s(cold), warm: s(warm) };
  writeOut();
}

if (want("room")) {
  const out = {};
  for (const [name, url] of [["welcome", "/welcome"], ["start-url", "/"]]) {
    const cold = [], warm = [];
    for (let i = 0; i < RUNS; i++) {
      const context = await newContext({ returning: false });
      const { page } = await newPage(context);
      const c = await visit(page, url, `room:${name}:cold:${i}`);
      // From `/`, a first run is now sent on by a head script (#508 fix 14):
      // a new document, whose clock starts at the redirect. Time it from
      // the first navigation, as a person tapping the icon waits.
      const hop = url !== "/welcome" ? c.waterfall?.find((e) => e.kind === "doc" && e.url.startsWith("/welcome")) : null;
      if (hop) {
        for (const k of ["ready", "fcp", "lcp"]) if (c[k] != null) c[k] += hop.start;
        c.redirectAt = hop.start;
      }
      cold.push(c);
      await swReady(page);
      warm.push(await visit(page, url, `room:${name}:warm:${i}`));
      await context.close();
      link.log.length = 0;
      process.stdout.write(`room ${name} run ${i + 1}: cold ready ${round(c.ready)} (${c.readyPath})\n`);
    }
    const order = [...cold].sort((a, b) => (a.ready ?? 1e9) - (b.ready ?? 1e9));
    const mid = order[order.length >> 1];
    out[name] = {
      url,
      cold: summarise(cold),
      warm: summarise(warm),
      readyPath: mid.readyPath,
      lcpWhat: mid.lcpWhat,
      byKind: mid.byKind,
      waterfall: mid.waterfall,
      imgs: mid.imgs,
      media: mid.media,
    };
  }
  results.room = out;
  writeOut();
}

if (want("upload")) {
  // A take as this Chromium records it: 10 s of the fake mic, as the
  // recorder records it (lib/speech-recorder.ts: its bitrate, read off
  // the source, so "as shipped" follows the app), the browser's default
  // and a lower speech bitrate beside it.
  const shippedBps = (() => {
    try {
      const m = readFileSync(join(ROOT, "lib", "speech-recorder.ts"), "utf8").match(/SPEECH_BITS_PER_SECOND = ([\d_]+)/);
      return m ? Number(m[1].replace(/_/g, "")) : null;
    } catch {
      return null;
    }
  })();
  const context = await newContext();
  const { page } = await newPage(context);
  await page.goto(BASE + "/settings/help", { waitUntil: "load" }).catch(() => {});
  const sizes = await page.evaluate(async (shippedBps) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const take = (opts) =>
      new Promise((resolve) => {
        const rec = new MediaRecorder(stream, opts);
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => resolve({ type: rec.mimeType, bytes: chunks.reduce((s, c) => s + c.size, 0), bitrate: rec.audioBitsPerSecond });
        rec.start();
        setTimeout(() => rec.stop(), 10000);
      });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
    const browserDefault = await take(mime ? { mimeType: mime } : undefined);
    const asShipped = shippedBps ? await take({ ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: shippedBps }) : browserDefault;
    const speech32 = await take({ ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    const speech24 = await take({ ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
    stream.getTracks().forEach((t) => t.stop());
    return { asShipped, browserDefault, speech32, speech24 };
  }, shippedBps);
  await context.close();
  const per60 = (b) => Math.round((b / 10) * 60);
  const upMs = (b) => (Number.isFinite(P.upBps) ? Math.round((b / P.upBps) * 1000 + P.rtt) : 0);
  results.upload = Object.fromEntries(
    Object.entries(sizes).map(([k, v]) => [k, { ...v, bytesPer10s: v.bytes, bytesPer60s: per60(v.bytes), sendMsAt750kbps: upMs(per60(v.bytes)) }])
  );
  process.stdout.write(`upload: as shipped ${per60(sizes.asShipped.bytes)} B per 60 s\n`);
  writeOut();
}

if (want("stop") && process.env.STOP_BASE) {
  // The recorder's own send, through the link, against a server whose
  // Whisper, Claude and Supabase are stubs with known delays
  // (scripts/speed-stubs.mjs). Each stage's line is timed as it lands.
  const STOP = process.env.STOP_BASE.replace(/\/$/, "");
  // Shaped like a real session's token (an unsigned JWT naming the stubs'
  // user, scripts/speed-stubs.mjs), so the route's gate takes the path a
  // phone's take does (#508 fix 17); the stub answers any token.
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const STOP_TOKEN = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated" })}.speed`;
  const context = await newContext();
  const { page } = await newPage(context);
  await page.goto(STOP + "/settings/help", { waitUntil: "load" }).catch(() => {});
  const runs = [];
  for (const kb of [Number(process.env.TAKE_KB ?? 0) || (results.upload?.asShipped?.bytesPer60s ?? 960000) / 1024, 180]) {
    link.visit(`stop:${kb}`);
    const wall = Date.now();
    const r = await page.evaluate(async ({ kb, stop, token }) => {
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array(Math.round(kb * 1024))], { type: "audio/webm" }), "rep.webm");
      form.append("lessonId", "f1");
      form.append("clientId", "speed-" + Math.random().toString(36).slice(2));
      form.append("tzOffset", "-660");
      const t0 = performance.now();
      const res = await fetch(stop + "/api/analyze", { method: "POST", body: form, headers: { Accept: "application/x-ndjson", Authorization: `Bearer ${token}` } });
      const lines = [];
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          try {
            const j = JSON.parse(line);
            lines.push({ stage: j.stage, at: Math.round(performance.now() - t0), status: j.status });
          } catch {}
        }
      }
      return { status: res.status, lines, total: Math.round(performance.now() - t0) };
    }, { kb, stop: STOP, token: STOP_TOKEN });
    // The server's calls to its stubs, on the same clock as the send.
    let calls = [];
    try {
      calls = readFileSync(process.env.STUB_LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l))
        .filter((c) => c.start >= wall && c.start <= wall + r.total + 1000)
        .map((c) => ({ kind: c.kind, method: c.method, path: c.path.replace(/\/reps\/\d+-[^/]+$/, "/reps/<take>"), start: c.start - wall, end: c.end - wall }));
    } catch {}
    runs.push({ takeKB: Math.round(kb), ...r, calls });
    process.stdout.write(`stop ${Math.round(kb)} KB: ${r.lines.map((l) => `${l.stage}@${l.at}`).join(" ")}\n`);
  }
  await context.close();
  const stubs = { whisperMs: Number(process.env.SPEED_WHISPER_MS ?? 6000), claudeMs: Number(process.env.SPEED_CLAUDE_MS ?? 12000), supabaseMs: Number(process.env.SPEED_SUPA_MS ?? 20) };
  results.stop = {
    note: "The recorder's send over the link (750 kbps up, 150 ms), the server's Whisper, Claude and Supabase stubbed (scripts/speed-stubs.mjs) with the delays in `stubs`, which must match the server's. `calls` is every stubbed call on the send's clock.",
    runs,
    stubs,
  };
  writeOut();
}

/* MERGE=1 keeps what an earlier run of the same label measured and
   replaces only what this run measured (a scene, or a route by name). */
function priorRun() {
  if (priorRead !== undefined) return priorRead;
  priorRead = null;
  if (process.env.MERGE === "1") {
    try {
      priorRead = JSON.parse(readFileSync(join(ROOT, "docs", "speed", `${LABEL}.json`), "utf8"));
    } catch {}
  }
  return priorRead;
}
function writeOut() {
  const dir = join(ROOT, "docs", "speed");
  mkdirSync(dir, { recursive: true });
  const prior = priorRun();
  const out = prior ? { ...prior, ...results, routes: { ...(prior.routes ?? {}), ...(results.routes ?? {}) } } : results;
  if (prior) out.meta = { ...results.meta, merged: [...(prior.meta?.merged ?? [prior.meta?.when]), results.meta.when] };
  writeFileSync(join(dir, `${LABEL}.json`), JSON.stringify(out, null, 1) + "\n");
}

writeOut();
await browser.close();
link.close();
process.stdout.write(`wrote docs/speed/${LABEL}.json\n`);
