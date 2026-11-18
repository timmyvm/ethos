/**
 * The look loop's camera for Say it better (DECISIONS #507): You's first
 * card, the page, a row's sheet and its Undo, the spoken test walked
 * through every state, the glance's proof token (#509) and the results sheet's
 * door. Fixture data is look-fixtures.mjs `sayMode` (a few swaps in each
 * state, three due, one used in a later recording, one the live take
 * says); the Whisper check (/api/say) is stubbed here.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 4031
 *   PLAYWRIGHT_MODULE=… LOOK_BASE=http://localhost:4031 node scripts/look-say-it-better.mjs [state…]
 *
 * States: you you-dry you-new page page-dry page-new page-fallback sheet
 * undo walk after-test unheard blocked offline glance glance-ask words
 * (glance-ask: the day's first take on a phone never asked for reminders,
 * the ask in the cue's slot with its own words). Shots go to
 * docs/look/say-it-better/after/<state>-<beat>-<w>x<h>-<theme>.png
 * (LOOK_OUT to move them), at 390x844 and 320x568 in both themes
 * (SIZES=390 for one), deviceScaleFactor 2. A JSON report of what each
 * screen held is printed last.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import {
  SAY_SAVED,
  analyzeBody,
  json,
  POSE_PREF,
  sayMode,
  savedWordsMode,
  seed,
  session,
  supabaseRoute,
} from "./look-fixtures.mjs";

const ALL = ["you", "you-dry", "you-new", "page", "page-dry", "page-new", "page-fallback", "sheet", "undo", "walk", "after-test", "unheard", "blocked", "offline", "glance", "glance-ask", "words"];
const STATES = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const BASE = process.env.LOOK_BASE ?? "http://localhost:4031";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/say-it-better/after/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const SIZES = (process.env.SIZES ?? "390,320").split(",").map((w) => (w === "320" ? [320, 568] : [390, 844]));
const THEMES = (process.env.THEMES ?? "light,dark").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

/** What /api/say answers next: the stub for Whisper's check. */
const whisper = { next: "said" };
const ANSWERS = {
  said: { heard: true, at: 0.6, old: false, text: "It's for example when you plan a week nobody could actually do." },
  missed: { heard: false, at: null, old: true, text: "I was doing stuff for the trip all week." },
  unheard: { heard: false, at: null, old: false, text: "" },
};

function reset(state) {
  sayMode.on = true;
  sayMode.dry = state.endsWith("-dry");
  sayMode.empty = state.endsWith("-new");
  sayMode.table = state === "page-fallback" ? "missing" : "ok";
  sayMode.written = [];
  savedWordsMode.rows = sayMode.empty ? [] : SAY_SAVED.map((r) => ({ ...r }));
  savedWordsMode.fail = false;
  whisper.next = "said";
}

async function open(state, [w, h], theme, init) {
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/analyze", async (route) => {
    await sleep(500);
    await route.fulfill(json(analyzeBody));
  });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/audio**", (route) => route.fulfill(json({ error: "Not here." }, 404)));
  await context.route("**/api/say", async (route) => {
    await sleep(500);
    await route.fulfill(json(ANSWERS[whisper.next]));
  });
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", state, theme, e.message.slice(0, 200)));
  return { context, page };
}

const report = {};
const note = (key, value) => {
  report[key] = value;
};

async function shoot(page, state, beat, [w, h], theme, opts = {}) {
  await sleep(opts.settle ?? 700);
  const file = `${OUT}${state}${beat ? `-${beat}` : ""}-${w}x${h}-${theme}.png`;
  await page.screenshot({ path: file, fullPage: !!opts.full });
  console.log("shot", file.split("/").pop());
}

