/**
 * The look loop's camera for the word sheet's answer (#428, Timothy, 7
 * Nov: "the try instead words are shittt ... look look"). It walks a live
 * recording whose transcript holds his two sentences, opens the results'
 * door to the transcript, and photographs the sheet for:
 *
 *   sheet-phrase        "things" in "I switch things up." (a phrase swap)
 *   sheet-phrase-saved  the same, its first row saved
 *   sheet-keep          "dollar" in the child labour sentence (keep)
 *   sheet-swap          "really" in "was really good." (an intensifier with its word)
 *   sheet-word          "thing" in "fix the thing with the login page" (one word)
 *   sheet-loading       the skeleton while the server reads
 *   sheet-offline       no connection: the labelled line and its retry
 *   strip-keep, strip-phrase   0 (still loading), 80, 160, 240 and 400ms
 *                       after the answer lands, laid side by side
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-try-instead.mjs after                    # docs/look/try-instead/
 *   LOOK_WIDTH=375 LOOK_HEIGHT=667 node scripts/look-try-instead.mjs after
 *   LOOK_API=v1 node scripts/look-try-instead.mjs before       # against the v1 build
 *
 * /api/words is answered here as the route would, after a beat: v2
 * bodies (swap or keep) by default, or with LOOK_API=v1 the v1 list the
 * live build got (the old bundle answered things, thing and really from
 * its curated map without asking, as Timothy saw).
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute as supabase, analyzeBody, json, session, seed, POSE_PREF, savedWordsMode } from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/try-instead/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const WIDTH = Number(process.env.LOOK_WIDTH ?? 390) || 390;
const HEIGHT = Number(process.env.LOOK_HEIGHT ?? 844) || 844;
const WSUFFIX = `${WIDTH === 390 ? "" : `-${WIDTH}`}${HEIGHT === 844 ? "" : `x${HEIGHT}`}`;
const V1 = process.env.LOOK_API === "v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

/* Timothy's two sentences, an intensifier and a plain vague word. */
const TRANSCRIPT =
  "I think today's the day I switch things up. You know, I love to contribute to the billion dollar corporations that pay one dollar per hour for child labor. The feedback on my talk was really good. We need to fix the thing with the login page before Friday.";
