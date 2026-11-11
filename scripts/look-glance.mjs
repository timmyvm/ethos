/**
 * The results after a take, photographed and counted (DECISIONS #427):
 * Timothy's "so much to read" (7 Nov) as a number on every screen.
 *
 * Walks a take to its results and shoots every beat after it, full page
 * and one phone screen at a time, printing the visible words on each.
 * It reads whichever results the server has: the old three-step walk
 * (The score, The numbers, Your words) or the glance and its door (The
 * whole recording). On the glance it also asserts the rules the glance is
 * held to: at most 25 visible words (named exceptions at their own
 * ceiling), no scroll, exactly one filled tap (`.tap` since #437; it
 * counted the terracotta fill), at most one moment
 * chip, and the tap live from the first frame.
 *
 *   NEXT_DIST_DIR=.next-glance NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3661
 *   LOOK_BASE=http://localhost:3661 node scripts/look-glance.mjs after lesson
 *   LOOK_BEST=1 node scripts/look-glance.mjs after best
 *   LOOK_FRESH=1 node scripts/look-glance.mjs after first
 *
 * Variants: lesson (The cold open, practice 1 of 3), lesson3 (its last
 * practice, the first two taken earlier today: the lesson's ending, and
 * its exit; LOOK_PLAN=code for Premium), daily (Today's card, Pausing),
 * unscored (12 words), game (a Q&A round), capped (a free account's
 * second take today), tester, best (LOOK_BEST=1), first (LOOK_FRESH=1),
 * video (a Premium Voice + Video take, with Presence 72 since 68), boss,
 * upload.
 *
 * The #427 review added: every glance's bands (no gap over 64 between
 * the header's back and the shelf at 390x844, reported elsewhere), the
 * door wholly above the shelf, no back while "How did that feel?" is
 * asked, and playback started in the sheet stopping with it.
 * Sizes: LOOK_SIZES, default "390x844-light,390x844-dark,375x667-light".
 * Shots: LOOK_OUT, default docs/look/results-lighter/, as
 * <tag>-<variant>-<size>-<beat>-<s0|full>.png, and a JSON report of every
 * count beside them. LOOK_STRIP=1 adds the sheet's rise as a strip (0,
 * 80, 160, 240, 400ms); LOOK_BLUR=7 blurs the glance for the squint test.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "/opt/node-tools/node_modules/playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const VARIANT = process.argv[3] ?? "lesson";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3661";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/results-lighter/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
const BLUR = Number(process.env.LOOK_BLUR ?? 0);
const STRIP = process.env.LOOK_STRIP === "1";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};

/* ---- the take each variant scores ------------------------------------- */
const A = F.analyzeBody;
const UNSCORED_WORDS = F.LIVE_WORDS.slice(0, 12);
const bodies = {
  lesson: () => A,
  lesson3: () => ({ ...A, previousIndex: 662, ethosIndex: 689 }),
  daily: () => A,
  tester: () => A,
  best: () => A,
  first: () => ({ ...A, previousIndex: null }),
  capped: () => ({ ...A, coach: null, ethosIndex: null, judged: { ran: false, unlimited: false, remaining: 0, capped: true } }),
  unscored: () => ({
    ...A,
    transcript: "So the thing about habits is, um, they compound. You do",
    words: UNSCORED_WORDS,
    metrics: {
      ...A.metrics,
      durationS: 9, wordCount: 12, wpm: 80, fillerCount: 1, fillersPerMin: 6.7,
      fillers: [A.metrics.fillers[0]], fillerCounts: { um: 1 }, topFiller: "um",
      repairCount: 0, repairsPerMin: 0, pauses: [], heldPauses: 0, composedPauses: 0, midSentencePauses: 0, stars: 1,
      substance: { wordCount: 12, distinctRatio: 0.92, repeatShare: 0 },
    },
    coach: null, ethosIndex: null, scorable: false, pauseHeadline: null,
  }),
  game: () => ({
    ...A,
    mode: "game",
    round: {
      game: "qa", v: 1, level: 1, cap: 90, durationS: 62, stoppedBy: "you", lastWord: 61.4, stars: 2, scorable: true, counted: true, best: 22,
      cutIns: [{ at: 17.2, line: "Says who?", gap: 1.2, gapFrom: 17.4, gapTo: 18.6, verdict: "held", fillerAt: null, fillerWord: null, cleanAfter: 22, spokeAfter: 30 }],
    },
  }),
  video: () => ({ ...A, captureMode: "video", previousPresence: 680 }),
  boss: () => ({
    ...A,
    mode: "boss",
    accuracy: { score: 72, coverage: 0.75, covered: ["a", "b", "c"], missed: ["The fourth point"], confidentlyWrong: 0, claims: [] },
  }),
  upload: () => A,
};
if (!bodies[VARIANT]) throw new Error(`unknown variant ${VARIANT}`);
const premium = ["game", "video"].includes(VARIANT) || process.env.LOOK_PLAN === "code";
/* lesson3: the lesson's first two practices, taken earlier today, so the
   last practice is the lesson's ending ("Lesson done: 6, 4, 4 fillers"). */
