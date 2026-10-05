/**
 * The look loop's camera (DESIGN.md): Playwright at 390px, light and
 * dark, every screen the one-system pass touches, against a mocked
 * Supabase so the shots show a populated app rather than day zero.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look.mjs before            # docs/look/<screen>-before-{light,dark}.png
 *   node scripts/look.mjs after             # docs/look/<screen>-after-{light,dark}.png
 *   node scripts/look.mjs after today you   # a subset of screens
 *   LOOK_OUT=docs/look/x node scripts/look.mjs after   # somewhere else
 *   LOOK_BLUR=6 node scripts/look.mjs squint today     # the squint test
 *
 * Screens: today, lessons, lesson, log, you, shop, games, settings,
 * rep-detail (the stored result the log links to), rep-idle,
 * rep-recording, rep-results, rep-numbers, rep-words; off the bar,
 * practice, unit, boss, hostile, calibrate, upload, upload-results,
 * paywall, splash
 * (with splash-lift, the lift about 100ms in);
 * signed out, signin, signup, forgot, reset, about, privacy, terms.
 * The introduction has its own camera, scripts/look-welcome.mjs.
 * Full-page shots; the nav is fixed so it appears where the viewport
 * would show it.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";

const [, , TAG = "before", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A mono 16-bit WAV of `seconds` of silence, for the upload's picker. */
const silentWav = (seconds, rate = 8000) => {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
};
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
/** Squint mode: LOOK_BLUR=6 blurs the page so only mass and colour survive. */
const BLUR = Number(process.env.LOOK_BLUR ?? 0) || 0;

import { supabaseRoute as supabase, analyzeBody as analyze, json, session } from "./look-fixtures.mjs";

