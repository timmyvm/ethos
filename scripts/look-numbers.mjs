/**
 * Every number off the glance, photographed (DECISIONS #471): the Log's
 * stored recording through its dimensions, You's trait rows and a
 * trait's sheet, and a trait's own page where its percentile stands.
 * The glance and its "Every number" sheet are scripts/look-glance.mjs's
 * (`LOOK_OUT=docs/look/numbers`).
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3801
 *   LOOK_BASE=http://localhost:3801 node scripts/look-numbers.mjs after
 *   LOOK_PLAN=code ... (You with all nine traits)
 *
 * Shots: LOOK_OUT, default docs/look/numbers/, as
 * <tag>-<scene>-<size>-<beat>.png. Sizes: LOOK_SIZES, default
 * "390x844-light,390x844-dark,375x667-light".
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3801";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/numbers/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
const PLAN = process.env.LOOK_PLAN ?? "free";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

for (const size of SIZES) {
  F.resetPlan(PLAN);
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: size.theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  const file = (scene, beat) => `${OUT}${TAG}-${scene}-${size.name}-${beat}.png`;
  const settled = () =>
    page
      .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
  const shoot = async (scene, beat) => {
    await sleep(700);
    await page.screenshot({ path: file(scene, beat) });
    console.log(`shot  ${scene} ${size.name} ${beat}`);
  };
  /** Scroll the page so `sel` stands `pad` under the top, then shoot. */
  const at = async (scene, beat, sel, pad = 72) => {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0) {
      console.log(`MISSING ${scene} ${beat}: ${sel}`);
      return false;
    }
    await el.evaluate((e, p) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - p), pad);
    await shoot(scene, beat);
    return true;
  };

  /* ---- the Log's stored recording --------------------------------------- */
  if (want("log")) {
    await page.goto(`${BASE}/rep/rep-22`);
    await page.waitForSelector("main :is([data-score], h1, .section-head)", { timeout: 20000 });
    await settled();
    await sleep(1600);
    await shoot("log", "s0");
    await at("log", "dims", 'main h2.section-head:text-matches("dimension", "i")');
    /* The rows' foot: how the 1000 is made. */
    const rows = page.locator("main details");
    if ((await rows.count()) > 0) {
      await rows.last().evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45));
      await shoot("log", "dims-foot");
      /* One row open: what the take did, in plain words. */
      const fillers = page.locator('main details:has(summary[data-trait="fillers"])').first();
      if ((await fillers.count()) > 0) {
        await fillers.locator("summary").click();
        await sleep(400);
        await fillers.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 160));
        await shoot("log", "dims-open");
      }
    }
  }

  /* ---- the first stored recording: a row under half (Work on this) ------ */
  if (want("log1")) {
    await page.goto(`${BASE}/rep/rep-1`);
    await page.waitForSelector("main :is([data-score], h1, .section-head)", { timeout: 20000 });
    await settled();
    await sleep(1600);
    await at("log1", "dims", 'main h2.section-head:text-matches("dimension", "i")');
  }

  /* ---- You: the trait rows and a trait's sheet --------------------------- */
  if (want("you")) {
    await page.goto(`${BASE}/you`);
    await page.waitForSelector("main :is(h1, h2, .section-head)", { timeout: 20000 });
    await settled();
    await sleep(1400);
    if (await at("you", "traits", 'main h2.section-head:text-matches("trait", "i")', 96)) {
      const row = page.locator('main button[data-trait="fillers"]').first();
      if ((await row.count()) > 0) {
        await row.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
        await sleep(800);
        await shoot("you", "sheet-fillers");
        await page.keyboard.press("Escape");
        await sleep(700);
      }
      const pause = page.locator('main button[data-trait="pause"]').first();
      if ((await pause.count()) > 0) {
        await pause.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
        await sleep(800);
        await shoot("you", "sheet-pause");
        await page.keyboard.press("Escape");
        await sleep(700);
      }
    }
  }

  /* ---- a trait's own page, where its percentile stands ------------------- */
  if (want("trait")) {
    await page.goto(`${BASE}/practice/fillers`);
    await page.waitForSelector("main h1", { timeout: 20000 });
    await settled();
    await sleep(1800);
    await shoot("trait", "fillers");
  }

  /* The Log's every-skill rows went with #506 (What moved and its
     Premium skill trendlines); a recording's rows are shot on its page. */

  /* ---- Today's tiles, where the percentile is first met ------------------ */
  if (want("today")) {
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main .arrive", { timeout: 20000 });
    await settled();
    await sleep(1400);
    await at("today", "tiles", "main [data-wide]", 120);
  }
  await context.close();
}
await browser.close();