if (VARIANT === "lesson3") {
  const at = (min) => new Date(new Date(F.TODAY_REP.created_at).getTime() + min * 60000).toISOString();
  const fillers = (n) => Array.from({ length: n }, (_, k) => ({ word: k % 2 ? "like" : "um", t: 2.7 + k * 9.1 }));
  F.extraReps.push(
    { ...F.TODAY_REP, id: "lesson3-p1", client_id: "lesson3-p1", lesson_id: "lesson:the-cold-open:1", created_at: at(0), filler_count: 6, fillers: fillers(6), ethos_index: 650 },
    { ...F.TODAY_REP, id: "lesson3-p2", client_id: "lesson3-p2", lesson_id: "lesson:the-cold-open:2", created_at: at(9), filler_count: 4, fillers: fillers(4), ethos_index: 662 }
  );
}
/* video: the Presence a pose model would have measured, which a headless
   browser has none of (app/rep/page.tsx cameraPresence). */
const PRESENCE = {
  metrics: { gestureRate: 6, postureDrift: 0.08, headStability: 0.82, eyeLinePct: 71, headLift: 0.4, neckGap: 0.2, presenceScore: 720 },
  dimensions: [],
  moments: [{ t: 21.4, kind: "eyes-down", seconds: 3, note: "0:21, eyes down for 3 seconds." }],
  usableFrames: 240,
  scorable: true,
};

