/**
 * The look loop's camera for TESTER PRESENCE (#402, docs/testers.md):
 * Today, You, the results walk, the Log's question, Settings' row and
 * the tester page, as each kind of account meets them during the test
 * and after it, against the mocked Supabase of scripts/look-fixtures.mjs.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-presence.mjs after                    # every scene
 *   node scripts/look-presence.mjs after today-tester-send  # a subset
 *
 * Env: LOOK_BASE (the server), LOOK_OUT (default docs/look/testers/presence/),
 * LOOK_SIZES ("390x844,320x568"), LOOK_THEMES ("light,dark").
 *
 * The scenes are photographed on three days of the test, each on its own
 * Melbourne calendar: 31 October (test day 2), 12 November (day 14, the
 * last) and 14 November (the test over). Without LOOK_TODAY the camera
 * runs itself once per day it has scenes for, each run with LOOK_TODAY
 * set, so the fixtures' recordings are dated from that day; the page's
 * clock is fixed to 19:00 that day (page.clock.setFixedTime), except on
 * the results walk, whose recorder times the take by the real clock (it
 * runs on 31 October only, and says so when the box's date is another).
 *
 * Accounts: a non-tester (no hint, no row); a current tester (consent 3,
 * the device holding the hint); a paused tester (consent 2, already asked
 * once on this device, so the open's ask does not cover the screen); a
 * tester who recorded today (testerMode.today: a 09:12 recording, Index
 * 665); and the test over. "sent" is the device having sent the tester
 * number (ethos.tester.sent).
 *
 * Every shot is `${scene}-${W}x${H}-${TAG}-${theme}.png`. Today scenes at
 * a short phone add `-tile`, scrolled to the test tile (or, before it
 * existed, to the Today / This week switch). With TAG other than
 * "before", the tile is measured (#402 §14): it clears the floating nav
 * at 390x844 on the first screen, holds 208px in every state, its ask row
 * holds 44px, and the eyebrow says the test's day during it and the date
 * after. A failed measurement prints ASSERT-FAIL and the run exits 1.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  collectRoute,
  json,
  session,
  testerMode,
  seed,
  POSE_PREF,
  LOOK_TODAY,
  TODAY_REP,
} from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/testers/presence/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844,320x568").split(",").map((s) => s.split("x").map(Number));
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The returning account's id: its tester number reads "0B5E 7A21". */
const RETURNING_ID = "0b5e7a21-6c3d-4f8e-8a1b-2d9c4e6f7a10";
const SENT = "0B5E7A21";

/** Each day's scenes. The camera runs once per day, LOOK_TODAY set. */
const DAYS = {
  "2026-10-31": [
    "today-plain", "today-tester-send", "today-tester-record", "today-tester-paused", "today-tester-answer",
    "today-tester-done", "today-tester-loading", "today-tester-unknown",
    "you-plain", "you-tester", "you-paused",
    "felt", "results-tester", "results-paused", "results-plain", "log-match",
    "settings-testing", "tester-page",
    "squint-today-tester-send", "strip-today-land", "strip-send",
  ],
  "2026-11-12": ["today-tester-last", "settings-last"],
  "2026-11-14": ["today-tester-over", "you-over", "settings-over"],
};

/** A scene runs on its own day, and only when asked for (or when nothing was named). */
const want = (name) => (!LOOK_TODAY || (DAYS[LOOK_TODAY] ?? []).includes(name)) && (ONLY.length === 0 || ONLY.includes(name));

if (!LOOK_TODAY) {
  let failed = 0;
  for (const [day, scenes] of Object.entries(DAYS)) {
    const mine = ONLY.length ? ONLY.filter((s) => scenes.includes(s)) : scenes;
    if (!mine.length) continue;
    console.log(`== ${day}: ${mine.length} scenes`);
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), TAG, ...mine], {
      stdio: "inherit",
      env: { ...process.env, LOOK_TODAY: day },
    });
    if (run.status !== 0) failed++;
  }
  process.exit(failed ? 1 : 0);
}