// ---- Camera ----------------------------------------------------------------
// Hinting off: headless Linux Chromium rounds each glyph advance to a
// whole pixel and prints "Ne xt", "4 O ctober". Phones never do (#325).
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    /* The app's offline shell takes over fetches once it controls a
       page, and Playwright's routes no longer see them: the mocked host
       goes quiet and a later screen photographs its skeletons. The
       camera shoots the app, not the shell (#289). */
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(({ theme, session }) => {
    localStorage.setItem("ethos.welcomed", new Date().toISOString());
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
    localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
    localStorage.setItem("ethos.gates.streak", new Date().toISOString());
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
  }, { theme, session });
  const page = await context.newPage();
  // Full-page shots: the dev badge goes, and the fixed nav sits where
  // the page ends rather than where the first viewport did.
  await page.addStyleTag({ content: "" }).catch(() => {});
  await context.addInitScript((blur) => {
    const css = document.createElement("style");
    css.textContent =
      'nextjs-portal{display:none!important} body{position:relative} nav[aria-label="Sections"]{position:absolute!important}' +
      // The squint test (DESIGN.md, elevation): blur the whole page, and
      // the thing that matters should still be the thing you land on.
      (blur ? ` html{filter:blur(${blur}px)}` : "");
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  }, BLUR);
  /*
   * The splash holds for the camera. SplashLift waits on
   * `document.fonts.ready` (and its 900ms floor), so on a `?splash` open
   * that promise also waits for the camera's release: the "on" frame is
   * shot while it is certainly on, and the lift starts when the camera
   * says so. Without the hold the dark shot raced the lift and caught
   * Today under a ghost of it. No other page is touched.
   */
  await context.addInitScript(() => {
    if (!/[?&]splash\b/.test(location.search)) return;
    let release;
    const hold = new Promise((r) => (release = r));
    window.__ethosReleaseSplash = release;
    try {
      const fonts = document.fonts;
      const real = fonts.ready;
      Object.defineProperty(fonts, "ready", {
        configurable: true,
        get: () => Promise.all([real, hold]).then(() => fonts),
      });
    } catch {}
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160), (e.stack ?? "").split("\n").slice(1, 4).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", page.url(), m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && !/supabase\.local/.test(r.url())) console.log("HTTP", r.status(), r.url()); });
  /*
   * A full-page shot photographs the whole document but the browser
   * only ever loaded the images inside the viewport, so anything
   * lazy below the fold appears as an empty box. Lessons has fifteen
   * pictures and eleven of them came back blank the first time. Walk
   * the page to the bottom, let the loader catch up, return to the
   * top. Lazy loading is right for a phone; it is the camera that
   * needs to scroll.
   */
  const loadLazily = async () => {
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page
      .waitForFunction(
        () => [...document.images].every((i) => i.complete),
        null,
        { timeout: 12000 }
      )
      .catch(() => console.log("IMAGES-INCOMPLETE", page.url()));
    /*
     * `complete` only says the bytes arrived. Chromium drops the
     * DECODED bitmap of an offscreen image when it wants the memory
     * back, and a full-page capture of a six-thousand-pixel page is
     * exactly when it wants the memory back — Lessons photographed its
     * five biggest pictures as empty boxes in dark and not in light,
     * from one run to the next, with every image loaded and every
     * request a 200. `decode()` puts the bitmap back before the
     * shutter.
     */
    await page
      .evaluate(() =>
        Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
      )
      .catch(() => {});
  };
  const shot = async (name, opts = {}) => {
    if (!want(name)) return;
    if (opts.fullPage ?? true) await loadLazily();
    await sleep(opts.settle ?? 900);
    await page.screenshot({ path: `${OUT}${name}-${TAG}-${theme}.png`, fullPage: opts.fullPage ?? true });
    console.log(`shot  ${name}-${TAG}-${theme}`);
  };
  /*
   * A screen is ready when its skeletons are gone. Waiting on a selector
   * that exists before the read (an eyebrow, a heading) photographed
   * /you mid-load, all placeholders — and a gallery of placeholders is a
   * gallery of the wrong app.
   */
  const settled = async () => {
    await page
      .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, {
        timeout: 12000,
      })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
  };

  const go = async (path, waitFor) => {
    await page.goto(`${BASE}${path}`).catch(async () => { await sleep(500); await page.goto(`${BASE}${path}`); });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT", path, waitFor));
    await settled();
  };

  const step = async (fn) => { try { await fn(); } catch (e) { console.log("STEP-FAILED", theme, String(e.message ?? e).split("\n")[0]); } };
  /*
   * One screen: go there and shoot it, or skip the trip entirely when it
   * was not asked for (a subset run used to load all seventeen routes on
   * a dev server that compiles each on first visit). The wait selectors
   * name a ROLE the screen keeps through a redesign (a heading, a section
   * head, an eyebrow) rather than one class, so a package that retires
   * the capitals register does not leave the camera waiting 15s.
   */
  const READY = "main :is(h1, h2, .section-head, .eyebrow, .label-data)";
  const scene = (name, path, waitFor = READY, opts) =>
    step(async () => {
      if (!want(name)) return;
      await go(path, waitFor);
      await shot(name, opts);
    });
  await scene("today", "/", "main .arrive");
  await scene("lessons", "/lessons");
  await scene("lesson", "/lessons/the-cold-open", "main h1");
  await scene("log", "/history", "main .arrive");
  await scene("you", "/you");
  await scene("shop", "/shop", "main");
  await scene("games", "/games");
  // auth-14 (A1's rename): Settings is an .inset-group.
  await scene("settings", "/settings", "main .inset-group");
  // The stored recording: RepResult marks its Index with data-score.
  await scene("rep-detail", "/rep/rep-22", "main :is([data-score], h1, .section-head)");

  // Off the bar: every route a signed-in person can reach that the
  // camera used to skip.
  await scene("practice", "/practice/pause", "main h1");
  await scene("unit", "/lesson/filler", "main");
  await scene("boss", "/boss", "main");
  await scene("hostile", "/hostile", "main");
  await scene("calibrate", "/calibrate", "main");
  await scene("upload", "/upload", "main");
  /*
   * The upload's results: the camera only ever saw the file picker, so
   * RepResult's "all" view and the player on /upload were never shot.
   * One second of silence goes in; the scoring mock answers.
   */
  await step(async () => {
    if (!want("upload-results")) return;
    await go("/upload", "main h1");
    await page.setInputFiles('main input[type="file"]', { name: "memo.wav", mimeType: "audio/wav", buffer: silentWav(1) });
    await page.waitForSelector("main [data-score]", { timeout: 15000 });
    await shot("upload-results", { settle: 1200 });
  });
  await step(async () => {
    if (!want("paywall")) return;
    await go("/games", READY);
    await page.click(".premium-wall", { force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    await shot("paywall", { fullPage: false, settle: 900 });
  });
  /*
   * auth-14: the splash, photographed while it is up. `goto` used to
   * wait for `load`, which on a dev server lands after SplashLift's
   * 900ms floor, so both shots caught Today under a 10% ghost of the
   * lift. Now: navigate on commit, wait for the mark to be visible and
   * the wordmark's rise to finish with the picture decoded, shoot it if
   * the splash is still on, then release the hold (above) and catch
   * the lift about 100ms in.
   */
  await step(async () => {
    if (!want("splash")) return;
    await page.goto(`${BASE}/?splash`, { waitUntil: "commit" });
    await page.waitForSelector('html[data-splash="on"] .splash-mark img', { state: "visible", timeout: 15000 });
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector(".splash-mark img");
          const words = [...document.querySelectorAll(".splash-word")];
          return (
            !!img && img.complete && img.naturalWidth > 0 && words.length > 0 &&
            words.every((w) => w.getAnimations().every((a) => a.playState === "finished"))
          );
        },
        null,
        { timeout: 10000, polling: 16 }
      )
      .catch(() => {});
    const state = await page.evaluate(() => document.documentElement.getAttribute("data-splash"));
    if (state === "on") {
      await page.screenshot({ path: `${OUT}splash-${TAG}-${theme}.png` });
      console.log(`shot  splash-${TAG}-${theme}`);
    } else {
      console.log("SPLASH-MISSED", theme, state);
    }
    await page.evaluate(() => window.__ethosReleaseSplash?.());
    await page.waitForSelector('html[data-splash="out"]', { timeout: 15000 });
    // A screenshot takes 40 to 80ms to come back (DESIGN.md), so a 40ms
    // wait lands the frame about 100ms into the 360ms lift.
    await sleep(40);
    await page.screenshot({ path: `${OUT}splash-lift-${TAG}-${theme}.png` });
    console.log(`shot  splash-lift-${TAG}-${theme}`);
  });

  // The loop: idle, recording, results (live, via the scoring mock).
  await step(async () => {
  const walk = ["rep-recording", "rep-results", "rep-numbers", "rep-words"].some(want);
  if (!walk && !want("rep-idle")) return;
  await go("/rep?lesson=h4", 'button[aria-label="Start recording"]');
  await shot("rep-idle", { fullPage: false });
  if (walk) {
    // `force`, because the Record button breathes while it waits and
    // Playwright's actionability check waits for an element to stop
    // moving — which this one never does (#242).
    await page.click('button[aria-label="Start recording"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(2500);
    await shot("rep-recording", { fullPage: false, settle: 100 });
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("main .arrive-x", { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT results"));
    // Let the celebration play out, if one comes.
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
    await sleep(1600);
    await shot("rep-results", { settle: 200 });
    // The walk has three steps and the camera only ever saw the first.
    for (const [name, label] of [["rep-numbers", /The numbers/], ["rep-words", /Your words/]]) {
      const button = page.getByRole("button", { name: label });
      if (!(await button.count())) break;
      await button.first().click();
      await sleep(500);
      await shot(name, { settle: 400 });
    }
  }
  });
  await context.close();

  // Signed out: the doors in, and the pages a stranger can read.
  const OUT_SCREENS = [
    ["signin", "/signin"], ["signup", "/signup"], ["forgot", "/auth/forgot"],
    ["reset", "/auth/reset"], ["about", "/about"], ["privacy", "/privacy"], ["terms", "/terms"],
  ].filter(([name]) => want(name));
  if (OUT_SCREENS.length) {
    const stranger = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
    });
    await stranger.route("http://supabase.local/**", supabase);
    await stranger.addInitScript(({ theme, blur }) => {
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, skipIntros: true, haptics: false }));
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}" + (blur ? ` html{filter:blur(${blur}px)}` : "");
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    }, { theme, blur: BLUR });
    const p = await stranger.newPage();
    for (const [name, path] of OUT_SCREENS) {
      try {
        await p.goto(`${BASE}${path}`);
        await p.waitForSelector("main, h1", { timeout: 15000 }).catch(() => {});
        await sleep(900);
        await p.screenshot({ path: `${OUT}${name}-${TAG}-${theme}.png`, fullPage: true });
        console.log(`shot  ${name}-${TAG}-${theme}`);
      } catch (e) { console.log("STEP-FAILED", theme, name, String(e.message ?? e).split("\n")[0]); }
    }
    await stranger.close();
  }
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
