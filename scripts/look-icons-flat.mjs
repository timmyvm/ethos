/**
 * The flat icon board's camera (app/workbench/icons): the board shot
 * whole at 430 wide, light and dark, at deviceScaleFactor 2, laid side by
 * side, and each section cropped light over dark so it can be read at
 * full size.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 4151
 *   LOOK_BASE=http://localhost:4151 node scripts/look-icons-flat.mjs
 *
 * Writes into LOOK_OUT (default docs/look/icons-flat/):
 *   board-light.png, board-dark.png   the whole board in each theme
 *   board.jpg                         light beside dark, scaled to stay under 1 MB for a phone
 *   stats.png, lessons.png, family.png, context.png
 *                                     each section, light over dark
 * Single shots, and each trait's objects (trait-<id>.png, light beside
 * dark), go to LOOK_TMP (default the system temp dir), never the repository.
 */
import { createRequire } from "node:module";
import { mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require("playwright");
const sharp = require("sharp");
const F = await import("./look-fixtures.mjs");

const BASE = process.env.LOOK_BASE ?? "http://localhost:4151";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/icons-flat/", import.meta.url).pathname).replace(/\/?$/, "/");
const TMP = process.env.LOOK_TMP ?? join(tmpdir(), "icons-flat");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const THEMES = ["light", "dark"];
const GROUND = { light: "#ffffff", dark: "#121212" };
const SECTIONS = {
  stats: 'section[aria-label="Stat icons"]',
  lessons: 'section[aria-label="Lesson objects"]',
  family: `section[aria-label="On the family's colour"]`,
  context: 'section[aria-label="In the app"]',
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const shots = {};
for (const theme of THEMES) {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, colorScheme: theme });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.addInitScript(F.seed, { theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  await page.goto(`${BASE}/workbench/icons`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const board = join(TMP, `board-${theme}.png`);
  await page.screenshot({ path: board, fullPage: true });
  shots[theme] = { board };
  /* Each section with 12px of the page's ground around it; each trait's
     objects too, into LOOK_TMP only, to be read at full size. */
  const crop = async (selector, file) => {
    const box = await page.locator(selector).boundingBox();
    const pad = 12;
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    await page.screenshot({ path: file, fullPage: true, clip: { x, y, width: Math.min(430 - x, box.width + 2 * pad), height: box.height + 2 * pad } });
  };
  for (const [name, selector] of Object.entries(SECTIONS)) {
    const file = join(TMP, `${name}-${theme}.png`);
    await crop(selector, file);
    shots[theme][name] = file;
  }
  for (const trait of ["pause", "fillers", "repairs", "pace", "range"]) {
    await crop(`[data-family-board="${trait}"]`, join(TMP, `trait-${trait}-${theme}.png`));
  }
  console.log(`board ${theme}`);
  await context.close();
}
await browser.close();

/** Images side by side, a grey band between them. */
async function row(files, gap = 8) {
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const height = Math.max(...metas.map((m) => m.height));
  const width = metas.reduce((s, m) => s + m.width, 0) + gap * (files.length - 1);
  let x = 0;
  const layers = metas.map((m, i) => {
    const l = { input: files[i], left: x, top: 0 };
    x += m.width + gap;
    return l;
  });
  return sharp({ create: { width, height, channels: 3, background: "#8a8a8a" } }).composite(layers).png().toBuffer();
}

/** Images one over the other, a grey band between them. */
async function stack(files, band = 16) {
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const width = Math.max(...metas.map((m) => m.width));
  const height = metas.reduce((s, m) => s + m.height, 0) + band * (files.length - 1);
  let y = 0;
  const layers = metas.map((m, i) => {
    const l = { input: files[i], left: 0, top: y };
    y += m.height + band;
    return l;
  });
  return sharp({ create: { width, height, channels: 3, background: "#8a8a8a" } }).composite(layers).png().toBuffer();
}

for (const theme of THEMES) {
  await sharp(shots[theme].board)
    .flatten({ background: GROUND[theme] })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(`${OUT}board-${theme}.png`);
}
for (const name of Object.keys(SECTIONS)) {
  await sharp(await stack(THEMES.map((t) => shots[t][name]))).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(`${OUT}${name}.png`);
}

for (const trait of ["pause", "fillers", "repairs", "pace", "range"]) {
  await sharp(await row(THEMES.map((t) => join(TMP, `trait-${trait}-${t}.png`)))).png().toFile(join(TMP, `trait-${trait}.png`));
}

/* The phone's copy: light beside dark, scaled down until it is under 1 MB. */
const both = await row(THEMES.map((t) => shots[t].board));
for (const width of [1720, 1600, 1440, 1280]) {
  await sharp(both).resize({ width }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}board.jpg`);
  const bytes = statSync(`${OUT}board.jpg`).size;
  console.log(`board.jpg ${width}px wide, ${(bytes / 1024).toFixed(0)} KB`);
  if (bytes < 1_000_000) break;
}
for (const f of ["board-light.png", "board-dark.png", ...Object.keys(SECTIONS).map((n) => `${n}.png`)]) {
  console.log(f, `${(statSync(OUT + f).size / 1024).toFixed(0)} KB`);
}
