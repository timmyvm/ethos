/**
 * Today's three things (#478): the practice card, Hostile Q&A and this
 * week's boss, with the trait tiles flat under them; Hostile free with a
 * daily cap; Practice and /boss with Hostile out of Premium.
 *
 *   LOOK_BASE=http://localhost:3843 node scripts/look-today-three.mjs <before|after> [scene...]
 *
 * Scenes (a returning free account whose last take was yesterday, so the
 * card is the open day's):
 *   today     Today's first screen at 390x844 light and dark, 375x667
 *             and 320x568 light, and the whole page at 390 in both
 *             themes (the trait tiles are under the fold).
 *   hostile   /hostile as a free account sees it with no round today,
 *             and at the cap: three takes in the last 24 hours (after),
 *             or this week's one take (before, the weekly lock).
 *   practice  the Practice tab, where Hostile moves from Premium to Free.
 *   boss      /boss, whose Premium card loses its Hostile row.
 *   squint    Today's first screen at 390x844 light, blurred 7px.
 *   phones    Today's first screen at 390x844, 393x852 and 430x932 with
 *             an iPhone's 34px home inset, light (#495: the Today / This
 *             week switch against the tab bar).
 *   scrolled  Today scrolled until the card's foot is under the bar,
 *             light and dark (#495: the bar over the coloured card), and
 *             scrolled to the tiles.
 *   spoken    Today's header on a day already spoken (a take at 09:12),
 *             light and dark, beside the open day's (#495: the streak chip).
 *
 * Shots go to docs/look/today-three/<phase>/ (LOOK_OUT moves the root),
 * deviceScaleFactor 2.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
import { supabaseRoute as supabase, json, session, seed, POSE_PREF, reps, extraReps, resetPlan, testerMode, TODAY_REP } from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "before";
const ONLY = process.argv.slice(3);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3843";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/today-three"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (s) => ONLY.length === 0 || ONLY.includes(s);

resetPlan("free");
testerMode.tester = false;

const VIEWS = {
  "390-light": { w: 390, h: 844, theme: "light", inset: 34 },
  "390-dark": { w: 390, h: 844, theme: "dark", inset: 34 },
  "375-light": { w: 375, h: 667, theme: "light", inset: 0 },
  "320-light": { w: 320, h: 568, theme: "light", inset: 0 },
};
/* The three iPhones of #495's switch, each with its home inset. */
const PHONES = {
  "390x844-light": { w: 390, h: 844, theme: "light", inset: 34 },
  "393x852-light": { w: 393, h: 852, theme: "light", inset: 34 },
  "430x932-light": { w: 430, h: 932, theme: "light", inset: 34 },
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function context(tag) {
  const v = VIEWS[tag] ?? PHONES[tag];
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: v.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.addInitScript(seed, { theme: v.theme, session, pose: POSE_PREF });
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

async function settle(page) {
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  await sleep(1400);
}

async function today(page) {
  for (let i = 0; ; i++) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
    const ok = await page.waitForSelector("main .home-tile[data-wide]", { timeout: 20000 }).then(() => true, () => false);
    if (ok) break;
    if (i === 3) throw new Error("Today never landed");
  }
  await settle(page);
}

const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log(`  ${name}`);
};

/** A hostile take banked `h` hours ago, its verdict stored when `held` is given. */
function hostileTake(h, held = null) {
  const base = reps[reps.length - 1];
  const at = new Date(Date.now() - h * 3_600_000).toISOString();
  return {
    ...base,
    id: `hostile-${h}`,
    client_id: `hostile-${h}`,
    lesson_id: "hostile-take",
    created_at: at,
    round:
      held === null
        ? null
        : {
            v: 1,
            game: "hostile",
            claimId: "zoos",
            verdict: {
              held: { score: held, citedMoment: 'You said "zoos keep species alive".', improve: "Name one species." },
              answered: { score: 61, citedMoment: 'You said "the breeding programs".', improve: "Answer first." },
              composed: { score: 70, citedMoment: 'You said "I think".', improve: "Keep that pause." },
              coachLine: "You held the claim.",
            },
            questions: [{ question: "Which species?", quoted: "zoos keep species alive" }],
          },
  };
}

