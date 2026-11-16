/**
 * The look loop's camera for #484: a recording's page in the Log and the
 * live results' sheet, read once. Timothy marked two shots of a stored
 * recording (16 Nov, dark): underlined means remove, a square bracket
 * means it fails the two-second test (a first-time user reads the line
 * once and knows what it means or what to do within two seconds).
 *
 * The Log's scene is his recording, rebuilt as a fixture row: no fillers
 * in 59.66 seconds at 115 words a minute, 8 held pauses (7 mid-sentence,
 * 1 after a finished sentence), Filler control at 92 (the level-up
 * doubles at 90), the coach's stored read "7 mid-sentence pauses against
 * 1 composed pause. Tomorrow: ..." and its stored Kept "0 fillers in 59
 * seconds. Nothing filled the gaps.", with no upgrade. The live scene
 * walks a Pace lesson's practice to its glance and opens "Every number":
 * the coach's Kept alone over the rows, Pace at 93 (its open row carries
 * the level-up), the analyze reply otherwise the fixtures' own.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3891
 *   LOOK_BASE=http://localhost:3891 node scripts/look-log-plain.mjs before [log|sheet]
 *
 * Shots: LOOK_OUT, default docs/look/log-plain/, as
 * <tag>-<scene>-<size>-<theme>-<beat>.png. Sizes: LOOK_SIZES, default
 * "390x844,375x667", each light and dark. Prints every visible line it
 * reads on the page and the sheet, for the two-second list.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import {
  analyzeBody,
  billingApiRoute,
  collectRoute,
  extraReps,
  json,
  POSE_PREF,
  reps,
  resetPlan,
  seed,
  session,
  supabaseRoute,
} from "./look-fixtures.mjs";

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3891";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/log-plain/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844,375x667").split(",").map((s) => {
  const [w, h] = s.split("x").map(Number);
  return { w, h, name: s };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The Index as the app weighs it (lib/index-score INDEX_WEIGHTS), so the
   stored number is the rows' own sum and no "earlier weights" note shows. */
const WEIGHTS = {
  pause: 150, fillers: 100, repairs: 50, pace: 100, range: 100,
  structure: 150, credibility: 150, engagement: 100, confidence: 100,
};
const indexOf = (scores) =>
  Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + Math.round((Math.max(0, Math.min(100, Math.round(scores[k]))) / 100) * w), 0);

/* ---- Timothy's recording, as the Log stores it ----------------------------- */
const LOG_ID = "4b8e2f1a-6c3d-4e5f-8a9b-0c1d2e3f4a5b";
const base = reps[reps.length - 1];
const tier1 = { pause: 41, fillers: 92, repairs: 66, pace: 62, range: 58 };
const tier2 = base.dimensions.tier2;
const scores = { ...tier1, ...Object.fromEntries(Object.entries(tier2).map(([k, v]) => [k, v.score])) };
/* Eight held pauses: seven inside a sentence, one after a finished one. */
const held = [3.2, 9.8, 15.1, 22.4, 30.6, 38.9, 47.3].map((t) => ({ t, len: 1.1, kind: "mid" }));
held.splice(3, 0, { t: 19.0, len: 1.4, kind: "pre", verdict: "landing" });
extraReps.push({
  ...base,
  id: LOG_ID,
  client_id: "k-log-plain",
  created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  duration_s: 59.66,
  wpm: 115,
  filler_count: 0,
  fillers: [],
  pauses: held,
  focus:
    process.env.LOOK_FOCUS ??
    "7 mid-sentence pauses against 1 composed pause. Tomorrow: finish each sentence in one breath, then pause.",
  strength: process.env.LOOK_STRENGTH ?? "0 fillers in 59 seconds. Nothing filled the gaps.",
  supply: null,
  ethos_index: indexOf(scores),
  dimensions: { ...base.dimensions, tier1 },
});

