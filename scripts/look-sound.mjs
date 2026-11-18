/**
 * The sound audition's camera (#505): /workbench/sound against the look
 * fixtures (a signed-in account, its introduction done), so the page is
 * shot as Timothy opens it, light and dark at 390x844 and light at 320.
 *
 *   LOOK_BASE=http://localhost:3971 LOOK_OUT=docs/look/sound/after \
 *     node scripts/look-sound.mjs after
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require("playwright");
const F = await import("./look-fixtures.mjs");

const [, , TAG = "after"] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3971";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/sound/after/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
for (const [w, h, theme] of [
  [390, 844, "light"],
  [390, 844, "dark"],
  [320, 568, "light"],
]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.addInitScript(F.seed, { theme, session: F.session, pose: F.POSE_PREF });
  const page = await context.newPage();
  await page.goto(`${BASE}/workbench/sound`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${TAG}-workbench-sound-${w}x${h}-${theme}.png` });
  if (w === 390 && theme === "light") await page.screenshot({ path: `${OUT}${TAG}-workbench-sound-390-light-full.png`, fullPage: true });
  console.log(`workbench/sound ${w}x${h} ${theme}`);
  await context.close();
}
await browser.close();
