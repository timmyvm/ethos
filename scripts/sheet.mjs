/**
 * Shots side by side in one image: the look loop's "view them, then view
 * the reference beside them" (DESIGN.md) for more screens than fit in
 * one glance, and small enough to keep in the repository where the
 * full-size PNGs are not (22 screens in two themes, before and after,
 * are 60 MB as PNGs and 2 MB as six sheets).
 *
 *   node scripts/sheet.mjs <out.jpg> <columns> <cell width> <max height> <a.png> <b.png> ...
 *
 *   LOOK_OUT=/tmp/shots node scripts/look.mjs after today lessons you
 *   node scripts/sheet.mjs docs/look/x/after.jpg 3 300 700 /tmp/shots/*-after-light.png
 *
 * Each shot is scaled to the cell's width under its file's name (less
 * the `-before-light` tail `scripts/look.mjs` gives it) and cut off at
 * the max height, so a long page shows its first screen or so. A name
 * of the form `label=path` sets the label. SHEET_GROUND=dark draws the
 * sheet on a dark ground for dark shots.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [, , out, cols, cellW, maxH, ...files] = process.argv;
if (!out || !files.length) {
  console.error("usage: node scripts/sheet.mjs <out.jpg> <columns> <cell width> <max height> <shot.png> ...");
  process.exit(1);
}
const dark = process.env.SHEET_GROUND === "dark";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const cell = (entry) => {
  const at = entry.indexOf("=");
  const file = at > 0 ? entry.slice(at + 1) : entry;
  const label = at > 0 ? entry.slice(0, at) : basename(file).replace(/\.(png|jpe?g)$/, "").replace(/-(before|after)-(light|dark)$/, "");
  const type = /\.jpe?g$/.test(file) ? "jpeg" : "png";
  return `<div><div style="font:600 14px ui-sans-serif,system-ui,sans-serif;color:${dark ? "#bbb" : "#333"};margin-bottom:5px">${label}</div><div style="width:${cellW}px;max-height:${maxH}px;overflow:hidden;border-radius:12px"><img src="data:image/${type};base64,${readFileSync(file).toString("base64")}" style="display:block;width:${cellW}px"></div></div>`;
};
await page.setContent(
  `<body style="margin:0"><div id="s" style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:14px 10px;background:${dark ? "#2a2a2a" : "#dcdcdc"};padding:12px;width:max-content">${files.map(cell).join("")}</div></body>`
);
await page.locator("#s").screenshot({ path: out, type: "jpeg", quality: 82 });
await browser.close();
console.log("sheet →", out);