mkdirSync(OUT, { recursive: true });
const CLOCK = new Date(`${LOOK_TODAY}T19:00:00+11:00`);
const MEL_TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

let asserts = 0;
let assertFails = 0;
const expectIt = (label, ok, detail = "") => {
  asserts++;
  if (!ok) assertFails++;
  if (!ok) console.log(`ASSERT-FAIL ${label}${detail ? `  (${detail})` : ""}`);
};

async function context(theme, [W, H], o = {}) {
  const { hint = false, asked = 0, sent = null, lit = null, clock = true, blur = false, share = true } = o;
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester/collect", collectRoute);
  /* The session expires a day after the page's clock, not the box's, and
     a refresh answers with the same account: on 12 and 14 November the
     seeded one had expired, the refresh came back as the fixture's "u1",
     and the tile drew no tester number. */
  const me = { ...session, user: { ...session.user, id: RETURNING_ID }, expires_at: Math.floor(CLOCK.getTime() / 1000) + 86_400 };
  await ctx.route("http://supabase.local/auth/v1/token**", (route) => route.fulfill(json(me)));
  await ctx.addInitScript(seed, { theme, session: me, pose: POSE_PREF, tester: hint });
  await ctx.addInitScript(
    ({ asked, sent, lit }) => {
      if (asked) localStorage.setItem("ethos.tester.asked", String(asked));
      if (sent) localStorage.setItem("ethos.tester.sent", sent);
      if (lit) localStorage.setItem("ethos.tester.lit", lit);
    },
    { asked, sent, lit }
  );
  // The phone's share sheet (an iPhone has one, desktop Chromium does not),
  // answering after 300ms as a tap on a contact would.
  if (share) await ctx.addInitScript(() => { navigator.share = () => new Promise((r) => setTimeout(r, 300)); });
  await ctx.addInitScript((blur) => {
    const css = document.createElement("style");
    css.textContent = `nextjs-portal{display:none!important}${blur ? " html{filter:blur(7px)}" : ""}`;
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  }, blur);
  const page = await ctx.newPage();
  if (clock) await page.clock.setFixedTime(CLOCK);
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/CERT_AUTHORITY|Failed to load resource/.test(m.text())) console.log("CONSOLE", page.url(), m.text().slice(0, 200)); });
  return { ctx, page };
}

/** Testers state for a scene, reset between scenes. */
function state(o = {}) {
  testerMode.tester = o.tester ?? false;
  testerMode.consentVersion = o.version ?? 3;
  testerMode.today = o.today ?? false;
  testerMode.repsFail = o.repsFail ?? false;
  testerMode.testerDelay = o.delay ?? 0;
  testerMode.feedback = "ok";
  testerMode.stored = o.answered ? { [TODAY_REP.client_id]: { client_id: TODAY_REP.client_id, answer: "about_right", note: null, scores: null, felt: "okay" } } : {};
  testerMode.answers.length = 0;
}

/** The tile's measurements, for the scenes that should draw it. */
async function measure(page, name, size, { tile, eyebrow }) {
  if (TAG === "before") return;
  const m = await page.evaluate(() => {
    const t = document.querySelector("[data-test]");
    const ask = document.querySelector("[data-test-ask]");
    const r = t?.getBoundingClientRect();
    return {
      has: !!t,
      bottom: r ? r.bottom + window.scrollY : null,
      height: r ? r.height : null,
      ask: ask ? ask.getBoundingClientRect().height : null,
      eyebrow: document.querySelector(".large-title-eyebrow")?.textContent?.trim() ?? null,
    };
  });
  const at = `${name} ${size}`;
  expectIt(`${at}: the tile ${tile ? "shows" : "is absent"}`, m.has === tile);
  if (tile && m.has) {
    expectIt(`${at}: the tile holds 208px`, Math.abs(m.height - 208) <= 1, `${m.height}`);
    if (m.ask !== null) expectIt(`${at}: the ask row holds 44px`, Math.abs(m.ask - 44) <= 1, `${m.ask}`);
    if (size === "390x844") expectIt(`${at}: the tile clears the nav on the first screen`, m.bottom <= 766, `${m.bottom}`);
  }
  if (eyebrow === "test") expectIt(`${at}: the eyebrow says the test's day`, /^Test day \d+ of 14$/.test(m.eyebrow ?? ""), m.eyebrow ?? "none");
  if (eyebrow === "date") expectIt(`${at}: the eyebrow is the date`, !/^Test day/.test(m.eyebrow ?? ""), m.eyebrow ?? "none");
}

