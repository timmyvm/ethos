/**
 * The two-second sweep's camera (#490): every screen whose words it
 * changed, as a first-time reader meets them. 390x844 and 320x568, light
 * and dark.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3915
 *   LOOK_BASE=http://localhost:3915 PLAYWRIGHT_MODULE=... node scripts/look-plain-words.mjs <before|after> [scene...]
 *
 * Scenes (shots in docs/look/words/<phase>/<scene>-<view>.png):
 *   glance         a Pausing lesson's practice 1, its glance: two pauses
 *                  between sentences, three mid-sentence (the pause line
 *                  and its cue, and the back's lesson title)
 *   pause-row      "Every number" opened, the Pause row open at its
 *                  headline (the take's own pause report, computed by
 *                  lib/pause-quality.ts through jiti, so before and after
 *                  each show what their code says)
 *   rows-head      the rows' headline over the card
 *   hear           Hear it back's card and its key, and in report.json
 *                  "hear-key": the head's lines (two, as before #490)
 *                  and whether each quiet key word holds the pause row
 *                  to one line
 *   closing        the closing note at the sheet's end
 *   filled         the same take with one pause next to an um: the glance
 *   filled-row     and its Pause row with the moment
 *   ledger         the Log's stored recording, its rows opened (the
 *                  scoring rule's words, Steadiness's counted line)
 *   lesson-pause   /lessons/inside-or-after, its "Your number"
 *   lesson-range   /lessons/second-pass, its "Your number"
 *   plan           the introduction's plan for "I freeze on the spot":
 *                  the first number's line and the unit step
 *
 * Every shot's visible words go to report.json beside them.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import { createJiti } from "jiti";
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
const BASE = process.env.LOOK_BASE ?? "http://localhost:3915";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/words"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = new URL("..", import.meta.url).pathname;
const jiti = createJiti(new URL(import.meta.url).pathname, { alias: { "@": ROOT.replace(/\/$/, "") } });
const PQ = await jiti.import(`${ROOT}lib/pause-quality.ts`);

const VIEWS = (process.env.LOOK_VIEWS ?? "390x844-light,390x844-dark,320x568-light,320x568-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, tag: s, inset: h >= 800 ? 34 : 0 };
});

/* Two takes, the fixture's 62 seconds with its pauses judged two ways. */
const P = (t, len, kind, verdict) => ({ t, len, kind, verdict, note: "" });
const TAKES = {
  mid: [P(2.1, 1.2, "pre", "landing"), P(11.4, 0.9, "mid", "hesitation"), P(20, 0.9, "mid", "hesitation"), P(33, 1.1, "mid", "hesitation"), P(41, 1.5, "pre", "landing")],
  filled: [P(2.1, 1.2, "pre", "landing"), P(15, 1.0, "pre", "filled"), P(41, 1.5, "pre", "landing"), P(58, 1.1, "pre", "landing")],
};
function body(kind) {
  const pauses = TAKES[kind];
  const report = PQ.reportJudged(pauses, analyzeBody.metrics.durationS);
  return {
    ...analyzeBody,
    metrics: {
      ...analyzeBody.metrics,
      pauses,
      heldPauses: pauses.length,
      composedPauses: pauses.filter((p) => p.kind === "pre").length,
      midSentencePauses: pauses.filter((p) => p.kind === "mid").length,
    },
    pauseHeadline: report.headline,
  };
}

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function context(v, { fresh = false, analyze = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: v.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
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
  if (fresh) {
    await ctx.addInitScript((t) => {
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme: t, reducedMotion: false, haptics: false }));
      localStorage.setItem(
        "ethos.onboarding",
        JSON.stringify({
          answers: { name: "Tim", ageBand: "18_24", goal: "feet", pains: ["freezing"], level: "some", context: "work", time: "evening" },
          step: 9,
          walk: 2,
          done: false,
          synced: false,
        })
      );
    }, v.theme);
  } else {
    await ctx.addInitScript(seed, { theme: v.theme, session, pose: POSE_PREF });
    /* The reminder ask has had today's showing, so the glance is its own. */
    await ctx.addInitScript(() => {
      const d = new Date();
      localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    });
  }
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: v.inset, left: 0, right: 0 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

