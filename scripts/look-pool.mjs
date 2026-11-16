/**
 * The school pool on Today's card (#489): the card of someone under 18 on
 * a day their walk held a prompt about a job, beside a grown-up's on the
 * same day, and the address the command menu's Today opens for each.
 *
 *   LOOK_TODAY=2026-12-12 LOOK_BASE=http://localhost:3913 \
 *     node scripts/look-pool.mjs <before|after>
 *
 * The fixtures' newest measured take makes Pausing the weakest trait at
 * the lower tier, and on 12 Dec 2026 that walk stands at its tenth place,
 * pause-1-10, "The worst job you've ever done" (t10), which the school
 * pool drops. Before #489 both people were handed it. After, the person
 * under 18 gets the stand-in from the same place in Fillers' walk, with
 * Pausing's angle and tactic; the grown-up's card is unchanged.
 *
 * Three people, one answer apart: the age band "u18", "18_24" or never
 * given (the fixtures' own answers are an old layout that reads as no
 * age at all, so every other camera's account is the third).
 * Shots at 390x844, light and dark, deviceScaleFactor 2, into
 * docs/look/pool/<phase>/; what each card and each Today door named into
 * cards.json there.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
import { supabaseRoute as supabase, json, session, seed, POSE_PREF, reps, resetPlan, testerMode, LOOK_TODAY } from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "after";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3913";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/pool"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!LOOK_TODAY) throw new Error("Set LOOK_TODAY (2026-12-12 is a day the fixture's walk holds a job prompt).");

/* Yesterday's take is the newest: an open day, the card's Start and "Another topic". */
const MEL = "Australia/Melbourne";
const melDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: MEL }).format(d);
const ORIGINAL = [...reps];
reps.length = 0;
for (const r of ORIGINAL) if (Math.round((Date.parse(LOOK_TODAY) - Date.parse(melDay(new Date(r.created_at)))) / 86_400_000) >= 1) reps.push(r);
resetPlan("free");
testerMode.tester = false;

/* The third never gave an age: the school pool too (#489), so the job
   prompt waits for an age band or for Work as the place. */
const PEOPLE = [
  { tag: "under-18", ageBand: "u18" },
  { tag: "adult", ageBand: "18_24" },
  { tag: "no-age", ageBand: null },
];
const VIEWS = [
  { tag: "390-light", w: 390, h: 844, theme: "light" },
  { tag: "390-dark", w: 390, h: 844, theme: "dark" },
];
const CLOCK = new Date(`${LOOK_TODAY}T19:00:00+11:00`);

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function open(person, v) {
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
  await ctx.addInitScript((ageBand) => {
    const o = JSON.parse(localStorage.getItem("ethos.onboarding") ?? "{}");
    o.answers = { ...o.answers, ageBand, goal: "sharper", context: null };
    localStorage.setItem("ethos.onboarding", JSON.stringify(o));
  }, person.ageBand);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CLOCK);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
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

const report = { phase: PHASE, day: LOOK_TODAY, cards: [] };
for (const person of PEOPLE) {
  for (const v of VIEWS) {
    const { ctx, page } = await open(person, v);
    await today(page);
    const topic = await page.$eval("#home-topic", (e) => e.textContent.trim());
    const start = await page.$eval("a.home-start", (a) => a.getAttribute("href"));
    await page.screenshot({ path: `${OUT}card-${person.tag}-${v.tag}.png` });
    /* The command menu's Today, on a keyboard (#438): the address it opens. */
    let menu = null;
    if (v.theme === "light") {
      await page.keyboard.press("Control+K");
      const field = page.locator('[role="combobox"]');
      if (await field.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
        await field.fill("today's practice");
        await sleep(300);
        await page.keyboard.press("Enter");
        await page.waitForURL(/\/rep\?/, { timeout: 10000 }).catch(() => {});
        menu = new URL(page.url()).pathname + new URL(page.url()).search;
      }
    }
    /* Where Start goes: the recorder, ready, heading with the practice's
       angle and leading with its tactic, which a stand-in keeps. */
    if (v.theme === "light") {
      await page.goto(`${BASE}${start}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForSelector("[data-record]", { timeout: 20000 }).catch(() => {});
      await sleep(1200);
      await page.screenshot({ path: `${OUT}ready-${person.tag}-${v.tag}.png` });
    }
    report.cards.push({ person: person.tag, view: v.tag, topic, start, menu });
    console.log(`${person.tag} ${v.tag}: "${topic}"  start ${start}${menu ? `  menu ${menu}` : ""}`);
    await ctx.close();
  }
}

writeFileSync(`${OUT}cards.json`, JSON.stringify(report, null, 2) + "\n");
await browser.close();