async function shootAll() {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      const [W, H] = size;
      const sz = `${W}x${H}`;
      const file = (name) => `${OUT}${name}-${sz}-${TAG}-${theme}.png`;
      const shot = async (page, name, { settle = 700, fullPage = false } = {}) => {
        await sleep(settle);
        await page.screenshot({ path: file(name), fullPage });
        console.log(`shot  ${name}-${sz}-${TAG}-${theme}`);
      };
      const step = async (name, fn) => {
        if (!want(name)) return;
        try {
          await fn();
        } catch (e) {
          console.log("STEP-FAILED", theme, sz, name, String(e.message ?? e).split("\n").slice(0, 6).join(" / "));
          assertFails++;
        }
      };

      /* Today: the first screen, and on a short phone the tile too. */
      const today = async (name, s, ctxOpts, { tile = true, eyebrow = "test", wait = true, settle = 1600 } = {}) =>
        step(name, async () => {
          state(s);
          const { ctx, page } = await context(theme, size, ctxOpts);
          await page.goto(`${BASE}/`);
          await page.waitForSelector("main h1", { timeout: 30000 });
          if (wait) await page.waitForSelector(".home-seg, [role=alert], main .error-state", { timeout: 20000 }).catch(() => {});
          await shot(page, name, { settle });
          await measure(page, name, sz, { tile, eyebrow });
          if (H < 700) {
            const target = page.locator(tile && TAG !== "before" ? "[data-test]" : ".home-seg").first();
            if (await target.count()) {
              await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
              await shot(page, `${name}-tile`, { settle: 400 });
            }
          }
          await ctx.close();
        });

      const tester = { tester: true, version: 3 };
      const sent = { hint: true, sent: SENT };
      await today("today-plain", {}, {}, { tile: false, eyebrow: "date" });
      await today("today-tester-send", tester, { hint: true });
      await today("today-tester-record", tester, sent);
      await today("today-tester-paused", { tester: true, version: 2 }, { hint: true, asked: 3 });
      await today("today-tester-answer", { ...tester, today: true }, sent);
      await today("today-tester-done", { ...tester, today: true, answered: true }, sent);
      await today("today-tester-loading", { ...tester, delay: 6000 }, sent, { wait: false, settle: 1500 });
      await today("today-tester-unknown", { ...tester, repsFail: true }, sent, { settle: 2500 });
      await today("today-tester-last", { ...tester, today: true, answered: true }, sent);
      await today("today-tester-over", tester, sent, { eyebrow: "date" });

      if (W === 390 && theme === "light") {
        await step("squint-today-tester-send", async () => {
          state(tester);
          const { ctx, page } = await context(theme, size, { hint: true, blur: true });
          await page.goto(`${BASE}/`);
          await page.waitForSelector(".home-seg", { timeout: 30000 });
          await shot(page, "squint-today-tester-send", { settle: 1600 });
          await ctx.close();
        });
      }

      /* You: unchanged for everyone, photographed to prove it. */
      const you = async (name, s, ctxOpts) =>
        step(name, async () => {
          state(s);
          const { ctx, page } = await context(theme, size, ctxOpts);
          await page.goto(`${BASE}/you`);
          await page.waitForSelector("main h1", { timeout: 30000 });
          await shot(page, name, { settle: 1800 });
          await ctx.close();
        });
      await you("you-plain", {}, {});
      await you("you-tester", tester, sent);
      await you("you-paused", { tester: true, version: 2 }, { hint: true, asked: 3 });
      await you("you-over", tester, sent);

      /* The results walk: record a take, then each step. */
      const results = async (page) => {
        await page.goto(`${BASE}/rep?lesson=h4`);
        await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
        await page.click('button[aria-label="Start recording"]', { force: true });
        await page.waitForSelector('button[aria-label="Stop and score this recording"]');
        await sleep(2500);
        await page.click('button[aria-label="Stop and score this recording"]', { force: true });
        await page.waitForSelector("main .arrive-x, #felt-question", { timeout: 20000 });
        await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
        await sleep(3200);
      };
      const toLast = async (page, until) => {
        const pick = page.getByRole("button", { name: "Okay", exact: true });
        if (await pick.count()) {
          await pick.click();
          await sleep(700);
        }
        for (let i = 0; i < 4; i++) {
          if (await page.getByText(until).count()) break;
          const next = page.locator("[data-step-action]").first();
          if (!(await next.count()) || !/numbers|words/i.test(await next.innerText())) break;
          await next.click();
          await sleep(900);
        }
      };
      const walk = async (name, s, ctxOpts, fn) =>
        step(name, async () => {
          if (LOOK_TODAY !== MEL_TODAY) {
            console.log(`skip  ${name}: the recorder needs the real clock, and today in Melbourne is ${MEL_TODAY}, not ${LOOK_TODAY}`);
            return;
          }
          state(s);
          const { ctx, page } = await context(theme, size, { ...ctxOpts, clock: false });
          await results(page);
          await fn(page);
          await ctx.close();
        });
      await walk("felt", tester, sent, async (page) => {
        await page.getByText("How did that feel?").waitFor({ timeout: 8000 });
        await shot(page, "felt", { settle: 400 });
      });
      await walk("results-tester", tester, sent, async (page) => {
        await toLast(page, /feel right\?/);
        const q = page.getByText(/feel right\?/).first();
        await q.waitFor({ timeout: 8000 });
        await q.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await shot(page, "results-tester", { settle: 600 });
      });
      await walk("results-paused", { tester: true, version: 2 }, { hint: true, asked: 3 }, async (page) => {
        await toLast(page, "Testing is paused.");
        const line = page.getByText("Testing is paused.").first();
        await line.waitFor({ timeout: 8000 });
        await line.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await shot(page, "results-paused", { settle: 600 });
      });
      await walk("results-plain", {}, {}, async (page) => {
        await shot(page, "results-plain", { settle: 600 });
      });

      /* The Log's page of today's recording, opened from Today's Answer. */
      await step("log-match", async () => {
        state({ ...tester, today: true });
        const { ctx, page } = await context(theme, size, sent);
        await page.goto(`${BASE}/rep/${TODAY_REP.id}#match`);
        await page.waitForSelector("main h1", { timeout: 30000 });
        await page.getByText(/feel right\?/).first().waitFor({ timeout: 20000 }).catch(() => {});
        await shot(page, "log-match", { settle: 1500 });
        await ctx.close();
      });

      /* Settings' About group, the Testing Ethos row in view. */
      const settings = async (name) =>
        step(name, async () => {
          state(tester);
          const { ctx, page } = await context(theme, size, sent);
          await page.goto(`${BASE}/settings`);
          await page.waitForSelector("main .inset-group", { timeout: 30000 });
          await sleep(1200);
          const row = page.getByRole("link", { name: /Testing Ethos/ }).first();
          await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await shot(page, name, { settle: 500 });
          await ctx.close();
        });
      await settings("settings-testing");
      await settings("settings-last");
      await settings("settings-over");

      await step("tester-page", async () => {
        state(tester);
        const { ctx, page } = await context(theme, size, { hint: true });
        await page.goto(`${BASE}/tester?from=settings`);
        await page.getByText("You're testing Ethos").first().waitFor({ timeout: 20000 });
        await shot(page, "tester-page", { settle: 1200 });
        await ctx.close();
      });

      /* Frame strips (DESIGN.md, step 5), at 390 only. */
      if (W === 390) {
        await step("strip-today-land", async () => {
          state({ ...tester, today: true, answered: true });
          const { ctx, page } = await context(theme, size, { ...sent, lit: "2026-10-30" });
          await page.goto(`${BASE}/`);
          await page.waitForSelector("main h1", { timeout: 30000 });
          const frames = [await page.screenshot()];
          await page.waitForSelector("[data-test] .test-day-fill", { timeout: 20000 });
          await stripFrames(page, frames, [80, 160, 240, 400, 900]);
          await compose(ctx, frames, ["0", "80", "160", "240", "400", "900"], `${OUT}strip-today-land-${TAG}-${theme}.png`);
          await ctx.close();
        });
        await step("strip-send", async () => {
          state(tester);
          const { ctx, page } = await context(theme, size, { hint: true });
          await page.goto(`${BASE}/`);
          const key = page.locator("[data-test] button[aria-label]").first();
          await key.waitFor({ timeout: 30000 });
          await sleep(1500);
          await key.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await sleep(300);
          const frames = [await page.screenshot()];
          await key.dispatchEvent("click");
          // The share sheet answers at 300ms, and the key's label fades to Sent: seeked frames of that fade.
          await sleep(340);
          await stripFrames(page, frames, [0, 80, 160]);
          await page.evaluate(() => { for (const a of window.__strip ?? []) try { a.play(); } catch {} });
          // The 2s hold ends and the next ask arrives: seeked frames of its arrival.
          await sleep(2050);
          await stripFrames(page, frames, [80, 400]);
          await compose(ctx, frames, ["before", "340+0", "340+80", "340+160", "2400+80", "2400+400"], `${OUT}strip-send-${TAG}-${theme}.png`);
          await ctx.close();
        });
      }
    }
  }
}

