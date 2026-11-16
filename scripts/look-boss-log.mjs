/**
 * The camera for #486: the boss card, Total stars and the Log's switch.
 * Viewport shots (the first screen is what the change is about) at the
 * three phones, both themes, against the shared fixtures, plus the Log
 * whole at 390.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3901
 *   LOOK_BASE=http://localhost:3901 LOOK_OUT=/tmp/x node scripts/look-boss-log.mjs before
 *   LOOK_BASE=http://localhost:3901 LOOK_OUT=/tmp/x node scripts/look-boss-log.mjs after log-games
 *
 * Scenes: practice (Practice's boss card), boss (/boss), today (Today's
 * header), log (the Log, Daily), log-games-empty and log-games (the
 * Log's Games side with no rounds and with the fixtures' games, bosses
 * and Hostile takes, `gamesMode.on`), you-road (You's road card).
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  json,
  session,
  billingApiRoute,
  resetPlan,
  gamesMode,
  POSE_PREF,
} from "./look-fixtures.mjs";

const [, , TAG = "before", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3901";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/boss-log/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = (process.env.LOOK_SIZES ?? "390x844,375x667,320x568").split(",").map((s) => s.split("x").map(Number));

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function shoot(theme, [width, height]) {
  resetPlan();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", (route) => route.fulfill(json(analyze)));
  await context.route("**/api/billing/*", billingApiRoute);
  await context.addInitScript(({ theme, session, pose }) => {
    localStorage.setItem("ethos.welcomed", new Date().toISOString());
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose, skipIntros: true, haptics: false }));
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
    localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
    localStorage.setItem("ethos.gates.streak", new Date().toISOString());
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
  }, { theme, session, pose: POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  const tag = `${width}x${height}`;
  const settled = () =>
    page
      .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
  const go = async (path, waitFor = "main :is(h1, h2, .section-head, .eyebrow)") => {
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT", path, waitFor));
    await settled();
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
    await sleep(900);
  };
  const snap = async (name, full = false) => {
    await page.screenshot({ path: `${OUT}${name}-${tag}-${TAG}-${theme}.png`, fullPage: full });
    console.log(`shot  ${name}-${tag}-${TAG}-${theme}`);
  };
  const scene = async (name, fn) => {
    if (!want(name)) return;
    try {
      await fn();
    } catch (e) {
      console.log("STEP-FAILED", name, tag, theme, String(e.message ?? e).split("\n")[0]);
    }
  };

  await scene("practice", async () => {
    await go("/games");
    await snap("practice");
  });
  await scene("boss", async () => {
    await go("/boss", "main h1");
    await snap("boss");
  });
  await scene("today", async () => {
    await go("/", "main .arrive");
    await snap("today");
  });
  await scene("log", async () => {
    await go("/history", "main .arrive");
    await snap("log");
    if (width === 390) await snap("log-full", true);
  });
  await scene("log-games-empty", async () => {
    gamesMode.on = false;
    await go("/history?view=games", "main .section-head");
    await snap("log-games-empty");
  });
  await scene("log-games", async () => {
    gamesMode.on = true;
    await go("/history?view=games", "main .section-head");
    await snap("log-games");
    if (width === 390) await snap("log-games-full", true);
    gamesMode.on = false;
  });
  await scene("you-road", async () => {
    await go("/you");
    const road = page.getByText("The road", { exact: true });
    await road.waitFor({ timeout: 8000 });
    await sleep(600);
    await road.evaluate((el) => el.closest("a")?.scrollIntoView({ block: "center" }));
    await sleep(500);
    await snap("you-road");
  });
  await context.close();
}

for (const size of SIZES) {
  for (const theme of ["light", "dark"]) await shoot(theme, size);
}
await browser.close();
