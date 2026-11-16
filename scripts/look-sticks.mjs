/**
 * Feedback that sticks (DECISIONS #477), photographed: the one cue a take
 * ends on, the warm-up on it before the next day's take, and the next
 * day's answer.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3841
 *   LOOK_BASE=http://localhost:3841 node scripts/look-sticks.mjs after ready glance answer kept
 *
 * Scenes:
 *   ready   Today's Start on a day not yet spoken: the ready recorder. With
 *           a cue carried from yesterday, its warm-up stands before Record.
 *   glance  a take's results with no cue carried yet: the result's end, the
 *           cue it sets.
 *   answer  yesterday's cue ("um" 5 times) answered by today's take, which
 *           says it twice: it held, and a new cue is set.
 *   kept    yesterday's cue ("um" twice) answered by a take that says it
 *           twice again: it did not hold, and it is carried.
 *   ready-pace  the warm-up on a pace cue, with its fixed sentence.
 *   skip    the warm-up's Skip, before and after the tap (LOOK_STRIP=1: as a
 *           strip, 0 to 400ms).
 *   pre0033 a database before migration 0033: the column answers 42703 and
 *           PGRST204, and yesterday's cue is answered from this phone's copy.
 *
 * Sizes: LOOK_SIZES, default 390x844-light,390x844-dark,375x667-light,320x568-light.
 * Shots: LOOK_OUT, default docs/look/sticks/, as <tag>-<scene>-<size>.png.
 * Prints each glance's visible words, filled taps and whether it scrolls,
 * and fails a glance over 25 words, with more than one filled tap, or that
 * scrolls.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "/opt/node-tools/node_modules/playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const SCENES = process.argv.slice(3).length ? process.argv.slice(3) : ["ready", "glance", "answer", "kept"];
const BASE = process.env.LOOK_BASE ?? "http://localhost:3841";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/sticks/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light,320x568-light").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};

/** Melbourne's yesterday, as lib/carried-cue.ts keys a day. */
const dayKey = (ago) => {
  const d = new Date(Date.now() - ago * 86_400_000);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
};

/*
 * The cue each scene finds carried (lib/carried-cue.ts CarriedCue), given
 * yesterday. "answer": "um" five times then, so today's two hold it.
 * "kept": twice then, so today's two do not.
 */
const LINE = { text: "So the thing about habits is ‖ they compound.", at: 2.68 };
const cueOf = (from) => ({
  v: 1,
  cue: { kind: "filler", word: "um", from, last: from, givenOn: dayKey(1), answeredOn: null, tries: 0, line: LINE },
  aside: [],
  at: new Date(Date.now() - 86_400_000).toISOString(),
});
const CUES = { answer: cueOf(5), kept: cueOf(2) };
CUES.ready = CUES.answer;
CUES.skip = CUES.answer;
/* A cue with no sentence of the take's own: the fixed one, for pace. */
CUES["ready-pace"] = { ...cueOf(178), cue: { ...cueOf(178).cue, kind: "fast", word: null, line: null } };

/** The glance's counts: visible words in main (sr-only and hidden left out), filled taps, scroll. */
const MEASURE = () => {
  const hidden = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (e.matches?.('nav[aria-label="Sections"], nextjs-portal, .sr-only, [hidden]')) return true;
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return true;
    }
    return false;
  };
  const main = document.querySelector("main");
  let text = "";
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const t = (n.nodeValue ?? "").trim();
    if (!t || hidden(n.parentElement)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const b = r.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    text += ` ${t}`;
  }
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !hidden(el);
  };
  return {
    text: text.replace(/\s+/g, " ").trim(),
    words: text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length,
    taps: [...main.querySelectorAll(".tap, .tap-tonal")].filter(vis).length,
    scrolls: document.scrollingElement.scrollHeight > innerHeight + 1,
    cue: document.querySelector("main [data-glance-cue]")?.textContent ?? null,
    line: document.querySelector("main [data-glance-line]")?.textContent ?? null,
    /* The warm-up as drawn: a closed slot (Skip) keeps it in the page, unseen. */
    warmup: (() => {
      const el = document.querySelector("main [data-warmup]");
      return el && !el.closest('[data-open="false"]') && !hidden(el) ? el.innerText : null;
    })(),
    record: (() => {
      const r = document.querySelector('button[data-record="start"]')?.getBoundingClientRect();
      return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null;
    })(),
  };
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

