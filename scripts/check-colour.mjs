/**
 * Today's colour, measured in a real browser (S05, D21 and D05):
 *
 * 1. Start stands out on every day's card. For each of the five trait
 *    families, in both themes, at 390 and 320, the card's own pixels
 *    around Start's row (left of it, and just over and under it at its
 *    left, middle and right) hold 3:1 or better against Start's
 *    terracotta. The foot used to land at the card's last pixel, so
 *    Start stood on a mid-gradient at 2.4 to 3.0:1.
 * 2. Today's colour stays on the card. The share of chromatic pixels
 *    between the card's foot and the tab bar at 390x844 stays inside
 *    its pin, the figure measured after the home round (#393) plus 10%
 *    headroom (lib/today-colour.test.ts holds the headroom).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-colour.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

/*
 * The pin: the percentage of the band under Today's card (from 56px
 * below its foot, past its own glow, down to the tab bar) whose pixels
 * carry colour (chroma over 24 of 255, the difference between a pixel's
 * largest and smallest channel), at 390x844 on the look fixtures. It
 * was 0.2% under the cohesion pass's stage and 0.68% after the home
 * round (#393), most of it the wide tile's hourglass repeating the
 * card's object; with the wide tile's object gone (D22) it measures
 * 0.09% in both themes, pinned at 0.1. The ceiling is the pin plus the
 * 10% headroom.
 */
const TODAY_COLOUR_PIN = { light: 0.1, dark: 0.1 };
const HEADROOM = 1.1;

const FAMILIES = ["pause", "fillers", "repairs", "pace", "range"];
const START = "#c67139";
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
async function open(theme, width) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main .home-start", { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  await sleep(900);
  return { context, page };
}

/** The viewport's pixels, read back through a canvas in the page. */
async function pixels(page) {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    window.__px = { w: c.width, h: c.height, d };
    return { w: c.width, h: c.height };
  }, png);
}

// 1. Start against the card at its row.
for (const theme of ["light", "dark"]) {
  for (const width of [390, 320]) {
    const { context, page } = await open(theme, width);
    for (const family of FAMILIES) {
      await page.evaluate((f) => (document.querySelector(".home-hero").dataset.family = f), family);
      await sleep(100);
      await pixels(page);
      const worst = await page.evaluate(() => {
        const s = document.querySelector(".home-start").getBoundingClientRect();
        const card = document.querySelector(".home-hero").getBoundingClientRect();
        const { w, d } = window.__px;
        const at = (x, y) => {
          const i = (Math.round(y) * w + Math.round(x)) * 4;
          return [d[i], d[i + 1], d[i + 2]];
        };
        const mid = s.top + s.height / 2;
        const xs = [s.left + 12, s.left + s.width / 2, s.right - 12];
        return [
          at((card.left + s.left) / 2, mid),
          ...xs.map((x) => at(x, s.top - 3)),
          ...xs.map((x) => at(x, s.bottom + 3)),
        ];
      });
      const ratios = worst.map((p) => ratio(p, rgb(START)));
      const min = Math.min(...ratios);
      ok(`${theme} ${width}: Start on the ${family} card at 3:1 or better`, min >= 3, min.toFixed(2));
    }
    await context.close();
  }
}

// 2. The colour under the card.
for (const theme of ["light", "dark"]) {
  const { context, page } = await open(theme, 390);
  await pixels(page);
  const share = await page.evaluate(() => {
    const card = document.querySelector(".home-hero").getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Sections"]')?.getBoundingClientRect();
    const { w, h, d } = window.__px;
    const top = Math.ceil(card.bottom + 56);
    const bottom = Math.floor(Math.min(h, nav ? nav.top : h));
    let coloured = 0;
    let all = 0;
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const hi = Math.max(d[i], d[i + 1], d[i + 2]);
        const lo = Math.min(d[i], d[i + 1], d[i + 2]);
        all++;
        if (hi - lo > 24) coloured++;
      }
    }
    return (coloured / all) * 100;
  });
  const ceiling = TODAY_COLOUR_PIN[theme] * HEADROOM;
  ok(`${theme}: Today's colour under the card within its pin`, share <= ceiling, `${share.toFixed(2)}% of ${ceiling.toFixed(2)}%`);
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
