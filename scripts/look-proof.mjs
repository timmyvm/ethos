/**
 * Say it better's proof token, photographed and held (DECISIONS #509):
 * the take that says a saved swap's better phrase shows it under the
 * score, "✓ the point is" over "the thing is" struck, with the moment's
 * chip, outside the word ceiling, and its door opens the swap's sheet
 * over the results.
 *
 * Scenes, each Today's practice on four days of history with yesterday's
 * cue ("um" 5 times) carried in and answered; the swap is look-fixtures'
 * SAY_LEXICON "the thing is" → "the point is", saved two days ago and said
 * at 0:11 of the take (one sentence of the fixture take rewritten nine
 * words for nine, so every other word keeps its time):
 *
 *   returning  an ordinary returning take: the stars, the cue answered,
 *              Tomorrow's line, the token; no bigger moment, so Demos
 *              cheers it and it plays the hand won
 *   level      the same take crossing Pace to level 3: the level-up owns
 *              the sound and Demos's cheer, the token lands quietly
 *   first      the day's first take on a phone never asked for reminders:
 *              the reminder ask in the cue's slot
 *   none       the returning take with no swap said: the glance as it was
 *   worst      #429's longest pair (eight words said, six better) on a
 *              level-up take that is also the day's first: the struck
 *              phrase left to the sheet, no scroll, Demos at or over 88
 *   late       Say it better's read lands after the glance's first frame:
 *              no token arrives under the reader, and nothing moves
 *   door       the token tapped: the swap's sheet over the results, no
 *              streak moment, Done back to the token; the chip tapped
 *              plays and opens nothing
 *   nostar     a take with no star that says the better phrase (twelve
 *              words, not scored, no Ethos number, 0 XP; #510 with #509,
 *              the final pass of 19 Nov): "Not scored", no token, no
 *              note and no pulse, and the swap left unheard for a scored
 *              take to prove
 *   capped     a free account's fourth take of the day (#514) that says
 *              the better phrase: no Ethos number, "Ethos score back
 *              tomorrow, or go Premium" under its fillers, and the token,
 *              since Say it better counts a capped take (the reel's extra
 *              A, 26 Nov: the meter is the score's, never the words')
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 4081
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     LOOK_BASE=http://localhost:4081 node scripts/look-proof.mjs [scene…]
 *
 * Shots: docs/look/proof/after/<scene>-<w>x<h>-<theme>.png (LOOK_OUT to
 * move them), deviceScaleFactor 2; returning, level, first and none at
 * 390x844 and 320x568 in both themes (the first three at 375x667 too,
 * where Demos stands beside his line), worst at all three in light, late
 * at 390x844 light, door at 390x844 in both themes (LOOK_SIZES narrows
 * them). Prints, per shot, the token as drawn, Demos's line and cue, the
 * earned line, the visible words with the token's apart, the filled
 * taps, the playing chips, the scroll, the bands, Demos's height, the
 * notes the glance played and each pulse the page asked the phone for;
 * fails on a scroll, a second tap or chip, a missing or extra token, a
 * Demos under 88 at 390x844, a band over 64 there, a door that leaves or
 * a chip that opens the sheet.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
const F = await import("./look-fixtures.mjs");

const ALL = ["returning", "level", "first", "none", "worst", "late", "door", "nostar", "capped"];
const SCENES = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const BASE = process.env.LOOK_BASE ?? "http://localhost:4081";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/proof/after/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const size = (s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
};
const SIZES_OF = {
  returning: ["390x844-light", "390x844-dark", "375x667-light", "320x568-light", "320x568-dark"],
  level: ["390x844-light", "390x844-dark", "375x667-light", "320x568-light", "320x568-dark"],
  first: ["390x844-light", "390x844-dark", "375x667-light", "320x568-light", "320x568-dark"],
  none: ["390x844-light", "390x844-dark", "320x568-light", "320x568-dark"],
  worst: ["390x844-light", "375x667-light", "320x568-light"],
  late: ["390x844-light"],
  door: ["390x844-light", "390x844-dark"],
  nostar: ["390x844-light", "390x844-dark", "320x568-light", "320x568-dark"],
  capped: ["390x844-light", "390x844-dark", "375x667-light", "375x667-dark", "320x568-light", "320x568-dark"],
};
const ONLY = process.env.LOOK_SIZES ? process.env.LOOK_SIZES.split(",") : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};

/* ---- the take ------------------------------------------------------------ */
const A = F.analyzeBody;
/* Rewrite one stretch of the fixture take, word for word, so every other word keeps its time. */
const rewrite = (from, to) => {
  if (!A.transcript.includes(from)) throw new Error(`the fixture's take changed: "${from}" is not in it`);
  const transcript = A.transcript.replace(from, to);
  const raw = transcript.match(/[A-Za-z0-9']+/g);
  if (raw.length !== A.words.length) throw new Error("the rewrite moved the take's words");
  return { ...A, transcript, words: A.words.map((w, i) => ({ ...w, word: raw[i] })) };
};
/* "the point is" at 0:11. */
const TAKE = rewrite("Um, the mistake people make is waiting to feel ready.", "Um, the point is, people just wait to feel ready.");
/* A take with no star (#504, #510): twelve words over nine seconds, the
   better phrase among them, as look-glance's unscored take; not scored,
   so no Ethos number, no coach and nothing paid. */
const NO_STAR = (() => {
  const said = ["So", "the", "point", "is", "habits", "um", "they", "compound", "over", "time", "you", "know"];
  const words = said.map((word, i) => ({ word, start: 0.4 + i * 0.7, end: 0.9 + i * 0.7 }));
  return {
    ...A,
    transcript: "So the point is, habits, um, they compound over time, you know.",
    words,
    metrics: { ...A.metrics, durationS: 9, wordCount: 12, wpm: 80, fillerCount: 1, fillersPerMin: 6.7, fillers: [{ word: "um", t: 3.9 }], fillerCounts: { um: 1 }, topFiller: "um", repairCount: 0, repairsPerMin: 0, disfluenciesPerMin: 6.7, pauses: [], heldPauses: 0, composedPauses: 0, midSentencePauses: 0, stars: 0, substance: { wordCount: 12, distinctRatio: 1, repeatShare: 0 } },
    coach: null,
    ethosIndex: null,
    scorable: false,
    xp: 0,
    repId: "rep-live-nostar",
    judged: { ran: false, unlimited: false, remaining: 3, capped: false },
  };
})();
/* A free account's fourth take today (#514): measured in full, its words
   timed, no coach and no Ethos number because the day's 3 are used. */
const CAPPED = {
  ...TAKE,
  coach: null,
  ethosIndex: null,
  repId: "rep-live-capped",
  judged: { ran: false, unlimited: false, remaining: 0, capped: true },
};
/* #429's longest better phrase, "a week nobody could survive at all". */
const LONG_TAKE = rewrite("a week nobody could really do, then miss", "a week nobody could survive at all, miss");
const COMMON = F.SAY_LEXICON[0];
if (COMMON.original !== "the thing is") throw new Error("SAY_LEXICON's first pair changed");
const LONGEST = { ...COMMON, id: "00000000-0000-4000-8000-0000000000c9", original: "a week that no person could actually do", upgrade: "a week nobody could survive at all" };

/* ---- the history (look-trait-xp's) --------------------------------------- */
const tmpl = F.LEVEL_MIX[0];
const take = (id, daysAgo, s) => ({
  ...tmpl,
  id: `pv-${id}`,
  client_id: `look-pv-${id}`,
  created_at: new Date(Date.now() - daysAgo * 86400000 - 3600000).toISOString(),
  dimensions: {
    tier1: { pause: s.pause, fillers: s.fillers, repairs: s.repairs, pace: s.pace, range: s.range },
    anchors: { hedgeCount: 2, restartCount: 1 },
    tier2: tmpl.dimensions.tier2,
  },
});
/* The Index each day held: the take's 665 three over the last and under
   the best, so "▲ 3 since last time" and no "Best yet". */
const INDEX = [680, 650, 658, A.ethosIndex - 3];
const PAUSES = [...A.metrics.pauses, { t: 60, len: 1.2, kind: "pre" }];
const flat = (n, s) =>
  Array.from({ length: n }, (_, i) => ({ ...take(`h-${i + 1}`, n - i, s), ethos_index: INDEX[i] ?? INDEX.at(-1), pauses: i === 0 ? PAUSES : tmpl.pauses }));
const STEADY = { pace: 55, pause: 55, fillers: 75, repairs: 25, range: 58 };
/* Pace 380 + 93 crosses 420: level 3. */
const CROSSING = { ...STEADY, pace: 95 };
const SCENE = {
  returning: { history: flat(4, STEADY), take: TAKE, lexicon: F.SAY_LEXICON, asks: false },
  level: { history: flat(4, CROSSING), take: TAKE, lexicon: F.SAY_LEXICON, asks: false },
  first: { history: flat(4, STEADY), take: TAKE, lexicon: F.SAY_LEXICON, asks: true },
  none: { history: flat(4, STEADY), take: TAKE, lexicon: [], asks: false },
  worst: { history: flat(4, CROSSING), take: LONG_TAKE, lexicon: [LONGEST], asks: true },
  late: { history: flat(4, STEADY), take: TAKE, lexicon: F.SAY_LEXICON, asks: false, lexiconAfterMs: 14000 },
  door: { history: flat(4, STEADY), take: TAKE, lexicon: F.SAY_LEXICON, asks: false },
  nostar: { history: flat(4, STEADY), take: NO_STAR, lexicon: F.SAY_LEXICON, asks: false },
  capped: { history: flat(4, STEADY), take: CAPPED, lexicon: F.SAY_LEXICON, asks: false },
};

/* ---- yesterday's cue (look-sticks' "answer") ----------------------------- */
const dayKey = (ago) => {
  const d = new Date(Date.now() - ago * 86_400_000);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
};
const CUE = {
  v: 1,
  cue: { kind: "filler", word: "um", from: 5, last: 5, givenOn: dayKey(1), answeredOn: null, tries: 0, line: { text: "So the thing about habits is ‖ they compound.", at: 2.68 } },
  aside: [],
  at: new Date(Date.now() - 86_400_000).toISOString(),
};

/* ---- what the glance holds ---------------------------------------------- */
const MEASURE = () => {
  const hidden = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (e.matches?.('nav[aria-label="Sections"], nextjs-portal, .sr-only, [hidden], select, option')) return true;
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return true;
    }
    return false;
  };
  const words = (root, skip) => {
    let text = "";
    if (!root) return 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = (n.nodeValue ?? "").trim();
      if (!t || hidden(n.parentElement) || (skip && n.parentElement.closest(skip))) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const b = r.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      text += ` ${t}`;
    }
    return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  };
  const main = document.querySelector("main");
  const tokens = [...document.querySelectorAll("main [data-say-token]")];
  const token = tokens[0] ?? null;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !hidden(el);
  };
  const clip = (sel) => {
    const el = document.querySelector(sel);
    return el && vis(el) ? el.textContent.replace(/\s+/g, " ").trim() : null;
  };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  };
  /* The bands (rule 7), as look-glance.mjs measures them: every vertical
     gap between painted things in main, header to the shelf's first
     control; text by its line boxes, art and controls by their boxes. */
  const boxes = [];
  const walker2 = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (walker2.nextNode()) {
    const n = walker2.currentNode;
    if (!(n.nodeValue ?? "").trim() || hidden(n.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.height > 0) boxes.push([r.top, r.bottom]);
  }
  for (const el of main.querySelectorAll("img, svg, video, canvas, button, [data-glance-door], .card")) {
    if (hidden(el) || el.closest("[data-footer-shelf]")) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0) boxes.push([r.top, r.bottom]);
  }
  const shelf = main.querySelector("[data-footer-shelf]");
  const shelfTop = shelf ? Math.min(...[...shelf.querySelectorAll("button, a, p")].map((e) => e.getBoundingClientRect().top).filter((t) => t > 0)) : innerHeight;
  const sorted = boxes.filter(([a, b]) => b > 0 && a < shelfTop).sort((x, y) => x[0] - y[0]);
  let maxBand = 0;
  let reach = sorted.length ? sorted[0][1] : 0;
  for (const [a, b] of sorted.slice(1)) {
    if (a - reach > maxBand) maxBand = a - reach;
    reach = Math.max(reach, b);
  }
  if (sorted.length && shelfTop - reach > maxBand) maxBand = shelfTop - reach;
  /* Demos's drawn size: DemosArt's own box (the clip or the still inside it). */
  const demos = [...main.querySelectorAll('[data-glance] div[style*="100cqh"]')].find((el) => el.getBoundingClientRect().height > 0);
  const said = token?.querySelector("[data-proof-said]");
  return {
    token: token ? token.textContent.replace(/\s+/g, " ").trim() : null,
    tokens: tokens.filter(vis).length,
    tokenBox: rect(token),
    struck: said ? (vis(said) ? "drawn" : "hidden here") : "none",
    door: token?.querySelector("[data-say-token-door]")?.getAttribute("aria-label") ?? null,
    line: clip("main [data-glance-line]"),
    cue: clip("main [data-glance-cue]"),
    ask: clip("main [data-reminder-ask]"),
    earned: clip("main [data-earned]"),
    words: words(main?.parentElement ?? document.body, "[data-say-token]"),
    tokenWords: words(token),
    taps: [...document.querySelectorAll(".tap, .tap-tonal")].filter(vis).length,
    chips: [...main.querySelectorAll("button[data-glance-chip], button[data-say-chip], [data-pause-moment]")].filter(vis).length,
    scrolls: document.scrollingElement.scrollHeight > innerHeight + 1,
    overflow: document.scrollingElement.scrollHeight - innerHeight,
    maxBand: Math.round(maxBand),
    demos: demos ? Math.round(demos.getBoundingClientRect().height) : null,
    celebrating: !!main.querySelector(".earned-burst"),
    boxes: ["main [data-glance-line]", "main [data-coach-room]", "main [data-glance-door]"].map((sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? Math.round(r.top) : null;
    }),
  };
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