const WORDS = (() => {
  const raw = TRANSCRIPT.match(/[A-Za-z0-9']+/g);
  const spaced = TRANSCRIPT.split(/\s+/);
  let t = 0.4;
  return raw.map((word, i) => {
    const w = { word, start: Math.round(t * 100) / 100, end: Math.round((t + 0.3) * 100) / 100 };
    t += 0.38 + (/[.?!]/.test(spaced[i] ?? "") ? 0.9 : 0);
    return w;
  });
})();
const youAt = WORDS.findIndex((w, i) => w.word === "You" && WORDS[i + 1]?.word === "know");
const FILLERS = [{ word: "you know", t: WORDS[youAt].start }];
const analyze = {
  ...analyzeBody,
  transcript: TRANSCRIPT,
  words: WORDS,
  metrics: {
    ...analyzeBody.metrics,
    wordCount: WORDS.length,
    fillers: FILLERS,
    fillerCount: 1,
    fillersPerMin: 1,
    fillerCounts: { "you know": 1 },
    topFiller: "you know",
    substance: { ...analyzeBody.metrics.substance, wordCount: WORDS.length },
  },
};

/** What the v2 route answers, by the word tapped. */
const V2 = {
  things: { verdict: "swap", replaces: "switch things up", alternatives: ["shake things up", "try something new"], note: "" },
  dollar: { verdict: "keep", replaces: "dollar", alternatives: [], note: "A currency says it exactly." },
  really: { verdict: "swap", replaces: "really good", alternatives: ["glowing", "excellent"], note: "" },
  thing: { verdict: "swap", replaces: "thing", alternatives: ["problem", "bug", "glitch"], note: "" },
};
/** What the v1 route gave for a word its map did not hold (Timothy's second screenshot). */
const V1_LISTS = { dollar: ["buck", "cent", "penny", "pound", "euro", "quarter"] };

const api = { mode: "ok", release: null, offline: false };
async function wordsRoute(route) {
  // A route handler still answers while the context is offline: fail as the network would.
  if (api.offline) return route.abort("internetdisconnected");
  let body = null;
  try {
    body = route.request().postDataJSON();
  } catch {}
  if (api.mode === "slow") {
    await sleep(20000);
    return route.fulfill(json({ error: "The alternatives didn't load." }, 502)).catch(() => {});
  }
  if (api.mode === "hold") await new Promise((r) => (api.release = r));
  else await sleep(350);
  const word = String(body?.word ?? "").toLowerCase();
  if (V1) return route.fulfill(json({ alternatives: V1_LISTS[word] ?? ["moment", "turn", "point", "beat"], source: "model" }));
  const answer = V2[word] ?? { verdict: "swap", replaces: body?.word ?? word, alternatives: ["moment"], note: "" };
  return route.fulfill(json({ v: 2, ...answer, source: "model" })).catch(() => {});
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
    // Nothing kept on the phone from an earlier walk: every tap asks.
    try { localStorage.removeItem("ethos.words"); localStorage.removeItem("ethos.words.v2"); } catch {}
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) console.log("CONSOLE", m.text().slice(0, 200)); });

  const shot = async (name, opts = {}) => {
    if (!want(name)) return;
    await sleep(opts.settle ?? 700);
    await page.screenshot({ path: `${OUT}${name}${WSUFFIX}-${TAG}-${theme}.png` });
    console.log(`shot  ${name}${WSUFFIX}-${TAG}-${theme}`);
  };
  const step = async (fn) => { try { await fn(); } catch (e) { console.log("STEP-FAILED", theme, String(e.message ?? e).split("\n")[0]); } };

  // ---- Walk to the transcript, behind the results' door --------------------
  savedWordsMode.rows = [];
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
  await sleep(800);
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]');
  await sleep(2600);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main .arrive-x", { timeout: 30000 });
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
  await sleep(1200);
  await page.locator("main [data-glance-door]").click();
  await sleep(900);
  await page.waitForSelector(":is(main, [role=dialog]) h2.section-head:has-text('What you said')", { timeout: 10000 });
  await sleep(400);

  const sheetOpen = () => page.locator(".word-sheet");
  const open = async (selector, nth = 0) => {
    const word = page.locator(selector).nth(nth);
    if (!(await word.count())) return false;
    await word.scrollIntoViewIfNeeded();
    await word.click();
    await sheetOpen().waitFor({ timeout: 5000 });
    return true;
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    await sheetOpen().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    await sleep(250);
  };
  const forget = () => page.evaluate(() => { try { localStorage.removeItem("ethos.words.v2"); } catch {} });
  /* `act` replaces the plain shot (it takes its own); `after` runs once
     the shot is taken. */
  const sheet = (name, selector, { nth = 0, settle = 1000, before, act, after } = {}) =>
    step(async () => {
      if (!want(name)) return;
      if (before) await before();
      if (!(await open(selector, nth))) return console.log("NO-WORD", name, selector);
      if (act) await act();
      else await shot(name, { settle });
      if (after) await after();
      api.mode = "ok";
      await close();
    });

  await sheet("sheet-phrase", '.tw[data-word-key="things"]');
  await sheet("sheet-phrase-saved", '.tw[data-word-key="things"]', {
    before: forget,
    act: async () => {
      await sleep(900);
      await page.locator('.word-sheet button:has-text("Save")').first().click();
      await shot("sheet-phrase-saved", { settle: 900 });
    },
  });
  await sheet("sheet-keep", '.tw[data-word-key="dollar"]');
  await sheet("sheet-swap", '.tw[data-word-key="really"]');
  await sheet("sheet-word", '.tw[data-word-key="thing"]');
  await sheet("sheet-loading", '.tw[data-word-key="corporations"]', { before: () => (api.mode = "slow"), settle: 700 }); // past the skeleton's wait (#434)

  // ---- The answer landing, as a strip --------------------------------------
  const strip = (name, selector, nth = 0) =>
    step(async () => {
      if (!want(name) || V1) return;
      await forget();
      api.mode = "hold";
      if (!(await open(selector, nth))) return console.log("NO-WORD", name, selector);
      await sleep(900); // the sheet has risen; the answer is held
      const frames = [await page.screenshot()];
      const released = await page.evaluate(() => document.timeline.currentTime);
      api.release?.();
      // The answer lands: pause what started with it and seek it.
      await page.waitForFunction(() => !document.querySelector('.word-sheet [aria-busy="true"]'), null, { timeout: 5000 });
      await page.evaluate((from) => {
        window.__landing = document.getAnimations().filter((a) => (a.startTime ?? Infinity) >= from - 4);
        for (const a of window.__landing) a.pause();
      }, released);
      for (const at of [80, 160, 240, 400]) {
        await page.evaluate((t) => {
          for (const a of window.__landing ?? []) {
            try { a.currentTime = t; } catch {}
          }
        }, at);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        frames.push(await page.screenshot());
      }
      await page.evaluate(() => { for (const a of window.__landing ?? []) { try { a.play(); } catch {} } });
      api.mode = "ok";
      await close();
      const sheetPage = await context.newPage();
      const w = 200;
      await sheetPage.setViewportSize({ width: 5 * w + 6 * 14, height: Math.round((w * HEIGHT) / WIDTH) + 60 });
      await sheetPage.setContent(`
        <style>
          body { margin:0; background:#0f0d0b; font:11px/1 ui-monospace,monospace; color:#8a8272;
                 display:flex; gap:14px; padding:14px; align-items:flex-start; }
          figure { margin:0; width:${w}px; }
          img { width:${w}px; display:block; border-radius:4px; }
          figcaption { padding-top:7px; letter-spacing:.12em; text-transform:uppercase; }
        </style>
        ${["0 (held)", "80ms", "160ms", "240ms", "400ms"].map((label, i) => `<figure><img src="data:image/png;base64,${frames[i].toString("base64")}"><figcaption>${label}</figcaption></figure>`).join("")}
      `);
      await sheetPage.waitForTimeout(300);
      await sheetPage.screenshot({ path: `${OUT}${name}${WSUFFIX}-${TAG}-${theme}.png`, fullPage: true });
      await sheetPage.close();
      console.log(`strip ${name}${WSUFFIX}-${TAG}-${theme}`);
    });
  await strip("strip-keep", '.tw[data-word-key="dollar"]', 1);
  await strip("strip-phrase", '.tw[data-word-key="things"]');

  // ---- Offline last: the connection comes back only for the next walk -------
  await sheet("sheet-offline", '.tw[data-word-key="contribute"]', {
    before: async () => { api.offline = true; await context.setOffline(true); },
    after: async () => { api.offline = false; await context.setOffline(false); },
  });

  await context.close();
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