/* ---- the measuring tape: walk.mjs's, so before and after count alike --- */
const MEASURE = (scope) => {
  const hidden = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (e.matches?.('nav[aria-label="Sections"], nextjs-portal, .sr-only, [hidden]')) return true;
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return true;
    }
    return false;
  };
  const root = scope === "dialog" ? document.querySelector('[role="dialog"]') : document.body;
  const chunks = [];
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = (n.nodeValue ?? "").replace(/\s+/g, " ").trim();
      if (!t) continue;
      const p = n.parentElement;
      if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(p.tagName)) continue;
      if (scope === "page" && p.closest('[role="dialog"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (hidden(p)) continue;
      chunks.push({ t, raw: n.nodeValue ?? "", left: r.left, right: r.right, top: Math.round(r.top + scrollY), transcript: !!p.closest(".transcript"), round: !!p.closest('section[aria-label="The round"]') });
    }
  }
  const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  const nums = (s) => (s.match(/\d+(?:[.:,]\d+)*/g) ?? []).length;
  const join = (cs) => {
    let out = "";
    let prev = null;
    for (const c of cs) {
      const touching = prev && Math.abs(c.top - prev.top) < 4 && c.left - prev.right < 1.5 && c.left >= prev.left && !/\s$/.test(prev.raw) && !/^\s/.test(c.raw);
      out += (prev && !touching ? " " : "") + c.t;
      prev = c;
    }
    return out;
  };
  const all = join(chunks);
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !hidden(el);
  };
  const within = scope === "dialog" ? root : document.querySelector("main");
  const count = (sel) => (within ? [...within.querySelectorAll(sel)].filter(vis).length : 0);
  /* The bands (DESIGN rule 7, the #427 review): every vertical gap between
     painted things in main, from the header's back to the shelf's first
     control. Text by its line boxes, art and controls by their boxes. */
  const boxes = [];
  const mainEl = document.querySelector("main");
  if (scope === "page" && mainEl) {
    for (const c of chunks) if (c.top !== undefined) boxes.push([c.top - scrollY, c.top - scrollY + 1]);
    const walker2 = document.createTreeWalker(mainEl, NodeFilter.SHOW_TEXT);
    while (walker2.nextNode()) {
      const n = walker2.currentNode;
      if (!(n.nodeValue ?? "").trim() || hidden(n.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.height > 0) boxes.push([r.top, r.bottom]);
    }
    for (const el of mainEl.querySelectorAll("img, svg, video, canvas, button, [data-glance-door], .card")) {
      if (hidden(el) || el.closest("[data-footer-shelf]")) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) boxes.push([r.top, r.bottom]);
    }
  }
  const shelf = document.querySelector("main [data-footer-shelf]");
  const shelfTop = shelf ? Math.min(...[...shelf.querySelectorAll("button, a, p")].map((e) => e.getBoundingClientRect().top).filter((t) => t > 0)) : innerHeight;
  const sorted = boxes.filter(([a, b]) => b > 0 && a < shelfTop).sort((x, y) => x[0] - y[0]);
  let maxBand = 0;
  let band = null;
  let reach = sorted.length ? sorted[0][1] : 0;
  for (const [a, b] of sorted.slice(1)) {
    if (a - reach > maxBand) {
      maxBand = a - reach;
      band = [Math.round(reach), Math.round(a)];
    }
    reach = Math.max(reach, b);
  }
  if (shelfTop - reach > maxBand && sorted.length) {
    maxBand = shelfTop - reach;
    band = [Math.round(reach), Math.round(shelfTop)];
  }
  const door = document.querySelector("main [data-glance-door]")?.getBoundingClientRect();
  const shelfBox = shelf?.getBoundingClientRect();
  return {
    maxBand: Math.round(maxBand),
    band,
    doorClear: door && shelfBox ? door.bottom <= shelfBox.top + 1 : null,
    backDuringFelt: !!document.querySelector("main [data-results-back]"),
    words: words(all),
    wordsNoTranscript: words(join(chunks.filter((c) => !c.transcript))),
    wordsNoRound: words(join(chunks.filter((c) => !c.round))),
    numbers: nums(all),
    text: all,
    scrollH: document.scrollingElement.scrollHeight,
    innerH: innerHeight,
    taps: count(".tap, .tap-tonal"),
    chips: count("[data-glance-chip], [data-pause-moment]"),
  };
};

/* ---- the browser -------------------------------------------------------- */
const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const report = { tag: TAG, variant: VARIANT, sizes: [] };

