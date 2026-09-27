/**
 * The lesson artwork, fetched and cut down (DECISIONS #269).
 *
 * Fifteen pieces, one per lesson in `content/lessons.ts`. Since #319
 * (27 Sep) they are soft 3D clay objects to sit beside the 3D Demos: GPT
 * Image 2.5 at high quality, 1:1, one object per lesson on a flat
 * ground in its trait's tone, from one shared prompt so the set reads as
 * one. The risograph set (Recraft V4.1, #269) is in git history.
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
  "the-landing": "hf_20260927_033557_0a86c362-ae3f-4949-8833-da5b2b9c1952.png",
  "inside-or-after": "hf_20260927_033557_340bbf96-d805-4952-ab89-81515b0b98c1.png",
  "the-long-one": "hf_20260927_033434_22f88de6-f178-436f-9b81-800f7bc5df44.png",
  "the-cold-open": "hf_20260927_033557_9fd00bf7-1d6a-4e73-9631-fc62618049c6.png",
  "closed-mouth": "hf_20260927_033557_0b3e523f-f225-482b-a22e-11dd32837894.png",
  "the-crutch": "hf_20260927_033557_e2965b9b-80ac-44cd-b445-ce7f2de89415.png",
  "finish-it": "hf_20260927_033433_eba59e51-1b58-4f71-9e7c-96aa6b39eff3.png",
  "know-the-landing": "hf_20260927_033557_85eedb66-347c-4316-bd9b-f55c30514043.png",
  "or-rather": "hf_20260927_033628_8466408f-ce68-4f98-9faf-8e67362d9043.png",
  "room-to-land": "hf_20260927_033557_8e665c3e-6ffa-45b7-bae0-56604af5516d.png",
  "one-gear-down": "hf_20260927_033557_19edaafc-95ba-4a50-b6f2-78b789052fd3.png",
  "change-gear": "hf_20260927_033557_9b09923b-b832-4e70-aeb6-984217152a97.png",
  "name-it-once": "hf_20260927_033557_1c569b0c-b997-4fc8-a5fc-0c17ed9d8c44.png",
  "short-and-concrete": "hf_20260927_033628_e1421d9e-9f20-4552-afe2-e72ee53bbe90.png",
  "second-pass": "hf_20260927_033629_abc90c1b-a1c3-419d-85a4-81620068adce.png",
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
