/**
 * The look loop's camera for the command menu (#438): a desktop window
 * (a keyboard, a pointer that hovers), light and dark.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-command.mjs after              # docs/look/command/
 *
 * Scenes: hint (Today with the hint in the window's corner), open (the
 * menu as it opens), typed (two letters in: "pa"), lesson (a lesson
 * found by a word), none (nothing found), phone (a phone's Today: no
 * hint), and strip (the menu rising, 0 to 400ms).
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/command/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function open(theme, phone = false) {
  const context = await browser.newContext({
    ...(phone
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1180, height: 800 } }),
    deviceScaleFactor: 2, locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main");
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(900);
  return { context, page };
}

for (const theme of ["light", "dark"]) {
  const shot = async (page, name, clip) => {
    if (!want(name)) return;
    await page.screenshot({ path: `${OUT}${name}-${TAG}-${theme}.png`, ...(clip ? { clip } : {}) });
    console.log(`shot  ${name}-${TAG}-${theme}`);
  };
  const { context, page } = await open(theme);
  const column = { x: 1180 / 2 - 260, y: 0, width: 520, height: 800 };
  await shot(page, "hint");
  if (want("strip")) {
    await page.keyboard.press("Control+k");
    await page.waitForSelector(".command-sheet");
    for (const t of [80, 160, 240, 400]) {
      await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), t);
      await page.screenshot({ path: `${OUT}strip-${t}-${TAG}-${theme}.png`, clip: column });
    }
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    await page.keyboard.press("Escape");
    await sleep(700);
  }
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-sheet");
  await sleep(900);
  await shot(page, "open", column);
  await page.keyboard.type("pa");
  await sleep(250);
  await shot(page, "typed", column);
  await page.keyboard.press("Control+a");
  await page.keyboard.type("closed");
  await sleep(250);
  await shot(page, "lesson", column);
  await page.keyboard.press("Control+a");
  await page.keyboard.type("zzz");
  await sleep(250);
  await shot(page, "none", column);
  await context.close();

  if (want("phone")) {
    const p = await open(theme, true);
    await p.page.screenshot({ path: `${OUT}phone-${TAG}-${theme}.png` });
    console.log(`shot  phone-${TAG}-${theme}`);
    await p.context.close();
  }
}
await browser.close();
console.log(`done → ${OUT}`);
