/**
 * Who is active (#431), shot with fixtures: the founder's view (light,
 * dark, 375x667, full page), the loading frame, a failed read, and what
 * anyone else meets. The route is answered by the camera with the
 * fixture view (scripts/active-fixtures.ts, through lib/active.ts).
 *
 *   npx vite-node --config vitest.config.ts scripts/active-fixtures.ts > /tmp/active-view.json
 *   LOOK_BASE=http://localhost:3123 PLAYWRIGHT_MODULE=... node scripts/look-active.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { readFileSync, mkdirSync } from "node:fs";
import { json, session, seed, POSE_PREF, supabaseRoute as supabase } from "./look-fixtures.mjs";
const OUT = process.env.LOOK_OUT ?? "docs/look/comeback-active/";
mkdirSync(OUT, { recursive: true });
const VIEW = readFileSync(process.env.ACTIVE_VIEW ?? "/tmp/active-view.json", "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
async function shot(name, { w = 390, h = 844, theme = "light", answer = "ok", full = false, delay = 0 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block" });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/active", async (route) => {
    if (delay) await sleep(delay);
    if (answer === "ok") return route.fulfill({ status: 200, contentType: "application/json", body: VIEW });
    if (answer === "fail") return route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"Read failed."}' });
    return route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Not found."}' });
  });
  await ctx.route("http://supabase.local/auth/v1/token**", (r) => r.fulfill(json(session)));
  await ctx.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await ctx.addInitScript(() => { const css = document.createElement("style"); css.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css)); });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: h > 700 ? 34 : 0, left: 0, right: 0 } });
  let broke = false;
  page.on("pageerror", (e) => { broke = true; console.log("PAGEERROR", e.message.slice(0, 200)); });
  for (let i = 0; i < 3; i++) {
    broke = false;
    await page.goto(`${process.env.LOOK_BASE ?? "http://localhost:3123"}/active`, { waitUntil: delay ? "domcontentloaded" : "networkidle" });
    if (!delay) await page.waitForSelector("main h1, main h2", { timeout: 15000 }).catch(() => (broke = true));
    if (!broke) break;
    console.log("retry", name);
  }
  await sleep(delay ? 600 : 1500);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
  console.log(name, await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth })));
  await ctx.close();
}
await shot("active-390-light", {});
await shot("active-390-light-full", { full: true });
await shot("active-390-dark", { theme: "dark" });
await shot("active-375-light", { w: 375, h: 667 });
await shot("active-loading-390-light", { delay: 4000 });
await shot("active-failed-390-light", { answer: "fail" });
await shot("active-not-founder-390-light", { answer: "none" });
await browser.close();
