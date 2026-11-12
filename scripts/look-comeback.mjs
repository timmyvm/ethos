/**
 * Open straight into speaking (#431): Today and the recording screen as a
 * returning tester sees them, before and after. The investigation's
 * scenes (comeback/today.md), at 390x844 light and dark and 375x667
 * light, with first-screen words and taps counted, and the walk from
 * Today to the first second of recording timed.
 *
 *   LOOK_BASE=http://localhost:3123 PLAYWRIGHT_MODULE=... node scripts/look-comeback.mjs <before|after> [scene...]
 *   PUSH_URL="/rep?topic=...&ready=1" for the reminder's door after (bare /rep before)
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  collectRoute,
  json,
  session,
  testerMode,
  seed,
  POSE_PREF,
  reps,
  resetPlan,
} from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "before";
const ONLY = process.argv.slice(3);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/comeback-today"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETURNING_ID = "0b5e7a21-6c3d-4f8e-8a1b-2d9c4e6f7a10";
const SENT = "0B5E7A21";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1";

const ORIGINAL = [...reps];
const MEL = "Australia/Melbourne";
const melDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: MEL }).format(d);
const TODAY = process.env.LOOK_TODAY ?? melDay(new Date());
const agoOf = (iso) => Math.round((Date.parse(TODAY) - Date.parse(melDay(new Date(iso)))) / 86_400_000);
function history(minAgo) {
  reps.length = 0;
  for (const r of ORIGINAL) if (agoOf(r.created_at) >= minAgo) reps.push(r);
}

const SCENES = {
  "free-alive": { plan: "free", minAgo: 1, tester: true },
  "premium-alive": { plan: "code", minAgo: 1, tester: true },
  "free-broken": { plan: "free", minAgo: 2, tester: true },
  "premium-broken": { plan: "code", minAgo: 2, tester: true },
  "free-away4": { plan: "free", minAgo: 5, tester: true },
  "plain-free-alive": { plan: "free", minAgo: 1, tester: false },
  "spoke-today": { plan: "free", minAgo: 1, tester: true, today: true },
};

const VIEWS = [
  { tag: "390-light", w: 390, h: 844, theme: "light", inset: 34 },
  { tag: "390-dark", w: 390, h: 844, theme: "dark", inset: 34 },
  { tag: "375-light", w: 375, h: 667, theme: "light", inset: 0 },
];

const browser = await chromium.launch({
  args: [
    "--font-render-hinting=none",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

async function context(o, v, ua) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: MEL,
    colorScheme: v.theme,
    serviceWorkers: "block",
    ...(ua ? { userAgent: ua } : {}),
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/analyze", async (route) => {
    await sleep(600);
    await route.fulfill(json(analyze));
  });
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester/collect", collectRoute);
  const me = { ...session, user: { ...session.user, id: RETURNING_ID } };
  await ctx.route("http://supabase.local/auth/v1/token**", (route) => route.fulfill(json(me)));
  await ctx.addInitScript(seed, { theme: v.theme, session: me, pose: POSE_PREF, tester: o.tester });
  if (o.tester) await ctx.addInitScript((sent) => localStorage.setItem("ethos.tester.sent", sent), SENT);
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, bottom: v.inset, left: 0, right: 0 },
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

/** Words and taps on the first screen (above the nav), and on the whole page. */
async function count(page) {
  return page.evaluate(() => {
    const vh = innerHeight, vw = innerWidth;
    const navEl = document.querySelector(".nav-dock");
    const navTop = navEl?.querySelector(".nav-glass")?.getBoundingClientRect().top ?? vh;
    const visible = (el) =>
      el && (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true);
    const words = { first: [], below: [], nav: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const el = n.parentElement;
      if (!visible(el) || el.closest(".sr-only, script, style, noscript, .splash")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1 && r.right > 0 && r.left < vw);
      if (!rects.length) continue;
      const tokens = text.split(" ").filter((t) => /[\p{L}\p{N}]/u.test(t));
      const inNav = navEl?.contains(el);
      const top = Math.min(...rects.map((r) => r.top));
      const bucket = inNav ? "nav" : top < navTop && top >= 0 && top < vh ? "first" : "below";
      words[bucket].push(...tokens);
    }
    const tapSel = 'a[href], button, [role="button"], [role="radio"], [role="tab"], input, summary';
    const taps = { first: [], below: [], nav: [] };
    for (const el of document.querySelectorAll(tapSel)) {
      if (!visible(el) || el.closest("[inert]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48);
      const inNav = navEl?.contains(el);
      const bucket = inNav ? "nav" : r.top < navTop && r.bottom > 0 && r.top < vh ? "first" : "below";
      taps[bucket].push(label);
    }
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
    };
    return {
      words: { first: words.first.length, below: words.below.length, nav: words.nav.length, text: words.first.join(" ") },
      taps: { first: taps.first.length, below: taps.below.length, labels: taps.first },
      start: box(".home-start"),
      record: box('button[data-record="start"]'),
      title: document.querySelector(".home .large-title")?.textContent ?? null,
      lead: document.querySelector(".home-hero-lead")?.textContent ?? null,
    };
  });
}

const report = {};
for (const [name, s] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  for (const v of VIEWS) {
    history(s.minAgo);
    resetPlan(s.plan);
    testerMode.tester = s.tester;
    testerMode.consentVersion = 3;
    testerMode.today = Boolean(s.today);
    const { ctx, page } = await context(s, v);
    /* The dev server now and then answers a page without its client
       manifest (a Next dev invariant): reload until Today lands. */
    for (let i = 0; ; i++) {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
      await page.reload({ waitUntil: "networkidle" }).catch(() => {});
      const ok = await page
        .waitForSelector(".home-hero:not([data-family='none'])", { timeout: 20000 })
        .then(() => true, () => false);
      if (ok) break;
      if (i === 3) throw new Error(`Today never landed: ${name} ${v.tag}`);
      console.log("retry", name, v.tag);
    }
    await sleep(1800);
    await page.screenshot({ path: `${OUT}today-${name}-${v.tag}.png` });
    const key = `${name} ${v.tag}`;
    report[key] = { today: await count(page) };

    if (v.tag === "390-light") {
      await page.screenshot({ path: `${OUT}today-${name}-${v.tag}-full.png`, fullPage: true });
      /* The walk: Today's cold open to the first second of recording. */
      const t0 = Date.now();
      await page.goto(`${BASE}/`, { waitUntil: "commit" });
      await page.waitForSelector(".home-start", { state: "visible" });
      const startVisible = Date.now() - t0;
      await page.waitForSelector(".home-hero:not([data-family='none'])");
      const cardReady = Date.now() - t0;
      const t1 = Date.now();
      await page.click(".home-start");
      await page.waitForURL(/\/rep/);
      await page.waitForSelector('button[data-record="start"]', { state: "visible" });
      const startToRecord = Date.now() - t1;
      await sleep(1500);
      const repUrl = page.url().replace(BASE, "");
      await page.screenshot({ path: `${OUT}rep-from-${name}-${v.tag}.png` });
      const rep = await count(page);
      const t2 = Date.now();
      await page.click('button[data-record="start"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]', { state: "visible", timeout: 15000 });
      const recordToLive = Date.now() - t2;
      report[key].rep = rep;
      report[key].repUrl = repUrl;
      report[key].timing = { startVisible, cardReady, startToRecord, recordToLive };
      await ctx.close();

      /* The same recording screen on an iPhone (iOS 18.7 Safari UA). */
      if (name === "free-alive" || name === "spoke-today") {
        const ip = await context(s, v, IPHONE);
        await ip.page.goto(`${BASE}${repUrl}`, { waitUntil: "networkidle" });
        await ip.page.waitForSelector('button[data-record="start"]', { state: "visible" });
        await sleep(1500);
        await ip.page.screenshot({ path: `${OUT}rep-iphone-${name}-${v.tag}.png` });
        report[key].repIphone = await count(ip.page);
        await ip.ctx.close();
      }
    } else {
      /* The recording screen Start opens, in this theme and size. */
      await page.click(".home-start");
      await page.waitForURL(/\/rep/);
      await page.waitForSelector('button[data-record="start"]', { state: "visible" });
      await sleep(1500);
      await page.screenshot({ path: `${OUT}rep-from-${name}-${v.tag}.png` });
      report[key].rep = await count(page);
      await ctx.close();
    }
    const r = report[key];
    console.log(
      key,
      JSON.stringify({
        title: r.today.title,
        lead: r.today.lead,
        words: r.today.words.first,
        taps: r.today.taps.first,
        start: r.today.start,
        rep: r.rep && { words: r.rep.words.first, taps: r.rep.taps.first, record: r.rep.record },
        repIphone: r.repIphone && { words: r.repIphone.words.first, taps: r.repIphone.taps.first },
        repUrl: r.repUrl,
        timing: r.timing,
      })
    );
  }
}

/* The reminder's door: bare /rep before, Today's own href after. */
if (!ONLY.length || ONLY.includes("push")) {
  history(1);
  resetPlan("free");
  testerMode.tester = true;
  testerMode.today = false;
  const v = VIEWS[0];
  const { ctx, page } = await context({ tester: true }, v);
  const url = process.env.PUSH_URL ?? "/rep";
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForSelector('button[data-record="start"]', { state: "visible" });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}rep-from-push-${v.tag}.png` });
  report.push = { url, rep: await count(page) };
  console.log("push", url, JSON.stringify({ words: report.push.rep.words, taps: report.push.rep.taps.first }));
  await ctx.close();
}

writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 2));
await browser.close();
