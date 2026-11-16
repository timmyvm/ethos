/**
 * Demos's busts (#488): each pose a person can wear as their picture,
 * cut to his head and shoulders for a round coin.
 *
 * A picture of the person is a coin, 40 to 64pt (Today's corner 44,
 * Settings' list 40, its index 56, You's card 64). The poses are full
 * figures on a portrait canvas (assets/3d/demos-onboard-<pose>.webp,
 * 1024 tall), and a full figure in a 44pt circle is a red smudge with a
 * tail. So each pose is cut here to a square round his head, the way
 * the app's icon frames him (app/icon.png, the hello pose on sky): his
 * head about three quarters of the width, the ears' tips inside the
 * circle's top, the paws at its foot.
 *
 * BOX is each square in the source's pixels: `cx` the head's centre,
 * `top` where the square starts (above the canvas is transparent, so it
 * is padded), `side` its edge. They were read off the alpha (the head's
 * widest row and its ears' first row) and set so the head spans HEAD of
 * the side, then looked at in a 44 and a 64 circle in both themes.
 *
 *   node scripts/cut-busts.mjs            the four files
 *   node scripts/cut-busts.mjs preview    and a sheet of them in coins
 *
 * Output: public/demos-bust/<pose>.webp, 256px (a 64pt coin at 3x
 * wants 192; 256 leaves room for the sheet's 88), WebP with alpha, a few
 * KB each. New paths, so the service worker's SHELL takes them without
 * a cache bump; a re-cut keeps its path and then CACHE in public/sw.js
 * moves in the same commit.
 */
import { mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

const SRC = "assets/3d/";
const OUT = process.env.OUT ?? "public/demos-bust/";
const SIZE = 256;

/** Each pose's square, in the 1024-tall source's pixels. */
export const BOX = {
  // head 319 to 866 wide at its cheeks, ears from y 15
  hello: { cx: 592, top: -78, side: 740 },
  // head 273 to 835; the raised paw at the circle's right
  speaking: { cx: 560, top: -76, side: 760 },
  // the hello head over the clock
  clock: { cx: 594, top: -78, side: 740 },
  // head 142 to 676 at the cheeks; both paws up at the circle's sides
  celebrate: { cx: 418, top: -84, side: 760 },
};

mkdirSync(OUT, { recursive: true });

async function cut(pose) {
  const src = sharp(`${SRC}demos-onboard-${pose}.webp`).ensureAlpha();
  const { width, height } = await src.metadata();
  const { cx, top, side } = BOX[pose];
  const left = Math.round(cx - side / 2);
  // Pad the canvas so the square can reach past its edges.
  const padTop = Math.max(0, -top);
  const padLeft = Math.max(0, -left);
  const padRight = Math.max(0, left + side - width);
  const padBottom = Math.max(0, top + side - height);
  const padded = await src
    .extend({ top: padTop, left: padLeft, right: padRight, bottom: padBottom, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const file = `${OUT}${pose}.webp`;
  await sharp(padded)
    .extract({ left: left + padLeft, top: top + padTop, width: side, height: side })
    .resize(SIZE, SIZE, { kernel: "lanczos3" })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toFile(file);
  console.log(`${pose}: ${statSync(file).size} bytes`);
  return file;
}

const files = [];
for (const pose of Object.keys(BOX)) files.push(await cut(pose));

if (process.argv[2] === "preview") {
  /* Each bust in a circle at 64 and 44, on the sky disc and the surface,
     light then dark: what the coins will draw. */
  const grounds = [
    ["#ffffff", "#a8daf5"],
    ["#ffffff", "#f4f4f4"],
    ["#121212", "#123f60"],
    ["#121212", "#333333"],
  ];
  const cell = 96;
  const tiles = [];
  for (let g = 0; g < grounds.length; g++) {
    const [page, disc] = grounds[g];
    for (let i = 0; i < files.length; i++) {
      for (const [j, d] of [64, 44].entries()) {
        const mask = Buffer.from(`<svg width="${d * 2}" height="${d * 2}"><circle cx="${d}" cy="${d}" r="${d}" fill="${disc}"/></svg>`);
        const bust = await sharp(files[i]).resize(d * 2, d * 2).toBuffer();
        const coin = await sharp(mask)
          .composite([{ input: bust }, { input: Buffer.from(`<svg width="${d * 2}" height="${d * 2}"><circle cx="${d}" cy="${d}" r="${d}"/></svg>`), blend: "dest-in" }])
          .png()
          .toBuffer();
        tiles.push({ input: coin, left: (i * 2 + j) * cell * 2 + (cell * 2 - d * 2) / 2, top: g * cell * 2 + (cell * 2 - d * 2) / 2, page });
      }
    }
  }
  const W = files.length * 2 * cell * 2;
  const H = grounds.length * cell * 2;
  const rows = grounds.map(([page], g) => ({
    input: { create: { width: W, height: cell * 2, channels: 4, background: page } },
    left: 0,
    top: g * cell * 2,
  }));
  const out = process.env.PREVIEW ?? "busts-preview.png";
  await sharp({ create: { width: W, height: H, channels: 4, background: "#ffffff" } })
    .composite([...rows, ...tiles.map(({ input, left, top }) => ({ input, left, top }))])
    .png()
    .toFile(out);
  console.log(`preview → ${out}`);
}