/* ---- the live take: Kept alone, the rest the fixtures' reply ---------------- */
const live = {
  ...analyzeBody,
  coach: {
    ...analyzeBody.coach,
    strength: process.env.LOOK_STRENGTH ?? "0 fillers in 59 seconds. Nothing filled the gaps.",
    supply: null,
  },
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

const lines = {};

for (const size of SIZES) {
  for (const theme of ["light", "dark"]) {
    resetPlan("free");
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
      colorScheme: theme, serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", supabaseRoute);
    await context.route("**/api/billing/*", billingApiRoute);
    await context.route("**/api/tester/collect", collectRoute);
    await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(live)); });
    await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
    await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
    const at = `${size.name}-${theme}`;
    const file = (scene, beat) => `${OUT}${TAG}-${scene}-${at}-${beat}.png`;
    const shoot = async (scene, beat, opts = {}) => {
      await sleep(opts.settle ?? 600);
      await page.screenshot({ path: file(scene, beat), fullPage: !!opts.full });
      console.log(`shot  ${scene} ${at} ${beat}`);
    };
    /** Scroll a scroller (the page, or the sheet's) so `sel` stands `pad` under its top. */
    const bring = async (sel, pad, scroller = null) =>
      page.evaluate(
        ([s, p, sc]) => {
          const el = document.querySelector(s);
          if (!el) return false;
          const box = sc ? document.querySelector(sc) : null;
          if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - p;
          else window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - p);
          return true;
        },
        [sel, pad, scroller]
      );
    /** Every visible line of words under `root`, in order, once each. */
    const read = (root) =>
      page.evaluate((r) => {
        const host = document.querySelector(r);
        if (!host) return [];
        const out = [];
        const walk = (el) => {
          const style = getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || el.closest("[aria-hidden=true], .sr-only")) return;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          const block = ["P", "H1", "H2", "H3", "LI", "SUMMARY", "BUTTON", "A", "LABEL"].includes(el.tagName) || (own && style.display === "block");
          if (block && el.innerText?.trim()) {
            out.push(el.innerText.replace(/\s+/g, " ").trim());
            return;
          }
          for (const c of el.children) walk(c);
        };
        walk(host);
        return [...new Set(out)];
      }, root);

    /* ---- the Log's stored recording ------------------------------------- */
    if (want("log")) {
      await page.goto(`${BASE}/rep/${LOG_ID}`);
      await page.waitForSelector("main [data-score]", { timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
      await sleep(1600);
      await shoot("log", "top");
      /* "Every dimension" and what stands under it. */
      const dims = await page.evaluate(() => {
        const h = [...document.querySelectorAll("main h2.section-head")].find((e) => /dimension/i.test(e.textContent));
        if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 72);
        return !!h;
      });
      if (dims) await shoot("log", "dims");
      else console.log(`MISSING log dims ${at}`);
      /* The rows' last row and whatever stands under it. */
      await page.evaluate(() => {
        const rows = document.querySelectorAll("main details");
        const last = rows[rows.length - 1];
        if (last) window.scrollTo(0, last.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4);
      });
      await shoot("log", "foot");
      /* Demos's read: what went well, by its label. */
      const kept = await page.evaluate(() => {
        const p = [...document.querySelectorAll("main p")].find((e) => /^(Kept|What went well)\b/.test(e.textContent.trim()));
        if (!p) return false;
        window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - 200);
        return true;
      });
      if (kept) await shoot("log", "kept");
      else console.log(`MISSING log kept ${at}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shoot("log", "full", { full: true });
      if (size.name === "390x844" && theme === "dark") lines.log = await read("main");
    }

    /* ---- a live take, its glance, and "Every number" ----------------------- */
    if (want("sheet")) {
      await page.goto(`${BASE}/rep?lesson=room-to-land&q=1`);
      await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
      await sleep(800);
      await page.click('button[data-record="start"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]');
      await sleep(2600);
      await page.click('button[aria-label="Stop and score this recording"]', { force: true });
      await page.waitForSelector("main [data-glance]", { timeout: 30000 });
      await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
      await sleep(3200);
      await page.locator("main [data-glance-door]").click();
      await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 5000 });
      await shoot("sheet", "read", { settle: 1200 });
      const scroller = '[role="dialog"] [data-sheet-scroll]';
      const dims = await bring('[role="dialog"] [data-sheet-section="dimensions"]', 24, scroller);
      if (dims) await shoot("sheet", "dims");
      else console.log(`MISSING sheet dims ${at}`);
      await page.evaluate((sc) => {
        const box = document.querySelector(sc);
        const rows = document.querySelectorAll('[role="dialog"] [data-sheet-section="dimensions"] details');
        const last = rows[rows.length - 1];
        if (box && last) box.scrollTop += last.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight * 0.4;
      }, scroller);
      await shoot("sheet", "foot");
      if (size.name === "390x844" && theme === "dark") lines.sheet = await read('[role="dialog"]');
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(`${OUT}${TAG}-lines.json`, JSON.stringify(lines, null, 1));
console.log(JSON.stringify(lines, null, 1));
console.log(`done → ${OUT}`);