const report = {};
async function shoot(page, scene, v, scope = null) {
  await page.mouse.move(0, 0).catch(() => {});
  await sleep(500);
  await page.screenshot({ path: `${OUT}${scene}-${v.tag}.png` });
  const words = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.querySelector("main") ?? document.body;
    return root ? root.innerText.replace(/\s+\n/g, "\n").replace(/\n{2,}/g, "\n").trim().slice(0, 4000) : null;
  }, scope);
  report[`${scene} ${v.tag}`] = words;
  console.log(`shot ${scene} ${v.tag}`);
}

/** Bring an element in the sheet to the sheet's top, 12px under its edge. */
async function sheetTo(page, selectorFn) {
  await page.evaluate((fn) => {
    const scroller = document.querySelector("[data-sheet-scroll]");
    const el = new Function("return (" + fn + ")()")();
    if (!scroller || !el) return;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
    scroller.scrollTop = top;
  }, selectorFn.toString());
  await sleep(400);
}

async function results(v, kind) {
  resetPlan("free");
  testerMode.tester = false;
  testerMode.today = false;
  const { ctx, page } = await context(v, { analyze: body(kind) });
  await page.goto(`${BASE}/rep?lesson=inside-or-after&q=1&back=${encodeURIComponent("/lessons/inside-or-after")}`);
  await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
  await sleep(900);
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
  await sleep(2500);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main .arrive-x", { timeout: 30000 });
  await page.waitForSelector("main [data-step-action]", { state: "visible", timeout: 10000 });
  await sleep(3200);
  const pre = kind === "mid" ? "" : "filled-";
  await shoot(page, kind === "mid" ? "glance" : "filled", v);
  await page.locator("main [data-glance-door]").click();
  await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 5000 });
  await sleep(900);
  if (kind === "mid" && want("rows-head")) {
    await sheetTo(page, () => document.querySelector("[role=dialog] [data-dimension-headline]"));
    await shoot(page, "rows-head", v, '[role="dialog"]');
  }
  await sheetTo(page, () => document.querySelector('[role=dialog] details[open] summary[data-trait="pause"]')?.closest("details"));
  await shoot(page, kind === "mid" ? "pause-row" : "filled-row", v, '[role="dialog"]');
  if (kind === "mid") {
    await sheetTo(page, () => [...document.querySelectorAll("[role=dialog] .eyebrow")].find((e) => e.textContent.trim() === "Hear it back")?.closest(".card"));
    await shoot(page, "hear", v, '[role="dialog"]');
    /* The key's head in lines (the review of #490: it was two at 320, and
       the plain words in one wrapping group made it four), and whether
       the pause row holds one line with each word the quiet key can say. */
    const key = await page.evaluate(() => {
      const card = [...document.querySelectorAll("[role=dialog] .eyebrow")].find((e) => e.textContent.trim() === "Hear it back")?.closest(".card");
      const row = card?.querySelector("[data-pause-key]");
      if (!card || !row) return null;
      const head = card.querySelector(".eyebrow").parentElement;
      const items = [head.querySelector(".eyebrow"), ...head.querySelectorAll("span.whitespace-nowrap"), ...row.children];
      /* A line is a run of items whose boxes overlap: the eyebrow and a key
         beside it are centred on each other, not top-aligned. */
      let lines = 0;
      let bottom = -Infinity;
      for (const r of items.map((e) => e.getBoundingClientRect()).sort((a, b) => a.top - b.top)) {
        if (r.top >= bottom - 1) lines += 1;
        bottom = Math.max(r.top >= bottom - 1 ? r.bottom : bottom, r.bottom);
      }
      const quiet = row.lastElementChild;
      const oneLine = {};
      /* lib/pause-mark.ts PAUSE_KEY_WORDS, the quiet key's every word. */
      for (const word of ["mid-sentence", "other pause", "misplaced", "too long", "next to an um", "with a sound"]) {
        const probe = quiet.cloneNode(true);
        probe.lastChild.textContent = word;
        quiet.replaceWith(probe);
        oneLine[word] = new Set([...row.children].map((e) => Math.round(e.getBoundingClientRect().top))).size === 1;
        probe.replaceWith(quiet);
      }
      return { lines, width: Math.round(row.getBoundingClientRect().width), oneLine };
    });
    report[`hear-key ${v.tag}`] = key;
    console.log(`hear-key ${v.tag}`, JSON.stringify(key));
    await page.evaluate(() => {
      const s = document.querySelector("[data-sheet-scroll]");
      if (s) s.scrollTop = s.scrollHeight;
    });
    await sleep(500);
    await shoot(page, "closing", v, '[role="dialog"]');
  }
  void pre;
  await ctx.close();
}