for (const scene of SCENES) {
  for (const size of SIZES) {
    F.resetPlan("free");
    const at = `${scene} ${size.name}`;
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      permissions: ["microphone", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
      colorScheme: size.theme, serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", F.supabaseRoute);
    /* The account's carried cue (migration 0033), answered on the profile's
       read of that column; every other profile read as the fixtures do. */
    const cue = CUES[scene] ?? null;
    const written = [];
    /* pre0033: a database without the column. The read answers Postgres's
       42703 and the write PostgREST's PGRST204; the cue is this phone's copy. */
    const missing = scene === "pre0033";
    if (missing) {
      await context.addInitScript((state) => localStorage.setItem("ethos.cue", JSON.stringify({ uid: "u1", state })), CUES.answer);
    }
    await context.route("http://supabase.local/rest/v1/profiles**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const asksCue = (url.searchParams.get("select") ?? "").includes("carried_cue") || (req.postData() ?? "").includes("carried_cue");
      if (missing && asksCue) {
        return route.fulfill(
          req.method() === "GET"
            ? F.json({ code: "42703", message: "column profiles.carried_cue does not exist" }, 400)
            : F.json({ code: "PGRST204", message: "Could not find the 'carried_cue' column of 'profiles' in the schema cache" }, 400)
        );
      }
      if (req.method() === "GET" && (url.searchParams.get("select") ?? "").includes("carried_cue")) {
        const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
        const row = { carried_cue: cue };
        return route.fulfill(F.json(single ? row : [row]));
      }
      if (req.method() !== "GET") {
        try {
          const body = req.postDataJSON();
          if (body && "carried_cue" in body) written.push(body.carried_cue);
        } catch {}
      }
      return route.fallback();
    });
    await context.route("**/api/analyze", async (route) => {
      await sleep(1200);
      await route.fulfill(F.json(F.analyzeBody));
    });
    await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
    await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
    /* The reminder ask has had today's showing, so the cue has its slot. */
    await context.addInitScript(() => {
      const d = new Date();
      localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    });
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
    const shot = (beat) => `${OUT}${TAG}-${scene}${beat ? `-${beat}` : ""}-${size.name}.png`;

    await page.goto(`${BASE}/`);
    await page.waitForSelector("main .arrive", { timeout: 30000 });
    await sleep(800);
    await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
    await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
    await sleep(1400);

    if (scene.startsWith("ready") || scene === "skip") {
      const m = await page.evaluate(MEASURE);
      await page.screenshot({ path: shot(scene === "skip" ? "before-tap" : "") });
      console.log(`${at}: warm-up ${JSON.stringify(m.warmup)}; Record ${JSON.stringify(m.record)}; scrolls ${m.scrolls}; ${m.taps} filled tap(s)`);
      if (m.record && m.record.bottom > size.h) fail(`${at}: Record is under the fold (${m.record.bottom} > ${size.h})`);
      if (m.taps !== 1) fail(`${at}: ${m.taps} filled taps`);
      if (scene === "skip") {
        const skip = page.locator("main [data-warmup] button", { hasText: "Skip" });
        if ((await skip.count()) === 0) fail(`${at}: no Skip on the warm-up`);
        else if (process.env.LOOK_STRIP === "1") {
          /* Skip's trade of the two slots as a strip: frame 0 is the moment
             before the tap, then 80, 160, 240 and 400ms after it. A shot
             takes 40 to 80ms to come back, longer than the spring's first
             frames, so the page's animations run at a quarter speed and the
             camera waits four times as long: each frame is its moment. */
          const cdp = await context.newCDPSession(page);
          await cdp.send("Animation.enable");
          await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.25 });
          const frames = [await page.screenshot()];
          const t = Date.now();
          await skip.click();
          for (const ms of [80, 160, 240, 400]) {
            await sleep(Math.max(0, ms * 4 - (Date.now() - t)));
            frames.push(await page.screenshot());
          }
          const sharp = (await import("sharp")).default;
          const w = size.w * 2;
          const h = size.h * 2;
          const whole = await sharp({ create: { width: w * 5 + 40, height: h, channels: 3, background: "#808080" } })
            .composite(frames.map((input, i) => ({ input, left: i * (w + 10), top: 0 })))
            .png()
            .toBuffer();
          await sharp(whole)
            .resize({ width: Math.round((w * 5 + 40) / 2) })
            .jpeg({ quality: 80 })
            .toFile(shot("strip").replace(/\.png$/, ".jpg"));
          console.log(`${at}: Skip strip shot`);
        } else {
          await skip.click();
          await sleep(700);
          const after = await page.evaluate(MEASURE);
          await page.screenshot({ path: shot("after-tap") });
          console.log(`${at}: after Skip, warm-up ${JSON.stringify(after.warmup)}`);
          if (after.warmup) fail(`${at}: the warm-up stayed after Skip`);
        }
      }
      await context.close();
      continue;
    }

    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
    await sleep(3000);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("main [data-glance]", { timeout: 30000 });
    await sleep(3600);
    const m = await page.evaluate(MEASURE);
    await page.screenshot({ path: shot("") });
    console.log(`${at}: line ${JSON.stringify(m.line)} cue ${JSON.stringify(m.cue)}; ${m.words} words, ${m.taps} filled tap(s), scrolls ${m.scrolls}`);
    console.log(`${at}: stored ${JSON.stringify(written.at(-1) ?? null)}`);
    if (missing) {
      /* Before 0033 the answer still comes, from this phone's copy, and the next cue stays on it. */
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.cue") ?? "null"));
      console.log(`${at}: this phone keeps ${JSON.stringify(kept?.state?.cue ?? null)}`);
      if (!/down from 5/.test(m.line ?? "")) fail(`${at}: before 0033 the answer did not come from this phone's copy`);
      if (!kept?.state?.cue || kept.state.cue.givenOn === CUES.answer.cue.givenOn) fail(`${at}: before 0033 the next cue was not kept on the phone`);
    }
    if (m.words > 25) fail(`${at}: ${m.words} words over the glance's 25`);
    if (m.taps !== 1) fail(`${at}: ${m.taps} filled taps`);
    if (m.scrolls) fail(`${at}: the glance scrolls`);
    await context.close();
  }
}

await browser.close();
console.log(`\n${TAG}: ${failures.length ? `${failures.length} failure(s)` : "every check passed"}`);
process.exit(failures.length ? 1 : 0);
