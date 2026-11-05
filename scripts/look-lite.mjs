/**
 * The look loop's camera for lite graphics (#412): Today, the recording
 * screen idle and mid take, the scoring wait and Settings, drawn full and
 * drawn lite, light and dark, plus what each costs in compositing layers
 * and their backing stores (Chromium's LayerTree, at the phone's 3x).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-lite.mjs after                  # docs/look/lite/
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute as supabase, analyzeBody as analyze, json, session, seed, POSE_PREF } from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/lite/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const DPR = Number(process.env.LOOK_DPR ?? 2) || 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

async function layers(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("LayerTree.enable");
  const tree = await new Promise((resolve) => {
    cdp.on("LayerTree.layerTreeDidChange", (e) => e.layers && resolve(e.layers));
    setTimeout(() => resolve([]), 3000);
  });
  const drawn = tree.filter((l) => l.drawsContent);
  const bytes = drawn.reduce((n, l) => n + l.width * l.height * DPR * DPR * 4, 0);
  const canvases = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => `${c.width}x${c.height}`));
  const videos = await page.evaluate(() => document.querySelectorAll("video").length);
  await cdp.detach();
  return { layers: drawn.length, mb: Math.round(bytes / 1e5) / 10, canvases, videos };
}

async function run(theme, lite) {
  const mode = lite ? "lite" : "full";
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", async (route) => { await sleep(4000); await route.fulfill(json(analyze)); });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await context.addInitScript((lite) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    try {
      if (lite) localStorage.setItem("ethos.lite", "crash");
      else localStorage.removeItem("ethos.lite");
      localStorage.removeItem("ethos.alive");
    } catch {}
  }, lite);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  const shot = async (name) => {
    if (!want(name)) return;
    await sleep(900);
    const cost = await layers(page);
    await page.screenshot({ path: `${OUT}${name}-${TAG}-${mode}-${theme}.png` });
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-graphics"));
    console.log(`shot  ${name}-${TAG}-${mode}-${theme}  data-graphics=${attr}  layers=${cost.layers} ~${cost.mb}MB canvases=[${cost.canvases}] videos=${cost.videos}`);
  };
  const step = async (fn) => { try { await fn(); } catch (e) { console.log("STEP-FAILED", mode, theme, String(e.message ?? e).split("\n")[0]); } };

  await step(async () => {
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main", { timeout: 20000 });
    await sleep(2500);
    await shot("today");
  });
  await step(async () => {
    await page.goto(`${BASE}/rep?lesson=h4`);
    await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 20000 });
    await sleep(3500);
    await shot("rep-idle");
    await page.click('button[aria-label="Start recording"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(3000);
    await shot("rep-live");
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await sleep(1500);
    await shot("rep-scoring");
  });
  await step(async () => {
    await page.goto(`${BASE}/settings`);
    await page.getByText("Lite graphics").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    await shot("settings");
  });
  await context.close();
}

for (const theme of (process.env.LOOK_THEMES ?? "light,dark").split(",")) {
  await run(theme, false);
  await run(theme, true);
}
await browser.close();
console.log(`done → ${OUT}`);
