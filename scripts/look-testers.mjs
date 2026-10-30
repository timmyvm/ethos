/**
 * The look loop's camera for TESTER MODE (migration 0020, docs/testers.md):
 * every screen a tester meets and the ones a non-tester must meet
 * unchanged, against the mocked Supabase of scripts/look-fixtures.mjs.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-testers.mjs after                 # docs/look/testers/
 *   node scripts/look-testers.mjs after consent results  # a subset
 *   LOOK_WIDTH=320 node scripts/look-testers.mjs after consent results results-no
 *
 * Scenes: welcome (the introduction's first screen, with the door),
 * code (empty), code-wrong, code-right (four digits in, Continue lit),
 * consent, joined, settings (a non-tester's row), settings-tester,
 * tester-page (Settings' door for a tester), results (a tester's match
 * check, unanswered), results-yes, results-no (No, the note open and
 * typed), results-fail (the answer refused, its retry), results-plain
 * (a non-tester's results: nothing new), log (a stored recording's page,
 * the answer reopened), privacy (the Testers section). The question is on
 * the results' last step, so the results scenes walk there first.
 * /api/tester is answered here as the route would: 1234 right, anything
 * else wrong.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  json,
  session,
  testerMode,
  seed,
  POSE_PREF,
} from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/testers/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const WIDTH = Number(process.env.LOOK_WIDTH ?? 390) || 390;
/* LOOK_HEIGHT: a short phone (667 an iPhone SE, 568 the 320 one, 664 a
   390 in Safari with its bars showing), where the shelves matter. */
