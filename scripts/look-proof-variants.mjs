/**
 * TEMPORARY (18 Nov, lib/proof-variant.ts): the camera for Say it better's
 * proof line in its three designs, for the judges. One build draws all
 * three: this camera sets the switch (`ethos.look.proof`) per shot.
 *
 *   a     an earned moment, like a level-up: its own word allowance, whole
 *   b     a visual piece under the score, outside the words, a door to the
 *         swap's sheet in Say it better
 *   c     Demos says it in the carried cue's place, celebrating; the cue
 *         for tomorrow waits a day
 *   live  the switch unset: #507's line as production draws it (the before)
 *
 * Scenes, each Today's practice on four days of history, the swap "the
 * thing is" → "the point is" saved two days ago and said at 0:11 of the
 * take, and yesterday's cue ("um" 5 times) carried in and answered:
 *
 *   returning  an ordinary returning take: the stars, the carried cue
 *              answered, Tomorrow's line, and the proof
 *   level      the same take crossing Pace to level 3 (look-trait-xp's
 *              "one" history)
 *   first      the day's first take on a phone never asked for reminders:
 *              the reminder ask in the cue's slot
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 4081
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     LOOK_BASE=http://localhost:4081 node scripts/look-proof-variants.mjs [a b c live]
 *
 * Shots: docs/look/proof/variants/<key>/<scene>-<w>x<h>-<theme>.png at
 * 390x844 light and dark and 320x568 light (LOOK_SIZES), deviceScaleFactor
 * 2; for b, the piece's door tapped (returning-door-390x844-light.png).
 * Prints, per shot, the proof as drawn, Demos's line, the cue, the earned
 * line, the visible words, the filled taps, whether it scrolls, and each
 * pulse the page asked the phone for.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
const F = await import("./look-fixtures.mjs");

const KEYS = process.argv.slice(2).length ? process.argv.slice(2) : ["a", "b", "c"];
const SCENES = (process.env.LOOK_SCENES ?? "returning,level,first").split(",");
const BASE = process.env.LOOK_BASE ?? "http://localhost:4081";
const ROOT = new URL("../docs/look/proof/variants/", import.meta.url).pathname;
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,320x568-light").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};

/* ---- the take ------------------------------------------------------------ */
/*
 * The live take with one sentence said better: "the mistake people make
 * is waiting to feel ready" becomes "the point is, people just wait to
 * feel ready", nine words for nine, so every other word keeps its time
 * and the fillers stay where the fixture counts them. "the point is"
 * starts at 0:11.
 */