const report = {};
for (const scene of SCENES) {
  const S = SCENE[scene];
  if (!S) throw new Error(`no scene "${scene}"`);
  for (const sz of SIZES_OF[scene].filter((s) => !ONLY || ONLY.includes(s)).map(size)) {
    const at = `${scene} ${sz.name}`;
    F.resetPlan("free");
    F.repsMode.rows = S.history;
    F.extraReps.length = 0;
    const context = await browser.newContext({
      viewport: { width: sz.w, height: sz.h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      permissions: S.asks ? ["microphone"] : ["microphone", "notifications"],
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
      colorScheme: sz.theme,
      serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", F.supabaseRoute);
    /* Say it better's swaps (registered after, so it answers first). */
    let lexiconServedAt = null;
    await context.route("http://supabase.local/rest/v1/lexicon**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      if (S.lexiconAfterMs) await sleep(S.lexiconAfterMs);
      lexiconServedAt = Date.now();
      return route.fulfill(F.json(S.lexicon));
    });
    /* Yesterday's cue on the account (migration 0034). */
    await context.route("http://supabase.local/rest/v1/profiles**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "GET" && (url.searchParams.get("select") ?? "").includes("carried_cue")) {
        const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
        const row = { carried_cue: CUE };
        return route.fulfill(F.json(single ? row : [row]));
      }
      return route.fallback();
    });
    await context.route("**/api/analyze", async (route) => {
      await sleep(1200);
      const last = S.history.at(-1);
      const body = { ...S.take, previousIndex: last ? last.ethos_index : null };
      /* Stored as the route stores it, so the reads after the take hold it. */
      F.extraReps.push({
        ...tmpl,
        id: body.repId,
        client_id: "look-pv-live",
        created_at: new Date().toISOString(),
        transcript: body.transcript,
        ethos_index: body.ethosIndex,
        dimensions: {
          tier1: body.tier1,
          anchors: body.anchors,
          tier2: body.coach?.dimensions ?? null,
          ...(body.judged?.capped ? { capped: true } : {}),
        },
        /* A take with no star is stored with none (nostar). */
        stars: body.metrics.stars,
      });
      await route.fulfill(F.json(body));
    });
    await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
    await context.route("**/api/audio**", (r) => r.fulfill(F.json({ error: "Not here." }, 404)));
    await context.addInitScript(F.seed, { theme: sz.theme, session: F.session, pose: F.POSE_PREF });
    await context.addInitScript(
      ({ asks }) => {
        /* Haptics on, and every pulse the page asks for kept. */
        try {
          const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
          localStorage.setItem("ethos.prefs", JSON.stringify({ ...prefs, haptics: true }));
        } catch {}
        window.__pulses = [];
        navigator.vibrate = (p) => {
          window.__pulses.push({ at: Math.round(performance.now()), p });
          return true;
        };
        /* Every note the page starts, by when and its pitch (look-glance's LOOK_SOUND). */
        window.__sounds = [];
        const set = AudioParam.prototype.setValueAtTime;
        AudioParam.prototype.setValueAtTime = function (v) {
          if (this.__first === undefined) this.__first = v;
          return set.apply(this, arguments);
        };
        const start = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (when) {
          const lead = Math.max(0, (when ?? 0) - this.context.currentTime);
          window.__sounds.push({ t: performance.now() + lead * 1000, f: Math.round((this.frequency.__first ?? this.frequency.value) * 100) / 100 });
          return start.apply(this, arguments);
        };
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (asks) {
          localStorage.removeItem("ethos.reminder.asked");
          if (typeof Notification !== "undefined") {
            Object.defineProperty(Notification, "permission", { get: () => "default" });
            Notification.requestPermission = () => Promise.resolve("default");
          }
        } else {
          /* The reminder ask has had today's showing, so the cue has its slot. */
          localStorage.setItem("ethos.reminder.asked", today);
        }
        const css = document.createElement("style");
        css.textContent = "nextjs-portal{display:none!important}";
        document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
      },
      { asks: S.asks }
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", at, e.message.slice(0, 160)));
    const file = (beat = "") => `${OUT}${scene}${beat ? `-${beat}` : ""}-${sz.w}x${sz.h}-${sz.theme}.png`;
    try {
      await page.goto(`${BASE}/`);
      await page.waitForSelector("main .arrive", { timeout: 30000 });
      await sleep(800);
      await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
      await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
      await sleep(1200);
      await page.click('button[data-record="start"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
      await sleep(3000);
      await page.click('button[aria-label="Stop and score this recording"]', { force: true });
      await page.waitForSelector("main [data-glance]", { timeout: 30000 });
      const t0 = await page.evaluate(() => performance.now());
      await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
      await sleep(3800);
      const m = await page.evaluate(MEASURE);
      /* The pulses the glance asked for (Record's and Stop's come before it). */
      const pulses = await page.evaluate((t) => window.__pulses.filter((x) => x.at >= t).map((x) => ({ after: Math.round(x.at - t), p: x.p })), t0);
      /* The notes after the glance's first frame, as clusters (a gap of 25ms or more). */
      const notes = await page.evaluate((t) => window.__sounds.filter((n) => n.t >= t - 50).map((n) => ({ t: Math.round(n.t - t), f: n.f })), t0);
      const clusters = [];
      for (const n of notes.sort((a, b) => a.t - b.t)) {
        const last = clusters.at(-1);
        if (last && n.t - last.end < 25) {
          last.end = n.t;
          last.n += 1;
        } else clusters.push({ t: n.t, end: n.t, n: 1, f: n.f });
      }
      await page.screenshot({ path: file() });
      console.log(`shot  ${file().replace(OUT, "")}`);
      report[at] = { ...m, pulses, sounds: clusters.map((c) => `${c.t}ms×${c.n}`) };
      console.log(`  ${at}: ${JSON.stringify(report[at])}`);

      const wantsToken = scene !== "none" && scene !== "late" && scene !== "nostar";
      if (wantsToken && m.tokens !== 1) fail(`${at}: ${m.tokens} proof tokens`);
      if (!wantsToken && m.tokens !== 0) fail(`${at}: a proof token where none belongs`);
      if (m.scrolls) fail(`${at}: the glance scrolls ${m.overflow}pt`);
      if (m.taps !== 1) fail(`${at}: ${m.taps} filled taps`);
      if (m.chips > 1) fail(`${at}: ${m.chips} chips that play`);
      if (sz.w === 390 && sz.h === 844 && m.maxBand > 64) fail(`${at}: a ${m.maxBand}pt band`);
      if (sz.w === 390 && m.demos !== null && m.demos < 88) fail(`${at}: Demos at ${m.demos}pt, under his 88 floor`);
      if (scene === "worst" && m.struck !== "none") fail(`${at}: the longest pair's struck phrase is on the token`);
      if (wantsToken && pulses.length !== 1) fail(`${at}: ${pulses.length} pulses for the proof`);
      if (!wantsToken && pulses.length !== 0) fail(`${at}: a pulse with no proof`);
      if (scene === "capped") {
        /* No number, the meter's line, and the token under it. */
        const text = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
        if (!/Ethos score back tomorrow/.test(text)) fail(`${at}: no "Ethos score back tomorrow" on a capped take`);
        if (/\/1000/.test(text)) fail(`${at}: an Ethos number on a capped take`);
      }
      if (scene === "nostar") {
        /* It won nothing: no note says it did, and it says why it was not scored. */
        if (clusters.length !== 0) fail(`${at}: ${clusters.length} note(s) on a take with no star`);
        const text = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
        if (!/Not scored/.test(text)) fail(`${at}: no "Not scored" on a take with no star`);
        if (/\+\s*\d+\s*XP/.test(text)) fail(`${at}: XP shown on a take that paid none`);
      }

      if (scene === "late") {
        /* The read lands after the first frame: nothing arrives and nothing moves. */
        const wait = Math.max(0, (lexiconServedAt ? 0 : S.lexiconAfterMs) + 2500);
        await sleep(wait);
        const after = await page.evaluate(MEASURE);
        /* Nothing on the glance moved when the read landed: the line and
           the bubble stand where they stood. (The swap may be marked heard
           by Say it better's own read, which counts this take; the glance
           never marks a swap it did not show.) */
        const still = JSON.stringify(after.boxes) === JSON.stringify(m.boxes);
        await page.screenshot({ path: file("after-read") });
        console.log(`shot  ${file("after-read").replace(OUT, "")}`);
        report[`${at} after the read`] = { served: !!lexiconServedAt, tokens: after.tokens, line: after.line, still };
        console.log(`  ${at} after the read: ${JSON.stringify(report[`${at} after the read`])}`);
        if (!lexiconServedAt) fail(`${at}: the read never landed`);
        if (after.tokens !== 0) fail(`${at}: a token arrived under the reader`);
        if (!still) fail(`${at}: the glance moved when the read landed`);
      }

      if (scene === "door") {
        const url = page.url();
        /* The chip plays and opens nothing. */
        const chip = page.locator("main [data-say-token] button[data-say-chip]");
        await chip.click();
        await sleep(700);
        const afterChip = await page.evaluate(() => ({
          sheet: !!document.querySelector("[data-say-sheet]"),
          pressed: document.querySelector("main [data-say-token] button[data-say-chip]")?.getAttribute("aria-pressed"),
        }));
        if (afterChip.sheet) fail(`${at}: the chip opened the sheet`);
        /* The door: the swap's sheet over the results, no beat on the way. */
        await page.locator("main [data-say-token-door]").click();
        await page.waitForSelector("[data-say-sheet]", { timeout: 8000 });
        await sleep(1300);
        await page.screenshot({ path: file("sheet") });
        console.log(`shot  ${file("sheet").replace(OUT, "")}`);
        const sheet = await page.evaluate(() => ({
          text: document.querySelector("[data-say-sheet]")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 200),
          remove: !!document.querySelector("[data-say-remove]"),
          streak: !!document.querySelector("[data-streak-moment], [data-moment='streak']") || /Continue/.test(document.body.innerText),
          glanceUnder: !!document.querySelector("main [data-glance]"),
        }));
        if (page.url() !== url) fail(`${at}: the door left the results (${page.url()})`);
        if (sheet.remove) fail(`${at}: Remove on the results' sheet`);
        if (sheet.streak) fail(`${at}: a streak moment on the way to the sheet`);
        if (!sheet.glanceUnder) fail(`${at}: the glance is not under the sheet`);
        await page.getByRole("button", { name: "Done", exact: true }).click();
        await page.waitForSelector("[data-say-sheet]", { state: "detached", timeout: 5000 });
        await sleep(400);
        const back = await page.evaluate(() => ({
          focus: !!document.activeElement?.matches("[data-say-token-door]"),
          url: location.pathname,
        }));
        if (!back.focus) fail(`${at}: Done did not hand focus back to the token`);
        report[`${at} door`] = { afterChip, sheet, back };
        console.log(`  ${at} door: ${JSON.stringify(report[`${at} door`])}`);
      }
    } catch (e) {
      fail(`${at}: ${e.message.split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
console.log(`\n${failures.length ? `${failures.length} failure(s)` : "every shot taken, every check held"}`);
process.exit(failures.length ? 1 : 0);
