/**
 * More topics (#473): Today's card and its reroll, before and after, and
 * every topic in the pool measured where it is drawn.
 *
 *   LOOK_BASE=http://localhost:3803 node scripts/look-topics.mjs <before|after> [scene...]
 *
 * Scenes (all for a returning account whose last take was yesterday, so
 * the card is the open day's: Start across it, "Another topic" under it):
 *   card    Today's card as the fixtures choose it, then with the pool's
 *           longest topic and (after) the longest new one in its place:
 *           the same h2, the same `data-long` rule (over 40 characters
 *           steps the size down), so the card is the one a person sees.
 *   reroll  "Another topic", then "Spin again": the roulette at rest and
 *           landed. After, the device's memory is seeded so the first
 *           draw is the longest new topic (lib/topic-walk.ts).
 *   ready   /rep?topic=<longest new>&ready=1, the recorder a reminder or
 *           Today's Start opens: the topic at 40/800, Record on screen.
 *   walk    (after) 70 rerolls with motion off: no topic twice inside a
 *           walk, none of the last 20 at the turn, the whole pool seen.
 *   fit     every topic in the card's h2 and in the reel's window at 320,
 *           375 and 390: lines, the card's height, the window's four.
 *
 * Shots at 390x844 light and dark and 375x667 light, deviceScaleFactor 2,
 * into docs/look/topics/<phase>/; the measurements into fit.json there.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
/* An ESM import does not read NODE_PATH; a require does. */
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
import { supabaseRoute as supabase, json, session, seed, POSE_PREF, reps, resetPlan, testerMode } from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "before";
const ONLY = process.argv.slice(3);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3803";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/topics"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (s) => ONLY.length === 0 || ONLY.includes(s);

/* The pool, read from the source the app builds from. */
const SRC = readFileSync("lib/topics.ts", "utf8");
const TOPICS = [...SRC.matchAll(/\{ id: "(t\d+)", prompt: "([^"]+)", shape: "(\w+)"/g)].map((m) => ({
  id: m[1],
  prompt: m[2],
  shape: m[3],
}));
const isNew = (t) => Number(t.id.slice(1)) > 20;
const longest = (ts) => ts.reduce((a, b) => (b.prompt.length > a.prompt.length ? b : a));
const LONGEST = longest(TOPICS);
const LONGEST_NEW = TOPICS.some(isNew) ? longest(TOPICS.filter(isNew)) : null;
console.log(`${TOPICS.length} topics; longest ${LONGEST.id} (${LONGEST.prompt.length})` +
  (LONGEST_NEW ? `; longest new ${LONGEST_NEW.id} (${LONGEST_NEW.prompt.length})` : ""));

/* Yesterday's take is the newest: an open day, the card's "Another topic". */
const MEL = "Australia/Melbourne";
const melDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: MEL }).format(d);
const TODAY = melDay(new Date());
const ORIGINAL = [...reps];
reps.length = 0;
for (const r of ORIGINAL) if (Math.round((Date.parse(TODAY) - Date.parse(melDay(new Date(r.created_at)))) / 86_400_000) >= 1) reps.push(r);
resetPlan("free");
testerMode.tester = false;