const SAID = "Um, the mistake people make is waiting to feel ready.";
const BETTER = "Um, the point is, people just wait to feel ready.";
const A = F.analyzeBody;
if (!A.transcript.includes(SAID)) throw new Error("the fixture's take changed: SAID is not in it");
const TRANSCRIPT = A.transcript.replace(SAID, BETTER);
const WORDS = (() => {
  const raw = TRANSCRIPT.match(/[A-Za-z0-9']+/g);
  if (raw.length !== A.words.length) throw new Error("the better sentence moved the take's words");
  return A.words.map((w, i) => ({ ...w, word: raw[i] }));
})();
const TAKE = { ...A, transcript: TRANSCRIPT, words: WORDS };

/* The swaps: the coach's pairs (look-fixtures' SAY_LEXICON, "the thing is"
   → "the point is" saved two days ago and never tested or heard). */
const LEXICON = F.SAY_LEXICON;

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
/* The Index each day held, the take's 665 three over the last and under
   the best, so the glance says "▲ 3 since last time" and no "Best yet":
   an ordinary day, nothing earned but the stars and the proof. */
const INDEX = [680, 650, 658, A.ethosIndex - 3];
/* Five pauses held on the best day, so the take's four set no record. */
const PAUSES = [...A.metrics.pauses, { t: 60, len: 1.2, kind: "pre" }];
const flat = (n, s) =>
  Array.from({ length: n }, (_, i) => ({ ...take(`h-${i + 1}`, n - i, s), ethos_index: INDEX[i] ?? INDEX.at(-1), pauses: i === 0 ? PAUSES : tmpl.pauses }));
const HISTORY = {
  /* Every trait stays under its next level after the take. */
  returning: flat(4, { pace: 55, pause: 55, fillers: 75, repairs: 25, range: 58 }),
  /* Pace 380 + 93 crosses 420: level 3. */
  level: flat(4, { pace: 95, pause: 55, fillers: 75, repairs: 25, range: 58 }),
  first: flat(4, { pace: 55, pause: 55, fillers: 75, repairs: 25, range: 58 }),
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
  const words = (root) => {
    let text = "";
    if (!root) return { text, n: 0 };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
    text = text.replace(/\s+/g, " ").trim();
    return { text, n: text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length };
  };
  const all = words(document.querySelector("main")?.parentElement ?? document.body);
  const proofEl = document.querySelector("[data-say-proof], [data-say-piece]");
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !hidden(el);
  };
  const clip = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  };
  return {
    proof: proofEl ? proofEl.textContent.replace(/\s+/g, " ").trim() : null,
    proofWords: words(proofEl).n,
    line: clip("main [data-glance-line]"),
    cue: clip("main [data-glance-cue]"),
    ask: clip("main [data-reminder-ask]"),
    earned: clip("main [data-earned]"),
    words: all.n,
    taps: [...document.querySelectorAll(".tap, .tap-tonal")].filter(vis).length,
    scrolls: document.scrollingElement.scrollHeight > innerHeight + 1,
    overflow: document.scrollingElement.scrollHeight - innerHeight,
    piece: (() => {
      const r = document.querySelector("[data-say-piece]")?.getBoundingClientRect();
      return r ? { h: Math.round(r.height), w: Math.round(r.width) } : null;
    })(),
    celebrating: !!document.querySelector("main .earned-burst"),
  };
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

const report = {};
for (const key of KEYS) {
  const out = `${ROOT}${key}/`;
  mkdirSync(out, { recursive: true });
  for (const scene of SCENES) {
    for (const size of SIZES) {
      const at = `${key} ${scene} ${size.name}`;
      F.resetPlan("free");
      F.repsMode.rows = HISTORY[scene];
      F.extraReps.length = 0;
      const asks = scene === "first";
      const context = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        permissions: asks ? ["microphone"] : ["microphone", "notifications"],
        locale: "en-AU",
        timezoneId: "Australia/Melbourne",
        colorScheme: size.theme,
        serviceWorkers: "block",
      });
      await context.route("http://supabase.local/**", F.supabaseRoute);
      /* Say it better's swaps (registered after, so it answers first). */
      await context.route("http://supabase.local/rest/v1/lexicon**", (route) =>
        route.request().method() === "GET" ? route.fulfill(F.json(LEXICON)) : route.fallback()
      );
      /* Yesterday's cue on the account (migration 0034). */
      const written = [];
      await context.route("http://supabase.local/rest/v1/profiles**", async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (req.method() === "GET" && (url.searchParams.get("select") ?? "").includes("carried_cue")) {
          const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
          const row = { carried_cue: CUE };
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
        const last = HISTORY[scene].at(-1);
        const body = { ...TAKE, previousIndex: last ? last.ethos_index : null };
        /* Stored as the route stores it, so the read after the take holds it. */
        F.extraReps.push({
          ...tmpl,
          id: body.repId,
          client_id: "look-pv-live",
          created_at: new Date().toISOString(),
          transcript: body.transcript,
          ethos_index: body.ethosIndex,
          dimensions: { tier1: body.tier1, anchors: body.anchors, tier2: body.coach.dimensions },
        });
        await route.fulfill(F.json(body));
      });
      await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
      await context.route("**/api/audio**", (r) => r.fulfill(F.json({ error: "Not here." }, 404)));
      await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
      await context.addInitScript(
        ({ variant, asks }) => {
          if (variant === "live") localStorage.removeItem("ethos.look.proof");
          else localStorage.setItem("ethos.look.proof", variant);
          /* Haptics on, and every pulse the page asks for kept, so the
             report says when the proof's came. */
          try {
            const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
            localStorage.setItem("ethos.prefs", JSON.stringify({ ...prefs, haptics: true }));
          } catch {}
          window.__pulses = [];
          navigator.vibrate = (p) => {
            window.__pulses.push({ at: Math.round(performance.now()), p });
            return true;
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
        { variant: key, asks }
      );
      const page = await context.newPage();
      page.on("pageerror", (e) => console.log("PAGEERROR", at, e.message.slice(0, 160)));
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
        const stopAt = await page.evaluate(() => performance.now());
        await page.click('button[aria-label="Stop and score this recording"]', { force: true });
        await page.waitForSelector("main [data-glance]", { timeout: 30000 });
        await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
        await sleep(3800);
        const m = await page.evaluate(MEASURE);
        const pulses = await page.evaluate((t0) => window.__pulses.map((x) => ({ after: x.at - t0, p: x.p })), stopAt);
        const file = `${out}${scene}-${size.w}x${size.h}-${size.theme}.png`;
        await page.screenshot({ path: file });
        console.log(`shot  ${file.replace(ROOT, "")}`);
        report[at] = { ...m, pulses, cueStored: written.length ? (written.at(-1)?.cue?.kind ?? null) : "nothing written" };
        console.log(`  ${at}: ${JSON.stringify(report[at])}`);
        if (key !== "live" && !m.proof && !(key === "c" && /instead of/i.test(m.line ?? ""))) fail(`${at}: no proof on the glance`);
        if (m.scrolls) fail(`${at}: the glance scrolls`);
        if (m.taps !== 1) fail(`${at}: ${m.taps} filled taps`);
        if (key === "b" && scene === "returning" && size.name === "390x844-light") {
          /* The piece is a door: the swap's sheet in Say it better. */
          await page.locator("[data-say-piece] > button").click();
          /* A way out of the results: the streak's moment the take owes
             plays first (exitBeat), then its Continue goes on. */
          const cont = page.getByRole("button", { name: /^Continue/ });
          await Promise.race([page.waitForURL(/\/say\?/, { timeout: 15000 }), cont.waitFor({ timeout: 15000 })]).catch(() => {});
          if (!/\/say\?/.test(page.url()) && (await cont.count())) {
            await sleep(600);
            const owed = `${out}${scene}-door-streak-${size.w}x${size.h}-${size.theme}.png`;
            await page.screenshot({ path: owed });
            console.log(`shot  ${owed.replace(ROOT, "")}`);
            await cont.click();
          }
          /* Then the one ask an exit that leaves may owe ("Since day one"): Not now goes on. */
          const notNow = page.getByRole("button", { name: /^Not now/ });
          await Promise.race([page.waitForURL(/\/say\?/, { timeout: 8000 }), notNow.waitFor({ timeout: 8000 })]).catch(() => {});
          if (!/\/say\?/.test(page.url()) && (await notNow.count())) await notNow.first().click();
          await page.waitForURL(/\/say\?/, { timeout: 15000 });
          await page.waitForSelector("[data-say-sheet]", { timeout: 15000 });
          await sleep(1300);
          const door = `${out}${scene}-door-${size.w}x${size.h}-${size.theme}.png`;
          await page.screenshot({ path: door });
          console.log(`shot  ${door.replace(ROOT, "")}`);
          report[`${at} door`] = {
            url: page.url().replace(BASE, ""),
            sheet: await page.evaluate(() => document.querySelector("[data-say-sheet]")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160)),
          };
          console.log(`  door: ${JSON.stringify(report[`${at} door`])}`);
        }
      } catch (e) {
        fail(`${at}: ${e.message.split("\n")[0]}`);
      }
      await context.close();
    }
  }
}
await browser.close();
console.log(`\n${failures.length ? `${failures.length} failure(s)` : "every shot taken"}`);
process.exit(failures.length ? 1 : 0);
