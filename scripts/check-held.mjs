/**
 * Stale-while-revalidate, in a real browser (#433, lib/held.ts).
 *
 * A tab opened by moving through the app draws what the visit last read
 * in its first frame, and reads it again behind that. This walks the tab
 * bar twice with a slow backend (every Supabase answer held back
 * LATENCY ms, so a skeleton would be on screen for at least that long)
 * and checks, on each arrival, in the frame after the page mounts:
 *
 *   1. no skeleton stands where held numbers can be drawn (the plan's
 *      own card on You is the named exception: a price is read, never
 *      remembered);
 *   2. the screen still read again (Supabase was asked after the tap);
 *   3. nothing on it replays its arrival (`.arrive` is for content that
 *      lands over a skeleton);
 *   4. a cold open of every tab still hydrates clean and shows its
 *      skeleton first, exactly as before.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-held.mjs
 *   SHOTS=docs/look/ux20 node scripts/check-held.mjs   # a frame 80ms after each tap
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const LATENCY = Number(process.env.LATENCY ?? 350);
const SHOTS = process.env.SHOTS ? process.env.SHOTS.replace(/\/?$/, "/") : null;
const TAG = process.env.TAG ?? "after";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const TABS = [
  { name: "Lessons", href: "/lessons" },
  { name: "Practice", href: "/games" },
  { name: "Log", href: "/history" },
  { name: "You", href: "/you" },
  { name: "Today", href: "/" },
];

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function open(theme = "light") {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
  });
  const asked = { n: 0 };
  await context.route("http://supabase.local/**", async (route) => {
    if (route.request().method() !== "OPTIONS") asked.n += 1;
    await sleep(LATENCY);
    return supabaseRoute(route);
  });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|did not match|#418|#423|#425/i.test(m.text())) errors.push(m.text().slice(0, 160));
  });
  return { context, page, asked, errors };
}

/** Skeleton bones a person would see in the page, outside the plan's own card. */
const bones = (page) =>
  page.evaluate(() => {
    const seen = [...document.querySelectorAll("main .skeleton")].filter((el) => {
      if (el.closest("[data-look='plan-slot'], [data-plan-skeleton]")) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    });
    return seen.length;
  });

/** Arrivals still running in the page: content drawn from what was held has none. */
const arriving = (page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("main .arrive, main .stagger > *")].filter((el) =>
        el.getAnimations().some((a) => a.playState === "running" && /arrive|stagger|fade/i.test(a.animationName ?? ""))
      ).length
  );

const settled = async (page) => {
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(250);
};

// ---- 1. the walk -----------------------------------------------------------
{
  const { context, page, asked, errors } = await open();
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main");
  const coldBones = await bones(page);
  ok("a cold open of Today still shows its skeleton first", coldBones > 0, `${coldBones} bones`);
  await settled(page);

  for (const round of [1, 2]) {
    for (const tab of TABS) {
      const before = asked.n;
      await page.locator(`nav a[href="${tab.href}"]`).click({ force: true });
      await page.waitForURL((u) => new URL(u).pathname === tab.href);
      await page.waitForSelector("main");
      // One frame after the page mounts: what a person sees on arrival.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const n = await bones(page);
      const moving = await arriving(page);
      if (SHOTS) {
        await sleep(40);
        await page.screenshot({ path: `${SHOTS}held-${TAG}-${round}-${tab.name.toLowerCase()}.png` });
      }
      /* Held is only what was read. You is the one screen that reads the
         XP, so on its first visit the level's lines wait for it (and say
         so with their bones); everything else on it, and every other tab,
         was read by a screen before it. */
      const firstYou = round === 1 && tab.name === "You";
      if (firstYou) ok("You, first visit: only the XP's lines wait", n > 0 && n <= 8, `${n} bones`);
      else ok(`${tab.name}, visit ${round}: opens on its numbers, no skeleton`, n === 0, `${n} bones`);
      ok(`${tab.name}, visit ${round}: nothing replays its arrival`, moving === 0, `${moving} arriving`);
      await sleep(LATENCY * 3 + 300);
      ok(`${tab.name}, visit ${round}: read again behind what it drew`, asked.n > before, `${asked.n - before} reads`);
      await settled(page);
    }
  }
  ok("the walk threw nothing and hydrated clean", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 2. every tab, opened cold, is the page the server sent -----------------
for (const tab of TABS) {
  const { context, page, errors } = await open();
  await page.goto(`${BASE}${tab.href}`);
  await page.waitForSelector("main");
  const n = await bones(page);
  await settled(page);
  ok(`${tab.name} cold: skeleton first, then its numbers, no hydration error`, n > 0 && errors.length === 0, `${n} bones${errors.length ? `, ${errors[0]}` : ""}`);
  await context.close();
}

// ---- 3. a read that fails behind a drawn screen leaves the screen ----------
{
  const { context, page } = await open();
  await page.goto(`${BASE}/`);
  await settled(page);
  await page.locator('nav a[href="/history"]').click({ force: true });
  await page.waitForURL((u) => new URL(u).pathname === "/history");
  await settled(page);
  // The backend goes away; Today is opened again from what the visit holds.
  await context.unroute("http://supabase.local/**");
  await context.route("http://supabase.local/**", (route) => route.abort("failed"));
  await page.locator('nav a[href="/"]').click({ force: true });
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await sleep(1200);
  const state = await page.evaluate(() => ({
    error: !!document.querySelector("main [role='alert']"),
    retry: [...document.querySelectorAll("main button")].some((b) => /try again/i.test(b.textContent ?? "")),
    card: !!document.querySelector(".home-hero"),
    bones: document.querySelectorAll("main .skeleton").length,
  }));
  ok("offline behind a drawn Today: the screen stands, no error card, no skeleton", state.card && !state.retry && state.bones === 0, JSON.stringify(state));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
