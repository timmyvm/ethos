/**
 * Frame strips (DESIGN.md, the look loop step 5): capture a transition at
 * 0, 80, 160, 240 and 400ms after the tap and lay the frames out side by
 * side, so "does this cut?" is a thing you can look at rather than a
 * thing you argue about.
 *
 * The strip is composed in the browser that took it — five data URLs in
 * a flex row, screenshotted — which is why this needs no image library.
 *
 *   node scripts/strip.mjs <name> <url> <selector> [--dark] [--full]
 *   node scripts/strip.mjs tab-log / 'nav a[href="/history"]'
 *   node scripts/strip.mjs mods / 'button:has-text("Make it harder")'
 *
 * Writes docs/look/strips/<name>-{light,dark}.png. The selector is
 * tapped; if it is the literal string "load" the strip is the page's own
 * first 400ms instead.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const [, , NAME, URL_PATH = "/", SELECTOR = "load", ...FLAGS] = process.argv;
if (!NAME) {
  console.error("usage: node scripts/strip.mjs <name> <url> <selector> [--dark] [--full]");
  process.exit(1);
}
const THEME = FLAGS.includes("--dark") ? "dark" : "light";
const FULL = FLAGS.includes("--full");
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = new URL("../docs/look/strips/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/** The five moments DESIGN.md names. 0 is the frame before the tap. */
const AT = [0, 80, 160, 240, 400];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The fixtures and the Supabase mock live with the camera; a strip wants
// the same populated app, so it borrows them.
const { supabaseRoute, seed, analyzeBody, session } = await import("./look-fixtures.mjs");

const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ["microphone"],
  locale: "en-AU",
  timezoneId: "Australia/Melbourne",
  colorScheme: THEME,
});
await context.route("http://supabase.local/**", supabaseRoute);
await context.route("**/api/analyze", async (route) => {
  await sleep(400);
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(analyzeBody),
  });
});
await context.addInitScript(seed, { theme: THEME, session });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 120)));

await page.goto(`${BASE}${URL_PATH}`);
await page.waitForSelector("main");
await sleep(SELECTOR === "load" ? 0 : 1200);

const frames = [];
const shoot = async () => {
  const buf = await page.screenshot({ fullPage: FULL });
  frames.push(`data:image/png;base64,${buf.toString("base64")}`);
};

/*
 * Frame 0 is shot BEFORE the tap, not after it. A screenshot takes forty
 * to eighty milliseconds to come back, so a "0ms" frame captured after
 * the click is really the 60ms frame — which made every strip open on a
 * transition that had already happened and look like a cut.
 */
await shoot();

if (SELECTOR === "load") {
  await page.reload({ waitUntil: "commit" });
} else {
  const target = page.locator(SELECTOR).first();
  await target.waitFor({ timeout: 10000 });
  // Not `click()`: Playwright waits for the element to hold still, which
  // is exactly the window we are trying to photograph.
  await target.dispatchEvent("click");
}

let last = 0;
for (const at of AT.slice(1)) {
  await sleep(at - last);
  last = at;
  await shoot();
}

// Lay the five out in the same browser and photograph the sheet.
const strip = await context.newPage();
await strip.setViewportSize({ width: 5 * 210 + 6 * 14, height: 520 });
await strip.setContent(`
  <style>
    body { margin:0; background:#0f0d0b; font:11px/1 ui-monospace,monospace; color:#8a8272;
           display:flex; gap:14px; padding:14px; align-items:flex-start; }
    figure { margin:0; width:210px; }
    img { width:210px; display:block; border-radius:4px; }
    figcaption { padding-top:7px; letter-spacing:.12em; text-transform:uppercase; }
  </style>
  ${AT.map((at, i) => `<figure><img src="${frames[i]}"><figcaption>${at}ms</figcaption></figure>`).join("")}
`);
await strip.waitForTimeout(300);
const path = `${OUT}${NAME}-${THEME}.png`;
await strip.screenshot({ path, fullPage: true });
console.log(`strip → ${path}`);

await browser.close();
