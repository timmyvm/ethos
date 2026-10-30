/**
 * Frame strips for tester mode (DESIGN.md, the look loop's step 5): the
 * match check's first answer (the thumb fading in where it lands, the
 * note opening under it) and the code field taking its fourth digit.
 * Frames at 0, 80, 160, 240 and 400ms after the tap, cut to the part of
 * the screen that moves and laid side by side by the caller.
 *
 *   node scripts/strip-testers.mjs           # docs/look/testers/strip-*-<n>-<theme>.png
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute as supabase, analyzeBody as analyze, json, session, testerMode, seed, POSE_PREF } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/testers/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAMES = [0, 80, 160, 240, 400];
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });

for (const theme of ["light", "dark"]) {
  testerMode.tester = true;
  testerMode.feedback = "slow";
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.addInitScript(seed, { theme, session, pose: POSE_PREF });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 20000 });
  await page.click('button[aria-label="Start recording"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]');
  await sleep(2000);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main .arrive-x", { timeout: 15000 });
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
  await sleep(3200);
  const box = await page.locator('section[aria-labelledby="match-question"]').boundingBox();
  const clip = { x: 0, y: box.y - 12, width: 390, height: 300 };
  // Frame 0 is the moment before the tap.
  await page.screenshot({ path: `${OUT}strip-match-0-${theme}.png`, clip });
  const t0 = Date.now();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  for (const ms of FRAMES.slice(1)) {
    await sleep(Math.max(0, ms - (Date.now() - t0)));
    await page.screenshot({ path: `${OUT}strip-match-${ms}-${theme}.png`, clip });
  }
  console.log(`strip match ${theme}`);
  await ctx.close();
}
testerMode.feedback = "ok";
await browser.close();
