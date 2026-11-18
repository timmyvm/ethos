/**
 * Today as one card (#500): the practice card, Hostile Q&A and the Weekly
 * boss as two rows on the ground, and the two numbers only Today holds
 * at the foot. Timothy, 18 Nov: "I don't fuck with all the cards on the
 * homepage."
 *
 *   LOOK_BASE=http://localhost:3966 node scripts/look-today-cards.mjs [scene...]
 *
 * Scenes (a returning free account whose last take was yesterday, so the
 * card is the open day's, unless the scene says otherwise):
 *   phones    the first screen at 390x844 light and dark, 430x932,
 *             402x874, 375x667, 320x568, 320x692 and 375x812 light, each
 *             with its home inset, and 430x932 under a 59px status bar
 *             inset too, and where the card, the rows, the foot and the
 *             tab bar stand printed beside each.
 *   scrolled  390x844 light and dark scrolled to the page's end: the foot.
 *   full      the whole page at 390, light and dark.
 *   states    390x844 light, scrolled to the foot: Hostile at its cap and
 *             with one round left, the Weekly boss done this week, a day
 *             already spoken, Premium, a first-day account and a tester;
 *             Hostile at its cap in dark too. (A guest's session now
 *             lands on sign-up, #497, so its "lives only in this
 *             browser" line has no scene here.)
 *   squint    the first screen at 390x844 light, blurred 7px.
 *
 * Shots go to docs/look/today-cards/<LOOK_PHASE, after>/ (LOOK_OUT moves
 * the root), deviceScaleFactor 2.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
import {
  supabaseRoute as supabase,
  json,
  session,
  seed,
  POSE_PREF,
  reps,
  extraReps,
  repsMode,
  resetPlan,
  testerMode,
  TODAY_REP,
} from "./look-fixtures.mjs";

const ONLY = process.argv.slice(2);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3966";
/* LOOK_PHASE=before photographs a build from before #500 (the tour's
   Today) at the same sizes: its tiles were links of the same class. */
const PHASE = process.env.LOOK_PHASE ?? "after";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/today-cards"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (s) => ONLY.length === 0 || ONLY.includes(s);

resetPlan("free");
testerMode.tester = false;

const VIEWS = {
  "390x844-light": { w: 390, h: 844, theme: "light", inset: 34 },
  "390x844-dark": { w: 390, h: 844, theme: "dark", inset: 34 },
  "430x932-light": { w: 430, h: 932, theme: "light", inset: 34 },
  "402x874-light": { w: 402, h: 874, theme: "light", inset: 34 },
  "375x667-light": { w: 375, h: 667, theme: "light", inset: 0 },
  "320x568-light": { w: 320, h: 568, theme: "light", inset: 0 },
  "320x692-light": { w: 320, h: 692, theme: "light", inset: 34 },
  /* #500 review: the minis, and a Pro Max under the 59px status bar
     inset an installed iPhone gives the page. */
  "375x812-light": { w: 375, h: 812, theme: "light", inset: 34 },
  "430x932-inset59-light": { w: 430, h: 932, theme: "light", inset: 34, top: 59 },
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function context(tag, { tester = false } = {}) {
  const v = VIEWS[tag];
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: v.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.addInitScript(seed, { theme: v.theme, session, pose: POSE_PREF, tester });
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: v.top ?? 0, bottom: v.inset, left: 0, right: 0 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

async function today(page) {
  for (let i = 0; ; i++) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
    const ok = await page.waitForSelector("main a.home-mode", { timeout: 20000 }).then(() => true, () => false);
    if (ok) break;
    if (i === 3) throw new Error("Today never landed");
  }
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  await sleep(1400);
}

/** Where the card, the rows, the foot and the bar stand on the first screen. */
const where = (page) =>
  page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const card = r("main .home-hero");
    const rows = [...document.querySelectorAll("main a.home-mode")].map((a) => a.getBoundingClientRect());
    const foot = r("main .home-foot");
    const bar = r("nav .nav-glass");
    const another = r("main .home-another");
    const n = (v) => (v === undefined ? "-" : Math.round(v));
    return `card ${n(card?.top)}-${n(card?.bottom)}, another ${n(another?.top)}-${n(another?.bottom)}, rows ${n(rows[0]?.top)}-${n(rows.at(-1)?.bottom)}, foot ${n(foot?.top)}, bar ${n(bar?.top)}-${n(bar?.bottom)}, page ${document.documentElement.scrollHeight}`;
  });

const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log(`  ${name}`);
};

/** A Hostile take banked `h` hours ago. */
const hostileTake = (h) => ({
  ...reps[reps.length - 1],
  id: `hostile-${h}`,
  client_id: `hostile-${h}`,
  lesson_id: "hostile-take",
  created_at: new Date(Date.now() - h * 3_600_000).toISOString(),
});
/** The Weekly boss, taken this week an hour ago. */
const bossTake = () => ({
  ...reps[reps.length - 1],
  id: "boss-this-week",
  client_id: "boss-this-week",
  lesson_id: "boss:dunning-kruger",
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
});

if (want("phones")) {
  for (const tag of Object.keys(VIEWS)) {
    const { ctx, page } = await context(tag);
    await today(page);
    await shot(page, `today-${tag}`);
    console.log(`    ${await where(page)}`);
    await ctx.close();
  }
}

if (want("scrolled")) {
  for (const tag of ["390x844-light", "390x844-dark"]) {
    const { ctx, page } = await context(tag);
    await today(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(700);
    await shot(page, `today-scrolled-${tag}`);
    await ctx.close();
  }
}

if (want("full")) {
  for (const tag of ["390x844-light", "390x844-dark"]) {
    const { ctx, page } = await context(tag);
    await today(page);
    await shot(page, `today-full-${tag}`, { fullPage: true });
    await ctx.close();
  }
}

if (want("states")) {
  const scenes = [
    ["hostile-cap", "390x844-light", () => extraReps.push(hostileTake(2), hostileTake(5), hostileTake(9))],
    ["hostile-cap", "390x844-dark", () => extraReps.push(hostileTake(2), hostileTake(5), hostileTake(9))],
    ["hostile-one-left", "390x844-light", () => extraReps.push(hostileTake(2), hostileTake(5))],
    ["boss-done", "390x844-light", () => extraReps.push(bossTake())],
    ["spoken", "390x844-light", () => extraReps.push({ ...TODAY_REP })],
    ["premium", "390x844-light", () => resetPlan("code")],
    ["day-zero", "390x844-light", () => (repsMode.rows = [])],
    ["tester", "390x844-light", () => (testerMode.tester = true), { tester: true }],
  ];
  for (const [name, tag, set, opts] of scenes) {
    extraReps.length = 0;
    repsMode.rows = null;
    resetPlan("free");
    testerMode.tester = false;
    set();
    const { ctx, page } = await context(tag, opts);
    await today(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(600);
    await shot(page, `state-${name}-${tag}`);
    await ctx.close();
  }
  extraReps.length = 0;
  repsMode.rows = null;
  resetPlan("free");
  testerMode.tester = false;
}

if (want("squint")) {
  const { ctx, page } = await context("390x844-light");
  await today(page);
  await page.addStyleTag({ content: "html{filter:blur(7px)}" });
  await sleep(300);
  await shot(page, "today-squint-390x844-light");
  await ctx.close();
}

await browser.close();
