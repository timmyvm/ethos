/**
 * Navigation the iPhone way, in a real browser (#442, #443).
 *
 *  - Back retraces: the chevron goes back in history when the screen
 *    under this one is where it points, so the parent returns where it
 *    was left, and history does not grow. A cold open, or a screen
 *    reached from somewhere else, keeps the chevron a link.
 *  - A tab keeps its place, the tab you are on goes to its top, and tab
 *    to tab is a swap with no sideways push. Going deeper still pushes;
 *    the chevron's back slides in from the left; the browser's own back
 *    is not drawn a second time.
 *  - The bar says where you are: Your words and Upload light their tab,
 *    a stored recording keeps the bar with Log lit, the recorder has
 *    none.
 *  - The header's words: no collision at 320, and a back that could only
 *    say "Back" is the chevron alone, still 44 wide and still named.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-nav.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { json, seed, session, supabaseRoute, SAVED_ROWS, savedWordsMode } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
async function open(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  return { context, page, errors };
}
const settle = async (page) => {
  await page.waitForSelector("main", { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(450);
};
const path = (page) => new URL(page.url()).pathname;
const at = (page) => page.evaluate(() => ({
  y: Math.round(window.scrollY),
  entries: window.navigation ? navigation.entries().length : -1,
  index: window.navigation ? navigation.currentEntry.index : -1,
  push: document.querySelector(".push-right") ? "right" : document.querySelector(".push-left") ? "left" : "none",
}));
const tab = (page, href) => page.locator(`nav a[href="${href}"]`);
const lit = (page) => page.evaluate(() => document.querySelector('nav a[aria-current="page"] .nav-label')?.textContent ?? null);

// ---- 1. back retraces ---------------------------------------------------------
{
  const { context, page, errors } = await open();
  await page.goto(`${BASE}/lessons`);
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  await sleep(250);
  const before = await at(page);
  await page.locator('main a[href^="/lessons/"]').nth(8).click();
  await page.waitForURL((u) => new URL(u).pathname.startsWith("/lessons/"));
  await settle(page);
  const deep = await at(page);
  ok("going deeper pushes in from the right", deep.push === "right" && deep.entries === before.entries + 1, JSON.stringify(deep));
  await page.locator("main a.screen-bar-back").first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/lessons");
  await sleep(700);
  const back = await at(page);
  ok("the chevron goes back to Lessons where it was left", Math.abs(back.y - before.y) <= 2, `${before.y} then ${back.y}`);
  ok("and history did not grow: it went back, it did not open Lessons again", back.entries === deep.entries && back.index === before.index, JSON.stringify(back));
  ok("the chevron's back slides in from the left", back.push === "left");
  // The phone's own back from there would have been a step forward before; now it leaves Lessons.
  await page.locator('main a[href^="/lessons/"]').nth(3).click();
  await page.waitForURL((u) => new URL(u).pathname.startsWith("/lessons/"));
  await settle(page);
  await page.goBack();
  await page.waitForURL((u) => new URL(u).pathname === "/lessons");
  await sleep(500);
  const sys = await at(page);
  ok("the browser's own back is not drawn a second time", sys.push === "none", JSON.stringify(sys));
  ok("nothing threw", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 2. a cold open, and a screen reached from somewhere else: still a link -----
{
  const { context, page } = await open();
  await page.goto(`${BASE}/lessons/the-cold-open`);
  await settle(page);
  await page.locator("main a.screen-bar-back").first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/lessons", { timeout: 8000 }).catch(() => {});
  ok("a cold open's chevron opens its parent", path(page) === "/lessons", path(page));

  await page.goto(`${BASE}/history`);
  await settle(page);
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const before = await at(page);
  await page.locator("main a.screen-bar-back").first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/you", { timeout: 8000 }).catch(() => {});
  await sleep(400);
  const after = await at(page);
  ok("with another screen under it, the chevron still goes where it says", path(page) === "/you" && after.index === before.index + 1, `${path(page)} ${JSON.stringify(after)}`);
  await context.close();
}

// ---- 3. tabs ----------------------------------------------------------------------
{
  const { context, page } = await open();
  await page.goto(`${BASE}/history`);
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 420));
  await sleep(250);
  // As far as this Log scrolls, if that is short of 420.
  const left = (await at(page)).y;
  await tab(page, "/").click({ force: true });
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await settle(page);
  const today = await at(page);
  ok("tab to tab is a swap: no sideways push", today.push === "none", JSON.stringify(today));
  ok("a tab never opened starts at its top", today.y === 0);
  await tab(page, "/history").click({ force: true });
  await page.waitForURL((u) => new URL(u).pathname === "/history");
  await sleep(500);
  const log = await at(page);
  ok("the Log comes back where it was left", left > 100 && Math.abs(log.y - left) <= 2, `${left} then ${log.y}`);
  await tab(page, "/history").click({ force: true });
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 4000 }).catch(() => {});
  const top = await at(page);
  ok("the tab you are on goes to its top, and stays on it", top.y === 0 && path(page) === "/history", JSON.stringify(top));
  await tab(page, "/you").click({ force: true });
  await page.waitForURL((u) => new URL(u).pathname === "/you");
  await settle(page);
  await tab(page, "/history").click({ force: true });
  await page.waitForURL((u) => new URL(u).pathname === "/history");
  await sleep(500);
  ok("and has no place to come back to after that", (await at(page)).y === 0);
  // A number key is a tab too.
  await page.evaluate(() => window.scrollTo(0, 300));
  await sleep(250);
  await page.keyboard.press("1");
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await settle(page);
  await page.keyboard.press("4");
  await page.waitForURL((u) => new URL(u).pathname === "/history");
  await sleep(500);
  ok("a tab opened by its key keeps its place too", Math.abs((await at(page)).y - 300) <= 2, String((await at(page)).y));
  await context.close();
}

// ---- 4. the bar says where you are -----------------------------------------------
{
  const { context, page } = await open();
  savedWordsMode.rows = SAVED_ROWS.map((r) => ({ ...r }));
  for (const [where, route, want] of [["Your words", "/words", "You"], ["Upload", "/upload", "Practice"], ["Settings", "/settings", "You"], ["a stored recording", "/rep/rep-22", "Log"]]) {
    await page.goto(`${BASE}${route}`);
    await settle(page);
    ok(`${where} lights ${want}`, (await lit(page)) === want, String(await lit(page)));
  }
  const foot = await page.evaluate(() => {
    const main = document.querySelector("main");
    const last = [...main.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().height > 0).pop();
    const nav = document.querySelector(".nav-glass");
    window.scrollTo(0, document.documentElement.scrollHeight);
    return { lastBottom: Math.round(last.getBoundingClientRect().bottom), navTop: Math.round(nav.getBoundingClientRect().top) };
  });
  await sleep(200);
  const clear = await page.evaluate(() => {
    const main = document.querySelector("main");
    const kids = [...main.children].filter((el) => el.getBoundingClientRect().height > 0);
    const last = kids[kids.length - 1].getBoundingClientRect();
    return Math.round(document.querySelector(".nav-glass").getBoundingClientRect().top - last.bottom);
  });
  ok("a stored recording's last line clears the bar", clear >= 8, `${clear}px (${JSON.stringify(foot)})`);
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector("main", { timeout: 20000 });
  await sleep(500);
  ok("the recorder has no tab bar", (await page.locator("nav .nav-glass").count()) === 0);
  await context.close();
}

// ---- 5. the header's words ----------------------------------------------------------
{
  const { context, page } = await open(320);
  await page.goto(`${BASE}/calibrate`);
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 400));
  await sleep(500);
  const bar = await page.evaluate(() => {
    const back = document.querySelector(".screen-bar .screen-bar-back")?.getBoundingClientRect();
    const title = document.querySelector(".screen-bar .screen-bar-title")?.getBoundingClientRect();
    const bar = document.querySelector(".screen-bar").getBoundingClientRect();
    return back && title ? { gap: Math.round(title.left - back.right), in: title.right <= bar.right + 0.5 && back.left >= bar.left - 0.5 } : null;
  });
  ok("at 320 the bar's title and its back never overlap", !!bar && bar.gap >= 0 && bar.in, JSON.stringify(bar));
  await context.close();
}
{
  const { context, page } = await open();
  // Sent to sign in from somewhere else: the back can only say "Back".
  await page.goto(`${BASE}/signin?next=%2Fshop`);
  await settle(page);
  const back = await page.evaluate(() => {
    const a = document.querySelector("main .screen-bar-back");
    if (!a) return null;
    const word = a.querySelector("span");
    const r = a.getBoundingClientRect();
    return { name: a.textContent.trim(), hidden: word.classList.contains("sr-only"), w: Math.round(r.width), h: Math.round(r.height) };
  });
  ok("a back that could only say Back is the chevron alone, named and 44 wide", !!back && back.name === "Back" && back.hidden && back.w >= 44 && back.h >= 44, JSON.stringify(back));
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const named = await page.evaluate(() => {
    const word = document.querySelector("main .screen-bar-back span");
    return { text: word?.textContent, hidden: word?.classList.contains("sr-only") };
  });
  ok("a back named for where it goes keeps its name", named.text === "You" && named.hidden === false, JSON.stringify(named));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
