/**
 * A labelled contact sheet of scripts/look-since-day-one.mjs's shots: a
 * before folder, and an after folder beside it when there is one, as one
 * JPG small enough to keep in docs/look/since-day-one/ (under 250 KB by
 * default; the quality steps down until it fits).
 *
 *   node scripts/sheet-since-day-one.mjs <out.jpg> <before dir> [<after dir>]
 *
 * One row per scene, one column per size and theme; with an after folder
 * each column is a pair, "before, 390 light" beside "after, 390 light".
 * Under every shot, the camera's own measures from that folder's
 * report.json: the largest band, the scroll, and whether the tap and Not
 * now stand on the first screen, in rust where the camera fails them.
 *
 *   SHEET_ROWS=progress,save-rep1          scenes, one row each (default:
 *                                          progress and save-rep1)
 *   SHEET_COLS=390x844-light,390x844-dark  sizes and themes (default:
 *                                          390x844 light and dark, 320x568
 *                                          light, 320x692 light)
 *   SHEET_CELLS=progress@390x844-light,save-rep1@320x568-light
 *                                          exact cells instead, rows formed
 *                                          by scene in the order given
 *   SHEET_SCALE=0.6                        sheet pixels per CSS pixel, so
 *                                          a 320 shot stands narrower than
 *                                          a 390 one, as on the phones
 *   SHEET_MAX_KB=250   SHEET_TITLE="..."
 *
 * Rendered by Playwright (an HTML grid, screenshotted), so it needs no
 * image library. PLAYWRIGHT_MODULE as for the camera.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

const GLOBAL_PW = "/opt/node22/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? (existsSync(GLOBAL_PW) ? GLOBAL_PW : "playwright"));

const [, , out, beforeDir, afterDir] = process.argv;
if (!out || !beforeDir) {
  console.error("usage: node scripts/sheet-since-day-one.mjs <out.jpg> <before dir> [<after dir>]");
  process.exit(1);
}
const SCALE = Number(process.env.SHEET_SCALE ?? 0.6);
const MAX_KB = Number(process.env.SHEET_MAX_KB ?? 250);
const BAND_HELD = new Set(["390x844", "430x932"]);
const NO_SCROLL = new Set(["320x568", "320x692"]);
const SHORT = { "390x844": "390", "375x667": "375", "320x568": "320", "430x932": "430", "320x692": "320 text+2" };
const ABOUT = {
  progress: "Since day one: 22 recordings over 26 days, the lead fillers, the Ethos row",
  "progress-wpm": "Since day one, the lead words a minute (I rush)",
  "progress-noindex": "Since day one, the first recording with no Ethos: three rows",
  "progress-worse": "Since day one, a mixed story: the lead and pauses worse, in rust",
  "progress-sheet": "Since day one, See Premium tapped: the paywall over it",
  "save-rep1": "Before you go, after the first recording, with its Ethos",
  "save-streak": "Before you go, the third day running",
  "save-noindex": "Before you go, the third day, no Ethos",
};

const folders = [["before", beforeDir], ...(afterDir ? [["after", afterDir]] : [])].map(([tag, dir]) => {
  const d = resolve(dir);
  let report = { shots: {} };
  try {
    report = JSON.parse(readFileSync(`${d}/report.json`, "utf8"));
  } catch {
    console.warn(`${d}/report.json not read: cells carry no measures`);
  }
  return { tag, dir: d, report };
});

/* The cells, as rows of [scene, size-theme]. */
let rows;
if (process.env.SHEET_CELLS) {
  const by = new Map();
  for (const c of process.env.SHEET_CELLS.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [scene, col] = c.split("@");
    if (!scene || !/^\d+x\d+-(light|dark)$/.test(col ?? "")) throw new Error(`SHEET_CELLS: "${c}" is not scene@WxH-theme`);
    if (!by.has(scene)) by.set(scene, []);
    by.get(scene).push(col);
  }
  rows = [...by.entries()];
} else {
  const scenes = (process.env.SHEET_ROWS ?? "progress,save-rep1").split(",").map((s) => s.trim()).filter(Boolean);
  const cols = (process.env.SHEET_COLS ?? "390x844-light,390x844-dark,320x568-light,320x692-light").split(",").map((s) => s.trim()).filter(Boolean);
  rows = scenes.map((s) => [s, cols]);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const RUST = "#b2432c";
function measures(entry, size) {
  if (!entry || entry.band === undefined) return `<span style="color:#888">no measures</span>`;
  const band = entry.band?.size ?? 0;
  const bandBad = BAND_HELD.has(size) && band > 64;
  const scrollBad = NO_SCROLL.has(size) && entry.scrolls && !(entry.tapDocked && entry.tapOnScreen);
  const sheet = entry.scene?.endsWith("-sheet");
  const tapBad = !sheet && !entry.tapOnScreen;
  const notBad = !sheet && !entry.notNowOnScreen;
  const bit = (text, bad) => `<span style="color:${bad ? RUST : "#555"};font-weight:${bad ? 700 : 500}">${esc(text)}</span>`;
  return [
    bit(`band ${band}px`, bandBad),
    bit(entry.scrolls ? `scrolls ${entry.scrollBy}px` : "no scroll", scrollBad),
    bit(entry.tapOnScreen ? "tap on screen" : "tap off screen", tapBad),
    ...(sheet ? [] : [bit(entry.notNowOnScreen ? "Not now on" : "Not now off", notBad)]),
  ].join(", ");
}

let missing = 0;
function cell(folder, scene, col) {
  const [size, theme] = col.split("-");
  const [w] = size.split("x").map(Number);
  const width = Math.round(w * SCALE);
  const file = `${folder.dir}/${scene}-${size}-${theme}.png`;
  const label = `${folder.tag}, ${SHORT[size] ?? size} ${theme}`;
  const head = `<div style="font:700 13px/1.2 system-ui,sans-serif;color:#222;margin-bottom:4px">${esc(label)}</div>`;
  if (!existsSync(file)) {
    missing += 1;
    return `<div style="width:${width}px">${head}<div style="width:${width}px;height:${Math.round(width * 1.8)}px;border:1px dashed #999;border-radius:10px;display:grid;place-items:center;font:12px system-ui;color:#777">not shot</div></div>`;
  }
  const entry = folder.report.shots?.[`${scene}-${size}-${theme}`];
  const img = `<img src="data:image/png;base64,${readFileSync(file).toString("base64")}" style="display:block;width:${width}px;border-radius:10px;outline:1px solid rgba(0,0,0,.18)">`;
  const foot = `<div style="font:11px/1.35 system-ui,sans-serif;margin-top:5px;max-width:${width}px">${measures(entry, size)}</div>`;
  return `<div style="width:${width}px">${head}${img}${foot}</div>`;
}

const title =
  process.env.SHEET_TITLE ??
  `Since day one and Before you go: ${folders.map((f) => `${f.tag} (${basename(f.dir)})`).join(" against ")}`;
const html = `<body style="margin:0;background:#dedede"><div id="s" style="padding:16px 18px 18px;width:max-content;background:#dedede">
<div style="font:800 18px/1.2 system-ui,sans-serif;color:#111;margin-bottom:12px">${esc(title)}</div>
${rows
  .map(
    ([scene, cols]) => `<div style="margin-top:14px">
  <div style="font:700 14px/1.2 system-ui,sans-serif;color:#111;margin-bottom:8px">${esc(scene)}<span style="font-weight:500;color:#444">${ABOUT[scene] ? `, ${esc(ABOUT[scene])}` : ""}</span></div>
  <div style="display:flex;gap:14px;align-items:flex-start">${cols
    .map((col) => `<div style="display:flex;gap:8px;align-items:flex-start">${folders.map((f) => cell(f, scene, col)).join("")}</div>`)
    .join("")}</div>
</div>`
  )
  .join("\n")}
</div></body>`;

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))));
let quality = 84;
let kb = Infinity;
for (; quality >= 40; quality -= 6) {
  await page.locator("#s").screenshot({ path: out, type: "jpeg", quality });
  kb = statSync(out).size / 1024;
  if (kb <= MAX_KB) break;
}
await browser.close();
console.log(`sheet -> ${out} (${Math.round(kb)} KB at quality ${Math.max(quality, 40)}${missing ? `, ${missing} cell(s) not shot` : ""})`);
if (kb > MAX_KB) {
  console.log(`over ${MAX_KB} KB even at quality 40: lower SHEET_SCALE or take fewer cells`);
  process.exit(1);
}
