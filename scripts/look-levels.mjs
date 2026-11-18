/**
 * You's trait levels, photographed (DECISIONS #482, trait XP since
 * #498): the rows and a trait's sheet against fourteen recordings built
 * to show every state a level can be in (look-fixtures.mjs `LEVEL_MIX`,
 * which the three weeks of practice never reach): Filler control level
 * 5 at 40%, Variety level 4 at 50%, Pace level 3 at 90%, Pausing level 2
 * just reached (its bar empty), Restart control level 0 at 57%, and on
 * Premium (the second pass, all nine rows) Engagement never read: "Not
 * yet".
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3871
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     LOOK_BASE=http://localhost:3871 node scripts/look-levels.mjs after
 *   ... look-levels.mjs after rows      # only the rows
 *
 * Each row's accessible name is printed beside its shot. Shots:
 * LOOK_OUT, default docs/look/levels/, as <tag>-<scene>-<size>.png.
 * Sizes: LOOK_SIZES, default
 * "390x844-light,390x844-dark,375x667-light,375x667-dark".
 */
import { mkdirSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3871";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/levels/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light,375x667-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

for (const plan of ["free", "code"]) {
  for (const size of SIZES) {
    F.resetPlan(plan);
    F.repsMode.rows = F.LEVEL_MIX;
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
    const file = (scene) => `${OUT}${TAG}-${scene}-${size.name}.png`;
    const shoot = async (scene) => {
      await sleep(700);
      await page.screenshot({ path: file(scene) });
      console.log(`shot  ${scene} ${size.name}`);
    };

    await page.goto(`${BASE}/you`);
    await page.waitForSelector("main :is(h1, h2, .section-head)", { timeout: 20000 });
    await page
      .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
    await sleep(1600);
    const head = page.locator('main h2.section-head:text-matches("trait level", "i")').first();
    if ((await head.count()) === 0) {
      console.log(`MISSING trait levels ${size.name}`);
      await context.close();
      continue;
    }
    await head.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 96));
    /* What a screen reader is given for each row, printed beside the shot. */
    const said = await page.evaluate(() =>
      [...document.querySelectorAll("main button[aria-haspopup='dialog']")]
        .filter((b) => b.closest("section")?.querySelector("h2")?.textContent?.match(/trait level/i))
        .map((b) => {
          const bar = b.querySelector("[role='progressbar']");
          return `${b.getAttribute("aria-label") ?? b.textContent.trim()}${bar ? `  [progressbar ${bar.getAttribute("aria-valuenow")}]` : ""}`;
        })
    );
    if (size === SIZES[0]) for (const line of said) console.log(`  row  ${line}`);
    if (want("rows")) await shoot(plan === "code" ? "rows-nine" : "rows");

    if (plan === "free" && want("sheets")) {
      for (const key of ["fillers", "pace", "pause", "repairs"]) {
        const row = page.locator(`main button[data-trait="${key}"]`).first();
        if ((await row.count()) === 0) continue;
        await row.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
        await sleep(900);
        await shoot(`sheet-${key}`);
        await page.keyboard.press("Escape");
        await sleep(700);
      }
    }
    await context.close();
  }
}
await browser.close();
