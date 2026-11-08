/**
 * The look loop's camera for "Say this instead" (DECISIONS #429; Timothy,
 * 8 Nov, "sure" to giving Demos's upgrade the word sheet's rule). It
 * walks a live recording to its results, shoots the glance, opens the
 * door and shoots the sheet, whose first section is Demos's read:
 *
 *   before   the pair every camera shot carried until now, "the thing
 *            about" to "what matters about" with its free-text note: a
 *            framing phrase made a claim of importance
 *   upgrade  an upgrade that keeps the meaning, with its fixed note
 *   none     the coach said none (or its upgrade was dropped): Kept alone
 *
 * and the Log's stored recording (`/rep/[id]`) with no upgrade, which
 * used to lose its whole coach, Kept and the judged dimensions with it.
 *
 *   NEXT_DIST_DIR=.next-say NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3760
 *   LOOK_BASE=http://localhost:3760 node scripts/look-say-instead.mjs [before|upgrade|none|log]...
 *
 * Shots: docs/look/say-instead/<state>-<beat>-390x844-<theme>.png.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { analyzeBody, extraReps, json, POSE_PREF, reps, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const STATES = process.argv.slice(2).length ? process.argv.slice(2) : ["before", "upgrade", "none", "log"];
const BASE = process.env.LOOK_BASE ?? "http://localhost:3760";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/say-instead/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const WIDTH = 390;
const HEIGHT = 844;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUPPLY = {
  before: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
  upgrade: analyzeBody.coach.supply,
  none: null,
};

/* The Log's recording with no upgrade: the newest fixture's, as a coach that said none stores it. */
const LOG_ID = "5a1c0d2e-3f4b-4a6c-9d8e-7f6a5b4c3d2e";
extraReps.push({ ...reps[reps.length - 1], id: LOG_ID, client_id: "k-say-none", supply: null });

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function shoot(state, theme) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  const body = { ...analyzeBody, coach: { ...analyzeBody.coach, supply: SUPPLY[state] ?? null } };
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(body)); });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", state, theme, e.message.slice(0, 160)));
  const file = (beat) => `${OUT}${state}-${beat}-${WIDTH}x${HEIGHT}-${theme}.png`;
  const shot = async (beat, settle = 700) => {
    await sleep(settle);
    await page.screenshot({ path: file(beat) });
    console.log(`shot  ${state}-${beat}-${theme}`);
  };

  if (state === "log") {
    await page.goto(`${BASE}/rep/${LOG_ID}`);
    await page.waitForSelector("main h2.section-head", { timeout: 30000 });
    await shot("top", 1200);
    const kept = page.locator("main p:has-text('Kept:')");
    const found = {
      kept: await kept.count(),
      say: await page.locator("main h2:has-text('Say this instead')").count(),
      dims: await page.locator("main h2:has-text('Every dimension')").count(),
    };
    console.log(`log   ${theme} ${JSON.stringify(found)}`);
    if (found.kept) {
      await kept.first().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -160));
      await shot("kept");
    }
    await context.close();
    return found;
  }

  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
  await sleep(800);
  await page.click('button[aria-label="Start recording"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]');
  await sleep(2600);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main [data-glance]", { timeout: 30000 });
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
  await shot("glance", 3200);
  await page.locator("main [data-glance-door]").click();
  await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 5000 });
  await shot("sheet", 1200);
  const found = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const text = (sel) => [...(d?.querySelectorAll(sel) ?? [])].map((e) => e.textContent?.trim());
    return { heads: text("h2.section-head"), subs: text("h3.detail-head"), struck: text(".line-through") };
  });
  console.log(`sheet ${state} ${theme} ${JSON.stringify(found)}`);
  await context.close();
  return found;
}

const report = {};
for (const state of STATES) {
  for (const theme of ["light", "dark"]) report[`${state}-${theme}`] = await shoot(state, theme);
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
console.log(`done → ${OUT}`);
