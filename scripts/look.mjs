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
 * Screens: today, rep-idle, rep-recording, rep-results, log, you, shop,
 * plus rep-detail (the stored result the log links to), games and
 * settings.
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
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
/** Squint mode: LOOK_BLUR=6 blurs the page so only mass and colour survive. */
const BLUR = Number(process.env.LOOK_BLUR ?? 0) || 0;

import { supabaseRoute as supabase, analyzeBody as analyze, json, session } from "./look-fixtures.mjs";

// ---- Camera ----------------------------------------------------------------
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme,
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
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160), (e.stack ?? "").split("\n").slice(1, 4).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", page.url(), m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && !/supabase\.local/.test(r.url())) console.log("HTTP", r.status(), r.url()); });
  const shot = async (name, opts = {}) => {
    if (!want(name)) return;
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
  await step(async () => { await go("/", "main .arrive");
  await shot("today"); });
  await step(async () => { await go("/history", "main .arrive"); await shot("log"); });
  await step(async () => { await go("/you", "main .label-data"); await shot("you"); });
  await step(async () => { await go("/shop", "main"); await shot("shop"); });
  await step(async () => { await go("/games", "main .label-data"); await shot("games"); });
  await step(async () => { await go("/settings", "main .label-data"); await shot("settings"); });
  await step(async () => { await go("/rep/rep-22", "main .label-data"); await shot("rep-detail"); });

  // The loop: idle, recording, results (live, via the scoring mock).
  await step(async () => {
  await go("/rep?lesson=h4", 'button[aria-label="Start recording"]');
  await shot("rep-idle", { fullPage: false });
  if (want("rep-recording") || want("rep-results")) {
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
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
