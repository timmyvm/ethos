/**
 * The lesson icons (#503), cut from their renders.
 *
 * Timothy, 18 Nov: "Let's use Higgsfield to change the icon colors. I
 * mean the lesson things." The fifteen lesson objects were pale Liquid
 * Glass (#322) beside the stat icons' bold glossy objects (#487), so
 * they were re-rendered in the stat icons' family: the same object per
 * lesson, chunky, saturated and glossy, each in its unit's colour made
 * bold (Pausing cobalt, Fillers pink, Restarts amber, Pace green,
 * Variety violet), on a transparent ground.
 *
 * The renders: Higgsfield, GPT Image 2.6 at high quality, 1:1, 1024px,
 * transparent background, with the stat flame and cup masters
 * (assets/icons-3d/streak.png, trophy.png) as reference images so the
 * two sets are one family. The full-size sources are committed in
 * `assets/lessons-3d/<lesson id>.png` (job ids in DECISIONS #503).
 *
 * What this does, per source (the stat icons' cut, scripts/cut-stat-
 * icons.mjs, at the lesson art's two sizes):
 *   1. drops the alpha haze the renderer leaves round the object
 *      (alpha at or under NOISE goes to 0, the rest is stretched back to
 *      full range), so the trim finds the object and no glow rings it;
 *   2. trims to the object's box;
 *   3. sizes it to one optical size: fitted inside the square with
 *      MARGIN on each side, then scaled by (cMin / c)^0.25, where c is
 *      how much of its own square the object fills. A cube fills more
 *      of its box than a flag or an S-arrow, so at the same box it reads
 *      bigger; the quarter power evens that out without shrinking the
 *      dense ones into dots. OPTICAL nudges what the eye still disagrees
 *      with;
 *   4. centres it on a square and writes WebP with alpha, once per size:
 *      public/lessons/<id>.webp at 360 (the thumbnails, 84 CSS px at
 *      most) and public/lessons/large/<id>.webp at 560 (Today's card,
 *      the lesson page and the recorder's topic card, up to 260px);
 *   5. measures each 560 cut's visible box (alpha over 40 of 255) and
 *      writes lib/lesson-art-bounds.ts, which Today's card and the topic
 *      card place every object by (lib/home.ts `artBox`).
 *
 * The file names are the lesson ids, as before, so nothing that draws
 * the art changes.
 *
 *   node scripts/cut-lesson-icons.mjs
 *
 * Run after replacing a source; the output is committed. A re-cut file
 * keeps its path, and the service worker serves a .webp cache-first from
 * its precache, so an installed phone keeps the old file until CACHE in
 * public/sw.js moves: bump it in the same commit.
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "assets/lessons-3d/";
const SIZES = [
  { size: 360, out: "public/lessons/" },
  { size: 560, out: "public/lessons/large/" },
];
/**
 * Air on each side of the fitted object, as a share of the square. The
 * glass set left about this much (its objects' longest sides averaged
 * 0.73 of the square), so a thumbnail's tile and the lesson page's stage
 * keep the room they were laid out for.
 */
const MARGIN = 0.11;
/**
 * Alpha at or under this is the renderer's haze, not the object. The
 * boomerang's motion trail came back in a soft violet mist (a tenth of
 * its frame at 1 to 40), which drew a pale cloud round it on #121212, so
 * its floor is higher, as the snowflake's is in the stat cut.
 */
const NOISE = { "second-pass": 40 };
const noise = (name) => NOISE[name] ?? 10;
/** Where Today's card measures an object: alpha over this, of 255. */
const SEEN = 40;

/** Each lesson's object, and the eye's last word on its size (a multiplier on the computed scale). */
const OPTICAL = {
  /* Pausing, cobalt */
  "the-landing": 1, // an orb in a bowl
  "inside-or-after": 1, // two pause bars and a dot
  "the-long-one": 1, // an hourglass
  /* Fillers, pink */
  "the-cold-open": 1, // a door
  "closed-mouth": 1, // a zipper
  "the-crutch": 1, // a magnifier over a speech bubble
  /* Restarts, amber */
  "finish-it": 1, // a checkered flag
  "know-the-landing": 1, // a target
  "or-rather": 1, // an S-arrow
  /* Pace, green */
  "room-to-land": 1, // a road
  "one-gear-down": 1, // a gauge
  "change-gear": 1, // a gearstick
  /* Variety, violet */
  "name-it-once": 1, // a tag
  "short-and-concrete": 1, // a cube
  "second-pass": 1, // a boomerang
};
const NAMES = Object.keys(OPTICAL);

/** The object's box and how much of its own square it fills. */
async function measure(name) {
  const { data, info } = await sharp(`${SRC}${name}.png`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const floor = noise(name);
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

/** The visible box of a written file, as fractions of its square: alpha over SEEN, the rule Today's card was laid out by. */
async function bounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= SEEN) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const r4 = (n) => Math.round(n * 10000) / 10000;
  return { l: r4(x0 / w), t: r4(y0 / h), r: r4((x1 + 1) / w), b: r4((y1 + 1) / h) };
}

const all = await Promise.all(NAMES.map(measure));
const cMin = Math.min(...all.map((m) => m.fill));
const boxes = {};

for (const { size, out } of SIZES) {
  mkdirSync(out, { recursive: true });
  const inner = size * (1 - 2 * MARGIN);
  for (const m of all) {
    const scale = (inner / m.side) * (cMin / m.fill) ** 0.25 * OPTICAL[m.name];
    const tw = Math.max(1, Math.round(m.box.width * scale));
    const th = Math.max(1, Math.round(m.box.height * scale));
    const object = await sharp(m.data, { raw: { width: m.w, height: m.h, channels: 4 } })
      .extract(m.box)
      .resize(tw, th, { kernel: "lanczos3" })
      .png()
      .toBuffer();
    const file = `${out}${m.name}.webp`;
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: object, left: Math.round((size - tw) / 2), top: Math.round((size - th) / 2) }])
      .webp({ quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toFile(file);
    if (size === 560) boxes[m.name] = await bounds(file);
    console.log(
      `${String(size).padEnd(4)}${m.name.padEnd(19)} fill ${m.fill.toFixed(3)}  scale ${scale.toFixed(3)}  ${tw}x${th}  ${statSync(file).size} bytes`
    );
  }
}

const rows = Object.keys(boxes)
  .sort()
  .map((name) => {
    const b = boxes[name];
    return `  "${name}": { l: ${b.l}, t: ${b.t}, r: ${b.r}, b: ${b.b} },`;
  });
writeFileSync(
  "lib/lesson-art-bounds.ts",
  "/**\n" +
    " * Generated by scripts/cut-lesson-icons.mjs from public/lessons/large/.\n" +
    " * Do not edit: re-run the script after re-cutting the art.\n" +
    " *\n" +
    " * Each lesson object's visible box inside its square, as fractions of\n" +
    " * the square (left, top, right, bottom; alpha over 40 of 255). Today's\n" +
    " * card and tiles size and place an object by this box, not by its\n" +
    " * square (lib/home.ts `artBox`).\n" +
    " */\n" +
    "export const ART_BOUNDS: Record<string, { l: number; t: number; r: number; b: number }> = {\n" +
    rows.join("\n") +
    "\n};\n"
);
console.log(`wrote ${rows.length} boxes to lib/lesson-art-bounds.ts`);