async function run(state, size, theme) {
  reset(state);
  const tag = `${state}-${size[0]}-${theme}`;
  if (state.startsWith("you")) {
    const { context, page } = await open(state, size, theme);
    await page.goto(`${BASE}/you`);
    await page.waitForSelector("[data-look='say-card'] .arrive", { timeout: 30000 });
    await shoot(page, state, "", size, theme, { settle: 1200 });
    if (state === "you") await shoot(page, state, "full", size, theme, { full: true });
    note(tag, await page.evaluate(() => {
      const card = document.querySelector("[data-look='say-card']");
      const first = document.querySelector("main section");
      return {
        firstCard: first?.getAttribute("data-look"),
        text: card?.textContent?.replace(/\s+/g, " ").trim(),
        elev2: document.querySelectorAll("main .elev-2").length,
        lexicon: /lexicon/i.test(document.body.innerText),
      };
    }));
    await context.close();
    return;
  }
  if (state.startsWith("page")) {
    const { context, page } = await open(state, size, theme);
    await page.goto(`${BASE}/say`);
    await page.waitForSelector("main h1:has-text('Say it better')", { timeout: 30000 });
    await page.waitForSelector(sayMode.empty ? "main .arrive" : "[data-say-count]", { timeout: 20000 });
    await shoot(page, state, "", size, theme, { settle: 1200 });
    if (state === "page") await shoot(page, state, "full", size, theme, { full: true });
    note(tag, await page.evaluate(() => ({
      count: document.querySelector("[data-say-count]")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      lists: [...document.querySelectorAll("[data-say-list]")].map((s) => ({
        list: s.getAttribute("data-say-list"),
        rows: [...s.querySelectorAll("li")].map((li) => li.textContent?.replace(/\s+/g, " ").trim()),
      })),
      tap: document.querySelector("main a.tap, main [data-say-test]")?.textContent?.trim() ?? null,
      dry: document.querySelector("[data-say-dry]")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      local: (() => {
        try {
          return Object.keys(JSON.parse(localStorage.getItem("ethos.say.v1") ?? "{}").states ?? {}).length;
        } catch {
          return null;
        }
      })(),
      lexicon: /lexicon/i.test(document.body.innerText),
    })));
    await context.close();
    return;
  }
  if (state === "sheet" || state === "undo") {
    const { context, page } = await open(state, size, theme);
    await page.goto(`${BASE}/say`);
    await page.waitForSelector("[data-say-list='now'] button", { timeout: 30000 });
    await sleep(800);
    if (state === "sheet") {
      await page.locator("[data-say-list='now'] button").first().click();
      await page.waitForSelector("[data-say-sheet]", { timeout: 5000 });
      await shoot(page, state, "now", size, theme, { settle: 1400 });
      note(`${tag}-now`, await page.evaluate(() => ({
        text: document.querySelector("[data-say-sheet]")?.textContent?.replace(/\s+/g, " ").trim(),
        chips: document.querySelectorAll("[data-say-sheet] [data-say-chip]").length,
      })));
      await page.keyboard.press("Escape");
      await sleep(700);
      await page.locator("[data-say-list='learning'] button").first().click();
      await page.waitForSelector("[data-say-sheet]", { timeout: 5000 });
      await shoot(page, state, "learning", size, theme, { settle: 1200 });
    } else {
      await page.locator("[data-say-list='learning'] button").first().click();
      await page.waitForSelector("[data-say-remove]", { timeout: 5000 });
      await sleep(600);
      await page.locator("[data-say-remove]").click();
      await page.waitForSelector("[role='status']:has-text('removed')", { timeout: 5000 }).catch(() => {});
      await shoot(page, state, "toast", size, theme, { settle: 800 });
      const before = await page.locator("[data-say-list='learning'] li").count();
      await page.getByRole("button", { name: /^Undo/ }).click();
      await sleep(900);
      const after = await page.locator("[data-say-list='learning'] li").count();
      note(tag, { learningAfterRemove: before, learningAfterUndo: after, written: sayMode.written.length });
    }
    await context.close();
    return;
  }
  if (state === "walk") {
    const { context, page } = await open(state, size, theme);
    await page.goto(`${BASE}/say/test`);
    await page.waitForSelector("[data-say-sentence]", { timeout: 30000 });
    await shoot(page, state, "1-ask", size, theme, { settle: 1200 });
    const facts = { tabBar: await page.locator("nav[aria-label]").count() };
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[data-record="stop"]', { timeout: 8000 });
    await shoot(page, state, "2-recording", size, theme, { settle: 1300 });
    whisper.next = "said";
    await page.click('button[data-record="stop"]', { force: true });
    await page.waitForSelector("[data-say-result='said']", { timeout: 10000 });
    await shoot(page, state, "3-said", size, theme, { settle: 900 });
    await page.click("[data-say-next]");
    await page.waitForSelector('main[data-say-walk="ask"]', { timeout: 5000 });
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[data-record="stop"]', { timeout: 8000 });
    await sleep(900);
    whisper.next = "missed";
    await page.click('button[data-record="stop"]', { force: true });
    await page.waitForSelector("[data-say-result='missed']", { timeout: 10000 });
    await shoot(page, state, "4-missed", size, theme, { settle: 900 });
    await page.click("[data-say-next]");
    await page.waitForSelector('main[data-say-walk="ask"]', { timeout: 5000 });
    await page.getByRole("button", { name: "Show it instead" }).click();
    await page.waitForSelector("[data-say-result='shown']", { timeout: 5000 });
    await shoot(page, state, "5-shown", size, theme, { settle: 800 });
    await page.click("[data-say-next]");
    await page.waitForSelector("[data-say-end]", { timeout: 5000 });
    await shoot(page, state, "6-end", size, theme, { settle: 1600 });
    facts.end = await page.evaluate(() => document.querySelector("[data-say-end]")?.textContent?.replace(/\s+/g, " ").trim());
    facts.saved = await page.evaluate(() => {
      try {
        const s = JSON.parse(localStorage.getItem("ethos.say.v1") ?? "{}").states ?? {};
        return Object.values(s).map((v) => `${v.last}:${v.due}`);
      } catch {
        return null;
      }
    });
    facts.written = sayMode.written.length;
    note(tag, facts);
    await context.close();
    return;
  }
  if (state === "unheard" || state === "blocked" || state === "offline") {
    const init =
      state === "blocked"
        ? () => {
            navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
          }
        : undefined;
    const { context, page } = await open(state, size, theme, init);
    await page.goto(`${BASE}/say/test`);
    await page.waitForSelector("[data-say-sentence]", { timeout: 30000 });
    await sleep(600);
    if (state === "offline") await context.setOffline(true);
    await page.click('button[data-record="start"]', { force: true });
    if (state === "unheard") {
      await page.waitForSelector('button[data-record="stop"]', { timeout: 8000 });
      await sleep(900);
      whisper.next = "unheard";
      await page.click('button[data-record="stop"]', { force: true });
      await page.waitForSelector('main[data-say-walk="unheard"]', { timeout: 10000 });
    } else {
      await page.waitForSelector(`main[data-say-walk="${state}"]`, { timeout: 8000 });
    }
    await shoot(page, state, "", size, theme, { settle: 900 });
    if (state === "offline") await context.setOffline(false);
    await context.close();
    return;
  }
  if (state === "after-test") {
    /* The #507 review: today's three answered (each shown, the quickest
       walk), then the page and You's card. A fourth swap is overdue in
       the fixture; it waits for tomorrow, so neither offers a test again. */
    const { context, page } = await open(state, size, theme);
    await page.goto(`${BASE}/say/test`);
    for (let k = 0; k < 3; k++) {
      await page.waitForSelector('main[data-say-walk="ask"]', { timeout: 20000 });
      await page.locator("footer button:has-text('Show it instead'), main button:has-text('Show it instead')").last().click();
      await page.waitForSelector("[data-say-next]", { timeout: 8000 });
      await page.click("[data-say-next]");
    }
    await page.waitForSelector("main[data-say-end]", { timeout: 8000 });
    await page.click("main a.screen-bar-back");
    await page.waitForSelector("[data-say-count]", { timeout: 20000 });
    await shoot(page, state, "page", size, theme, { settle: 1200 });
    const onPage = await page.evaluate(() => ({
      test: !!document.querySelector("main [data-say-test]"),
      dry: document.querySelector("main [data-say-dry]")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    }));
    await page.goto(`${BASE}/you`);
    await page.waitForSelector("[data-look='say-card'] .arrive", { timeout: 30000 });
    await shoot(page, state, "you", size, theme, { settle: 1200 });
    const onYou = await page.evaluate(() => ({
      test: !!document.querySelector("[data-look='say-card'] [data-say-test]"),
      text: document.querySelector("[data-look='say-card']")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    }));
    note(tag, { onPage, onYou });
    await context.close();
    return;
  }
  if (state === "glance" || state === "glance-ask") {
    const { context, page } = await open(state, size, theme);
    /* Headless Chromium answers "denied" for notifications whatever it is
       granted, so the shot drew the blocked line in Demos's bubble, a state
       no phone that was never asked is in (the final pass of 18 Nov). As
       look-glance.mjs does: "glance" is a day whose reminder ask has had
       its showing; "glance-ask" the day's first take on a phone never
       asked, the ask in the cue's slot. */
    if (state === "glance") {
      await context.addInitScript(() => {
        const d = new Date();
        localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      });
    } else {
      await context.addInitScript(() => {
        if (typeof Notification === "undefined") return;
        Object.defineProperty(Notification, "permission", { get: () => "default" });
        Notification.requestPermission = () => Promise.resolve("default");
      });
    }
    await page.goto(`${BASE}/rep?lesson=h4`);
    await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
    await sleep(1500);
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(2600);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("main [data-glance]", { timeout: 30000 });
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
    await shoot(page, state, "", size, theme, { settle: 3400 });
    note(tag, await page.evaluate(() => ({
      proof: document.querySelector("main [data-say-token]")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      earned: document.querySelector("[data-earned]")?.textContent?.trim() ?? null,
      cue: document.querySelector("[data-glance-cue]")?.textContent?.trim() ?? null,
      ask: document.querySelector("main [data-reminder-ask]")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    })));
    await page.locator("main [data-glance-door]").click();
    await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 5000 });
    await sleep(900);
    const door = page.locator("[role='dialog'] [data-say-door]");
    if (await door.count()) {
      await door.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelector("[role='dialog'] [data-say-door]")?.scrollIntoView({ block: "center" }));
    }
    await shoot(page, state, "sheet-door", size, theme, { settle: 900 });
    report[`${tag}-door`] = await door.count();
    await context.close();
    return;
  }
  if (state === "words") {
    const { context, page } = await open(state, size, theme);
    await page.goto(`${BASE}/words?from=%2Frep%2Frep-22`);
    await page.waitForURL(/\/say/, { timeout: 15000 });
    await page.waitForSelector("[data-say-count]", { timeout: 20000 });
    note(tag, { url: page.url().replace(BASE, ""), back: await page.locator("main a.screen-bar-back").first().textContent() });
    await context.close();
  }
}

for (const state of STATES) {
  for (const size of state === "words" || state === "page-fallback" ? [SIZES[0]] : SIZES) {
    for (const theme of state === "words" || state === "page-fallback" ? ["light"] : THEMES) {
      try {
        await run(state, size, theme);
      } catch (e) {
        console.log("FAILED", state, size[0], theme, e.message.split("\n")[0]);
        report[`${state}-${size[0]}-${theme}`] = { failed: e.message.split("\n")[0] };
      }
    }
  }
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
