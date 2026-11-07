/**
 * The look loop's camera for the interactive transcript and Your words
 * (#411): the results walk's words step, the word sheet on a filler, a
 * vague word and an ordinary word (with its loading and failed states),
 * and /words empty, loading, failed and with rows.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-words.mjs after                       # docs/look/words/
 *   LOOK_WIDTH=320 LOOK_HEIGHT=568 node scripts/look-words.mjs after
 *   node scripts/look-words.mjs after step sheet-filler     # a subset
 *
 * Scenes: step (the words step, full page), step-top (its first
 * screen), sheet-filler, sheet-vague, sheet-repeat, sheet-word,
 * sheet-word-loading, sheet-word-failed, sheet-saved (a swap saved,
 * the door to Your words), words-empty, words-loading, words-failed,
 * words (five rows), stored and stored-sheet (a Log recording's transcript and a word's sheet), you-door (You's lexicon and the door under it). /api/words is answered here as the route would,
 * with a beat; `wordsApi.mode` holds it ("slow") or refuses it ("fail").
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  json,
  session,
  seed,
  POSE_PREF,
  SAVED_ROWS,
  savedWordsMode,
} from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/words/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const WIDTH = Number(process.env.LOOK_WIDTH ?? 390) || 390;
const HEIGHT = Number(process.env.LOOK_HEIGHT ?? 844) || 844;
const WSUFFIX = `${WIDTH === 390 ? "" : `-${WIDTH}`}${HEIGHT === 844 ? "" : `x${HEIGHT}`}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

/** What /api/words answers: a list that fits most words, after a beat. */
const wordsApi = { mode: "ok", asked: [] };
const ALTERNATIVES = {
  compound: ["build on themselves", "snowball", "add up", "multiply"],
  discipline: ["willpower", "self-control", "routine", "rigour"],
};
async function wordsRoute(route) {
  let body = null;
  try {
    body = route.request().postDataJSON();
  } catch {}
  wordsApi.asked.push(body);
  if (wordsApi.mode === "slow") {
    await sleep(20000);
    return route.fulfill(json({ error: "The alternatives didn't load." }, 502)).catch(() => {});
  }
  await sleep(350);
  if (wordsApi.mode === "fail") return route.fulfill(json({ error: "The alternatives didn't load." }, 502));
  const word = String(body?.word ?? "").toLowerCase();
  return route.fulfill(json({ alternatives: ALTERNATIVES[word] ?? ["moment", "turn", "point", "beat"], source: "model" }));
}

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await context.route("**/api/words", wordsRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    // The phone's copy of past answers starts empty, so every shot asks.
    try { localStorage.removeItem("ethos.words"); } catch {}
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) console.log("CONSOLE", m.text().slice(0, 200)); });

  const shot = async (name, opts = {}) => {
    if (!want(name)) return;
    await sleep(opts.settle ?? 700);
    await page.screenshot({ path: `${OUT}${name}${WSUFFIX}-${TAG}-${theme}.png`, fullPage: opts.fullPage ?? false });
    console.log(`shot  ${name}${WSUFFIX}-${TAG}-${theme}`);
  };
  const step = async (fn) => { try { await fn(); } catch (e) { console.log("STEP-FAILED", theme, String(e.message ?? e).split("\n")[0]); } };

  // ---- The words step, walked to from a live recording --------------------
  const sheets = ["rise", "sheet-filler", "sheet-vague", "sheet-repeat", "sheet-word", "sheet-word-loading", "sheet-word-failed", "sheet-saved"];
  if (["step", "step-top", ...sheets].some(want)) {
    await step(async () => {
      savedWordsMode.rows = [];
      await page.goto(`${BASE}/rep?lesson=h4`);
      await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 20000 });
      await sleep(800);
      await page.click('button[aria-label="Start recording"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]');
      await sleep(2600);
      await page.click('button[aria-label="Stop and score this recording"]', { force: true });
      await page.waitForSelector("main .arrive-x", { timeout: 20000 });
      await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
      await sleep(1200);
      /* #427: the transcript is in the glance's door, "The whole recording". */
      await page.locator("main [data-glance-door]").click();
      await sleep(900);
      await page.waitForSelector(":is(main, [role=dialog]) h2.section-head:has-text('What you said')", { timeout: 8000 });
      await sleep(500);
      await shot("step", { fullPage: true });
      // The transcript in view, as a thumb meets it.
      await page.evaluate(() => {
        const head = [...document.querySelectorAll(":is(main, [role=dialog]) h2.section-head")].find((h) => /What you said/.test(h.textContent ?? ""));
        head?.scrollIntoView({ block: "start" });
        (document.querySelector("[data-sheet-scroll]") ?? window).scrollBy(0, -16);
      });
      await shot("step-top");
    });

    const open = async (selector) => {
      const word = page.locator(selector).first();
      if (!(await word.count())) return false;
      await word.scrollIntoViewIfNeeded();
      await word.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      return true;
    };
    const close = async () => {
      await page.keyboard.press("Escape");
      await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 5000 }).catch(() => {});
      await sleep(200);
    };
    const sheet = async (name, selector, before) =>
      step(async () => {
        if (!want(name)) return;
        if (before) before();
        if (!(await open(selector))) return console.log("NO-WORD", name, selector);
        await shot(name, { settle: name.endsWith("loading") ? 250 : 900 });
        wordsApi.mode = "ok";
        await close();
      });
    // The rise, as a strip: 0 (before the tap), 80, 160, 240 and 400ms after it.
    await step(async () => {
      if (!want("rise")) return;
      const word = page.locator('[data-word-key="compound"]').first();
      await word.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}rise-0${WSUFFIX}-${TAG}-${theme}.png` });
      const t0 = Date.now();
      await word.click();
      for (const at of [80, 160, 240, 400]) {
        await sleep(Math.max(0, at - (Date.now() - t0)));
        await page.screenshot({ path: `${OUT}rise-${at}${WSUFFIX}-${TAG}-${theme}.png` });
      }
      console.log(`shot  rise${WSUFFIX}-${TAG}-${theme} (5 frames)`);
      await close();
    });
    await sheet("sheet-filler", '.tw[data-word-mark="filler"]');
    await sheet("sheet-vague", '.tw[data-word-mark="vague"]');
    await sheet("sheet-repeat", '.tw[data-word-mark="repeat"]');
    await sheet("sheet-word", '[data-word-key="compound"]');
    await sheet("sheet-word-loading", '[data-word-key="discipline"]', () => (wordsApi.mode = "slow"));
    await sheet("sheet-word-failed", '[data-word-key="mistake"]', () => (wordsApi.mode = "fail"));
    await step(async () => {
      if (!want("sheet-saved")) return;
      if (!(await open('[data-word-key="thing"]'))) return console.log("NO-WORD sheet-saved");
      await page.locator('[role="dialog"] button:has-text("Save")').first().click();
      await shot("sheet-saved", { settle: 900 });
      await close();
    });
  }

  // ---- Your words ------------------------------------------------------------
  const words = async (name, rows, mode = {}) =>
    step(async () => {
      if (!want(name)) return;
      savedWordsMode.rows = rows.map((r) => ({ ...r }));
      savedWordsMode.fail = !!mode.fail;
      savedWordsMode.delay = mode.delay ?? 0;
      await page.goto(`${BASE}/words`);
      await page.waitForSelector("main h1", { timeout: 20000 }).catch(() => console.log("WAIT-TIMEOUT /words"));
      if (!mode.delay) {
        await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
      }
      await shot(name, { settle: mode.delay ? 300 : 900, fullPage: !mode.delay });
      savedWordsMode.fail = false;
      savedWordsMode.delay = 0;
    });
  await words("words-empty", []);
  await words("words-loading", SAVED_ROWS, { delay: 6000 });
  await words("words-failed", SAVED_ROWS, { fail: true });
  await words("words", SAVED_ROWS);

  // A stored recording from the Log (no word list in the fixture: the
  // text alone, its fillers timed from the stored list).
  await step(async () => {
    if (!want("stored") && !want("stored-sheet")) return;
    await page.goto(`${BASE}/rep/rep-22`);
    await page.waitForSelector("main h2.section-head:has-text('What you said')", { timeout: 20000 });
    await page.evaluate(() => {
      const head = [...document.querySelectorAll("main h2.section-head")].find((h) => /What you said/.test(h.textContent ?? ""));
      head?.scrollIntoView({ block: "start" });
      window.scrollBy(0, -16);
    });
    await shot("stored");
    if (!want("stored-sheet")) return;
    const word = page.locator('.tw[data-word-key="discipline"]').first();
    await word.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await shot("stored-sheet", { settle: 900 });
    await page.keyboard.press("Escape");
  });

  // You's door to it, beside the lexicon.
  await step(async () => {
    if (!want("you-door")) return;
    await page.goto(`${BASE}/you`);
    await page.waitForSelector("main h2.section-head:has-text('Your lexicon')", { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
    await page.evaluate(() => {
      const head = [...document.querySelectorAll("main h2.section-head")].find((h) => /Your lexicon/.test(h.textContent ?? ""));
      head?.scrollIntoView({ block: "start" });
      window.scrollBy(0, -80);
    });
    await shot("you-door");
  });

  await context.close();
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
