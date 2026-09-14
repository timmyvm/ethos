/**
 * The lesson artwork, fetched and cut down (DECISIONS #269).
 *
 * Fifteen pieces, one per lesson in `content/lessons.ts`, generated in
 * one pass so they read as a commissioned set rather than fifteen
 * separate ideas: Recraft V4.1 in `standard` mode, risograph poster,
 * full bleed, with an explicit colour-exclusion list because the first
 * attempt invented a salmon and a teal that are nowhere in the app.
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
/** The card is 3:2 and never wider than ~390 CSS px, so 900 is 2x plus room. */
const WIDTH = 900;

/** lesson id -> the generation it came from. */
const ART = {
  "the-landing": "hf_20260914_021147_28e9ce3b-0a03-4207-b1ba-4d748eed037d.png",
  "inside-or-after": "hf_20260914_021147_8377f101-7079-42a4-99c4-f236ba489952.png",
  "the-long-one": "hf_20260914_020641_89841d99-8665-4b28-924a-d77b2ca71957.png",
  "the-cold-open": "hf_20260914_020641_52f8bb8f-4431-431d-970f-4fb3480d4e27.png",
  "closed-mouth": "hf_20260914_021147_d4359285-ba5a-42b7-86ea-a079e2560f0b.png",
  "the-crutch": "hf_20260914_023951_a81a53d5-5142-4edf-b2a6-23a01a0ef4bc.png",
  "finish-it": "hf_20260914_020641_2d1cb8c6-d86f-4d93-a9d0-9e20e6b78c39.png",
  "know-the-landing": "hf_20260914_020641_80399425-9d21-4538-87c0-f45ee3a63d65.png",
  "or-rather": "hf_20260914_021147_691d7ee9-7428-4e6b-af83-707965082afc.png",
  "room-to-land": "hf_20260914_020641_532df537-2d13-46c7-bf96-1d23c00546ff.png",
  "one-gear-down": "hf_20260914_020641_84398023-7313-49ac-8e87-688d51e98238.png",
  "change-gear": "hf_20260914_020641_c3de6bb9-348f-4d0f-9dd0-3a3a9aa02b97.png",
  "name-it-once": "hf_20260914_021147_8c29e394-b49a-495b-b453-9a9104f4c137.png",
  "short-and-concrete": "hf_20260914_021147_8bddc1d2-4df0-41cd-8ba0-308080c0faa9.png",
  "second-pass": "hf_20260914_021147_0150eea5-44b8-4acd-986b-f6ab0ca20db0.png",
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
  const out = await sharp(raw)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  writeFileSync(to, out);
  console.log(
    `cut   ${id}  ${(raw.length / 1024 / 1024).toFixed(1)}MB -> ${(out.length / 1024).toFixed(0)}KB`
  );
}
