/**
 * A new pose joins the introduction's Demos set (DECISIONS #233, #249).
 *
 * The set's rule is that a pose change between screens is a pose change
 * and not a jump in size, which means a new drawing cannot be cut on its
 * own terms: it has to be measured against the set it is joining. So
 * this takes one fresh render, cuts its background the way
 * `scripts/cut-demos-alpha.mjs` does (flood from the border so interior
 * whites survive, feather the anti-aliased edge, bleed the colour
 * outward so a downscale cannot pull a white fringe onto the dark
 * theme), then scales it so its character is exactly as tall as the
 * character in a pose that already shipped, centres it on the same axis
 * and stands it on the same baseline.
 *
 * The reference is read from public/, which is the only place the set's
 * actual geometry exists.
 *
 *   node scripts/cut-onboard-pose.mjs mic dumbbell
 *   #          new assets/demos-onboard-mic.png  ─┘      └─ match public/demos-onboard-dumbbell.webp
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
import { readFileSync, writeFileSync } from "node:fs";

const [, , NAME, LIKE] = process.argv;
if (!NAME || !LIKE) {
  console.error("usage: node scripts/cut-onboard-pose.mjs <new-pose> <shipped-pose-to-match>");
  process.exit(1);
}

const OUT_SIZE = 1024;
const b64 = (p) => readFileSync(p).toString("base64");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();
await page.setContent("<!doctype html><title>cut</title>");

const result = await page.evaluate(
  async ({ source, reference, OUT_SIZE }) => {
    const load = async (dataUrl) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = dataUrl;
      });
      return img;
    };
    /** Where the drawing actually is, in a canvas that already has alpha. */
    const bounds = (alpha, W, H) => {
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
      return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    };

    // ---- The set's geometry, measured off a pose that already ships ----
    const ref = await load(reference);
    const rc = document.createElement("canvas");
    rc.width = ref.naturalWidth;
    rc.height = ref.naturalHeight;
    const rctx = rc.getContext("2d", { willReadFrequently: true });
    rctx.drawImage(ref, 0, 0);
    const rd = rctx.getImageData(0, 0, rc.width, rc.height).data;
    const ralpha = new Uint8Array(rc.width * rc.height);
    for (let q = 0; q < ralpha.length; q++) ralpha[q] = rd[q * 4 + 3];
    const rb = bounds(ralpha, rc.width, rc.height);
    // Normalised against the reference's own square, so a reference that
    // was exported at another size still gives the right proportions.
    const wantH = (rb.h / rc.height) * OUT_SIZE;
    const wantFeet = ((rb.minY + rb.h) / rc.height) * OUT_SIZE;

    // ---- The new render, cut ----
    const img = await load(source);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, W, H);
    const d = im.data;

    // The cream markings sit below this line, so the face and belly
    // survive the cut.
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
        alpha[q] = Math.round(255 * (1 - (m - FEATHER_FLOOR) / (BG - FEATHER_FLOOR)));
      }
    }

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

    // ---- Stood in the set ----
    const nb = bounds(alpha, W, H);
    const scale = wantH / nb.h;
    const dw = Math.round(nb.w * scale);
    const dh = Math.round(nb.h * scale);

    const o = document.createElement("canvas");
    o.width = OUT_SIZE;
    o.height = OUT_SIZE;
    const octx = o.getContext("2d");
    octx.imageSmoothingQuality = "high";
    octx.drawImage(
      c,
      nb.minX, nb.minY, nb.w, nb.h,
      Math.round((OUT_SIZE - dw) / 2),
      Math.round(wantFeet - dh),
      dw, dh
    );

    return {
      webp: o.toDataURL("image/webp", 0.92).split(",")[1],
      report: {
        source: `${nb.w}x${nb.h}`,
        scaled: `${dw}x${dh}`,
        matched: `${Math.round(wantH)}px tall, feet at ${Math.round(wantFeet)}`,
      },
    };
  },
  {
    source: "data:image/png;base64," + b64(`assets/demos-onboard-${NAME}.png`),
    reference: "data:image/webp;base64," + b64(`public/demos-onboard-${LIKE}.webp`),
    OUT_SIZE,
  }
);

const path = `public/demos-onboard-${NAME}.webp`;
writeFileSync(path, Buffer.from(result.webp, "base64"));
console.log(`${path}  ${result.report.source} → ${result.report.scaled}  (set: ${result.report.matched})`);

await browser.close();
