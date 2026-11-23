/**
 * The lessons' objects as files: public/lessons/<lesson id>.svg, one per
 * lesson, drawn from components/icons/flat/lesson-drawings.ts with the
 * tones of components/icons/flat/flat-icons.css baked in (the CSS is the
 * one place a tone lives). Then each file is rasterised at 560px and its
 * visible box (alpha over 40) written to lib/lesson-art-bounds.ts, which
 * Today's card and the recorder's topic card place an object by.
 *
 *   npx vite-node --config vitest.config.ts scripts/export-flat-icons.mjs
 *
 * Run after changing a drawing or a tone; the output is committed, and
 * lib/lesson-icons.test.ts fails while a file differs from what this
 * would write. A changed file keeps its path, and the service worker
 * serves an .svg cache-first from its precache, so bump CACHE in
 * public/sw.js in the same commit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import {
  MEASURE_PX,
  boundsModule,
  lessonSvgFiles,
  visibleBox,
} from "../components/icons/flat/export.ts";

const css = readFileSync("components/icons/flat/flat-icons.css", "utf8");
const files = lessonSvgFiles(css);
const boxes = {};
for (const [path, svg] of Object.entries(files)) {
  writeFileSync(path, svg);
  const id = path.slice("public/lessons/".length, -".svg".length);
  const { data } = await sharp(Buffer.from(svg), { density: (72 * MEASURE_PX) / 96 })
    .resize(MEASURE_PX, MEASURE_PX)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  boxes[id] = visibleBox(data, MEASURE_PX);
  console.log(`${path.padEnd(38)} ${String(Buffer.byteLength(svg)).padStart(5)} bytes  box ${JSON.stringify(boxes[id])}`);
}
writeFileSync("lib/lesson-art-bounds.ts", boundsModule(boxes));
console.log(`wrote ${Object.keys(files).length} files and lib/lesson-art-bounds.ts`);