const VIEWS = [
  { tag: "390-light", w: 390, h: 844, theme: "light", inset: 34 },
  { tag: "390-dark", w: 390, h: 844, theme: "dark", inset: 34 },
  { tag: "375-light", w: 375, h: 667, theme: "light", inset: 0 },
];

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function context(v, { walk = null, reduce = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: MEL,
    colorScheme: v.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("http://supabase.local/auth/v1/token**", (route) => route.fulfill(json(session)));
  await ctx.addInitScript(seed, { theme: v.theme, session, pose: POSE_PREF });
  await ctx.addInitScript(
    ({ walk, reduce, theme }) => {
      if (walk) localStorage.setItem("ethos.topics.seen", JSON.stringify(walk));
      if (reduce) {
        const p = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
        localStorage.setItem("ethos.prefs", JSON.stringify({ ...p, theme, reducedMotion: true }));
      }
    },
    { walk, reduce, theme: v.theme }
  );
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: v.inset ?? 0, left: 0, right: 0 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

async function today(page) {
  for (let i = 0; ; i++) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
    const ok = await page
      .waitForSelector(".home-hero:not([data-family='none']) #home-topic", { timeout: 20000 })
      .then(() => true, () => false);
    if (ok) break;
    if (i === 3) throw new Error("Today never landed");
  }
  await sleep(1500);
}

/** Past 60 the second step exists only after #473: before, the build has no CSS for it. */
const LONGER = PHASE === "before" ? Infinity : 60;

/** The card's topic replaced as React would draw it: the words, `data-long` past 40, `data-longer` past 60. */
async function putTopic(page, prompt) {
  await page.evaluate(
    ({ p, longer }) => {
      const h = document.querySelector("#home-topic");
      h.querySelector("span").textContent = p;
      if (p.length > 40) h.setAttribute("data-long", "true");
      else h.removeAttribute("data-long");
      if (p.length > longer) h.setAttribute("data-longer", "true");
      else h.removeAttribute("data-longer");
    },
    { p: prompt, longer: LONGER }
  );
  await sleep(150);
}

const cardTopic = (page) => page.$eval("#home-topic", (e) => e.textContent.trim()).catch(() => null);
const reelTopic = (page) => page.$eval("main .home-reel", (e) => e.textContent.trim()).catch(() => null);

const report = { phase: PHASE, topics: TOPICS.length, longest: LONGEST, longestNew: LONGEST_NEW };

/* The memory that makes the first draw the longest new topic: every
   other id walked already. The shape lib/topic-walk.ts reads. */
const seededWalk = (target) => {
  const others = TOPICS.filter((t) => t.id !== target.id).map((t) => t.id);
  return { v: 1, walk: others, recent: others.slice(0, 20) };
};

for (const v of VIEWS) {
  if (want("card")) {
    const { ctx, page } = await context(v);
    await today(page);
    report[`card ${v.tag}`] = { natural: await cardTopic(page) };
    await page.screenshot({ path: `${OUT}card-natural-${v.tag}.png` });
    await putTopic(page, LONGEST.prompt);
    await page.screenshot({ path: `${OUT}card-longest-${v.tag}.png` });
    if (LONGEST_NEW && LONGEST_NEW.id !== LONGEST.id) {
      await putTopic(page, LONGEST_NEW.prompt);
      await page.screenshot({ path: `${OUT}card-longest-new-${v.tag}.png` });
    }
    await ctx.close();
  }

  if (want("reroll")) {
    const target = LONGEST_NEW ?? LONGEST;
    const { ctx, page } = await context(v, { walk: PHASE === "after" ? seededWalk(target) : null });
    await today(page);
    const before = await cardTopic(page);
    await page.getByRole("button", { name: /Another topic|Spin a new topic/ }).click();
    await page.waitForSelector("main .home-reel");
    await sleep(700);
    const opened = await reelTopic(page);
    if (PHASE === "before") {
      /* No memory to seed before: the window is shown holding the pool's longest. */
      await page.evaluate((p) => {
        const cell = document.querySelector("main .home-reel span.block");
        if (cell) cell.textContent = p;
      }, LONGEST.prompt);
      await sleep(100);
    }
    await page.screenshot({ path: `${OUT}reroll-open-${v.tag}.png` });
    await page.getByRole("button", { name: "Spin again" }).click({ force: true });
    await sleep(3200);
    const spun = await reelTopic(page);
    await page.screenshot({ path: `${OUT}reroll-spun-${v.tag}.png` });
    report[`reroll ${v.tag}`] = { card: before, opened, spun };
    await ctx.close();
  }

  if (want("ready")) {
    /* The pool's longest as ready-*, the shot the before set has; the
       longest new one as ready-new-*. */
    const shots = [[LONGEST, "ready"], ...(LONGEST_NEW ? [[LONGEST_NEW, "ready-new"]] : [])];
    for (const [target, name] of shots) {
      const { ctx, page } = await context(v);
      await page.goto(`${BASE}/rep?topic=${target.id}&ready=1`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForSelector('button[data-record="start"]', { timeout: 20000 }).catch(() => {});
      await sleep(1500);
      await page.screenshot({ path: `${OUT}${name}-${v.tag}.png` });
      report[`${name} ${v.tag}`] = await page.evaluate(() => {
        const r = document.querySelector('button[data-record="start"]')?.getBoundingClientRect();
        const h = document.querySelector("h1.home-display");
        const lh = h ? parseFloat(getComputedStyle(h).lineHeight) : 0;
        return {
          topic: h?.textContent?.trim() ?? null,
          lines: h ? Math.round(h.querySelector("span").getBoundingClientRect().height / lh) : null,
          record: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
          vh: innerHeight,
        };
      });
      await ctx.close();
    }
  }
}

if (want("walk") && PHASE === "after") {
  const v = { tag: "390-light", w: 390, h: 844, theme: "light", inset: 34 };
  const { ctx, page } = await context(v, { reduce: true });
  await today(page);
  const card = await cardTopic(page);
  await page.getByRole("button", { name: /Another topic|Spin a new topic/ }).click();
  await page.waitForSelector("main .home-reel");
  await sleep(300);
  const ids = new Map(TOPICS.map((t) => [t.prompt, t.id]));
  const shown = [ids.get(card), ids.get(await reelTopic(page))];
  for (let i = 0; i < 70; i++) {
    await page.getByRole("button", { name: "Spin again" }).click({ force: true });
    await sleep(120);
    shown.push(ids.get(await reelTopic(page)));
  }
  const firstRepeat = shown.findIndex((id, i) => shown.indexOf(id) !== i);
  let minGap = Infinity;
  const last = new Map();
  shown.forEach((id, i) => {
    if (last.has(id)) minGap = Math.min(minGap, i - last.get(id));
    last.set(id, i);
  });
  const stored = await page.evaluate(() => localStorage.getItem("ethos.topics.seen"));
  report.walk = {
    shown: shown.length,
    distinct: new Set(shown).size,
    unknown: shown.filter((x) => !x).length,
    firstRepeatAt: firstRepeat,
    minGapBetweenRepeats: minGap,
    stored: stored ? JSON.parse(stored) : null,
  };
  console.log("walk", JSON.stringify({ ...report.walk, stored: undefined }));
  await ctx.close();
}

/* LOOK_TRY="a|b|c" measures candidate prompts in place of the pool. */
const FIT = process.env.LOOK_TRY
  ? process.env.LOOK_TRY.split("|").map((prompt, i) => ({ id: `try${i + 1}`, prompt, shape: "try" }))
  : TOPICS;

if (want("fit")) {
  report.fit = {};
  for (const w of [320, 375, 390]) {
    const v = { tag: `${w}`, w, h: w === 320 ? 692 : w === 375 ? 667 : 844, theme: "light", inset: 0 };
    const { ctx, page } = await context(v);
    await today(page);
    const base = await page.$eval(".home-hero", (e) => e.offsetHeight);
    const rows = [];
    for (const t of FIT) {
      await putTopic(page, t.prompt);
      rows.push({
        id: t.id,
        len: t.prompt.length,
        ...(await page.evaluate(() => {
          const h = document.querySelector("#home-topic");
          const lh = parseFloat(getComputedStyle(h).lineHeight);
          return {
            cardLines: Math.round(h.querySelector("span").getBoundingClientRect().height / lh),
            card: document.querySelector(".home-hero").offsetHeight,
          };
        })),
      });
    }
    /* The reel: open the roulette and set each prompt in its window. */
    await page.getByRole("button", { name: /Another topic|Spin a new topic/ }).click();
    await page.waitForSelector("main .home-reel span.block");
    await sleep(500);
    for (const row of rows) {
      const t = FIT.find((x) => x.id === row.id);
      Object.assign(
        row,
        await page.evaluate((p) => {
          const win = document.querySelector("main .home-reel");
          const cell = win.querySelector("span.block");
          cell.textContent = p;
          const lh = parseFloat(getComputedStyle(win).lineHeight);
          const lines = Math.round(cell.getBoundingClientRect().height / lh);
          return { reelLines: lines, reelFits: cell.getBoundingClientRect().height <= win.getBoundingClientRect().height + 1 };
        }, t.prompt)
      );
    }
    const worst = (k) => rows.reduce((a, b) => (b[k] > a[k] ? b : a));
    report.fit[w] = {
      cardAtRest: base,
      cardMax: worst("card").card,
      cardGrows: rows.filter((r) => r.card > base).map((r) => `${r.id} ${r.card}`),
      cardLinesMax: worst("cardLines").cardLines,
      reelLinesMax: worst("reelLines").reelLines,
      reelOverflow: rows.filter((r) => !r.reelFits).map((r) => r.id),
      rows,
    };
    console.log(
      w,
      JSON.stringify({ ...report.fit[w], rows: undefined })
    );
    await ctx.close();
  }
}

if (!process.env.LOOK_TRY) writeFileSync(`${OUT}fit.json`, JSON.stringify(report, null, 2));
else for (const w of Object.keys(report.fit)) for (const r of report.fit[w].rows) console.log(w, r.cardLines, r.card, r.reelLines, FIT.find((x) => x.id === r.id).prompt);
await browser.close();
console.log("done", OUT);
