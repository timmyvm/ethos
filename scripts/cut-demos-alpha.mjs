// Cuts Demos out of his opaque background and ships him as WebP with a
// real alpha channel, so he composites onto any surface in either theme.
//
// Run from the repo root with a dev server up (it borrows the browser's
// canvas encoder):  node scripts/cut-demos-alpha.mjs
//
// Source of truth is assets/*.png at 1024². Re-export from those, never
// from public/ — the shipped files already have their background removed,
// and a second pass over them would eat into the art.
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "fs";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:3100";
const OUT_SIZE = 512; // largest use is 200px CSS; 512 covers 2x and 3x

const POSES = [
  ["demos-side-profile", "demos"],
  ["demos-speaking", "demos-speaking"],
  ["demos-listening", "demos-listening"],
  ["demos-celebrate", "demos-celebrate"],
  ["demos-workout", "demos-workout"],
  ["demos-asleep", "demos-asleep"],
];

const sources = POSES.map(([src, out]) => ({
  out,
  dataUrl:
    "data:image/png;base64," + readFileSync(`assets/${src}.png`).toString("base64"),
}));

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();
await page.goto(ORIGIN);

const results = await page.evaluate(
  async ({ sources, OUT_SIZE }) => {
    const out = {};

    for (const { out: name, dataUrl } of sources) {
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

      // Background is near-white on EVERY channel. Demos' cream markings
      // (#FDF3EF, min channel 239) sit below this line, so his face and
      // belly survive the cut.
      const BG = 246;
      const isBg = (i) => d[i] >= BG && d[i + 1] >= BG && d[i + 2] >= BG;

      // Flood from the border, so interior whites — eye highlights, teeth —
      // are never reached. Only background connected to the edge goes.
      const bg = new Uint8Array(W * H);
      const stack = [];
      for (let x = 0; x < W; x++) stack.push(x, x + (H - 1) * W);
      for (let y = 0; y < H; y++) stack.push(y * W, W - 1 + y * W);
      let removed = 0;
      while (stack.length) {
        const q = stack.pop();
        if (q < 0 || q >= W * H || bg[q]) continue;
        if (!isBg(q * 4)) continue;
        bg[q] = 1;
        removed++;
        const x = q % W;
        const y = (q / W) | 0;
        if (x > 0) stack.push(q - 1);
        if (x < W - 1) stack.push(q + 1);
        if (y > 0) stack.push(q - W);
        if (y < H - 1) stack.push(q + W);
      }

      // Feather. A kept pixel touching removed background that is still
      // very light is an anti-aliased edge; fade it by how white it is or
      // the art keeps a pale halo on a dark ground.
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
        if (m > FEATHER_FLOOR)
          alpha[q] = Math.round(
            255 * (1 - (m - FEATHER_FLOOR) / (BG - FEATHER_FLOOR))
          );
      }

      // Bleed edge colour outward into the cleared region before writing
      // alpha. Cut pixels keep their original near-white RGB, and the
      // downscale below averages RGB across the alpha boundary — without
      // this, every edge picks up a white fringe on a dark ground.
      let frontier = new Uint8Array(bg);
      for (let pass = 0; pass < 4; pass++) {
        const next = new Uint8Array(frontier);
        for (let q = 0; q < W * H; q++) {
          if (!frontier[q]) continue;
          const x = q % W;
          const y = (q / W) | 0;
          let r = 0,
            g = 0,
            b = 0,
            n = 0;
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
          d[i] = (r / n) | 0;
          d[i + 1] = (g / n) | 0;
          d[i + 2] = (b / n) | 0;
          next[q] = 0;
        }
        frontier = next;
      }

      for (let q = 0; q < W * H; q++) d[q * 4 + 3] = alpha[q];
      ctx.putImageData(im, 0, 0);

      // Downscale last, so the cut runs at full resolution where the
      // anti-aliased edge is finest.
      const small = document.createElement("canvas");
      small.width = OUT_SIZE;
      small.height = OUT_SIZE;
      const sctx = small.getContext("2d");
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(c, 0, 0, OUT_SIZE, OUT_SIZE);

      out[name] = {
        dataUrl: small.toDataURL("image/webp", 0.92),
        removedPct: Math.round((removed / (W * H)) * 100),
        source: `${W}x${H}`,
      };
    }
    return out;
  },
  { sources, OUT_SIZE }
);

for (const [name, r] of Object.entries(results)) {
  const buf = Buffer.from(r.dataUrl.split(",")[1], "base64");
  writeFileSync(`public/${name}.webp`, buf);
  console.log(
    `${name}.webp`.padEnd(24),
    `${r.source} → ${OUT_SIZE}²`,
    `cut ${String(r.removedPct).padStart(2)}%`,
    `${Math.round(buf.length / 1024)}KB`
  );
}

await browser.close();
