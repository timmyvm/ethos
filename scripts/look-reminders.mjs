/**
 * The reminder's every way on, photographed (DECISIONS #430): the ask on
 * the glance after the day's first scored take, and Settings' reminder
 * group, in each state a phone can be in. The phone is stood in for in the
 * page: an iPhone's user agent, Home Screen or Safari tab, a permission
 * that is "default", "granted" or "denied", a service worker whose
 * pushManager raises the Allow prompt when it subscribes, and POST
 * /api/push answering 200 or 502.
 *
 *   NEXT_DIST_DIR=.next-rem NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=anon NEXT_PUBLIC_VAPID_PUBLIC_KEY=<any> npx next dev -p 3810
 *   LOOK_BASE=http://localhost:3810 node scripts/look-reminders.mjs after
 *   LOOK_BASE=http://localhost:3810 node scripts/look-reminders.mjs after glance-ask settings-armed
 *
 * Shots: LOOK_OUT (default docs/look/comeback-reminders/), as
 * <tag>-<scene>-<theme>.png at 390x844; LOOK_SIZES as in look-glance.mjs.
 * On the glance it asserts no scroll, exactly one terracotta fill, and the
 * ask's own words within GLANCE_WORDS_ASK (15).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "/opt/node-tools/node_modules/playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3810";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/comeback-reminders/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.log(`FAIL  ${m}`);
};

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1";

/**
 * A phone, as the page sees it. perm: the permission now; answer: what the
 * Allow prompt answers; tab: an iPhone's Safari tab (no Notification, no
 * PushManager); standalone: running from the Home Screen; subscribed: the
 * browser already holds a subscription; hour, ack: what this phone kept.
 */
const SCENES = {
  "glance-ask": { at: "glance", perm: "default", answer: "granted", standalone: true },
  "glance-chosen": { at: "glance", perm: "default", answer: "granted", standalone: true, hour: 21 },
  "glance-saved": { at: "glance", perm: "default", answer: "granted", standalone: true, tap: "remind" },
  "glance-failed": { at: "glance", perm: "default", answer: "granted", standalone: true, tap: "remind", post: 502 },
  "glance-denied": { at: "glance", perm: "default", answer: "denied", standalone: true, tap: "remind" },
  "glance-blocked": { at: "glance", perm: "denied", standalone: true },
  "glance-install": { at: "glance", tab: true },
  "glance-armed": { at: "glance", perm: "granted", standalone: true, hour: 18, ack: true, subscribed: true },
  "settings-off": { at: "settings", perm: "default", standalone: true },
  "settings-on": { at: "settings", perm: "default", answer: "granted", standalone: true, tap: "switch" },
  "settings-ask": { at: "settings", perm: "default", standalone: true, hour: 21 },
  "settings-armed": { at: "settings", perm: "granted", standalone: true, hour: 18, ack: true, subscribed: true },
  "settings-test": { at: "settings", perm: "granted", standalone: true, hour: 18, ack: true, subscribed: true, tap: "test" },
  "settings-failed": { at: "settings", perm: "granted", standalone: true, hour: 18, subscribed: true, post: 502 },
  "settings-blocked": { at: "settings", perm: "denied", standalone: true, hour: 21 },
  "settings-tab": { at: "settings", tab: true, hour: 21 },
};

function phone(o) {
  if (o.prefs) {
    try {
      const p = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
      localStorage.setItem("ethos.prefs", JSON.stringify({ ...p, ...o.prefs }));
    } catch {}
  }
  if (o.ack) localStorage.setItem("ethos.push.ack", JSON.stringify(o.ack));
  if (o.standalone) {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      /display-mode:\s*standalone/.test(q)
        ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
        : mm(q);
  }
  if (o.tab) {
    delete window.Notification;
    delete window.PushManager;
    return;
  }
  let perm = o.perm;
  Object.defineProperty(Notification, "permission", { get: () => perm, configurable: true });
  Notification.requestPermission = () => {
    if (perm === "default") perm = o.answer ?? "default";
    return Promise.resolve(perm);
  };
  const sub = {
    endpoint: "https://push.look/phone",
    toJSON: () => ({ endpoint: "https://push.look/phone", keys: { p256dh: "k", auth: "a" } }),
    unsubscribe: async () => true,
  };
  let held = !!o.subscribed;
  const reg = {
    pushManager: {
      subscribe: async () => {
        if (perm === "default") perm = o.answer ?? "default";
        if (perm !== "granted") throw new DOMException("Permission denied", "NotAllowedError");
        held = true;
        return sub;
      },
      getSubscription: async () => (held ? sub : null),
    },
    getNotifications: async () => [],
    showNotification: async () => {},
  };
  try {
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(reg), configurable: true });
    navigator.serviceWorker.register = async () => reg;
  } catch {}
}

