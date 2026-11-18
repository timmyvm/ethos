/**
 * One name for restarts (#502): every screen where the trait's name or
 * its count shows, as a first-time reader meets it. 390x844 and 320x568,
 * light and dark, at twice the pixels.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 4021
 *   LOOK_BASE=http://localhost:4021 PLAYWRIGHT_MODULE=... node scripts/look-restarts.mjs <before|after> [scene...]
 *
 * Scenes (shots in docs/look/restarts/<phase>/<scene>-<view>.png):
 *   lessons      /lessons at the trait's section head
 *   trait        /practice/repairs, its head and ring
 *   trait-why    the same page at its teaching (what, why, the distinction)
 *   lesson       /lessons/finish-it: its chip, title and "Your number"
 *   glance       a Finish it anyway practice's glance, three in 62s
 *   sheet-row    "Every number", the rows' headline and the trait's row open
 *   ledger       the Log's stored recording, the trait's row open
 *   ledger-low   the same at a score of 33 ("Work on this", the widest
 *                band word) with Steadiness open: the review of #502
 *                found the name cut to "Sentence…" there at 320
 *   you-rows     You's trait levels, the trait's row
 *   you-sheet    the trait's sheet on You
 *   command      the command menu (a desktop window), "restart" typed
 *
 * Every shot's visible words go to report.json, and the lines that name
 * the trait (restart, self-correct, start over) to names.json, so before
 * and after can be read side by side as text too.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody,
  collectRoute,
  billingApiRoute,
  json,
  session,
  seed,
  POSE_PREF,
  resetPlan,
  testerMode,
} from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "before";
const ONLY = process.argv.slice(3);
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
const BASE = process.env.LOOK_BASE ?? "http://localhost:4021";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/restarts"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWS = (process.env.LOOK_VIEWS ?? "390x844-light,390x844-dark,320x568-light,320x568-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, tag: s, inset: h >= 800 ? 34 : 0 };
});

/* The fixture's 62 seconds with three restarted sentences in it, so the
   count's plural and its rate both show. */
const RESTARTS = {
  ...analyzeBody,
  metrics: { ...analyzeBody.metrics, repairCount: 3, repairsPerMin: 2.9 },
  anchors: { ...analyzeBody.anchors, restartCount: 3 },
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

/* The fixture stores a Sentence restarts score of 66 on every recording;
   ledger-low reads it as 33, so the row wears "Work on this". */
const lowRepairs = (route) =>
  supabase(
    new Proxy(route, {
      get(t, k) {
        if (k === "fulfill")
          return (o) => t.fulfill(o && typeof o.body === "string" ? { ...o, body: o.body.replace(/"repairs":66/g, '"repairs":33') } : o);
        const val = t[k];
        return typeof val === "function" ? val.bind(t) : val;
      },
    })
  );

async function context(v, { analyze = null, desktop = false, low = false } = {}) {
  const ctx = await browser.newContext({
    ...(desktop
      ? { viewport: { width: 1180, height: 800 } }
      : { viewport: { width: v.w, height: v.h }, isMobile: true, hasTouch: true }),
    deviceScaleFactor: 2,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: v.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", low ? lowRepairs : supabase);
  await ctx.route("**/api/push", (r) => r.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester/collect", collectRoute);
  await ctx.route("**/api/billing/*", billingApiRoute);
  await ctx.route("**/api/words", (r) => r.fulfill(json({ alternatives: ["point", "idea", "claim"], source: "model" })));
  if (analyze) {
    await ctx.route("**/api/analyze", async (route) => {
      await sleep(900);
      await route.fulfill(json(analyze));
    });
  }
  await ctx.addInitScript(seed, { theme: v.theme, session, pose: POSE_PREF });
  await ctx.addInitScript(() => {
    const d = new Date();
    localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  if (!desktop) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: v.inset, left: 0, right: 0 } });
  }
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

const report = {};
const names = {};
const NAME_RE = /restart|self-correct|start(ed|ing)? over/i;
async function shoot(page, scene, v, scope = null) {
  await page.mouse.move(0, 0).catch(() => {});
  await sleep(500);
  await page.screenshot({ path: `${OUT}${scene}-${v.tag}.png` });
  const words = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.querySelector("main") ?? document.body;
    return root ? root.innerText.replace(/\s+\n/g, "\n").replace(/\n{2,}/g, "\n").trim().slice(0, 6000) : null;
  }, scope);
  /* What a screen reader is given for the trait, too: names and labels. */
  const labels = await page.evaluate((src) => {
    const re = new RegExp(src, "i");
    return [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((l) => re.test(l));
  }, NAME_RE.source);
  report[`${scene} ${v.tag}`] = words;
  names[`${scene} ${v.tag}`] = {
    text: (words ?? "").split("\n").filter((l) => NAME_RE.test(l)),
    labels,
  };
  console.log(`shot ${scene} ${v.tag}`);
}

async function scrollToEl(page, fnSrc, offset = 90) {
  await page.evaluate(
    ([src, off]) => {
      const el = new Function("return (" + src + ")()")();
      if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - off));
    },
    [fnSrc.toString(), offset]
  );
  await sleep(500);
}

async function settled(page) {
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(1400);
}

