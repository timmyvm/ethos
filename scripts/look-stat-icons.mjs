/**
 * The stat icons (#487; flat since the flat set), photographed on every surface that shows a
 * count or a state beside one: Today's streak chip (open day and spoken
 * day), the Shop's freeze and coin balance, You's numbers, Practice's
 * tiles with a game's best, the plaque before a game's Record, and the
 * founder's who-is-active rows. Each scene is shot whole (the viewport)
 * and cropped to the icon's neighbourhood, at 390x844 and 320x568, light
 * and dark.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3903
 *   npx vite-node --config vitest.config.ts scripts/active-fixtures.ts > /tmp/active-view.json
 *   LOOK_BASE=http://localhost:3903 ACTIVE_VIEW=/tmp/active-view.json \
 *     PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/look-stat-icons.mjs before            # or after
 *   node scripts/look-stat-icons.mjs after today shop  # a subset
 *   npx vite-node --config vitest.config.ts scripts/moment-fixture.ts > /tmp/moment.html
 *     (then MOMENT_HTML=/tmp/moment.html adds Best round yet, "moment")
 *
 * Shots: LOOK_OUT, default docs/look/stat-icons/, as
 * <tag>-<scene>-<size>-<theme>.png and <tag>-<scene>-<size>-<theme>-crop.png.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync, existsSync } from "node:fs";
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3903";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/stat-icons/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,320x568-light,320x568-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: wh };
});
const ACTIVE_VIEW = process.env.ACTIVE_VIEW ?? "/tmp/active-view.json";
const MOMENT_HTML = process.env.MOMENT_HTML ?? "/tmp/moment.html";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

/**
 * One scene: a fresh context (so a plan or a fixture switch never leaks
 * into the next), the route opened, the page settled, then the viewport
 * and the crop around `crop` (one selector, or several whose boxes are
 * joined), padded.
 */
async function scene(name, size, { path, plan = "free", games = false, today = false, crop, pad = 12, before, inject }) {
  if (!want(name)) return;
  F.resetPlan(plan);
  F.gamesMode.on = games;
  F.extraReps.length = 0;
  if (today) F.extraReps.push(F.TODAY_REP);
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: size.theme, serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", F.supabaseRoute);
  await ctx.route("**/api/billing/*", F.billingApiRoute);
  await ctx.route("**/api/tester/collect", F.collectRoute);
  if (existsSync(ACTIVE_VIEW)) {
    const view = readFileSync(ACTIVE_VIEW, "utf8");
    await ctx.route("**/api/active", (r) => r.fulfill({ status: 200, contentType: "application/json", body: view }));
  }
  await ctx.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (before) await before(page);
  await page
    .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
    .catch(() => console.log("SKELETONS-REMAIN", name));
  /* A moment no fixture walks to (Best round yet needs a whole round):
     the component's own markup, rendered by scripts/moment-fixture.ts,
     laid over the live page so it wears the build's CSS and fonts. */
  if (inject) {
    await page.evaluate((html) => {
      const el = document.createElement("div");
      el.id = "look-inject";
      el.style.cssText = "position:fixed;inset:0;z-index:60;background:var(--color-ground);padding:72px 16px 0";
      el.innerHTML = html;
      document.body.appendChild(el);
    }, inject);
  }
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  await sleep(1400);
  const file = `${OUT}${TAG}-${name}-${size.name}-${size.theme}`;
  await page.screenshot({ path: `${file}.png` });
  const sels = [crop].flat().filter(Boolean);
  const boxes = [];
  /* Scroll the first to the middle once, then measure every box in that
     same scroll position: the clip is in viewport coordinates. The
     middle, not just into view: at 320x568 "in view" left Practice's
     tile best under the floating tab bar (the review of #487). */
  if (sels.length)
    await page
      .locator(sels[0])
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
      .catch(() => {});
  await sleep(150);
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    const b = await loc.boundingBox();
    if (b) boxes.push(b);
  }
  if (boxes.length) {
    const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
    const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
    const x1 = Math.min(size.w, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
    const y1 = Math.min(size.h, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
    await page.screenshot({ path: `${file}-crop.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  } else {
    console.log("NO-CROP", name, size.name, size.theme);
  }
  console.log("shot", `${TAG}-${name}-${size.name}-${size.theme}`);
  await ctx.close();
}

/*
 * The icon sheet the 3D set had (`sheet`) went with its files: the flat
 * set's own board, every kind at every size, lit and unlit, light and
 * dark, is app/workbench/icons, shot by scripts/look-icons-flat.mjs.
 */
for (const size of SIZES) {
  /* Today on an open day (the fixtures' last recording is yesterday's):
     the streak chip's flame unlit. Then with today spoken: lit. */
  await scene("today-open", size, { path: "/", crop: [".today-earned >> nth=0", ".today-earned >> nth=-1"], pad: 24 });
  await scene("today-lit", size, { path: "/", today: true, crop: [".today-earned >> nth=0", ".today-earned >> nth=-1"], pad: 24 });
  /* The Shop: the coin balance in the header and the freeze's art. */
  await scene("shop", size, {
    path: "/shop",
    crop: ["main h1", '.card:has-text("Streak freeze")'],
  });
  /* You's three numbers (#485 is rebuilding this card; shot so the merge
     has a before). */
  await scene("you", size, { path: "/you", crop: 'section[aria-label="Your numbers"]', pad: 16 });
  /* Practice's tiles with a game's best (Premium, fixture rounds). */
  await scene("games", size, {
    path: "/games",
    plan: "code",
    games: true,
    crop: ['.game-card:has(.tile-best-value) >> nth=0', '.game-card:has(.tile-best-value) >> nth=1'],
  });
  /* The plaque before a game's Record: Q&A at level 2, best 31s clean. */
  await scene("plaque", size, {
    path: "/games",
    plan: "code",
    games: true,
    before: async (page) => {
      await page.locator('.game-card:has(.tile-best-value)').first().click();
      await page.waitForURL(/\/rep/, { timeout: 10000 }).catch(() => {});
      await page.waitForSelector(".best-plaque", { timeout: 12000 }).catch(() => console.log("NO-PLAQUE"));
    },
    crop: ".best-plaque",
    pad: 16,
  });
  /* Best round yet on the results walk (Moment.tsx), from its own
     markup: MOMENT_HTML, printed by scripts/moment-fixture.ts. */
  if (existsSync(MOMENT_HTML)) {
    await scene("moment", size, { path: "/games", plan: "code", games: true, inject: readFileSync(MOMENT_HTML, "utf8"), crop: "#look-inject .card", pad: 16 });
  }
  /* The founder's who-is-active rows: a streak per tester. */
  await scene("active", size, {
    path: "/active",
    crop: ['li:has([aria-label^="Streak"]) >> nth=0', 'li:has([aria-label^="Streak"]) >> nth=2'],
  });
}
await browser.close();
