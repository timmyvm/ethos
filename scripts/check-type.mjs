/**
 * The 11px floor, measured on every screen (#450).
 *
 * The smallest type an iPhone sets is 11pt. The app's micro labels, its
 * unit suffixes and a narrow tile's unit were 10. They are 11 now, and
 * 10% more ink does not fit where 10 was cut to the pixel, so this walks
 * the app at 390 and at 320 and checks what the change could break:
 *
 *   1. nothing a person reads is under 11px, on any screen, the results
 *      and their sheet included. The one exception is named: the cents
 *      on the paywall stair's faces, a price's superscript;
 *   2. no column head or tile label prints over its neighbour, or closer
 *      to it than 3px, and no page scrolls sideways;
 *   3. the Log, at five widths: its heads stand apart, a recording's
 *      name takes one line at 390 and two at most below it;
 *   4. a recording's three tiles at 320: every label and note inside its
 *      tile, the three numbers on one line.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-type.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { analyzeBody, json, seed, session, supabaseRoute, SAVED_ROWS, savedWordsMode } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const FLOOR = 11;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const SCREENS = [
  "/", "/lessons", "/lessons/the-cold-open", "/games", "/history", "/rep/rep-22", "/you", "/settings", "/shop", "/words",
  "/rep?lesson=h4", "/boss", "/hostile", "/upload", "/calibrate", "/practice/pause", "/terms", "/privacy", "/about",
  "/signin", "/signup", "/tester", "/games?paywall=1",
];

/** In the page: type under the floor, and small labels that crowd or cover a neighbour. */
const measure = (floor) => {
  const under = [];
  const crowded = [];
  const inkOf = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    if (!walker.currentNode.nodeValue?.trim()) continue;
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el) || el.closest("nextjs-portal, script, style, noscript, .sr-only")) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0 || box.width === 0 || box.height === 0) continue;
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 26);
    const size = parseFloat(cs.fontSize);
    if (size < floor - 0.01 && !el.closest(".stair-cents")) under.push(`${size}px “${text}”`);

    const cls = typeof el.className === "string" ? el.className : "";
    if (!/label-micro|label-data|text-suffix|home-unit/.test(cls)) continue;
    const ink = inkOf(el);
    for (const sib of el.parentElement ? [...el.parentElement.children] : []) {
      if (sib === el || getComputedStyle(sib).visibility === "hidden" || getComputedStyle(sib).display === "none") continue;
      const other = inkOf(sib);
      if (!other.width || other.bottom <= ink.top + 0.5 || other.top >= ink.bottom - 0.5) continue;
      const gap = other.left >= ink.right ? other.left - ink.right : ink.left >= other.right ? ink.left - other.right : -1;
      if (gap < 3) crowded.push(`“${text}” is ${gap < 0 ? "over" : `${Math.round(gap * 10) / 10}px from`} “${(sib.textContent ?? "").trim().slice(0, 16)}”`);
    }
    if (cs.whiteSpace === "nowrap" && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible") crowded.push(`“${text}” is cut`);
  }
  const de = document.documentElement;
  return { under: [...new Set(under)], crowded: [...new Set(crowded)], sideways: Math.max(0, de.scrollWidth - de.clientWidth) };
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
async function open(width) {
  const context = await browser.newContext({
    viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/analyze", async (route) => {
    await sleep(400);
    return route.fulfill(json(analyzeBody));
  });
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  savedWordsMode.rows = SAVED_ROWS.map((r) => ({ ...r }));
  const page = await context.newPage();
  return { context, page };
}
const settle = async (page) => {
  await page.waitForSelector("main", { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(700);
};

// ---- 1 and 2. every screen, at 390 and at 320 ---------------------------------
for (const width of [390, 320]) {
  const { context, page } = await open(width);
  const under = [];
  const crowded = [];
  const sideways = [];
  let screens = 0;
  const take = async (name) => {
    const res = await page.evaluate(measure, FLOOR);
    screens += 1;
    for (const u of res.under) under.push(`${name}: ${u}`);
    for (const c of res.crowded) crowded.push(`${name}: ${c}`);
    if (res.sideways > 1) sideways.push(`${name}: ${res.sideways}px`);
  };
  for (const path of SCREENS) {
    await page.goto(`${BASE}${path}`);
    await settle(page);
    if (path.includes("paywall")) {
      await page.waitForSelector('[role="dialog"] [role="slider"]', { timeout: 8000 }).catch(() => {});
      await sleep(900);
    }
    await take(path);
  }
  // The results and their sheet, after a take.
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector('button[data-record="start"]', { timeout: 20000 });
  await sleep(600);
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[data-record="stop"]', { timeout: 15000 });
  await sleep(2800);
  await page.click('button[data-record="stop"]', { force: true });
  await page.waitForSelector("main [data-glance-door]", { timeout: 20000 });
  await sleep(1500);
  await take("the results");
  await page.locator("main [data-glance-door]").click();
  await page.waitForSelector("[data-whole-recording]", { timeout: 4000 });
  await sleep(900);
  await take("Every number");

  ok(`${width}: nothing a person reads is under ${FLOOR}px, on ${screens} screens`, screens >= 25 && under.length === 0, under.slice(0, 5).join(" | "));
  ok(`${width}: no head or label crowds or covers its neighbour`, crowded.length === 0, crowded.slice(0, 5).join(" | "));
  ok(`${width}: no page scrolls sideways`, sideways.length === 0, sideways.join(" | "));

  // The exception, held to what it is: the stair's cents, and nothing smaller than the spec's 8.
  await page.goto(`${BASE}/games?paywall=1`);
  await page.waitForSelector('[role="dialog"] [role="slider"]', { timeout: 8000 }).catch(() => {});
  await sleep(900);
  const cents = await page.evaluate(() => [...document.querySelectorAll(".stair-cents")].filter((c) => getComputedStyle(c).visibility !== "hidden").map((c) => parseFloat(getComputedStyle(c).fontSize)));
  ok(`${width}: the stair's cents are the one exception, at the ladder's own ${width < 340 ? 8 : 10}px`, cents.length > 0 && cents.every((c) => c === (width < 340 ? 8 : 10)), cents.join(","));
  await context.close();
}

// ---- 3. the Log's two tables, at five widths ---------------------------------------
for (const width of [320, 360, 375, 390, 430]) {
  const { context, page } = await open(width);
  await page.goto(`${BASE}/history`);
  await settle(page);
  const log = await page.evaluate(() => {
    const ink = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const lines = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size;
    };
    const heads = [...document.querySelectorAll("main .label-micro")].filter((h) => getComputedStyle(h).visibility !== "hidden" && h.getBoundingClientRect().width > 0);
    const gaps = [];
    for (let i = 1; i < heads.length; i++) {
      const a = ink(heads[i - 1]);
      const b = ink(heads[i]);
      if (Math.abs(a.top - b.top) < 2 && b.left > a.left) gaps.push({ pair: `${heads[i - 1].textContent.trim()}|${heads[i].textContent.trim()}`, gap: Math.round((b.left - a.right) * 10) / 10 });
    }
    const sizes = [...new Set(heads.map((h) => parseFloat(getComputedStyle(h).fontSize)))];
    const names = [...document.querySelectorAll('main a[href^="/rep/"] .line-clamp-2')].map((n) => ({ text: n.textContent.trim(), lines: lines(n) }));
    return { gaps, sizes, names };
  });
  const tight = log.gaps.filter((g) => g.gap < 4);
  ok(`Log at ${width}: every head is 11px and 4px or more from the next`, log.gaps.length >= 6 && log.sizes.join() === "11" && tight.length === 0, tight.length ? JSON.stringify(tight) : `${log.gaps.length} pairs, closest ${Math.min(...log.gaps.map((g) => g.gap))}px`);
  const long = log.names.find((n) => n.text === "Punctuate with silence");
  const most = Math.max(...log.names.map((n) => n.lines));
  ok(
    `Log at ${width}: a recording's name takes ${width >= 390 ? "one line" : "two lines at most"}`,
    !!long && most <= 2 && (width < 390 || long.lines === 1),
    `“Punctuate with silence” ${long?.lines} line${long?.lines === 1 ? "" : "s"}, most ${most}`
  );
  await context.close();
}

// ---- 4. a recording's three tiles at 320 --------------------------------------------
{
  const { context, page } = await open(320);
  await page.goto(`${BASE}/rep/rep-22`);
  await settle(page);
  const tiles = await page.evaluate(() => {
    const label = [...document.querySelectorAll("main .label-micro")].find((l) => l.textContent.trim() === "Held pauses");
    const card = label?.closest(".card");
    if (!card) return null;
    const c = card.getBoundingClientRect();
    const out = [];
    let numbers = [];
    for (const tile of card.children) {
      const t = tile.getBoundingClientRect();
      const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
      let worst = 0;
      while (walker.nextNode()) {
        if (!walker.currentNode.nodeValue?.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(walker.currentNode);
        const ink = r.getBoundingClientRect();
        worst = Math.max(worst, ink.right - t.right, t.left - ink.left);
      }
      out.push(Math.round(worst * 10) / 10);
      const num = tile.querySelector(".tabular-nums");
      if (num) numbers.push(Math.round(num.getBoundingClientRect().top));
    }
    return { past: out, numbers, card: Math.round(c.width) };
  });
  ok("a recording at 320: every tile's label and note stay inside the tile", !!tiles && tiles.past.every((p) => p <= 0), JSON.stringify(tiles?.past));
  ok("and its three numbers stand on one line", !!tiles && tiles.numbers.length === 3 && new Set(tiles.numbers).size === 1, JSON.stringify(tiles?.numbers));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