/** Seeks every running animation to each moment and shoots it (scripts/strip.mjs's way). */
async function stripFrames(page, frames, at) {
  await sleep(30);
  await page.evaluate(() => {
    window.__strip = document.getAnimations();
    for (const a of window.__strip) a.pause();
  });
  for (const t of at) {
    await page.evaluate((t) => {
      for (const a of window.__strip ?? []) {
        try {
          a.currentTime = t;
        } catch {}
      }
    }, t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    frames.push(await page.screenshot());
  }
}

async function compose(ctx, frames, labels, path) {
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: frames.length * 210 + (frames.length + 1) * 14, height: 520 });
  await sheet.setContent(`
    <style>
      body { margin:0; background:#0f0d0b; font:11px/1 ui-monospace,monospace; color:#8a8272;
             display:flex; gap:14px; padding:14px; align-items:flex-start; }
      figure { margin:0; width:210px; }
      img { width:210px; display:block; border-radius:4px; }
      figcaption { padding-top:7px; letter-spacing:.12em; text-transform:uppercase; }
    </style>
    ${frames.map((f, i) => `<figure><img src="data:image/png;base64,${f.toString("base64")}"><figcaption>${labels[i]}${/\d$/.test(labels[i]) ? "ms" : ""}</figcaption></figure>`).join("")}
  `);
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path, fullPage: true });
  console.log(`strip ${path}`);
  await sheet.close();
}

await shootAll();
await browser.close();
if (TAG !== "before") console.log(`measured ${asserts - assertFails}/${asserts}`);
console.log(`done ${LOOK_TODAY} → ${OUT}`);
process.exit(assertFails ? 1 : 0);
