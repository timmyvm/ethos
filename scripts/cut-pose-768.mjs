/**
 * Demos's introduction poses at 768 (#508, the speed audit's fix 21).
 *
 * The set is cut at 1024 (scripts/place-3d-demos.py, for stages up to
 * 340pt) and at 512 (/demos-512, 170pt and under). Between them, where he
 * stands 171 to 256pt (the boss's stage at 235, every DemosArt left at its
 * 180 default), a 3x phone wants at most 768 pixels, and was sent the
 * 1024 file: 1.8 times the pixels, 40 to 50 KB more a pose. This cuts the
 * 768 set from the 1024 files, the same composition scaled, so a pose
 * lands where it always did.
 *
 *   node scripts/cut-pose-768.mjs
 *
 * Run after the 1024 set changes; the output is committed. New paths, so
 * no service worker CACHE moves (none of these files is pre-cached).
 */
import { mkdirSync, readdirSync, statSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/demos-768/";
mkdirSync(OUT, { recursive: true });
const poses = readdirSync("public").filter((f) => /^demos-onboard-[a-z]+\.webp$/.test(f));
for (const f of poses) {
  const src = `public/${f}`;
  const meta = await sharp(src).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) throw new Error(`${src} is ${meta.width}x${meta.height}, not 1024`);
  await sharp(src)
    .resize(768, 768, { kernel: "lanczos3" })
    .webp({ quality: 84, alphaQuality: 90, effort: 6 })
    .toFile(`${OUT}${f}`);
  console.log(`${f.padEnd(34)} ${statSync(src).size} -> ${statSync(`${OUT}${f}`).size} bytes`);
}