const MEASURE = () => {
  const ask = document.querySelector("[data-reminder-ask]");
  const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  return {
    ask: ask ? ask.innerText.replace(/\s+/g, " ").trim() : null,
    askWords: ask ? words(ask.innerText) : 0,
    scrollH: document.scrollingElement.scrollHeight,
    innerH: innerHeight,
    terracotta: [...document.querySelectorAll('main [class*="bg-terracotta-500"]')].filter(vis).length,
  };
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

for (const [name, s] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  for (const size of SIZES) {
    F.resetPlan("free");
    F.testerMode.tester = false;
    F.testerMode.today = false;
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
      colorScheme: size.theme, serviceWorkers: "block",
      userAgent: s.tab || s.standalone ? IPHONE : undefined,
    });
    await context.route("http://supabase.local/**", F.supabaseRoute);
    await context.route("**/api/analyze", async (route) => {
      await sleep(1200);
      await route.fulfill(F.json(F.analyzeBody));
    });
    await context.route("**/api/push", (r) =>
      r.request().method() === "POST" && s.post ? r.fulfill(F.json({ error: "The subscription didn't save. Try again." }, s.post)) : r.fulfill(F.json({ ok: true }))
    );
    await context.route("**/api/push/test", (r) => r.fulfill(F.json({ ok: true })));
    await context.route("**/api/tester/collect", F.collectRoute);
    await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    await context.addInitScript(phone, {
      perm: s.perm,
      answer: s.answer,
      tab: !!s.tab,
      standalone: !!s.standalone,
      subscribed: !!s.subscribed,
      prefs: s.hour != null ? { reminderHour: s.hour } : null,
      ack: s.ack ? { endpoint: "https://push.look/phone", hour: s.hour, tz: "Australia/Melbourne" } : null,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", name, e.message.slice(0, 160)));
    try {
    const file = `${OUT}${TAG}-${name}-${size.theme}${size.w === 390 && size.h === 844 ? "" : `-${size.w}x${size.h}`}.png`;

    if (s.at === "glance") {
      await page.goto(`${BASE}/`);
      await page.waitForSelector("main .arrive", { timeout: 30000 });
      await sleep(800);
      await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
      await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
      await sleep(900);
      await page.click('button[aria-label="Start recording"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
      await sleep(3000);
      await page.click('button[aria-label="Stop and score this recording"]', { force: true });
      await page.waitForSelector("main .arrive-x", { timeout: 30000 });
      await sleep(3800);
      if (s.tap === "remind") {
        const btn = page.locator("[data-reminder-remind]");
        if (await btn.count()) {
          await btn.click();
          await sleep(1500);
        } else fail(`${name} ${size.name}: no Remind me tap to press`);
      }
      const m = await page.evaluate(MEASURE);
      await page.screenshot({ path: file });
      console.log(`${name} ${size.name}: ${m.ask ? `"${m.ask}" (${m.askWords} words)` : "no ask"}, ${m.terracotta} terracotta, ${m.scrollH > m.innerH + 1 ? `SCROLLS ${m.scrollH}/${m.innerH}` : "no scroll"}`);
      if (TAG !== "before") {
        if (m.scrollH > m.innerH + 1) fail(`${name} ${size.name}: the glance scrolls`);
        if (m.terracotta !== 1) fail(`${name} ${size.name}: ${m.terracotta} terracotta fills`);
        if (m.askWords > 15) fail(`${name} ${size.name}: the ask says ${m.askWords} words`);
        const want = { "glance-armed": false, "glance-blocked": true, "glance-install": true };
        if (name in want && !!m.ask !== want[name]) fail(`${name} ${size.name}: the ask ${m.ask ? "showed" : "did not show"}`);
        if (!(name in want) && !m.ask) fail(`${name} ${size.name}: no ask`);
      }
    } else {
      await page.goto(`${BASE}/settings`);
      await page.waitForSelector("main .inset-group", { timeout: 30000 });
      await sleep(1500);
      if (s.tap === "switch") {
        await page.getByRole("switch", { name: "Daily reminder" }).click();
        await sleep(1500);
      }
      if (s.tap === "test") {
        const t = page.getByRole("button", { name: "Send a test" });
        if (await t.count()) {
          await t.click();
          await sleep(1200);
        } else if (TAG !== "before") fail(`${name} ${size.name}: no Send a test row`);
      }
      if (name === "settings-failed") {
        // A re-arm that fails: the hour changes, the server answers 502.
        const h = page.getByRole("radio").nth(5);
        if (await h.count()) {
          await h.click();
          await sleep(1500);
        }
      }
      await page.screenshot({ path: file });
      const text = await page.evaluate(() => document.querySelector("main section")?.innerText.replace(/\s+/g, " ").trim() ?? "");
      console.log(`${name} ${size.name}: ${text.slice(0, 260)}`);
    }
    } catch (e) {
      fail(`${name} ${size.name}: ${String(e.message ?? e).split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
console.log(`\n${TAG}: ${failures.length ? `${failures.length} failure(s)` : "every check passed"}`);
process.exit(failures.length ? 1 : 0);
