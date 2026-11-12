/**
 * Which letters touch (#454): the measurement behind the tracking
 * ceiling in app/globals.css and lib/type-tracking.test.ts.
 *
 * Outfit at 700 and over is drawn close, and a heading tracked in too
 * far runs its letters into each other ("with", "at it", "Punctuate").
 * An eye catches that on one title at a time. This draws every pair of
 * adjacent letters in the app's own headings, in the real face, at each
 * weight and each tracking, and counts the pairs whose ink joins:
 * the two letters drawn together make fewer shapes than drawn apart.
 * "near" is a pair that joins once each shape is grown by a hundredth
 * of an em, which at 34px is a third of a pixel.
 *
 * Read the table for the knee: the tracking past which common pairs
 * ("st", "ct", "ru") join the handful the face itself draws joined (its
 * fi and tt ligatures, r into y). At 800 that is between -0.015em and
 * -0.018em. A second table does the same for digits, which stand apart
 * at every value the number sizes use.
 *
 * Not a gate: it prints. Run it when the face, a weight or a display
 * size changes, then move the ceiling in lib/type-tracking.test.ts.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/look-kerning.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const HEADS = ".large-title, .section-head, .detail-head, .stage-prompt, .home-display, [class*='text-title'], h1, h2, h3";
const SCREENS = [
  "/", "/lessons", "/games", "/history", "/you", "/settings", "/shop", "/boss", "/hostile", "/upload", "/signup", "/signin",
  "/about", "/privacy", "/terms", "/rep?mode=daily", "/rep/rep-22", "/lessons/the-cold-open", "/practice/pause", "/words",
];
const TRACKINGS = [-0.03, -0.028, -0.025, -0.02, -0.018, -0.015, -0.012, -0.01, -0.005, 0];

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  serviceWorkers: "block", locale: "en-AU", timezoneId: "Australia/Melbourne",
});
await context.route("http://supabase.local/**", supabaseRoute);
await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
await context.addInitScript(seed, { theme: "light", session });
const page = await context.newPage();

const headings = new Set();
for (const path of SCREENS) {
  try {
    await page.goto(BASE + path, { timeout: 30000 });
    await page.waitForSelector("main", { timeout: 15000 });
    await page.waitForTimeout(1000);
    const found = await page.evaluate(
      (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()).filter((t) => t && t.length < 80),
      HEADS
    );
    for (const t of found) headings.add(t);
  } catch (e) {
    console.log(`skipped ${path}: ${String(e.message).split("\n")[0]}`);
  }
}
// Every lesson's name: each becomes a large title on its own screen.
await page.goto(`${BASE}/lessons`);
await page.waitForSelector("main");
await page.waitForTimeout(1000);
for (const t of await page.evaluate(() => [...document.querySelectorAll("a[data-lesson] .font-display")].map((e) => (e.textContent ?? "").trim()))) headings.add(t);

const result = await page.evaluate(
  async ({ words, trackings }) => {
    await document.fonts.ready;
    const family = getComputedStyle(document.querySelector(".large-title, h1")).fontFamily;
    const S = 200;
    const W = 520;
    const H = 340;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    /** The number of separate shapes `text` draws, each grown by `grow` pixels first. */
    const shapes = (text, weight, spacingPx, grow) => {
      ctx.clearRect(0, 0, W, H);
      ctx.font = `${weight} ${S}px ${family}`;
      ctx.letterSpacing = `${spacingPx}px`;
      ctx.fillText(text, 60, 230);
      const d = ctx.getImageData(0, 0, W, H).data;
      let ink = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) ink[i] = d[i * 4 + 3] > 110 ? 1 : 0;
      for (let g = 0; g < grow; g++) {
        const next = new Uint8Array(W * H);
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            next[i] = ink[i] | ink[i - 1] | ink[i + 1] | ink[i - W] | ink[i + W];
          }
        }
        ink = next;
      }
      let count = 0;
      const stack = [];
      for (let i = 0; i < W * H; i++) {
        if (!ink[i]) continue;
        count++;
        stack.push(i);
        ink[i] = 0;
        while (stack.length) {
          const p = stack.pop();
          const x = p % W;
          if (x > 0 && ink[p - 1]) (ink[p - 1] = 0), stack.push(p - 1);
          if (x < W - 1 && ink[p + 1]) (ink[p + 1] = 0), stack.push(p + 1);
          if (p >= W && ink[p - W]) (ink[p - W] = 0), stack.push(p - W);
          if (p < W * (H - 1) && ink[p + W]) (ink[p + W] = 0), stack.push(p + W);
        }
      }
      return count;
    };
    const alone = new Map();
    const one = (ch, weight, grow) => {
      const key = `${ch}|${weight}|${grow}`;
      if (!alone.has(key)) alone.set(key, shapes(ch, weight, 0, grow));
      return alone.get(key);
    };
    const table = (pairs, weight) => {
      const rows = {};
      for (const em of trackings) {
        const touching = [];
        const near = [];
        for (const [pair, n] of pairs) {
          const [a, b] = pair;
          if (shapes(pair, weight, em * S, 0) < one(a, weight, 0) + one(b, weight, 0)) touching.push([pair, n]);
          else if (shapes(pair, weight, em * S, 2) < one(a, weight, 2) + one(b, weight, 2)) near.push([pair, n]);
        }
        const say = (list) => list.sort((x, y) => y[1] - x[1]).map(([p, n]) => (n > 1 ? `${p}x${n}` : p));
        rows[em] = { touching: say(touching), near: say(near) };
      }
      return rows;
    };
    const letters = new Map();
    for (const heading of words) {
      for (const word of heading.split(/\s+/)) {
        for (let i = 0; i + 1 < word.length; i++) {
          const pair = word[i] + word[i + 1];
          if (/^[A-Za-z]{2}$/.test(pair)) letters.set(pair, (letters.get(pair) ?? 0) + 1);
        }
      }
    }
    const digits = new Map();
    for (const a of "0123456789") for (const b of "0123456789") digits.set(a + b, 1);
    return {
      family,
      pairs: letters.size,
      letters: { 800: table(letters, 800), 700: table(letters, 700), 600: table(letters, 600) },
      digits: table(digits, 800),
    };
  },
  { words: [...headings], trackings: TRACKINGS }
);

const print = (rows) => {
  for (const em of Object.keys(rows).sort((a, b) => Number(a) - Number(b))) {
    const r = rows[em];
    console.log(
      `${String(em).padStart(7)}em  touching ${String(r.touching.length).padStart(3)}  near ${String(r.near.length).padStart(3)}   ${r.touching.slice(0, 22).join(" ")}${
        r.touching.length && r.near.length ? "  |  " : ""
      }${r.near.slice(0, 12).join(" ")}`
    );
  }
};
console.log(`${headings.size} headings, ${result.pairs} letter pairs, in ${result.family}`);
for (const weight of [800, 700, 600]) {
  console.log(`\nletters at ${weight}`);
  print(result.letters[weight]);
}
console.log("\ndigits at 800 (proportional figures, the tighter case; the app sets them tabular)");
print(result.digits);
await browser.close();
