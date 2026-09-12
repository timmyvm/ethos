/**
 * The seven unit marks on the road: one Demos pose per unit, cut out of
 * its background and normalised into one set (DECISIONS #248).
 *
 * Same cut as `scripts/cut-demos-alpha.mjs` — flood from the border so
 * interior whites survive, feather the anti-aliased edge, bleed the
 * colour outward so a downscale cannot pull a white fringe in — plus the
 * thing a SET needs and a single pose does not: every mark is scaled so
 * the character is the same height, centred on the same axis, and stood
 * on the same baseline. Seven drawings that each arrived at their own
 * size would read as seven mascots rather than one.
 *
 * Source of truth is assets/demos-unit-*.png. Re-export from those,
 * never from public/ — the shipped files have already had their
 * background taken, and a second pass eats into the art.
 *
 *   node scripts/cut-unit-marks.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright-core"
);
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/** The units, in road order (lib/path.ts). */
const UNITS = [
  "filler",
  "pace",
  "pause",
  "boss",
  "structure",
  "compression",
  "fire",
];

/** The road draws these at 28 to 34px; 256 covers every density. */
const OUT_SIZE = 256;
/** How much of the box the character fills, top to bottom. */
const FILL = 0.9;

const sources = UNITS.map((id) => ({
  id,
  dataUrl:
    "data:image/png;base64," +
    readFileSync(`assets/demos-unit-${id}.png`).toString("base64"),
}));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();
await page.setContent("<!doctype html><title>cut</title>");

const results = await page.evaluate(
  async ({ sources, OUT_SIZE, FILL }) => {
    const out = {};
    const report = [];

    for (const { id, dataUrl } of sources) {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = dataUrl;
      });
      const W = img.naturalWidth;
      const H = img.naturalHeight;

      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const im = ctx.getImageData(0, 0, W, H);
      const d = im.data;

      // Background is near-white on every channel; the cream markings
      // sit below this line, so the face and belly survive the cut.
      const BG = 246;
      const isBg = (i) => d[i] >= BG && d[i + 1] >= BG && d[i + 2] >= BG;

      const bg = new Uint8Array(W * H);
      const stack = [];
      for (let x = 0; x < W; x++) stack.push(x, x + (H - 1) * W);
      for (let y = 0; y < H; y++) stack.push(y * W, W - 1 + y * W);
      while (stack.length) {
        const q = stack.pop();
        if (q < 0 || q >= W * H || bg[q]) continue;
        if (!isBg(q * 4)) continue;
        bg[q] = 1;
        const x = q % W;
        const y = (q / W) | 0;
        if (x > 0) stack.push(q - 1);
        if (x < W - 1) stack.push(q + 1);
        if (y > 0) stack.push(q - W);
        if (y < H - 1) stack.push(q + W);
      }

      const FEATHER_FLOOR = 232;
      const alpha = new Uint8Array(W * H).fill(255);
      for (let q = 0; q < W * H; q++) if (bg[q]) alpha[q] = 0;
      for (let q = 0; q < W * H; q++) {
        if (bg[q]) continue;
        const x = q % W;
        const y = (q / W) | 0;
        const touching =
          (x > 0 && bg[q - 1]) ||
          (x < W - 1 && bg[q + 1]) ||
          (y > 0 && bg[q - W]) ||
          (y < H - 1 && bg[q + W]);
        if (!touching) continue;
        const i = q * 4;
        const m = Math.min(d[i], d[i + 1], d[i + 2]);
        if (m > FEATHER_FLOOR) {
          alpha[q] = Math.round(
            255 * (1 - (m - FEATHER_FLOOR) / (BG - FEATHER_FLOOR))
          );
        }
      }

      // Bleed the edge colour outward before writing alpha, or the
      // downscale averages white across the boundary and every mark
      // keeps a pale halo on the dark theme.
      let frontier = new Uint8Array(bg);
      for (let pass = 0; pass < 4; pass++) {
        const next = new Uint8Array(frontier);
        for (let q = 0; q < W * H; q++) {
          if (!frontier[q]) continue;
          const x = q % W;
          const y = (q / W) | 0;
          let r = 0, g = 0, b = 0, n = 0;
          const take = (p) => {
            if (frontier[p]) return;
            const j = p * 4;
            r += d[j];
            g += d[j + 1];
            b += d[j + 2];
            n++;
          };
          if (x > 0) take(q - 1);
          if (x < W - 1) take(q + 1);
          if (y > 0) take(q - W);
          if (y < H - 1) take(q + W);
          if (!n) continue;
          const i = q * 4;
          d[i] = r / n;
          d[i + 1] = g / n;
          d[i + 2] = b / n;
          next[q] = 0;
        }
        frontier = next;
      }

      for (let q = 0; q < W * H; q++) d[q * 4 + 3] = alpha[q];
      ctx.putImageData(im, 0, 0);

      // The set, not the drawing: find the character, then place every
      // one of them at the same height on the same baseline.
      let minX = W, maxX = -1, minY = H, maxY = -1;
      for (let q = 0; q < W * H; q++) {
        if (alpha[q] < 8) continue;
        const x = q % W;
        const y = (q / W) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const cw = maxX - minX + 1;
      const ch = maxY - minY + 1;
      const scale = (OUT_SIZE * FILL) / ch;
      const dw = Math.round(cw * scale);
      const dh = Math.round(ch * scale);

      const o = document.createElement("canvas");
      o.width = OUT_SIZE;
      o.height = OUT_SIZE;
      const octx = o.getContext("2d");
      octx.imageSmoothingQuality = "high";
      octx.drawImage(
        c,
        minX, minY, cw, ch,
        Math.round((OUT_SIZE - dw) / 2),
        // Feet on a common baseline, with the leftover margin under them.
        Math.round(OUT_SIZE - dh - (OUT_SIZE * (1 - FILL)) / 2),
        dw, dh
      );

      out[id] = o.toDataURL("image/webp", 0.92).split(",")[1];
      report.push({ id, source: `${cw}x${ch}`, scaled: `${dw}x${dh}` });
    }
    return { out, report };
  },
  { sources, OUT_SIZE, FILL }
);

mkdirSync("public/unit", { recursive: true });
for (const [id, b64] of Object.entries(results.out)) {
  const path = `public/unit/${id}.webp`;
  writeFileSync(path, Buffer.from(b64, "base64"));
  const row = results.report.find((r) => r.id === id);
  console.log(`${path}  ${row.source} → ${row.scaled} in ${OUT_SIZE}²`);
}

await browser.close();
