/**
 * The wait after Stop (#472), photographed at its moments: just stopped,
 * the words in, Demos reading, and the results landing, with a frame
 * strip (0, 80, 160, 240 and 400ms) at the two moments something lands.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3802
 *   LOOK_BASE=http://localhost:3802 node scripts/look-wait.mjs before
 *   LOOK_BASE=http://localhost:3802 node scripts/look-wait.mjs after
 *
 * Writes docs/look/wait/<view>-<n>-<moment>-<tag>.png and, for 390x844,
 * docs/look/wait/strip-<moment>-<theme>-<tag>.png.
 *
 * Playwright's `route.fulfill` hands a body over whole, so it cannot
 * show a wait that arrives in parts. The camera stands in for the
 * network inside the page instead: `fetch("/api/analyze")` answers with
 * a stream the camera writes to, a line at a time, exactly what the
 * route sends (`lib/analyze-stream.ts`): `received`, `transcribing`,
 * `measured` with the early read, `saving`, then `done` with the
 * fixture's whole answer. `before` answers the old way, one JSON body
 * at the end, as the recorder read it before #472.
 *
 * WAIT_TAKE (seconds, default 55): how long the take runs for real, so
 * the panel's length and the fixture's words (62 seconds) agree. A short
 * one (WAIT_TAKE=6) is for iterating; its length will not match.
 * WAIT_VIEWS=390-light picks views.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute, seed, analyzeBody, session } from "./look-fixtures.mjs";

const [, , TAG = "after"] = process.argv;
const STREAM = TAG !== "before";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = new URL("../docs/look/wait/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const TAKE_S = Number(process.env.WAIT_TAKE ?? 55) || 55;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALL_VIEWS = [
  { name: "390-light", width: 390, height: 844, theme: "light", strips: true },
  { name: "390-dark", width: 390, height: 844, theme: "dark", strips: true },
  { name: "375-light", width: 375, height: 667, theme: "light" },
  { name: "375-dark", width: 375, height: 667, theme: "dark" },
];
const pick = (process.env.WAIT_VIEWS ?? "").split(",").filter(Boolean);
const VIEWS = pick.length ? ALL_VIEWS.filter((v) => pick.includes(v.name)) : ALL_VIEWS;

/** What the route sends once the words are in: lib/analyze-stream.ts `earlyRead`, from the fixture. */
const m = analyzeBody.metrics;
const early = {
  durationS: m.durationS,
  transcript: analyzeBody.transcript,
  words: analyzeBody.words,
  wordCount: m.wordCount,
  wpm: m.wpm,
  fillerCount: m.fillerCount,
  fillers: m.fillers,
  scorable: true,
  reads: true,
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

async function walk(view) {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: view.theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme: view.theme, session });
  // The network, held by the camera: the recorder's one call to the
  // engine waits until the camera opens it, then reads what it writes.
  await context.addInitScript(() => {
    const real = window.fetch.bind(window);
    const enc = new TextEncoder();
    const w = (window.__wait = { sent: 0 });
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!/\/api\/analyze\b/.test(url)) return real(input, init);
      w.sent++;
      w.accept = new Headers(init?.headers ?? {}).get("accept");
      return new Promise((resolve) => {
        w.open = (type) => {
          const body = new ReadableStream({
            start(c) {
              w.push = (text) => c.enqueue(enc.encode(text));
              w.end = () => c.close();
            },
          });
          resolve(new Response(body, { status: 200, headers: { "Content-Type": type } }));
        };
      });
    };
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 200)));
  const shot = async (n, moment) => {
    const path = `${OUT}${view.name}-${n}-${moment}-${TAG}.png`;
    await page.screenshot({ path });
    console.log("shot ", path.replace(OUT, ""));
    return path;
  };
  const line = (obj) => page.evaluate((t) => window.__wait.push(t), JSON.stringify(obj) + "\n");
  /** Frames at 0, 80, 160, 240 and 400ms around `act`, laid side by side. */
  const strip = async (moment, act) => {
    const frames = [];
    const t0 = Date.now();
    frames.push(await page.screenshot());
    await act();
    for (const at of [80, 160, 240, 400]) {
      const wait = at - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
      frames.push(await page.screenshot());
    }
    if (!view.strips) return;
    const sheet = await context.newPage();
    await sheet.setViewportSize({ width: 5 * 260 + 6 * 8, height: 600 });
    const ground = view.theme === "dark" ? "#2a2a2a" : "#dcdcdc";
    await sheet.setContent(
      `<body style="margin:0;background:${ground}"><div style="display:flex;gap:8px;padding:8px">${frames
        .map(
          (b, i) =>
            `<div><div style="font:600 13px system-ui;color:${view.theme === "dark" ? "#bbb" : "#333"};margin:0 0 4px">${[0, 80, 160, 240, 400][i]}ms</div><img style="width:260px;display:block;border-radius:10px" src="data:image/png;base64,${b.toString("base64")}"></div>`
        )
        .join("")}</div></body>`
    );
    await sheet.waitForTimeout(200);
    const path = `${OUT}strip-${moment}-${view.theme}-${TAG}.png`;
    await sheet.screenshot({ path, fullPage: true });
    console.log("strip", path.replace(OUT, ""));
    await sheet.close();
  };

  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector('button[data-record="start"]', { timeout: 20000 });
  await sleep(800);
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[data-record="stop"]', { timeout: 10000 });
  await sleep(TAKE_S * 1000);
  await page.click('button[data-record="stop"]', { force: true });
  await page.waitForFunction(() => window.__wait.open, null, { timeout: 15000 });
  await sleep(400);
  await shot(1, "stopped");

  if (!STREAM) {
    await sleep(2600);
    await shot(2, "three-seconds");
    await sleep(5000);
    await shot(3, "eight-seconds");
    await strip("landed", async () => {
      await page.evaluate((t) => {
        window.__wait.open("application/json");
        window.__wait.push(t);
        window.__wait.end();
      }, JSON.stringify(analyzeBody));
    });
  } else {
    const accept = await page.evaluate(() => window.__wait.accept);
    if (!/x-ndjson/.test(accept ?? "")) console.log("NOT-STREAMED accept:", accept);
    await page.evaluate(() => window.__wait.open("application/x-ndjson"));
    await line({ stage: "received" });
    await sleep(500);
    await line({ stage: "transcribing" });
    await sleep(1200);
    await shot(2, "transcribing");
    await strip("words", () => line({ stage: "measured", early }));
    await sleep(1000);
    await shot(3, "words");
    await sleep(5000);
    await shot(4, "reading");
    await line({ stage: "saving" });
    await sleep(300);
    await strip("landed", async () => {
      await line({ stage: "done", status: 200, body: analyzeBody });
      await page.evaluate(() => window.__wait.end());
    });
  }
  await sleep(1500);
  await shot(5, "results");
  await context.close();
}

for (const view of VIEWS) {
  try {
    await walk(view);
  } catch (e) {
    console.log("WALK-FAILED", view.name, String(e.message ?? e).split("\n")[0]);
  }
}
await browser.close();
