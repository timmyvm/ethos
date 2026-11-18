/**
 * The look loop's camera for #506, the Log made simple (Timothy, 18 Nov:
 * "what am I even looking at when I see the log? ... It's really, really
 * tight ... no one's gonna really consume that").
 *
 * Shoots the Log's Daily side as a phone sees it: the first screen, the
 * screen scrolled down to the list, and the whole page; its Games side;
 * a stored recording opened from it; and four more accounts the tour's
 * three weeks never show: one whose Ethos fell since it started, one with
 * a single recording, one with none, and the page while it loads.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3973
 *   LOOK_BASE=http://localhost:3973 node scripts/look-log-simple.mjs before
 *   LOOK_BASE=http://localhost:3973 node scripts/look-log-simple.mjs after daily falling
 *
 * Shots: LOOK_OUT, default docs/look/log-simple/<tag>/, as
 * <scene>-<w>x<h>-<theme>.png. Prints where the list's rows land against
 * the tab bar on each first screen, so a row cut by the bar is a number,
 * not a squint.
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
  repsMode,
  reps,
  POSE_PREF,
  seed,
} from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3973";
const OUT = (process.env.LOOK_OUT ?? new URL(`../docs/look/log-simple/${TAG}/`, import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A day `n` days back at 18:12 on the device's clock, as the fixtures date them. */
const daysAgo = (n, h = 18) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 12, 0, 0);
  return d.toISOString();
};
const like = (i, n, index, lesson = "h4") => ({
  ...reps[reps.length - 1],
  id: `acct-${i}`,
  client_id: `acct-${i}`,
  lesson_id: lesson,
  created_at: daysAgo(n),
  ethos_index: index,
});
/* An account whose Ethos fell: 690 to 641 over nine recordings. */
const FALLING = [690, 684, 677, 681, 669, 662, 655, 648, 641].map((v, i, all) => like(i, all.length - i, v));
/* One recording, scored. */
const SINGLE = [like(0, 1, 604, "lesson:the-landing:1")];

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function shoot(theme, [width, height], scenes) {
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
  let slow = 0;
  await context.route("http://supabase.local/**", async (route) => {
    if (slow && new URL(route.request().url()).pathname.startsWith("/rest/v1/reps")) await sleep(slow);
    return supabase(route);
  });
  await context.route("**/api/analyze", (route) => route.fulfill(json(analyze)));
  await context.route("**/api/billing/*", billingApiRoute);
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  const size = `${width}x${height}`;
  const settled = () =>
    page
      .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
  const go = async (path, waitFor = "main .arrive") => {
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT", path, waitFor));
    await settled();
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
    await sleep(1100);
  };
  const snap = async (name, full = false) => {
    await page.screenshot({ path: `${OUT}${name}-${size}-${theme}.png`, fullPage: full });
    console.log(`shot  ${name}-${size}-${theme}`);
  };
  /* Where each recording's row lands against the floating bar. */
  const rows = async (name) => {
    const r = await page.evaluate(() => {
      const bar = document.querySelector("nav .nav-glass, nav [data-nav-glass], nav > div")?.getBoundingClientRect();
      const top = bar ? Math.round(bar.top) : innerHeight;
      return {
        bar: top,
        rows: [...document.querySelectorAll('main a[href^="/rep/"]')].slice(0, 5).map((a) => {
          const b = a.getBoundingClientRect();
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), cut: b.top < top && b.bottom > top };
        }),
      };
    });
    console.log(`rows  ${name}-${size}-${theme} bar ${r.bar}: ${r.rows.map((x) => `${x.top}-${x.bottom}${x.cut ? " CUT" : ""}`).join(", ")}`);
  };
  const scene = async (name, fn) => {
    if (!scenes.includes(name) || !want(name)) return;
    try {
      await fn();
    } catch (e) {
      console.log("STEP-FAILED", name, size, theme, String(e.message ?? e).split("\n")[0]);
    }
  };

  /* Daily by address: a side chosen earlier in this context is kept on the phone (lib/log-view.ts). */
  await scene("daily", async () => {
    await go("/history?view=daily");
    await snap("daily");
    await rows("daily");
    /* Scrolled: the list under the stage, as a thumb takes it. */
    await page.evaluate(() => window.scrollTo({ top: Math.round(innerHeight * 0.55) }));
    await sleep(700);
    await snap("daily-scrolled");
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    if (width >= 390) await snap("daily-full", true);
  });
  await scene("games", async () => {
    gamesMode.on = true;
    await go("/history?view=games", "main .section-head");
    await snap("games");
    if (width >= 390) await snap("games-full", true);
    gamesMode.on = false;
  });
  await scene("recording", async () => {
    await go("/rep/rep-22", "main h1");
    await snap("recording");
  });
  await scene("falling", async () => {
    repsMode.rows = FALLING;
    await go("/history?view=daily");
    await snap("falling");
    repsMode.rows = null;
  });
  await scene("single", async () => {
    repsMode.rows = SINGLE;
    await go("/history?view=daily");
    await snap("single");
    repsMode.rows = null;
  });
  await scene("empty", async () => {
    repsMode.rows = [];
    await go("/history?view=daily");
    await snap("empty");
    repsMode.rows = null;
  });
  await scene("loading", async () => {
    slow = 4000;
    await page.goto(`${BASE}/history?view=daily`);
    await page.waitForSelector("main .skeleton", { timeout: 15000 }).catch(() => {});
    await sleep(900);
    await snap("loading");
    slow = 0;
  });
  await context.close();
}

const ALL = ["daily", "games", "recording", "falling", "single", "empty", "loading"];
for (const theme of ["light", "dark"]) {
  await shoot(theme, [390, 844], ALL);
  await shoot(theme, [320, 568], ["daily", "games", "empty"]);
}
/* Two text sizes up on a 390pt iPhone lays out at 320 by 692 (DESIGN 11). */
await shoot("light", [320, 692], ["daily"]);
await browser.close();
