/**
 * The screens the speed fixes touch (#508), shot so the before and after
 * can be laid side by side: nothing may look different, only arrive
 * sooner. Against a production build, the Supabase host mocked
 * (scripts/look-fixtures.mjs), the worker blocked so routes see every
 * fetch.
 *
 *   LOOK_BASE=http://localhost:4041 PLAYWRIGHT_MODULE=... \
 *     node scripts/look-speed.mjs after        # docs/look/speed/after/
 *
 * Shots, at 390x844 and 320x568, light and dark, 2x:
 *   today         Today drawn (a returning account)
 *   splash        the app-open splash, on (`?splash`)
 *   splash-landed the screen the splash lifted onto
 *   you           You, first opened from Today's tab bar (its tap-to-drawn
 *                 time is written beside the shots, times.json)
 *   practice      Practice drawn
 *   room          the room's door, a first run
 *   room-server   the same door with no app code run (the server's frame)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { supabaseRoute, session, json } from "./look-fixtures.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const BASE = (process.env.LOOK_BASE ?? "http://localhost:3123").replace(/\/$/, "");
const TAG = process.argv[2] ?? "after";
const OUT = `docs/look/speed/${TAG}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const times = {};

async function context(theme, size, returning, readDelay = 0) {
  const ctx = await browser.newContext({
    viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", readDelay ? async (r) => { await sleep(readDelay); return supabaseRoute(r); } : supabaseRoute);
  await ctx.route("**/api/push", (r) => r.fulfill(json({ ok: true })));
  await ctx.route("**/_vercel/**", (r) => r.fulfill({ status: 204, body: "" }));
  if (returning) {
    await ctx.addInitScript(({ theme, session }) => {
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, skipIntros: true, haptics: false }));
      localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
      localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
      localStorage.setItem("ethos.gates.streak", new Date().toISOString());
      localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
      localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
    }, { theme, session });
  } else {
    await ctx.addInitScript((theme) => localStorage.setItem("ethos.prefs", JSON.stringify({ theme })), theme);
  }
  return ctx;
}

const drawn = (page) =>
  page.waitForFunction(() => {
    const inView = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight; };
    return !document.documentElement.hasAttribute("data-splash") &&
      ![...document.querySelectorAll('.skeleton, [aria-busy="true"]')].some(inView) &&
      (document.querySelector("main h1")?.textContent ?? "").trim().length > 1;
  }, null, { timeout: 20000, polling: 50 });

for (const [w, h] of [[390, 844], [320, 568]]) {
  for (const theme of ["light", "dark"]) {
    const name = (s) => `${OUT}${s}-${w}-${theme}.png`;
    const size = { width: w, height: h };

    // Today, and You's first open from it.
    let ctx = await context(theme, size, true);
    let page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load" });
    await drawn(page);
    await sleep(900);
    await page.screenshot({ path: name("today") });
    await sleep(4500); // Today warms You's reads once drawn and idle (#508)
    const t0 = Date.now();
    await page.locator('nav a[href="/you"]').first().click();
    await page.waitForFunction(() => location.pathname === "/you" && /Level \d/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 20000, polling: 16 });
    times[`you-first-open-${w}-${theme}`] = Date.now() - t0;
    await sleep(700);
    await page.screenshot({ path: name("you") });
    await ctx.close();

    // The splash, and what it lifts onto. The reads are held a little, as
    // a phone's are, so the splash is still on when the word has risen.
    ctx = await context(theme, size, true, 1200);
    page = await ctx.newPage();
    await page.goto(BASE + "/?splash", { waitUntil: "commit" });
    // Before #508 the face was an <img>; after, a background drawn only while the splash is on.
    await page.waitForSelector('html[data-splash="on"] .splash-mark :is(.splash-img, img)', { state: "visible", timeout: 15000 });
    await page.evaluate(async () => {
      const el = document.querySelector(".splash-mark .splash-img, .splash-mark img");
      const url = el.tagName === "IMG" ? el.currentSrc || el.src : getComputedStyle(el).backgroundImage.replace(/^url\("?|"?\)$/g, "");
      const img = new Image(); img.src = url; await img.decode().catch(() => {});
    }).catch(() => {});
    // The word rises under Demos (`arrive-word`): shot once it has landed.
    await page.waitForFunction(() => (document.querySelector(".splash-word")?.getAnimations() ?? []).every((a) => a.playState === "finished"), null, { timeout: 5000, polling: 16 }).catch(() => {});
    if ((await page.evaluate(() => document.documentElement.getAttribute("data-splash"))) === "on") await page.screenshot({ path: name("splash") });
    else console.log(`splash ${w} ${theme}: lifted before the word landed`);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-splash"), null, { timeout: 15000 });
    await page.screenshot({ path: name("splash-landed") });
    await ctx.close();

    // Practice.
    ctx = await context(theme, size, true);
    page = await ctx.newPage();
    await page.goto(BASE + "/games", { waitUntil: "load" });
    await drawn(page);
    await sleep(1200);
    await page.screenshot({ path: name("practice") });
    await ctx.close();

    // The room's door, a first run; and the same with no app code run.
    for (const nojs of [false, true]) {
      ctx = await context(theme, size, false);
      if (nojs) await ctx.route("**/_next/static/chunks/**", (r) => r.abort());
      page = await ctx.newPage();
      await page.goto(BASE + "/welcome", { waitUntil: "load" });
      await page.waitForFunction(() => /Hold to step in/.test(document.body.innerText), null, { timeout: nojs ? 6000 : 20000 }).catch(() => {});
      await sleep(nojs ? 600 : 2600);
      await page.screenshot({ path: name(nojs ? "room-server" : "room") });
      await ctx.close();
    }
    console.log(`shot ${w} ${theme}`);
  }
}
writeFileSync(`${OUT}times.json`, JSON.stringify(times, null, 1) + "\n");
console.log(JSON.stringify(times));
await browser.close();