const HEIGHT = Number(process.env.LOOK_HEIGHT ?? 844) || 844;
const WSUFFIX = `${WIDTH === 390 ? "" : `-${WIDTH}`}${HEIGHT === 844 ? "" : `x${HEIGHT}`}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function context(theme, { returning = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester", async (route) => {
    await sleep(350);
    const body = route.request().postDataJSON() ?? {};
    if (body.code !== "1234") return route.fulfill(json({ error: "That code doesn't match. Check it and try again." }, 403));
    if (body.agree === undefined) return route.fulfill(json({ ok: true }));
    testerMode.tester = true;
    testerMode.consentVersion = body.agree;
    return route.fulfill(json({ ok: true, tester: { consent_version: body.agree, consented_at: new Date().toISOString() } }));
  });
  // A real account id (the fixture's is "u1"), so the tester number has
  // something to show once a fresh phone's anonymous session is minted.
  await ctx.route("http://supabase.local/auth/v1/signup**", (route) =>
    route.fulfill(json({ ...session, user: { ...session.user, id: "3f9a1c2e-0d4a-4c1e-9a77-3b2f5e8d1c40", is_anonymous: true, email: null } })));
  if (returning) await ctx.addInitScript(seed, { theme, session, pose: POSE_PREF });
  else
    await ctx.addInitScript((t) => {
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme: t, reducedMotion: false, haptics: false }));
    }, theme);
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = 'nextjs-portal{display:none!important} body{position:relative} nav[aria-label="Sections"]{position:absolute!important}';
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/CERT_AUTHORITY/.test(m.text())) console.log("CONSOLE", page.url(), m.text().slice(0, 200)); });
  return { ctx, page };
}

async function shootTheme(theme) {
  const shot = async (page, name, { fullPage = true, settle = 700 } = {}) => {
    await page.mouse.move(0, 0).catch(() => {});
    await sleep(settle);
    await page.screenshot({ path: `${OUT}${name}${WSUFFIX}-${TAG}-${theme}.png`, fullPage });
    console.log(`shot  ${name}${WSUFFIX}-${TAG}-${theme}`);
  };
  const step = async (names, fn) => {
    if (!names.some(want)) return;
    try { await fn(); } catch (e) { console.log("STEP-FAILED", theme, names[0], String(e.message ?? e).split("\n").slice(0, 6).join(" / ")); }
  };

  // The introduction's first screen: the door is quiet, top right.
  await step(["welcome"], async () => {
    testerMode.tester = false;
    const { ctx, page } = await context(theme, { returning: false });
    await page.goto(`${BASE}/welcome`);
    await page.waitForSelector("main h1");
    await shot(page, "welcome", { fullPage: false, settle: 1400 });
    await ctx.close();
  });

  // The walk in from the introduction: code, consent, joined.
  await step(["code", "code-wrong", "code-right", "consent", "joined"], async () => {
    testerMode.tester = false;
    const { ctx, page } = await context(theme, { returning: false });
    await page.goto(`${BASE}/welcome`);
    await page.waitForSelector("main h1");
    const door = page.getByRole("link", { name: "Tester code", exact: true });
    await sleep(1200);
    if (await door.count()) await door.click();
    else await page.goto(`${BASE}/tester?from=welcome`);
    const field = page.getByLabel("Tester code");
    await field.waitFor({ timeout: 15000 });
    if (want("code")) await shot(page, "code", { fullPage: false });
    await field.fill("1111");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("That code doesn't match.").waitFor({ timeout: 5000 }).catch(() => {});
    if (want("code-wrong")) await shot(page, "code-wrong", { fullPage: false, settle: 400 });
    await field.fill("1234");
    if (want("code-right")) await shot(page, "code-right", { fullPage: false, settle: 300 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "I agree" }).waitFor({ timeout: 8000 });
    if (want("consent")) await shot(page, "consent", { fullPage: false, settle: 900 });
    await page.getByRole("button", { name: "I agree" }).click();
    await page.getByText("You're testing Ethos").first().waitFor({ timeout: 8000 });
    if (want("joined")) await shot(page, "joined", { fullPage: false, settle: 1500 });
    await ctx.close();
  });

  // Settings, as a non-tester and as a tester, and the tester's door.
  for (const [name, isTester] of [["settings", false], ["settings-tester", true], ["tester-page", true]]) {
    await step([name], async () => {
      testerMode.tester = isTester;
      const { ctx, page } = await context(theme);
      await page.goto(`${BASE}/settings`);
      await page.waitForSelector("main .inset-group");
      await sleep(900);
      if (name === "tester-page") {
        await page.getByRole("link", { name: /Testing Ethos/ }).click();
        await page.getByText("You're testing Ethos").first().waitFor({ timeout: 8000 });
        await shot(page, name, { settle: 900 });
      } else {
        await shot(page, name, { settle: 400 });
      }
      await ctx.close();
    });
  }

  // Results: record a take on the floor, stop, wait out the celebration.
  const results = async (page) => {
    await page.goto(`${BASE}/rep?lesson=h4`);
    await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 20000 });
    await page.click('button[aria-label="Start recording"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(2500);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("main .arrive-x", { timeout: 15000 });
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
    await sleep(3200);
  };
  /* The question is asked on the last step, after the numbers: walk
     there with the step's own tap. */
  const toQuestion = async (page) => {
    for (let i = 0; i < 3; i++) {
      if (await page.getByText("Did this score match how it felt?").count()) return;
      const next = page.locator("[data-step-action]").first();
      if (!(await next.count()) || !/numbers|words/i.test(await next.innerText())) return;
      await next.click();
      await sleep(900);
    }
  };
  const scenes = [
    ["results", { tester: true }],
    ["results-yes", { tester: true, pick: "Yes" }],
    ["results-no", { tester: true, pick: "No", note: "Felt slower than 145 a minute." }],
    ["results-fail", { tester: true, pick: "Roughly", feedback: "fail" }],
    ["results-plain", { tester: false }],
  ];
  for (const [name, o] of scenes) {
    await step([name], async () => {
      testerMode.tester = o.tester;
      testerMode.feedback = o.feedback ?? "ok";
      testerMode.answers.length = 0;
      const { ctx, page } = await context(theme);
      await results(page);
      if (o.tester) await toQuestion(page);
      if (o.pick) {
        await page.getByRole("radio", { name: o.pick, exact: true }).click();
        await sleep(500);
      }
      if (o.note) {
        await page.getByLabel("What felt off?").fill(o.note);
      }
      await shot(page, name, { settle: 600, fullPage: false });
      if (testerMode.answers.length) console.log("  sent", JSON.stringify(testerMode.answers.at(-1)).slice(0, 240));
      testerMode.feedback = "ok";
      await ctx.close();
    });
  }

  // The Log: a stored recording's page asks too, and an answer given
  // there reopens as it was left.
  await step(["log"], async () => {
    testerMode.tester = true;
    testerMode.feedback = "ok";
    testerMode.stored = {};
    const { ctx, page } = await context(theme);
    await page.goto(`${BASE}/rep/rep-3`);
    const q = page.getByText("Did this score match how it felt?");
    await q.waitFor({ timeout: 20000 });
    await page.getByRole("radio", { name: "Roughly", exact: true }).click();
    await page.getByLabel("What felt off?").fill("The pauses felt longer than that.");
    await page.getByRole("button", { name: "Save note" }).click();
    await sleep(600);
    await page.reload();
    await q.waitFor({ timeout: 20000 });
    await sleep(1200);
    await q.scrollIntoViewIfNeeded();
    await shot(page, "log", { fullPage: false, settle: 500 });
    await ctx.close();
  });

  // Privacy's Testers section, cut from the page.
  await step(["privacy"], async () => {
    const { ctx, page } = await context(theme, { returning: false });
    await page.goto(`${BASE}/privacy`);
    await page.waitForSelector("main h1");
    await sleep(700);
    const section = page.locator("#testers");
    if (await section.count()) {
      // Page coordinates: a full-page clip is measured from the document's top.
      const top = await section.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      const height = await section.evaluate((el) => el.getBoundingClientRect().height);
      const clip = { x: 0, y: Math.max(0, top - 24), width: WIDTH, height: Math.min(844, height + 48) };
      await page.screenshot({ path: `${OUT}privacy${WSUFFIX}-${TAG}-${theme}.png`, clip, fullPage: true });
      console.log(`shot  privacy${WSUFFIX}-${TAG}-${theme}`);
    } else {
      await shot(page, "privacy", { settle: 300 });
    }
    await ctx.close();
  });
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