for (const size of SIZES) {
  F.resetPlan(premium ? "code" : "free");
  F.testerMode.tester = VARIANT === "tester";
  /* The capped take is the day's second: today already holds one. */
  F.testerMode.today = VARIANT === "capped";
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone", "camera", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: size.theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/analyze", async (route) => {
    await sleep(1500);
    await route.fulfill(F.json(bodies[VARIANT]()));
  });
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.route("**/api/words", (r) => r.fulfill(F.json({ alternatives: ["point", "idea", "claim"], source: "model" })));
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF, tester: VARIANT === "tester" });
  /* The reminder ask (#430) has had its showing today on this phone, so
     each variant's glance is its own; the daily walk below shoots the ask. */
  await context.addInitScript(() => {
    const d = new Date();
    localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  if (VARIANT === "video") {
    await context.addInitScript(() => {
      try {
        const p = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
        localStorage.setItem("ethos.prefs", JSON.stringify({ ...p, captureMode: "video" }));
      } catch {}
    });
    await context.addInitScript((presence) => {
      window.__ethosLookPresence = presence;
    }, PRESENCE);
  }
  if (VARIANT === "lesson3") {
    /* A phone that has never been asked: the reminder ask can show. */
    await context.addInitScript(() => {
      try {
        Object.defineProperty(Notification, "permission", { get: () => "default" });
        Notification.requestPermission = () => Promise.resolve("default");
      } catch {}
    });
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  const at = `${VARIANT} ${size.name}`;
  const file = (beat, kind) => `${OUT}${TAG}-${VARIANT}-${size.name}-${beat}-${kind}.png`;
  const entry = { size: size.name, beats: [] };
  report.sizes.push(entry);

  /** One beat: its counts, a phone screen at a time, and the whole page. */
  async function beat(name, { scope = "page", scroller = null, ceiling: base = null, full = true } = {}) {
    let ceiling = base;
    if (!scroller) await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    const m = await page.evaluate(MEASURE, scope);
    m.beat = name;
    m.files = [];
    if (BLUR && name === "glance") {
      await page.addStyleTag({ content: `main{filter:blur(${BLUR}px)}` });
      await page.screenshot({ path: file(name, `blur${BLUR}`) });
      await page.addStyleTag({ content: "main{filter:none}" });
    }
    /* One phone screen at a time, the page's scroll or the sheet's. */
    let i = 0;
    for (;;) {
      const f = file(name, `s${i}`);
      await page.screenshot({ path: f });
      m.files.push(f);
      const moved = await page.evaluate(
        ({ sel, step }) => {
          const el = sel ? document.querySelector(sel) : document.scrollingElement;
          if (!el) return false;
          const before = el.scrollTop;
          el.scrollTop = before + step;
          return el.scrollTop > before + 1;
        },
        { sel: scroller, step: Math.round(size.h * 0.75) }
      );
      i++;
      if (!moved || i > 10) break;
      await sleep(300);
    }
    await page.evaluate((sel) => {
      const el = sel ? document.querySelector(sel) : document.scrollingElement;
      if (el) el.scrollTop = 0;
    }, scroller);
    if (full && !scroller) {
      const f = file(name, "full");
      await page.screenshot({ path: f, fullPage: true });
      m.files.push(f);
    }
    m.screens = scroller ? i : +(m.scrollH / m.innerH).toFixed(2);
    entry.beats.push(m);
    const outside = VARIANT === "game" && m.wordsNoRound !== m.words ? `, ${m.wordsNoRound} outside the round card` : "";
    console.log(`${at} ${name}: ${m.words} words (${m.wordsNoTranscript} outside the transcript${outside}), ${m.numbers} numbers, ${m.screens} screens, ${m.taps} filled tap(s), ${m.chips} chips`);
    if (ceiling !== null) {
      /* The reminder ask's own words ride on the ceiling, up to 16 (#430, GLANCE_WORDS_ASK). */
      const askWords = await page.evaluate(() => {
        const a = document.querySelector("main [data-reminder-ask]");
        return a ? a.innerText.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length : 0;
      });
      ceiling += Math.min(16, askWords);
      const counted = VARIANT === "game" ? m.wordsNoRound : m.words;
      if (counted > ceiling) fail(`${at} ${name}: ${counted} words over the ceiling of ${ceiling}`);
      if (m.scrollH > m.innerH + 1) fail(`${at} ${name}: scrolls (${m.scrollH} over ${m.innerH})`);
      if (m.taps !== 1) fail(`${at} ${name}: ${m.taps} filled taps`);
      if (m.chips > 1) fail(`${at} ${name}: ${m.chips} moment chips`);
      if (m.doorClear === false) fail(`${at} ${name}: the door is under the shelf`);
      console.log(`${at} ${name}: largest band ${m.maxBand}pt ${JSON.stringify(m.band)}`);
      if (size.w === 390 && size.h === 844 && m.maxBand > 64) fail(`${at} ${name}: a ${m.maxBand}pt band (rule 7's 64)`);
    }
    return m;
  }

  /* ---- the way in ------------------------------------------------------- */
  if (VARIANT === "game") {
    await page.goto(`${BASE}/rep?game=qa&q=qa2`);
  } else if (VARIANT === "boss") {
    /* Where /boss's Start reading lands once the 90s read is over. */
    await page.goto(`${BASE}/rep?boss=week`);
  } else if (VARIANT === "lesson3") {
    await page.goto(`${BASE}/rep?lesson=the-cold-open&q=3&mods=no-notes&back=${encodeURIComponent("/lessons/the-cold-open")}`);
  } else if (["daily", "capped", "video"].includes(VARIANT)) {
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main .arrive", { timeout: 30000 });
    await sleep(800);
    await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
  } else {
    await page.goto(`${BASE}/lessons/the-cold-open`);
    await page.waitForSelector('main a[href*="lesson="]', { timeout: 30000 });
    await sleep(600);
    await page.getByRole("link", { name: "Start", exact: true }).click();
  }
  await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
  await sleep(900);
  await page.click('button[aria-label="Start recording"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
  /* Five seconds of the fake mic, so the glance's first moment (0:01.7
     to 0:04.2) is inside the take and can be heard playing on. */
  await sleep(5000);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });

  if (VARIANT === "tester") {
    await page.waitForSelector("text=How did that feel?", { timeout: 20000 });
    await sleep(900);
    const felt = await beat("felt");
    if (felt.backDuringFelt) fail(`${at}: the header's back is offered while "How did that feel?" is asked`);
    await page.getByRole("button", { name: "Okay" }).click();
  }

  /* The landing: the results' first frame, then when the tap is live. */
  await page.waitForSelector("main .arrive-x", { timeout: 30000 });
  const t0 = Date.now();
  await page.waitForSelector("main [data-step-action]", { state: "visible", timeout: 10000 });
  const tapLiveMs = Date.now() - t0;
  const glance = await page.$("main [data-glance]");
  await sleep(glance ? 3200 : 3500);
  entry.tapLiveMs = tapLiveMs;

  if (glance) {
    /* ---- the glance ----------------------------------------------------- */
    const ceiling = VARIANT === "tester" ? 36 : VARIANT === "first" ? 28 : VARIANT === "lesson3" ? 30 : 25;
    await beat("glance", { ceiling });
    console.log(`${at} glance: the tap is live ${tapLiveMs}ms after the first frame`);
    if (tapLiveMs > 400) fail(`${at}: the tap took ${tapLiveMs}ms to be live`);

    /* The chip plays, and keeps playing once the sheet is open. */
    const chip = await page.$("main [data-glance-chip]");
    if (chip && (await chip.evaluate((e) => e.tagName === "BUTTON"))) {
      await chip.click();
      await sleep(200);
    }
    /* ---- the door: The whole recording ---------------------------------- */
    const door = page.locator("main [data-glance-door]");
    if (STRIP) {
      const frames = [];
      const t = Date.now();
      await door.click();
      for (const ms of [0, 80, 160, 240, 400]) {
        await sleep(Math.max(0, ms - (Date.now() - t)));
        frames.push(await page.screenshot());
      }
      const sharp = (await import("sharp")).default;
      const w = size.w * 2;
      const h = size.h * 2;
      await sharp({ create: { width: w * 5 + 40, height: h, channels: 3, background: "#808080" } })
        .composite(frames.map((input, i) => ({ input, left: i * (w + 10), top: 0 })))
        .png()
        .toFile(file("sheet-rise", "strip"));
      console.log(`${at} sheet rise strip shot`);
    } else {
      await door.click();
    }
    await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 5000 });
    await sleep(500);
    /* The take's one <audio> stays on the page under the sheet: the
       moment started on the glance is still playing with the sheet up. */
    const playing = await page.evaluate(() => {
      const a = document.querySelector("main audio");
      return a ? { paused: a.paused, t: +a.currentTime.toFixed(2), duration: +a.duration.toFixed(2) } : null;
    });
    /* The fake mic's take is five seconds: a moment that starts past its
       end (0:20) has nothing to play here, so only an earlier one is held. */
    const chipAt = chip
      ? await chip.evaluate((e) => {
          const m = /(\d+):(\d+)/.exec(e.getAttribute("aria-label") ?? e.textContent ?? "");
          return m ? Number(m[1]) * 60 + Number(m[2]) : Infinity;
        })
      : Infinity;
    if (chip && (await chip.evaluate((e) => e.tagName === "BUTTON")) && playing && chipAt < (playing.duration || 0) - 1) {
      /* Paused past the moment's own end (a strip's frames take a while)
         is the moment played through, not stopped by the sheet. */
      if (!playing || (playing.paused && playing.t < chipAt + 1.4))
        fail(`${at}: the glance's moment stopped when the sheet opened (${JSON.stringify(playing)})`);
      else console.log(`${at} the glance's moment plays on under the sheet (${JSON.stringify(playing)})`);
    }
    await sleep(400);
    const focusIn = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    if (!focusIn) fail(`${at}: focus did not move into the sheet`);
    await beat("sheet", { scope: "dialog", scroller: "[data-sheet-scroll]" });
    /* A word in the transcript opens its sheet over this one. */
    const word = page.locator('[role="dialog"] .transcript [role="button"]').nth(3);
    if ((await word.count()) > 0) {
      await word.scrollIntoViewIfNeeded();
      await word.click();
      await sleep(900);
      const sheets = await page.$$eval('[role="dialog"]', (els) => els.length);
      if (sheets < 2) fail(`${at}: a transcript word did not open its sheet over the whole recording`);
      await page.screenshot({ path: file("sheet-word", "s0") });
      await page.keyboard.press("Escape");
      await sleep(700);
    }
    /* Hear it back's Play, started in the sheet, stops when the sheet
       closes: nothing on the glance could stop it (the review). */
    const hearPlay = page.locator('[role="dialog"] button[aria-label="Play"]').first();
    if ((await hearPlay.count()) > 0) {
      await hearPlay.scrollIntoViewIfNeeded();
      await hearPlay.click();
      await sleep(400);
    }
    await page.keyboard.press("Escape");
    await sleep(700);
    if ((await hearPlay.count().catch(() => 0)) >= 0) {
      const after = await page.evaluate(() => {
        const a = document.querySelector("main audio");
        return a ? { paused: a.paused, t: +a.currentTime.toFixed(2) } : null;
      });
      if (after && !after.paused) fail(`${at}: Hear it back played on after the sheet closed (${JSON.stringify(after)})`);
      else console.log(`${at} the sheet's playback stopped with it (${JSON.stringify(after)})`);
    }
    const back = await page.evaluate(() => ({
      open: !!document.querySelector('[role="dialog"][aria-label="Every number"]'),
      onDoor: !!document.activeElement?.matches("[data-glance-door]"),
    }));
    if (back.open) fail(`${at}: Escape left the sheet open`);
    if (!back.onDoor) fail(`${at}: closing the sheet did not hand focus back to the door`);

    /* ---- on the way out ------------------------------------------------- */
    if (VARIANT === "lesson3") {
      /* The ending's tap leaves for the next lesson: Since day one for a
         free account, the reminder ask for Premium, once a day. */
      console.log(`${at} tap: ${(await page.locator("main [data-step-action]").innerText()).trim()}`);
      await page.locator("main [data-step-action]").click();
      await sleep(2200);
      await beat("exit-tap");
    } else if (["daily", "lesson"].includes(VARIANT) && size.name === SIZES[0].name) {
      /* An exit that leaves: the header's back. Since day one is a free
         account's once per browser; with it shown, the reminder ask. */
      await page.locator("main [data-results-back]").click();
      await sleep(1600);
      await beat("exit-leaves");
      if (VARIANT === "daily") {
        await page.evaluate(() => localStorage.setItem("ethos.pro.day3", new Date().toISOString()));
      }
    } else {
      await page.locator("main [data-step-action]").click();
      await sleep(2200);
      await beat("exit-tap");
    }
  } else {
    /* ---- the old walk: The score, The numbers, Your words ---------------- */
    await beat("score");
    for (const name of ["numbers", "words"]) {
      const next = page.locator("main [data-step-action]");
      const label = (await next.innerText()).trim();
      if (!/The numbers|Your words/.test(label)) break;
      await next.click();
      await sleep(1800);
      await beat(name);
    }
    await page.locator("main [data-step-action]").click();
    await sleep(2200);
    await beat("exit-tap");
  }
  await context.close();
}

