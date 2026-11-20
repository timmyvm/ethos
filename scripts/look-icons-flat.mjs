/**
 * The flat icon board's camera (app/workbench/icons): each column (A, B,
 * Now) shot whole at 430 wide, light and dark, at deviceScaleFactor 2,
 * then laid side by side.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 4151
 *   LOOK_BASE=http://localhost:4151 PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/look-icons-flat.mjs
 *
 * Writes into LOOK_OUT (default docs/look/icons-flat/):
 *   board-light.png, board-dark.png  the three columns side by side
 *   context.png                      the "in the app" part of each column, light over dark
 *   board.jpg                        light over dark, scaled to stay under 1 MB for a phone
 * The single columns go to LOOK_TMP (default the system temp dir), never the repository.
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

const VARIANTS = ["a", "b", "now"];
const THEMES = ["light", "dark"];
const GROUND = { light: "#ffffff", dark: "#121212" };
const RULE = { light: "#e4e4e4", dark: "#333333" };

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const shots = {};
for (const theme of THEMES) {
  for (const v of VARIANTS) {
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
    await page.goto(`${BASE}/workbench/icons?only=${v}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const col = join(TMP, `col-${v}-${theme}.png`);
    const ctx = join(TMP, `ctx-${v}-${theme}.png`);
    await page.screenshot({ path: col, fullPage: true });
    await page.locator(`[data-context="${v}"]`).screenshot({ path: ctx });
    shots[`${v}-${theme}`] = { col, ctx };
    console.log(`column ${v} ${theme}`);
    await context.close();
  }
}
await browser.close();

/** Images side by side on the theme's ground, a hairline between them. */
async function row(files, theme, gap = 4) {
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const height = Math.max(...metas.map((m) => m.height));
  const width = metas.reduce((s, m) => s + m.width, 0) + gap * (files.length - 1);
  let x = 0;
  const layers = [];
  metas.forEach((m, i) => {
    layers.push({ input: files[i], left: x, top: 0 });
    x += m.width;
    if (i < files.length - 1) {
      layers.push({ input: { create: { width: gap, height, channels: 3, background: RULE[theme] } }, left: x, top: 0 });
      x += gap;
    }
  });
  return sharp({ create: { width, height, channels: 3, background: GROUND[theme] } }).composite(layers).png().toBuffer();
}

/** Buffers one over the other, a band between them. */
async function stack(buffers, band = 24) {
  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()));
  const width = Math.max(...metas.map((m) => m.width));
  const height = metas.reduce((s, m) => s + m.height, 0) + band * (buffers.length - 1);
  let y = 0;
  const layers = buffers.map((b, i) => {
    const l = { input: b, left: 0, top: y };
    y += metas[i].height + band;
    return l;
  });
  return sharp({ create: { width, height, channels: 3, background: "#8a8a8a" } }).composite(layers).png().toBuffer();
}

const boards = {};
for (const theme of THEMES) {
  boards[theme] = await row(VARIANTS.map((v) => shots[`${v}-${theme}`].col), theme);
  await sharp(boards[theme]).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(`${OUT}board-${theme}.png`);
}
const ctxRows = await Promise.all(THEMES.map((t) => row(VARIANTS.map((v) => shots[`${v}-${t}`].ctx), t)));
await sharp(await stack(ctxRows)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(`${OUT}context.png`);

/* The phone's copy: light over dark, scaled down until it is under 1 MB. */
const both = await stack([boards.light, boards.dark]);
for (const width of [1600, 1440, 1280, 1120]) {
  await sharp(both).resize({ width }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}board.jpg`);
  const bytes = statSync(`${OUT}board.jpg`).size;
  console.log(`board.jpg ${width}px wide, ${(bytes / 1024).toFixed(0)} KB`);
  if (bytes < 1_000_000) break;
}
for (const f of ["board-light.png", "board-dark.png", "context.png"]) console.log(f, `${(statSync(OUT + f).size / 1024).toFixed(0)} KB`);
