/**
 * The splash mark (components/Splash.tsx): Demos's head, alpha-cut, on
 * no tile at all, so it sits on the white ground and the near-black one
 * alike.
 *
 * Source is `public/demos.webp`, trimmed to the ink. That art is a bust
 * with a hard flat cut along its bottom and back, which floats on a
 * plain ground like a sticker, so the cut edges fade out here: the
 * bottom third and the back fifth go to nothing.
 *
 * Kept at the trimmed width (432px), which is 3x its 144px display, so
 * the catchlight in his eye survives. At 96px on the old icon tile it
 * did not, and a black eye with no light in it read as dead.
 *
 *   node scripts/cut-splash.mjs
 */

import sharp from "sharp";

const SRC = "public/demos.webp";
const OUT = "public/splash-demos.webp";

const { data, info } = await sharp(SRC)
  .trim({ threshold: 10 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: w, height: h, channels: c } = info;
const ease = (t) => t * t * (3 - 2 * t); // smoothstep

for (let y = 0; y < h; y++) {
  const fy = y / h;
  const bottom = fy < 0.7 ? 1 : 1 - ease(Math.min(1, (fy - 0.7) / 0.3));
  for (let x = 0; x < w; x++) {
    const fx = x / w;
    const back = fx < 0.84 ? 1 : 1 - ease(Math.min(1, (fx - 0.84) / 0.16));
    const i = (y * w + x) * c + 3;
    data[i] = Math.round(data[i] * bottom * back);
  }
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile(OUT);
console.log(`${OUT} ${w}x${h}`);