async function ledger(v) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}/history`);
  await page.waitForSelector('main a[href^="/rep/"]', { timeout: 30000 });
  await sleep(800);
  await page.locator('main a[href^="/rep/"]').first().click();
  await page.waitForSelector("main details", { timeout: 30000 });
  await sleep(1200);
  /* Open every row, then stand on the rows. */
  await page.evaluate(() => document.querySelectorAll("main details").forEach((d) => (d.open = true)));
  await sleep(600);
  await page.evaluate(() => {
    const d = document.querySelector('main details summary[data-trait="fillers"]')?.closest("details");
    if (d) window.scrollTo(0, d.getBoundingClientRect().top + window.scrollY - 70);
  });
  await shoot(page, "ledger", v);
  /* The last row (Steadiness, its counted line) clear of the tab bar. */
  await page.evaluate(() => {
    const ds = [...document.querySelectorAll("main details")];
    const d = ds[ds.length - 1];
    if (d) window.scrollTo(0, d.getBoundingClientRect().bottom + window.scrollY - innerHeight + 130);
  });
  await shoot(page, "ledger-end", v);
  await ctx.close();
}

async function lesson(v, id, scene) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}/lessons/${id}`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("main h2")].find((e) => e.textContent.trim() === "Your number");
    const t = document.querySelector("main h1");
    const el = t ?? h;
    if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 120));
  });
  await shoot(page, scene, v);
  await ctx.close();
}

async function plan(v) {
  const { ctx, page } = await context(v, { fresh: true });
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("main h1, main", { timeout: 30000 });
  await sleep(2600);
  await shoot(page, "plan", v);
  await ctx.close();
}

/* Two screens the trait's renamed words reach, shot by name only:
   the Pausing trait page's ring and You's trait rows. */
async function extra(v, scene) {
  resetPlan("free");
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}${scene === "trait-page" ? "/practice/pause" : "/you"}`);
  await page.waitForSelector("main", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(1800);
  if (scene === "you-traits") {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll("main *")].find((e) => e.children.length === 0 && e.textContent.trim() === "Sentence restarts");
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 260);
    });
  }
  await shoot(page, scene, v);
  await ctx.close();
}

for (const v of VIEWS) {
  if (ONLY.includes("trait-page")) await extra(v, "trait-page");
  if (ONLY.includes("you-traits")) await extra(v, "you-traits");
  if (want("glance") || want("pause-row") || want("hear") || want("closing") || want("rows-head")) await results(v, "mid");
  if (want("filled") || want("filled-row")) await results(v, "filled");
  if (want("ledger")) await ledger(v);
  if (want("lesson-pause")) await lesson(v, "inside-or-after", "lesson-pause");
  if (want("lesson-range")) await lesson(v, "second-pass", "lesson-range");
  if (want("plan")) await plan(v);
}

writeFileSync(`${OUT}report${ONLY.length ? `-${ONLY.join("-")}` : ""}.json`, JSON.stringify(report, null, 2));
await browser.close();
