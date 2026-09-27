/**
 * The lesson artwork, fetched and cut down (DECISIONS #269).
 *
 * Fifteen pieces, one per lesson in `content/lessons.ts`. Since #322
 * (27 Sep, the apple-design pass) they are iOS 26 Liquid Glass objects:
 * GPT Image 2.5 at high quality, 1:1, one frosted glass object per
 * lesson on a vertical gradient in its trait's tone, lit from above.
 * The hourglass was rendered first and every other piece was rendered
 * with it as the style reference, so the fifteen read as one set. The
 * clay set (#319) and the risograph set (#269) are in git history.
 *
 * The sources are about 2MB each at 1024px. Fifteen of those is 30MB
 * in the repo AND in the service worker's precache, for a card that
 * renders about 700px wide on a phone at 2x. So they are resized on the
 * way in. Run once; the output is committed.
 *
 *   node scripts/cut-lesson-art.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const BASE =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3B6GJ2qFPzJeS439soyfKOK3IXx/";
const OUT = "public/lessons/";
/** Square thumbnails, 84 CSS px at most: 360 is 4x the largest. */
const SIZE = 360;
/** The renders leave generous air; the thumbnail wants the object. */
const CROP = 0.82;

/** lesson id -> the generation it came from. */
const ART = {
  "the-landing": "hf_20260927_110301_45bc9388-a22f-4e83-916e-623a10c95467.png",
  "inside-or-after": "hf_20260927_110301_40a9046e-d160-4333-9ccb-fcdec61b5689.png",
  "the-long-one": "hf_20260927_110058_04f70d93-43fe-443f-8cea-f5b766ca5bed.png",
  "the-cold-open": "hf_20260927_110349_f875ca7c-2ef5-454f-939b-e29dcae17fc3.png",
  "closed-mouth": "hf_20260927_110057_900f9425-5230-42a7-a3ee-6b5f04a779e6.png",
  "the-crutch": "hf_20260927_110350_66302d7c-47fb-4898-b2b6-905b7aeded43.png",
  "finish-it": "hf_20260927_110301_956d4505-b7ae-483a-ba9d-374b81b52903.png",
  "know-the-landing": "hf_20260927_110301_1831e0f3-35f0-46b9-a5f4-aa3302803bd4.png",
  "or-rather": "hf_20260927_110301_515188d0-43e0-45d4-b02d-528365f191e4.png",
  "room-to-land": "hf_20260927_110350_8ae87bc8-815e-4c36-9f81-7cecc15fe0af.png",
  "one-gear-down": "hf_20260927_110301_53a1a158-04ad-43db-9422-a4d6897142eb.png",
  "change-gear": "hf_20260927_110301_34d2d044-ca04-43bd-b2d3-77764f9ad5b7.png",
  "name-it-once": "hf_20260927_110301_64bf1d26-cee5-4d00-ad40-429d02076058.png",
  "short-and-concrete": "hf_20260927_110301_686cf540-77dd-47fc-a3d4-2f9f879a05e1.png",
  "second-pass": "hf_20260927_110457_67865fff-22cf-4426-a553-b16c6bec5475.png",
};

mkdirSync(OUT, { recursive: true });

for (const [id, file] of Object.entries(ART)) {
  const to = `${OUT}${id}.webp`;
  if (!file) {
    console.log(`skip  ${id} (no generation recorded)`);
    continue;
  }
  if (existsSync(to) && !process.env.FORCE) {
    console.log(`have  ${id}`);
    continue;
  }
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.log(`FAIL  ${id} ${res.status}`);
    continue;
  }
  const raw = Buffer.from(await res.arrayBuffer());
  /*
   * WEBP, not PNG. These are grainy risograph renders and grain is the
   * worst case for PNG: the same image lands at about 380KB as PNG and
   * about a tenth of that as webp, with no visible difference at the
   * size a card draws it. Fifteen of the PNGs would have been 5MB in
   * the repo and in the service worker's precache.
   */
  const meta = await sharp(raw).metadata();
  const side = Math.round(Math.min(meta.width, meta.height) * CROP);
  const out = await sharp(raw)
    .extract({
      left: Math.round((meta.width - side) / 2),
      top: Math.round((meta.height - side) / 2),
      width: side,
      height: side,
    })
    .resize(SIZE, SIZE)
    .webp({ quality: 82 })
    .toBuffer();
  writeFileSync(to, out);
  console.log(
    `cut   ${id}  ${(raw.length / 1024 / 1024).toFixed(1)}MB -> ${(out.length / 1024).toFixed(0)}KB`
  );
}
