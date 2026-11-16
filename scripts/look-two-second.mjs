/**
 * The two-second test (#483): the ready screen before a recording, as
 * Timothy saw it on 16 Nov ("Concrete nouns" opened to its sentence, and
 * "Ethos 800 · 96 to go" under Record), and Today's card, before and
 * after. 390x844 light and dark, 375x667 light.
 *
 *   LOOK_BASE=http://localhost:3881 PLAYWRIGHT_MODULE=... node scripts/look-two-second.mjs <before|after>
 *
 * Scenes:
 *   ready     /rep for Variety's "Short concrete nouns" practice
 *             (range-1-3), ready=1, the tactic closed and then opened,
 *             with the line under Record. The streak is broken (the last
 *             take two days ago), so the line is a milestone, not the
 *             streak's.
 *   ready-800 the same with a best of 704, Timothy's own ("Ethos 800 ·
 *             96 to go").
 *   alive     the same screen with the streak alive, so the line is the
 *             streak's ("This one keeps a 6-day streak alive").
 *   today     Today on a day not yet spoken, and on a day spoken ("One
 *             more", the tactic on the card, opened).
 *
 * Each shot's line under Record and the tactic's words go to report.json.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  collectRoute,
  json,
  session,
  testerMode,
  seed,
  POSE_PREF,
  reps,
  resetPlan,
} from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "before";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3881";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/two-second"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ID = "0b5e7a21-6c3d-4f8e-8a1b-2d9c4e6f7a10";

const ORIGINAL = [...reps];
const MEL = "Australia/Melbourne";
const melDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: MEL }).format(d);
const TODAY = process.env.LOOK_TODAY ?? melDay(new Date());
const agoOf = (iso) => Math.round((Date.parse(TODAY) - Date.parse(melDay(new Date(iso)))) / 86_400_000);
/* Timothy's own state on 16 Nov: a best of 704, so the next band is 800. */
function history(minAgo, best = null) {
  reps.length = 0;
  for (const r of ORIGINAL) if (agoOf(r.created_at) >= minAgo) reps.push(r);
  if (best !== null) {
    const r = reps[reps.length - 1];
    const at = new Date(Date.parse(r.created_at) - 3_600_000).toISOString();
    reps.push({ ...r, id: `${r.id}-best`, ethos_index: best, created_at: at });
  }
}

const VIEWS = [
  { tag: "390-light", w: 390, h: 844, theme: "light", inset: 34 },
  { tag: "390-dark", w: 390, h: 844, theme: "dark", inset: 34 },
  { tag: "375-light", w: 375, h: 667, theme: "light", inset: 0 },
];

/* Variety's third angle, the practice whose tactic Timothy opened. */
const READY = "/rep?topic=t41&item=range-1-3&trait=range&ready=1";

const browser = await chromium.launch({
  args: [
    "--font-render-hinting=none",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

async function context(v) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: MEL,
    colorScheme: v.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/analyze", (route) => route.fulfill(json(analyze)));
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester/collect", collectRoute);
  const me = { ...session, user: { ...session.user, id: ID } };
  await ctx.route("http://supabase.local/auth/v1/token**", (route) => route.fulfill(json(me)));
  await ctx.addInitScript(seed, { theme: v.theme, session: me, pose: POSE_PREF, tester: false });
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, bottom: v.inset, left: 0, right: 0 },
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

/** The words a person reads on the ready screen: the tactic and the line under Record. */
async function read(page) {
  return page.evaluate(() => {
    const record = document.querySelector('button[data-record="start"]');
    const box = record?.getBoundingClientRect();
    const tip = document.querySelector("button[aria-expanded]");
    const panel = tip?.getAttribute("aria-controls") ? document.getElementById(tip.getAttribute("aria-controls")) : null;
    const lines = [...document.querySelectorAll("p")]
      .filter((p) => box && p.getBoundingClientRect().top >= box.bottom - 4 && p.getBoundingClientRect().top < box.bottom + 80)
      .map((p) => ({ text: p.textContent.trim(), h: Math.round(p.getBoundingClientRect().height) }));
    return {
      tactic: tip?.textContent.replace(/\s+/g, " ").trim() ?? null,
      sentence: panel?.textContent.replace(/\s+/g, " ").trim() ?? null,
      underRecord: lines,
      heading: document.querySelector("h1, h2")?.textContent.trim() ?? null,
    };
  });
}

const report = {};
async function ready(name, minAgo, v, best = null) {
  history(minAgo, best);
  resetPlan("free");
  testerMode.tester = false;
  testerMode.today = false;
  const { ctx, page } = await context(v);
  await page.goto(`${BASE}${READY}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForSelector('button[data-record="start"]', { state: "visible", timeout: 20000 });
  await sleep(1800);
  await page.screenshot({ path: `${OUT}${name}-${v.tag}.png` });
  const closed = await read(page);
  const tip = page.locator("button[aria-expanded]").first();
  if (await tip.count()) {
    await tip.click();
    await sleep(700);
  }
  await page.screenshot({ path: `${OUT}${name}-open-${v.tag}.png` });
  report[`${name} ${v.tag}`] = { closed, open: await read(page) };
  console.log(name, v.tag, JSON.stringify(report[`${name} ${v.tag}`]));
  await ctx.close();
}

async function today(name, spoken, v) {
  history(2);
  resetPlan("free");
  testerMode.tester = false;
  testerMode.today = spoken;
  const { ctx, page } = await context(v);
  for (let i = 0; ; i++) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
    const ok = await page
      .waitForSelector(".home-hero:not([data-family='none'])", { timeout: 20000 })
      .then(() => true, () => false);
    if (ok) break;
    if (i === 3) throw new Error(`Today never landed: ${name} ${v.tag}`);
  }
  await sleep(1800);
  await page.screenshot({ path: `${OUT}${name}-${v.tag}.png` });
  const tactic = page.locator(".home-hero button[aria-expanded]").first();
  const r = { lead: await page.locator(".home-hero-lead").first().textContent().catch(() => null) };
  if (await tactic.count()) {
    r.tactic = (await tactic.textContent()).replace(/\s+/g, " ").trim();
    await tactic.click();
    await sleep(700);
    await page.screenshot({ path: `${OUT}${name}-open-${v.tag}.png` });
    r.sentence = await page.evaluate(() => {
      const b = document.querySelector(".home-hero button[aria-expanded]");
      const id = b?.getAttribute("aria-controls");
      return id ? document.getElementById(id)?.textContent.replace(/\s+/g, " ").trim() ?? null : null;
    });
  }
  report[`${name} ${v.tag}`] = r;
  console.log(name, v.tag, JSON.stringify(r));
  await ctx.close();
}

for (const v of VIEWS) {
  await ready("ready", 2, v);
  await ready("ready-800", 2, v, 704);
  await ready("alive", 1, v);
  await today("today-open", false, v);
  await today("today-spoken", true, v);
}

writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 2));
await browser.close();
