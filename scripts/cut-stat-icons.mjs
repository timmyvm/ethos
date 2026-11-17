/**
 * The stat icons (#487), cut from their renders.
 *
 * Timothy, 16 Nov: "instead of icons make freeze, streak, ect higgs
 * field icons duolingo style!" Every glyph that stands for a count or a
 * state (the streak, a freeze, XP, the best streak, a game's best) is a
 * chunky glossy 3D object now, in the plush Demos's and the glass lesson
 * art's world; the controls and the tab bar stay line icons.
 *
 * The renders: Higgsfield, GPT Image 2.6 at high quality, 1:1, 1024px,
 * with a transparent background. The flame was rendered first as four
 * variants and the plump two-tipped one chosen at 16 to 64px on #121212
 * and on white; every other icon was rendered with it as the reference
 * image, so the set is one family. The full-size sources are committed
 * in `assets/icons-3d/` (job ids in DECISIONS #487); the grey flame is
 * not a render, it is the lit file through a CSS filter
 * (`.stat-icon[data-lit="false"]`, app/globals.css), so the two can
 * never drift apart in shape.
 *
 * What this does, per source:
 *   1. drops the alpha haze the renderer leaves round the object
 *      (alpha under NOISE goes to 0, the rest is stretched back to
 *      full range), so the trim finds the object and no glow rings it;
 *   2. trims to the object's box;
 *   3. sizes it to one optical size: fitted inside the square with
 *      MARGIN on each side, then scaled by (cMin / c)^0.25, where c is
 *      how much of its own square the object fills. A flame fills more
 *      of its box than a snowflake or a bolt, so at the same box it
 *      reads bigger; the quarter power evens that out without shrinking
 *      the dense ones into dots. OPTICAL nudges what the eye still
 *      disagrees with;
 *   4. centres it on a SIZE square and writes WebP with alpha.
 *
 * SIZE is 3x the largest place an icon is drawn: 64pt, the streak
 * moment's flame (#480 swaps its drawn flame for this file at the merge).
 *
 *   node scripts/cut-stat-icons.mjs
 *
 * Output: public/icons/3d/<name>.webp, a few KB each, and a line per
 * icon with its fill and bytes. Run after replacing a source; the output
 * is committed, and lib/stat-icons.test.ts holds each under its ceiling.
 * A re-cut file keeps its path, and the service worker serves a .webp
 * cache-first from its precache, so an installed phone keeps the old
 * file until CACHE in public/sw.js moves: bump it in the same commit.
 */
import { mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

const SRC = "assets/icons-3d/";
const OUT = process.env.OUT ?? "public/icons/3d/";
const SIZE = Number(process.env.SIZE ?? 192);
/** Air on each side of the fitted object, as a share of SIZE. */
const MARGIN = 0.04;
/**
 * Alpha at or under this is the renderer's haze, not the object; the
 * alpha above it is stretched back to 0 to 255 so the edge stays soft.
 * The snowflake came back in a pale blue glow (8% of its frame at 10 to
 * 40), which drew a light ring on #121212, so its floor is higher.
 */
const NOISE = { streak: 10, freeze: 48, xp: 10, best: 10, trophy: 10 };
/** The eye's last word, per icon: a multiplier on the computed scale. */
const OPTICAL = { streak: 1, freeze: 1, xp: 1, best: 1, trophy: 0.94 };
const NAMES = Object.keys(OPTICAL);

mkdirSync(OUT, { recursive: true });

/** The object's box and how much of its own square it fills. */
async function measure(name) {
  const { data, info } = await sharp(`${SRC}${name}.png`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const floor = NOISE[name];
  let x0 = w, y0 = h, x1 = -1, y1 = -1, mass = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3;
      if (data[i] <= floor) {
        data[i] = 0;
        continue;
      }
      data[i] = Math.round(((data[i] - floor) * 255) / (255 - floor));
      mass += data[i] / 255;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const side = Math.max(bw, bh);
  return { name, data, w, h, box: { left: x0, top: y0, width: bw, height: bh }, side, fill: mass / (side * side) };
}

/**
 * The one icon drawn large: the streak moment's flame (#480), which
 * takes the screen's free height since #496, up to 340pt. 192px held it
 * at 160pt; at 340pt on a 3x phone it would be stretched five times, so
 * it has its own cut, at the source's own resolution (the flame fills
 * about 840px of the 1024px render: nothing finer exists to give).
 */
const LARGE = { streak: 840 };

const all = await Promise.all(NAMES.map(measure));
const cMin = Math.min(...all.map((m) => m.fill));

async function cut(m, size, file) {
  const inner = size * (1 - 2 * MARGIN);
  const scale = (inner / m.side) * (cMin / m.fill) ** 0.25 * OPTICAL[m.name];
  const tw = Math.max(1, Math.round(m.box.width * scale));
  const th = Math.max(1, Math.round(m.box.height * scale));
  const object = await sharp(m.data, { raw: { width: m.w, height: m.h, channels: 4 } })
    .extract(m.box)
    .resize(tw, th, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: object, left: Math.round((size - tw) / 2), top: Math.round((size - th) / 2) }])
    .webp({ quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toFile(file);
  console.log(
    `${m.name.padEnd(7)} fill ${m.fill.toFixed(3)}  scale ${scale.toFixed(3)}  ${tw}x${th} in ${size}  ${statSync(file).size} bytes`
  );
}

for (const m of all) {
  await cut(m, SIZE, `${OUT}${m.name}.webp`);
  if (LARGE[m.name]) await cut(m, LARGE[m.name], `${OUT}${m.name}-large.webp`);
}
