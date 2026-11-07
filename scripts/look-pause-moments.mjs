/**
 * The look loop's camera for the Pause row's moments (#424): the live
 * results walk's numbers step with two, three and four pauses judged
 * filled, a stored recording with its audio (and without it, and with a
 * file that will not decode), and the probes behind the review of
 * #424: the chips' 44px targets never overlap, the row says "had a
 * sound in" once, the chip's glyph wears Hear it back's colour, and one
 * sound plays at a time when the numbers step also holds a video.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   LOOK_WAV=/path/to/62s.wav node scripts/look-pause-moments.mjs after            # every scene
 *   LOOK_WIDTH=320 LOOK_HEIGHT=568 node scripts/look-pause-moments.mjs after three  # a subset
 *
 * Scenes: two, three, four (the live numbers step, the Pause row open),
 * focus (two, the first chip focused by key), long (an 88s take with 34
 * gaps: the map draws the pause the row names), video (the one-sound probe,
 * no shot), stored, stored-playing, stored-silent, stored-broken.
 * LOOK_THEMES=light,dark picks the themes. Every probe prints a line
 * that starts PROBE; a broken promise prints FAIL.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync } from "node:fs";
import { supabaseRoute as supabase, analyzeBody, json, session, seed, POSE_PREF, reps } from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/pause-moments/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const WIDTH = Number(process.env.LOOK_WIDTH ?? 390) || 390;
const HEIGHT = Number(process.env.LOOK_HEIGHT ?? 844) || 844;
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",");
const WAV = process.env.LOOK_WAV ? readFileSync(process.env.LOOK_WAV) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL  ${msg}`);
};

/* The take's pauses: an opening, a mid-sentence hesitation, a landing,
   and two, three or four the take judged filled. */
const P = {
  opening: { t: 2.1, len: 1.2, kind: "pre", verdict: "opening" },
  a: { t: 15.3, len: 1.1, kind: "pre", verdict: "filled" },
  hes: { t: 20, len: 0.9, kind: "mid", verdict: "hesitation" },
  b: { t: 27.4, len: 1.0, kind: "pre", verdict: "filled" },
  c: { t: 40.2, len: 1.3, kind: "pre", verdict: "filled" },
  land: { t: 47, len: 1.5, kind: "pre", verdict: "landing" },
  d: { t: 52.6, len: 1.1, kind: "pre", verdict: "filled" },
};
const SETS = {
  two: [P.opening, P.a, P.hes, P.c, P.land],
  three: [P.opening, P.a, P.hes, P.b, P.c, P.land],
  four: [P.opening, P.a, P.hes, P.b, P.c, P.land, P.d],
};
/** What lib/pause-quality.ts headline() says for filled pauses and no dead air. */
const filledHeadline = (n) => `${n} of your "pauses" had a sound in them. Silence INSTEAD of the "um", not either side of it.`;
const bodyFor = (pauses, over = {}) => {
  const filled = pauses.filter((p) => p.verdict === "filled").length;
  const held = pauses.filter((p) => p.kind !== "beat");
  return {
    ...analyzeBody,
    metrics: {
      ...analyzeBody.metrics,
      pauses,
      heldPauses: held.length,
      composedPauses: held.filter((p) => p.kind === "pre").length,
      midSentencePauses: held.filter((p) => p.kind === "mid").length,
      ...over,
    },
    pauseHeadline: filledHeadline(filled),
  };
};
/** The video probe's take: a few seconds the fake mic can fill, its two filled pauses inside them. */
const SHORT = [
  { t: 1.2, len: 1.0, kind: "pre", verdict: "filled" },
  { t: 3.4, len: 0.9, kind: "pre", verdict: "filled" },
];
/* A long take (the review's map finding): 175 words at 2.5 a second, a
   0.45s beat every 5 words, a 1.2s held pause every 30, and a filler
   beside the last held pause, so 34 gaps and the filled one at 1:16,
   judged as lib/pause-map.test.ts judges the same take. */
