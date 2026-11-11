/**
 * A recording is protected, in a real browser (#440).
 *
 * Four promises: the screen is held awake from Record to the result and
 * let go after; a send that stalls gives its screen a way off, and the
 * take is not lost for leaving; a blocked microphone on an iPhone that
 * runs Ethos from its Home Screen gets steps for a phone with no
 * address bar; and Hostile gets the same steps where it had one line.
 *
 * The wake lock is counted, not felt: `navigator.wakeLock` is replaced
 * by a stub that records each request and release.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-awake.mjs
 *   SHOTS=docs/look/hig node scripts/check-awake.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { analyzeBody, json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ? process.env.SHOTS.replace(/\/?$/, "/") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
/** How /api/analyze answers each send, in order; the last one repeats. */
let script = ["ok"];
let sends = 0;

async function open({ iphone = false, micDenied = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
    ...(iphone ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1" } : {}),
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/analyze", async (route) => {
    const how = script[Math.min(sends, script.length - 1)];
    sends += 1;
    await sleep(900);
    if (how === "502") return route.fulfill(json({ error: null }, 502));
    return route.fulfill(json(analyzeBody));
  });
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(({ iphone, micDenied }) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    // The wake lock, counted.
    window.__awake = { asked: 0, released: 0, held: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          window.__awake.asked += 1;
          window.__awake.held += 1;
          return { release: async () => { window.__awake.released += 1; window.__awake.held -= 1; } };
        },
      },
    });
    if (iphone) Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    if (micDenied) {
      const deny = async () => { throw new DOMException("Permission denied", "NotAllowedError"); };
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: deny });
    }
  }, { iphone, micDenied });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  return { context, page };
}
const awake = (page) => page.evaluate(() => ({ ...window.__awake }));
const START = 'button[aria-label="Start recording"]';
const STOP = 'button[aria-label="Stop and score this recording"]';

// ---- 1. awake from Record to the result -------------------------------------
{
  script = ["ok"]; sends = 0;
  const { context, page } = await open();
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(START, { timeout: 20000 });
  await sleep(700);
  ok("nothing is held before Record", (await awake(page)).held === 0);
  await page.click(START, { force: true });
  await page.waitForSelector(STOP, { timeout: 15000 });
  await sleep(2800);
  let a = await awake(page);
  ok("the screen is held awake while the take is spoken", a.asked >= 1 && a.held === 1, JSON.stringify(a));
  await page.click(STOP, { force: true });
  await sleep(400);
  a = await awake(page);
  ok("and still held while it is scored", a.held === 1, JSON.stringify(a));
  await page.waitForFunction(() => window.__awake.held === 0, null, { timeout: 15000 }).catch(() => {});
  a = await awake(page);
  const scored = sends === 1 && (await page.evaluate(() => !/didn't score/.test(document.querySelector("main")?.textContent ?? "")));
  ok("and let go once the result is on screen", a.held === 0 && a.released === a.asked && scored, `${JSON.stringify(a)}, ${sends} send`);
  await context.close();
}

// ---- 2. a stalled send has a way off, and leaving loses nothing --------------
{
  script = ["502", "502", "ok"]; sends = 0;
  const { context, page } = await open();
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(START, { timeout: 20000 });
  await sleep(600);
  await page.click(START, { force: true });
  await page.waitForSelector(STOP, { timeout: 15000 });
  await sleep(2800);
  await page.click(STOP, { force: true });
  // The first try has no way off: scoring is a few seconds, and a link there is a way to lose it.
  await sleep(500);
  const early = await page.locator("main a").filter({ hasText: /^Back to / }).count();
  ok("no way off before anything has gone wrong", early === 0);
  await page.waitForSelector("text=Still sending", { timeout: 15000 });
  const link = page.locator("main a").filter({ hasText: /^Back to / });
  await link.waitFor({ timeout: 5000 }).catch(() => {});
  const box = await link.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    return { text: el.textContent, href: el.getAttribute("href"), h: r.height, reach: after.content !== "none" };
  }).catch(() => null);
  ok("a send that stalls offers the way back, named for where it goes", !!box && /^Back to \S/.test(box.text) && !!box.href, JSON.stringify(box));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}scoring-stalled-after-light.png` });
  await link.click();
  await page.waitForURL((u) => new URL(u).pathname !== "/rep", { timeout: 8000 }).catch(() => {});
  ok("it leaves the screen", new URL(page.url()).pathname !== "/rep", page.url());
  // The take keeps sending behind the screen that was left.
  await sleep(12000);
  ok("and the take is still sent after leaving", sends >= 3, `${sends} sends`);
  await context.close();
}

// ---- 3. a blocked mic on an installed iPhone ----------------------------------
{
  const { context, page } = await open({ iphone: true, micDenied: true });
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(START, { timeout: 20000 });
  await sleep(600);
  await page.click(START, { force: true });
  await page.waitForSelector("main ol li", { timeout: 10000 }).catch(() => {});
  const steps = await page.evaluate(() => [...document.querySelectorAll("main ol li")].map((li) => li.textContent.replace(/^\d+/, "").trim()));
  ok("an installed iPhone is told to open Ethos again", steps.length >= 3 && /Close Ethos/.test(steps[0]) && steps.some((s) => /Tap Allow/.test(s)), steps.join(" | "));
  ok("and never sent to an address bar it does not have", !steps.some((s) => /address bar|aA|Website Settings/.test(s)));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}mic-blocked-installed-after-light.png` });
  await context.close();
}
{
  const { context, page } = await open({ micDenied: true });
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(START, { timeout: 20000 });
  await sleep(600);
  await page.click(START, { force: true });
  await page.waitForSelector("main ol li", { timeout: 10000 }).catch(() => {});
  const steps = await page.evaluate(() => [...document.querySelectorAll("main ol li")].map((li) => li.textContent));
  ok("a browser tab keeps its own browser's steps", steps.length >= 3 && !steps.some((s) => /Close Ethos/.test(s)), steps.join(" | ").slice(0, 120));
  await context.close();
}

// ---- 4. Hostile gets the steps too ---------------------------------------------
{
  const { context, page } = await open({ iphone: true, micDenied: true });
  await page.goto(`${BASE}/hostile`);
  await page.waitForSelector("main button:has-text('Record my take')", { timeout: 20000 });
  await sleep(700);
  await page.locator("main button:has-text('Record my take')").click({ force: true });
  await page.waitForSelector("main ol li", { timeout: 10000 }).catch(() => {});
  const state = await page.evaluate(() => ({
    steps: [...document.querySelectorAll("main ol li")].length,
    first: document.querySelector("main ol li")?.textContent ?? "",
    again: [...document.querySelectorAll("main button")].filter((b) => /Check again/.test(b.textContent)).length,
    record: [...document.querySelectorAll("main button")].filter((b) => /Record my take/.test(b.textContent)).length,
  }));
  ok("Hostile shows this phone's steps where it had one line", state.steps >= 3 && /Close Ethos/.test(state.first), JSON.stringify(state));
  ok("and keeps one tap: its own Record is the check", state.again === 0 && state.record === 1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}hostile-mic-blocked-after-light.png` });
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
