/**
 * Demos as the app icon.
 *
 * Source is `public/demos.webp` — the alpha-cut side profile, which is
 * the approved art (DECISIONS #7). The masters in `assets/` still have
 * their opaque background, and a favicon on a cream tile disappears
 * into a dark browser chrome.
 *
 * The trim matters more than the resize. A favicon renders at 16–32px,
 * and the full-body render is mostly empty space, so untrimmed it
 * arrives as a beige smudge with a fleck of face in it. Trimming to the
 * ink first means the head fills the frame at the size anyone actually
 * sees it.
 *
 *   node scripts/make-favicon.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const SRC = "public/demos.webp";

/** Next.js serves app/icon.png as the favicon automatically. */
const OUTPUTS = [
  // Transparent, so it sits on light and dark browser chrome alike.
  { path: "app/icon.png", size: 256, flatten: null },
  // iOS composites onto black if you hand it alpha, so this one is flat.
  { path: "public/apple-touch-icon.png", size: 180, flatten: "#FAF7F2" },
];

async function main() {
  const trimmed = await sharp(SRC)
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });

  console.log(
    `demos trimmed to ${trimmed.info.width}x${trimmed.info.height}`
  );

  for (const { path, size, flatten } of OUTPUTS) {
    await mkdir(dirname(path), { recursive: true });

    let pipeline = sharp(trimmed.data).resize(size, size, {
      fit: "contain",
      // A hair of margin so the ears aren't clipped by a rounded mask.
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (flatten) pipeline = pipeline.flatten({ background: flatten });

    const out = await pipeline.png().toBuffer();
    await writeFile(path, out);
    console.log(`${path} — ${size}px, ${(out.length / 1024).toFixed(1)}KB`);
  }
}

main().catch((e) => {
  console.error(`favicon: ${e.message}`);
  process.exit(1);
});