async function lessons(v) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}/lessons`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await settled(page);
  await scrollToEl(page, () => document.querySelector('main [data-trait="repairs"]')?.closest("section") ?? document.querySelector('main [data-trait="repairs"]'), 70);
  await shoot(page, "lessons", v);
  await ctx.close();
}

async function trait(v) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}/practice/repairs`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await settled(page);
  await shoot(page, "trait", v);
  if (want("trait-why")) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(600);
    await shoot(page, "trait-why", v);
  }
  await ctx.close();
}

async function lesson(v) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}/lessons/finish-it`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await settled(page);
  await shoot(page, "lesson", v);
  await ctx.close();
}

async function results(v) {
  resetPlan("free");
  testerMode.tester = false;
  testerMode.today = false;
  const { ctx, page } = await context(v, { analyze: RESTARTS });
  await page.goto(`${BASE}/rep?lesson=finish-it&q=1&back=${encodeURIComponent("/lessons/finish-it")}`);
  await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
  await sleep(900);
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
  await sleep(2500);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main .arrive-x", { timeout: 30000 });
  await page.waitForSelector("main [data-step-action]", { state: "visible", timeout: 10000 });
  await sleep(3200);
  if (want("glance")) await shoot(page, "glance", v);
  if (want("sheet-row")) {
    await page.locator("main [data-glance-door]").click();
    await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 5000 });
    await sleep(900);
    await page.evaluate(() => {
      const s = document.querySelector('[role=dialog] summary[data-trait="repairs"]');
      const d = s?.closest("details");
      if (d) d.open = true;
    });
    await sleep(500);
    await page.evaluate(() => {
      const scroller = document.querySelector("[data-sheet-scroll]");
      const el = document.querySelector('[role=dialog] summary[data-trait="repairs"]')?.closest("details");
      if (!scroller || !el) return;
      scroller.scrollTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 140;
    });
    await sleep(500);
    await shoot(page, "sheet-row", v, '[role="dialog"]');
    await page.evaluate(() => {
      const scroller = document.querySelector("[data-sheet-scroll]");
      const el = document.querySelector("[role=dialog] [data-dimension-headline]");
      if (!scroller || !el) return;
      scroller.scrollTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
    });
    await sleep(500);
    await shoot(page, "sheet-head", v, '[role="dialog"]');
  }
  await ctx.close();
}

async function ledger(v, low = false) {
  resetPlan("free");
  const { ctx, page } = await context(v, { low });
  await page.goto(`${BASE}/history`);
  await page.waitForSelector('main a[href^="/rep/"]', { timeout: 30000 });
  await sleep(800);
  await page.locator('main a[href^="/rep/"]').first().click();
  await page.waitForSelector("main details", { timeout: 30000 });
  await sleep(1200);
  await page.evaluate(() => {
    const d = document.querySelector('main details summary[data-trait="repairs"]')?.closest("details");
    if (d) d.open = true;
  });
  await sleep(500);
  await scrollToEl(page, () => document.querySelector('main details summary[data-trait="repairs"]')?.closest("details"), 200);
  await shoot(page, low ? "ledger-low" : "ledger", v);
  if (low) {
    /* Steadiness, open, counts the same restarts as the row above it. */
    await page.evaluate(() => {
      const d = [...document.querySelectorAll("main details")].find((e) => /Steadiness/.test(e.querySelector("summary")?.textContent ?? ""));
      if (d) d.open = true;
    });
    await scrollToEl(page, () => [...document.querySelectorAll("main details")].find((e) => /Steadiness/.test(e.querySelector("summary")?.textContent ?? "")), 300);
    await shoot(page, "ledger-steadiness", v);
  }
  await ctx.close();
}

async function you(v) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}/you`);
  await page.waitForSelector("main h2.section-head", { timeout: 30000 });
  await settled(page);
  await scrollToEl(page, () => document.querySelector('main button[data-trait="repairs"]'), 240);
  if (want("you-rows")) await shoot(page, "you-rows", v);
  if (want("you-sheet")) {
    const row = page.locator('main button[data-trait="repairs"]').first();
    if ((await row.count()) > 0) {
      await row.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await sleep(1100);
      await shoot(page, "you-sheet", v, '[role="dialog"]');
    } else console.log("no repairs row on You");
  }
  await ctx.close();
}

async function command(v) {
  const { ctx, page } = await context(v, { desktop: true });
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main", { timeout: 30000 });
  await sleep(2200);
  await page.keyboard.press("Control+k");
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await sleep(500);
  await page.keyboard.type("restart");
  await sleep(600);
  await shoot(page, "command", v, '[role="dialog"]');
  await page.keyboard.press("Control+a");
  await page.keyboard.type("self correct");
  await sleep(600);
  await shoot(page, "command-old", v, '[role="dialog"]');
  await ctx.close();
}

for (const v of VIEWS) {
  if (want("lessons")) await lessons(v);
  if (want("trait") || want("trait-why")) await trait(v);
  if (want("lesson")) await lesson(v);
  if (want("glance") || want("sheet-row")) await results(v);
  if (want("ledger")) await ledger(v);
  if (want("ledger-low")) await ledger(v, true);
  if (want("you-rows") || want("you-sheet")) await you(v);
  if (want("command") && v.w === 390) await command(v);
}

const tag = ONLY.length ? `-${ONLY.join("-")}` : "";
writeFileSync(`${OUT}report${tag}.json`, JSON.stringify(report, null, 2));
writeFileSync(`${OUT}names${tag}.json`, JSON.stringify(names, null, 2));
await browser.close();