const LONG = (() => {
  const out = [];
  let t = 0.4;
  let held = 0;
  for (let i = 0; i < 175; i++) {
    const end = Math.round((t + 0.35) * 100) / 100;
    t += 0.4;
    if (i === 174) break;
    if ((i + 1) % 30 === 0) {
      held++;
      out.push({ t: end, len: 1.25, kind: "pre", verdict: held === 5 ? "filled" : "landing" });
      t += 1.2;
    } else if ((i + 1) % 5 === 0) {
      out.push({ t: end, len: 0.5, kind: "beat", verdict: "beat" });
      t += 0.45;
    }
  }
  return { pauses: out, durationS: Math.round(t + 0.5) };
})();
const live = { body: bodyFor(SETS.two) };

/* A stored recording with its audio: rep-22 keeps its row, with these
   pauses and an audio path the audio route answers. */
const stored = reps.find((r) => r.id === "rep-22");
const audio = { mode: "ok" };
async function audioRoute(route) {
  if (audio.mode === "broken") return route.fulfill(json({ url: `${BASE}/__look/broken.wav` }));
  return route.fulfill(json({ url: `${BASE}/__look/take.wav` }));
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
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(live.body)); });
  await context.route("**/api/words", (route) => route.fulfill(json({ alternatives: [], source: "model" })));
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/audio**", audioRoute);
  await context.route("**/__look/take.wav", (route) =>
    WAV ? route.fulfill({ status: 200, contentType: "audio/wav", body: WAV }) : route.fulfill({ status: 404, body: "" })
  );
  await context.route("**/__look/broken.wav", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: "not a wav" }));
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));

  const name = (scene, extra = "") => `${TAG}-${scene}-${WIDTH}x${HEIGHT}-${theme}${extra}.png`;
  const shot = async (scene, opts = {}) => {
    await sleep(opts.settle ?? 600);
    const file = name(scene, opts.extra);
    await page.screenshot({ path: `${OUT}${file}`, clip: opts.clip });
    console.log(`shot  ${file}`);
  };
  const step = async (fn) => { try { await fn(); } catch (e) { fail(`${theme} ${String(e.message ?? e).split("\n")[0]}`); } };

  /** The Pause row opened, the map's foot over it, as a thumb meets it. */
  const openPauseRow = async () => {
    const summary = page.locator("details summary:has-text('Pausing')").first();
    await summary.scrollIntoViewIfNeeded();
    if (!(await page.locator("details:has(summary:has-text('Pausing'))[open]").count())) await summary.click();
    await page.waitForSelector("details[open] [data-pause-moment]", { timeout: 5000 });
    await page.evaluate(() => {
      const map = [...document.querySelectorAll("main .eyebrow")].find((e) => e.textContent === "Pauses");
      const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
      const top = (map ?? row)?.getBoundingClientRect().top ?? 0;
      window.scrollBy(0, top - 72);
      const r = row?.getBoundingClientRect();
      // Keep the row's moments in view on a short phone.
      if (r && r.bottom > window.innerHeight - 120) window.scrollBy(0, r.bottom - window.innerHeight + 120);
    });
    await sleep(400);
  };

  /** The probes behind the review: targets, words and colour. */
  const probe = async (scene) => {
    const p = await page.evaluate(() => {
      const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
      const buttons = [...(row?.querySelectorAll("button[data-pause-moment]") ?? [])];
      const rects = buttons.map((b) => b.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      const pills = buttons.map((b) => b.querySelector(".moment-pill").getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      const overlaps = [];
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push([i, j]);
        }
      /* Down the middle of each pill: whose target is under the finger? */
      const stolen = [];
      buttons.forEach((b, i) => {
        const r = b.querySelector(".moment-pill").getBoundingClientRect();
        for (let y = Math.ceil(r.top); y < r.bottom; y++) {
          const hit = document.elementFromPoint(r.left + r.width / 2, y)?.closest("button[data-pause-moment]");
          if (hit && hit !== b) stolen.push({ pill: i, y: y - r.top, hit: buttons.indexOf(hit) });
        }
      });
      const detail = row?.querySelector(".reveal")?.textContent ?? "";
      const said = (detail.match(/had a sound in/g) ?? []).length;
      const glyph = buttons[0] ? getComputedStyle(buttons[0].querySelector("svg")).color : null;
      const scrubKey = document.querySelector('button[aria-label="Play"], button[aria-label="Pause"]');
      const fillerGlyph = [...document.querySelectorAll('button[aria-label^="Play "]')].find((b) => !b.hasAttribute("data-pause-moment"))?.querySelector("svg");
      const lineWidth = row?.querySelector(".reveal")?.getBoundingClientRect().width ?? 0;
      return {
        n: buttons.length, rects, pills, overlaps, stolen, detail, said, lineWidth,
        glyph, keyGlyph: scrubKey ? getComputedStyle(scrubKey).color : null, fillerGlyph: fillerGlyph ? getComputedStyle(fillerGlyph).color : null,
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log(`PROBE ${scene} ${WIDTH}x${HEIGHT} ${theme}: ${p.n} chips, pills ${JSON.stringify(p.pills.map((r) => [Math.round(r.x), +r.y.toFixed(1)]))}, line ${Math.round(p.lineWidth)}px`);
    console.log(`PROBE   detail: ${JSON.stringify(p.detail)}`);
    console.log(`PROBE   glyph ${p.glyph}, Hear it back's key ${p.keyGlyph}, a filler chip ${p.fillerGlyph}`);
    if (p.overlaps.length) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: targets overlap ${JSON.stringify(p.overlaps)}; a tap on one plays another: ${JSON.stringify(p.stolen.slice(0, 3))}`);
    if (p.stolen.length) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: ${p.stolen.length} rows of a pill hit another chip`);
    if (p.said !== 1) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: the row says "had a sound in" ${p.said} times`);
    if (p.hScroll) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: the page scrolls sideways`);
    if (p.keyGlyph && p.glyph !== p.keyGlyph) fail(`${scene} ${theme}: the chip's glyph ${p.glyph} is not Hear it back's ${p.keyGlyph}`);
    return p;
  };

  /** A live take, walked to the numbers step. */
  const walk = async (body, holdMs = 2600) => {
    live.body = body;
    await page.goto(`${BASE}/rep?lesson=h4`);
    await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
    await sleep(800);
    await page.click('button[aria-label="Start recording"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(holdMs);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("main .arrive-x", { timeout: 30000 });
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
    await sleep(1200);
    await page.getByRole("button", { name: /The numbers/ }).first().click();
    await page.waitForSelector("details summary:has-text('Pausing')", { timeout: 8000 });
    await sleep(600);
  };

  for (const n of ["two", "three", "four"]) {
    if (!want(n) && !(n === "two" && want("focus"))) continue;
    await step(async () => {
      await walk(bodyFor(SETS[n]));
      await openPauseRow();
      await probe(n);
      if (want(n)) await shot(n);
      if (n === "two" && want("focus") && theme === "light") {
        await page.locator("button[data-pause-moment]").first().focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const box = await page.locator("details[open] .reveal").first().boundingBox();
        await shot("two", { extra: "-focus", clip: { x: 0, y: Math.max(0, box.y - 24), width: WIDTH, height: box.height + 48 } });
      }
    });
  }

  /* The long take: the map draws the filled pause the row names. */
  if (want("long")) {
    await step(async () => {
      await walk(bodyFor(LONG.pauses, { durationS: LONG.durationS, heldPauses: 5 }));
      await openPauseRow();
      const map = await page.evaluate(() => {
        const bar = document.querySelector('[role="img"][aria-label*="held pause"]');
        const spans = [...(bar?.children ?? [])].map((s) => s.className);
        return {
          marks: spans.length,
          hollow: spans.filter((c) => c.includes("border-[1.5px]")).length,
          landed: spans.filter((c) => c.includes("bg-sage-600")).length,
          beats: spans.filter((c) => c.includes("min-w-[3px]")).length,
          overflow: bar ? bar.scrollWidth > bar.clientWidth + 1 : false,
        };
      });
      console.log(`PROBE long ${WIDTH}x${HEIGHT} ${theme}: ${JSON.stringify(map)}`);
      if (map.hollow < 1) fail(`long ${theme}: the row names 1:16 and the map draws no hollow mark`);
      if (map.landed + map.hollow !== 5) fail(`long ${theme}: the map draws ${map.landed + map.hollow} of 5 held pauses`);
      if (map.overflow) fail(`long ${theme}: the map overflows its card`);
      await shot("long");
    });
  }

  /* One sound at a time (review 1): the numbers step of a Premium
     Voice + Video take also holds the clip's <video controls>, which has
     sound. The camera cannot record a scorable body in a headless
     browser, so the Playback card's element is stood in here: a
     <video controls> on the same step playing the same take. */
  if (want("video")) {
    await step(async () => {
      await walk(bodyFor(SHORT, { durationS: 6 }), 6000);
      await openPauseRow();
      const result = await page.evaluate(async () => {
        const take = document.querySelector("audio[data-take]");
        const v = document.createElement("video");
        v.controls = true;
        v.src = take.src;
        v.id = "look-playback";
        document.querySelector("main").appendChild(v);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const state = () => ({ take: take.paused ? "paused" : "playing", video: v.paused ? "paused" : "playing" });
        await v.play().catch(() => {});
        await wait(300);
        const a = state();
        document.querySelector("button[data-pause-moment]").click();
        await wait(500);
        const b = state();
        await v.play().catch(() => {});
        await wait(500);
        const c = state();
        v.pause();
        take.pause();
        return { videoThenChip: { before: a, after: b }, chipThenVideo: c };
      });
      console.log(`PROBE video: the video plays ${JSON.stringify(result.videoThenChip.before)}; a chip is tapped ${JSON.stringify(result.videoThenChip.after)}; the video is played again ${JSON.stringify(result.chipThenVideo)}`);
      if (result.videoThenChip.after.video !== "paused" || result.videoThenChip.after.take !== "playing")
        fail(`video ${theme}: a chip tapped over a playing video leaves ${JSON.stringify(result.videoThenChip.after)}`);
      if (result.chipThenVideo.take !== "paused" || result.chipThenVideo.video !== "playing")
        fail(`video ${theme}: the video played over a chip leaves ${JSON.stringify(result.chipThenVideo)}`);
    });
  }

  /* A stored recording: the whole result on one page, Hear it back and
     the Pause row together. */
  const openStored = async (pathMode) => {
    stored.pauses = SETS.two.map((p) => ({ ...p }));
    stored.audio_path = pathMode === "silent" ? null : "look/rep-22.webm";
    audio.mode = pathMode === "broken" ? "broken" : "ok";
    await page.goto(`${BASE}/rep/rep-22`);
    await page.waitForSelector("details summary:has-text('Pausing')", { timeout: 30000 });
    await sleep(pathMode === "broken" ? 1500 : 800);
  };
  if (want("stored") || want("stored-playing")) {
    await step(async () => {
      await openStored("ok");
      const summary = page.locator("details summary:has-text('Pausing')").first();
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      await page.waitForSelector("details[open] [data-pause-moment]");
      await probe("stored");
      await page.evaluate(() => {
        const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
        window.scrollBy(0, (row?.getBoundingClientRect().top ?? 0) - 260);
      });
      if (want("stored")) await shot("stored");
      if (want("stored-playing")) {
        await page.locator("button[data-pause-moment]").first().click();
        await sleep(500);
        const pressed = await page.locator("button[data-pause-moment]").first().getAttribute("aria-pressed");
        console.log(`PROBE stored-playing: aria-pressed ${pressed}`);
        const box = await page.locator("details[open] .reveal").first().boundingBox();
        await shot("stored", { extra: "-playing", settle: 100, clip: { x: 0, y: Math.max(0, box.y - 24), width: WIDTH, height: box.height + 48 } });
        await page.evaluate(() => document.querySelector("audio[data-take]")?.pause());
      }
    });
  }
  for (const mode of ["silent", "broken"]) {
    if (!want(`stored-${mode}`) || theme !== "light") continue;
    await step(async () => {
      await openStored(mode);
      if (mode === "broken") {
        // A file that will not decode says so on its first play.
        await page.locator('button[aria-label="Play"]').first().click().catch(() => {});
        await sleep(800);
      }
      const summary = page.locator("details summary:has-text('Pausing')").first();
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      await page.waitForSelector("details[open] [data-pause-moment]");
      const buttons = await page.locator("details[open] button[data-pause-moment]").count();
      console.log(`PROBE stored-${mode}: ${buttons} buttons`);
      if (buttons) fail(`stored-${mode}: ${buttons} live chips with nothing to play`);
      await page.evaluate(() => {
        const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
        window.scrollBy(0, (row?.getBoundingClientRect().top ?? 0) - 260);
      });
      await shot(`stored-${mode}`);
    });
  }

  await context.close();
}

for (const theme of THEMES) await shootTheme(theme);
await browser.close();
console.log(failed ? `${failed} FAIL` : "all probes held");
console.log(`done → ${OUT}`);