/* The reminder ask, once: on the daily take's glance, the day's first scored take (#430). */
if (VARIANT === "daily" && process.env.LOOK_ASK !== "0") {
  const size = SIZES[0];
  F.resetPlan("free");
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: size.theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/analyze", async (route) => {
    await sleep(1500);
    await route.fulfill(F.json(A));
  });
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => localStorage.setItem("ethos.pro.day3", new Date().toISOString()));
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  /* Headless Chromium answers "denied" for notifications whatever the
     context grants; a phone that has never been asked says "default". */
  await context.addInitScript(() => {
    try {
      Object.defineProperty(Notification, "permission", { get: () => "default" });
      Notification.requestPermission = () => Promise.resolve("default");
    } catch {}
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main .arrive", { timeout: 30000 });
  await sleep(800);
  await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
  await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
  await sleep(900);
  await page.click('button[aria-label="Start recording"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]');
  await sleep(2600);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main .arrive-x", { timeout: 30000 });
  await sleep(3500);
  {
    const asked = await page.waitForSelector("main [data-reminder-ask]", { timeout: 4000 }).catch(() => null);
    await sleep(600);
    const f = `${OUT}${TAG}-daily-${size.name}-reminder-ask-s0.png`;
    await page.screenshot({ path: f });
    const m = await page.evaluate(MEASURE, "page");
    const askText = asked
      ? await asked.evaluate((e) => {
          let t = "";
          const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) if (!w.currentNode.parentElement?.closest("select, .sr-only")) t += ` ${w.currentNode.nodeValue}`;
          return t.replace(/\s+/g, " ").trim();
        })
      : "";
    const askWords = askText.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
    console.log(`daily ${size.name} reminder-ask: ${asked ? `"${askText}", ${m.words} words on the glance` : "not shown"}`);
    if (!asked) fail("the reminder ask did not show on the day's first scored take");
    if (m.words > 25 + Math.min(16, askWords)) fail(`the glance with the ask says ${m.words} words`);
    if (m.scrollH > m.innerH + 1) fail("the glance with the ask scrolls");
    if (m.taps !== 1) fail(`the glance with the ask has ${m.taps} filled taps`);
    console.log(`daily ${size.name} reminder-ask: largest band ${m.maxBand}pt ${JSON.stringify(m.band)}`);
    if (size.w === 390 && size.h === 844 && m.maxBand > 64) fail(`the glance with the ask has a ${m.maxBand}pt band`);
    report.reminderAsk = { words: m.words, askWords, text: askText };
  }
  await context.close();
}

writeFileSync(
  `${OUT}${TAG}-${VARIANT}${process.env.LOOK_SIZES ? `-${SIZES.map((s) => s.name).join("_")}` : ""}.json`,
  JSON.stringify(report, null, 2)
);
await browser.close();
console.log(`\n${TAG} ${VARIANT}: ${failures.length ? `${failures.length} failure(s)` : "every check passed"}`);
process.exit(failures.length ? 1 : 0);
