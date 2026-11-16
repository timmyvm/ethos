/**
 * Coming back to a tab costs nothing it already paid for (DECISIONS #467):
 * its numbers do not count up again, its rows do not fade in again, and
 * tab to tab within a minute asks the database for nothing but the plan
 * (the billing row is read, never remembered: #353, lib/held.ts rule 3).
 *
 * Against a build (see scripts/check-swipe.mjs for the commands):
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-tab-return.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3124";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: "light", serviceWorkers: "block",
});
let reads = 0;
await context.route("http://supabase.local/**", (route) => {
  const url = route.request().url();
  if (url.includes("/rest/") && !url.includes("/rest/v1/billing")) reads += 1;
  return supabaseRoute(route);
});
await context.addInitScript(seed, { theme: "light", session });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 140)));

/** Every finite animation running in the page, and the numbers it shows, over the first 700ms. */
const watch = () =>
  page.evaluate(async () => {
    const pg = () => document.querySelector("[data-page]");
    const nums = () =>
      [...(pg()?.querySelectorAll(".tabular-nums") ?? [])].map((n) => n.textContent?.trim()).join("|");
    const frames = [];
    let entrances = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 700) {
      await new Promise((r) => requestAnimationFrame(r));
      const running = (pg()?.getAnimations({ subtree: true }) ?? []).filter(
        (a) => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))
      );
      entrances = Math.max(entrances, running.length);
      frames.push(nums());
    }
    return { entrances, distinct: [...new Set(frames)].length, last: frames.at(-1) };
  });

const tap = async (href, path) => {
  await page.click(`nav[aria-label="Sections"] a[href="${href}"]`);
  await page.waitForFunction((p) => location.pathname === p, path);
};

await page.goto(`${BASE}/`);
await page.waitForSelector("main");
await page.waitForFunction(() => !document.querySelector("main .skeleton"), null, { timeout: 60000 });
await sleep(3500);

for (const [href, label] of [["/", "Today"], ["/history", "Log"], ["/you", "You"]]) {
  // First visit (Today was opened above), so every tab has counted once.
  if (href !== "/") {
    await tap(href, href);
    await sleep(2500);
  }
  await tap(href === "/" ? "/lessons" : "/", href === "/" ? "/lessons" : "/");
  await sleep(1200);
  reads = 0;
  await tap(href, href);
  const back = await watch();
  await sleep(600);
  ok(`${label}: its numbers stand still on the way back`, back.distinct === 1, `${back.distinct} different readings, ending ${back.last?.slice(0, 60)}`);
  ok(`${label}: nothing fades in again`, back.entrances === 0, `${back.entrances} entrances running`);
  ok(`${label}: tab to tab asks the database for nothing but the plan`, reads === 0, `${reads} reads`);
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
