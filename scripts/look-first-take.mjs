/**
 * The camera for #491's second half: Practice's door to the Log's Games
 * side. Practice at 390x844 and 320x568 in both themes, the first screen
 * and the whole page, with the fixtures' games played (`gamesMode.on`)
 * so the tiles carry their ladders and bests; then the door tapped, and
 * where it lands (the Log, Games side).
 *
 * The first take's note under the delta and the round card's door are
 * shot by scripts/look-glance.mjs (variants `rules` and `game`) with
 * LOOK_OUT=docs/look/first-take.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3917
 *   LOOK_BASE=http://localhost:3917 node scripts/look-first-take.mjs before
 *   LOOK_BASE=http://localhost:3917 node scripts/look-first-take.mjs after
 *
 * Asserts, on `after`: the door is on Practice, at least 44px tall,
 * inside the page's width, and one tap lands on /history?view=games
 * with the Games side chosen.
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

const [, , TAG = "before"] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3917";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/first-take/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = (process.env.LOOK_SIZES ?? "390x844,320x568").split(",").map((s) => s.split("x").map(Number));
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.log(`FAIL  ${m}`);
};

gamesMode.on = true;
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

for (const theme of ["light", "dark"]) {
  for (const [width, height] of SIZES) {
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
    const snap = async (name, full = false) => {
      await page.screenshot({ path: `${OUT}${name}-${tag}-${TAG}-${theme}.png`, fullPage: full });
      console.log(`shot  ${name}-${tag}-${TAG}-${theme}`);
    };
    try {
      await page.goto(`${BASE}/games`);
      await page.waitForSelector("main .section-head", { timeout: 15000 });
      await page
        .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
        .catch(() => console.log("SKELETONS-REMAIN"));
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
      await sleep(1200);
      await snap("practice");
      await snap("practice-full", true);
      const door = page.locator("main [data-games-log-door]");
      if ((await door.count()) === 0) {
        if (TAG !== "before") fail(`${tag} ${theme}: no door to the Log's Games side on Practice`);
      } else {
        await door.scrollIntoViewIfNeeded();
        await sleep(300);
        const box = await door.boundingBox();
        if (!box || box.height < 44) fail(`${tag} ${theme}: the door is ${box?.height ?? 0}px tall`);
        if (box && box.x + box.width > width + 0.5) fail(`${tag} ${theme}: the door runs off the page`);
        await snap("practice-door");
        await door.click();
        await page.waitForURL(/\/history\?view=games/, { timeout: 10000 }).catch(() => fail(`${tag} ${theme}: the door did not land on the Games side`));
        await page.waitForSelector("#games-boss", { timeout: 10000 }).catch(() => fail(`${tag} ${theme}: the Games side did not draw`));
        await sleep(900);
        await snap("log-games");
      }
    } catch (e) {
      fail(`${tag} ${theme}: ${String(e.message ?? e).split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall clear");
process.exit(failures.length ? 1 : 0);