if (want("today")) {
  for (const tag of Object.keys(VIEWS)) {
    const { ctx, page } = await context(tag);
    await today(page);
    await shot(page, `today-${tag}`);
    if (tag === "390-light" || tag === "390-dark") await shot(page, `today-full-${tag}`, { fullPage: true });
    /* On a short phone the two tiles are under the card: scrolled to,
       as a thumb brings them up. */
    if ((tag === "375-light" || tag === "320-light") && (await page.$("main .home-mode"))) {
      await page.evaluate(() => document.querySelector("main .home-mode").scrollIntoView({ block: "center" }));
      await sleep(500);
      await shot(page, `today-tiles-${tag}`);
    }
    await ctx.close();
  }
}

if (want("squint")) {
  const { ctx, page } = await context("390-light");
  await today(page);
  await page.addStyleTag({ content: "html{filter:blur(7px)}" });
  await sleep(300);
  await shot(page, "today-squint-390-light");
  await ctx.close();
}

if (want("phones")) {
  for (const tag of Object.keys(PHONES)) {
    const { ctx, page } = await context(tag);
    await today(page);
    /* Where the switch stands against the tab bar, printed beside the shot. */
    const at = await page.evaluate(() => {
      const seg = document.querySelector("main .home-seg")?.getBoundingClientRect();
      const nav = document.querySelector("nav")?.getBoundingClientRect();
      return seg && nav ? `switch ${Math.round(seg.top)} to ${Math.round(seg.bottom)}, bar from ${Math.round(nav.top)}` : "none";
    });
    await shot(page, `today-phone-${tag}`);
    console.log(`    ${at}`);
    await ctx.close();
  }
}

if (want("scrolled")) {
  for (const tag of ["390-light", "390-dark"]) {
    const { ctx, page } = await context(tag);
    await today(page);
    /* The card's foot 92px from the top, its last band under the bar:
       where the tour (02-today-tiles) saw "Another topic" ghost through
       a blue smear. */
    await page.evaluate(() => {
      const card = document.querySelector("main .home-hero");
      if (!card) return;
      const r = card.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.bottom - 92);
    });
    await sleep(700);
    await shot(page, `today-scrolled-${tag}`);
    await page.evaluate(() => document.querySelector("main .home-seg")?.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -70));
    await sleep(700);
    await shot(page, `today-tiles-scrolled-${tag}`);
    await ctx.close();
  }
}

if (want("spoken")) {
  for (const spoke of [false, true]) {
    extraReps.length = 0;
    if (spoke) extraReps.push({ ...TODAY_REP });
    for (const tag of ["390-light", "390-dark"]) {
      const { ctx, page } = await context(tag);
      await today(page);
      await shot(page, `today-header-${spoke ? "spoken" : "open"}-${tag}`, { clip: { x: 0, y: 0, width: 390, height: 140 } });
      await ctx.close();
    }
  }
  extraReps.length = 0;
}

if (want("hostile")) {
  for (const [scene, rows] of [
    ["open", []],
    ["cap", PHASE === "before" ? [hostileTake(3)] : [hostileTake(2, 72), hostileTake(5), hostileTake(9, 64)]],
  ]) {
    extraReps.length = 0;
    extraReps.push(...rows);
    for (const tag of scene === "cap" ? ["390-light", "390-dark", "375-light", "320-light"] : ["390-light"]) {
      const { ctx, page } = await context(tag);
      /* After, the open screen is reached from Today's tile, its back naming Today. */
      const from = PHASE === "after" && scene === "open" ? "?from=today" : "";
      await page.goto(`${BASE}/hostile${from}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForSelector("main section[aria-label='The claim']", { timeout: 20000 });
      await settle(page);
      await shot(page, `hostile-${scene}-${tag}`);
      await ctx.close();
    }
  }
  extraReps.length = 0;
}

if (want("practice")) {
  for (const tag of ["390-light", "390-dark"]) {
    const { ctx, page } = await context(tag);
    await page.goto(`${BASE}/games`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForSelector("main h1", { timeout: 20000 });
    await settle(page);
    await shot(page, `practice-full-${tag}`, { fullPage: true });
    await ctx.close();
  }
}

if (want("boss")) {
  const { ctx, page } = await context("390-light");
  await page.goto(`${BASE}/boss`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForSelector("main h1", { timeout: 20000 });
  await settle(page);
  await shot(page, "boss-390-light");
  await ctx.close();
}

await browser.close();
