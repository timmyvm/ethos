/**
 * The streak moment (DECISIONS #480), photographed: the take that first
 * makes today count, its results, and the full screen the exit plays
 * before going back to Today, where the flame lights and the count rolls
 * from yesterday's number to today's.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3844
 *   LOOK_BASE=http://localhost:3844 node scripts/look-streak.mjs after roll freeze first calm second short
 *
 * Scenes (the page's clock is moved to Thursday 19 November, 19:30 in
 * Melbourne, so this week's row has days in it before today):
 *   roll    spoke Monday to Wednesday: today's take rolls 3 to 4.
 *   freeze  spoke Sunday to Tuesday, Wednesday on a freeze: 3 to 4, the
 *           frozen day drawn as a freeze.
 *   first   a new account's first take: 0 to 1.
 *   calm    roll under reduced motion: lit, and at 4, from the first frame.
 *   second  today already spoken at 09:12: no moment, the exit goes to Today.
 *   short   a take stopped inside 1.5s: nothing is stored, no results, no moment.
 *   done    roll, left by the one tap rather than the header's back: Today's
 *           practice ends on "Done for today" (#493), which leaves for Today,
 *           so the moment plays on it. Fails a tap with other words.
 *   pro     roll on day 4 with Since day one never seen: Continue goes on to
 *           Since day one, and its Not now to Today (the #480 review: the
 *           asks follow the moment, or someone who speaks once a day never
 *           meets them).
 *
 * Each scene that shows the moment is shot at its start, mid-roll and end
 * (the page's animations paused and sought, so a frame is its moment),
 * then Continue is tapped and Today is shot. The glance before the exit
 * is shot as `glance`. A build from before #480 is shot the same way: its
 * celebration over the glance at three times, then the exit.
 *
 * Sizes: LOOK_SIZES, default 390x844-light,390x844-dark,375x667-light,375x667-dark.
 * Shots: LOOK_OUT, default docs/look/streak/, as <tag>-<scene>-<beat>-<size>.png.
 * Fails a scene whose moment comes when it should not, or not when it
 * should, a roll whose numbers are not yesterday's and today's, a moment
 * with more than one filled tap, and one whose Continue is under the fold.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "/opt/node-tools/node_modules/playwright");

/* The fixtures' Melbourne "today" is Thursday 19 November, set before they load. */
process.env.LOOK_TODAY = process.env.LOOK_TODAY ?? "2026-11-19";
const F = await import("./look-fixtures.mjs");
const CLOCK = new Date(`${process.env.LOOK_TODAY}T19:30:00+11:00`);

const TAG = process.argv[2] ?? "after";
const SCENES = process.argv.slice(3).length ? process.argv.slice(3) : ["roll", "freeze", "first", "calm", "second", "short"];
const BASE = process.env.LOOK_BASE ?? "http://localhost:3844";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/streak/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light,375x667-dark").split(",").map((s) => {
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

/* n days before the camera's Thursday, at h:12 Melbourne (AEDT, +11). */
const ago = (n, h = 18) => new Date(Date.parse(`${process.env.LOOK_TODAY}T${String(h).padStart(2, "0")}:12:00+11:00`) - n * 86_400_000);
const dateOnly = (n) => ago(n, 12).toISOString().slice(0, 10);
const template = F.reps[F.reps.length - 1];
const row = (n, i, h) => ({ ...template, id: `streak-${i}`, client_id: `streak-${i}`, created_at: ago(n, h).toISOString() });

/** What each scene's account holds before the take, and what it has after. */
const SCENE = {
  roll: { spoke: [1, 2, 3], frozen: [], from: 3, to: 4, moment: true },
  freeze: { spoke: [2, 3, 4], frozen: [1], from: 3, to: 4, moment: true },
  first: { spoke: [], frozen: [], from: 0, to: 1, moment: true },
  calm: { spoke: [1, 2, 3], frozen: [], from: 3, to: 4, moment: true, calm: true },
  second: { spoke: [1, 2, 3], frozen: [], today: true, moment: false },
  pro: { spoke: [1, 2, 3], frozen: [], from: 3, to: 4, moment: true, pro: true },
  done: { spoke: [1, 2, 3], frozen: [], from: 3, to: 4, moment: true, viaTap: "Done for today" },
  short: { spoke: [1, 2, 3], frozen: [], short: true, moment: false },
  /* A lesson's first practice makes today count: "Practice 2 of 3" goes
     straight on (the moment waits, owed), and the way back from the next
     practice's idle screen plays it. */
  lesson: { spoke: [1, 2, 3], frozen: [], from: 3, to: 4, moment: true, lesson: "know-the-landing" },
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

for (const scene of SCENES) {
  const S = SCENE[scene];
  if (!S) throw new Error(`no scene ${scene}`);
  for (const size of SIZES) {
    F.resetPlan("free");
    const at = `${scene} ${size.name}`;
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      permissions: ["microphone", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
      colorScheme: size.theme, serviceWorkers: "block", reducedMotion: S.calm ? "reduce" : "no-preference",
    });
    /* The page's clock, moved to the camera's Thursday and still running:
       the recorder times a take by it, so a fixed clock would make every
       take too short. */
    await context.addInitScript((shift) => {
      const Real = Date;
      class Shifted extends Real {
        constructor(...a) {
          if (a.length === 0) super(Real.now() + shift);
          else super(...a);
        }
        static now() {
          return Real.now() + shift;
        }
      }
      globalThis.Date = Shifted;
    }, CLOCK.getTime() - Date.now());

    let taken = false;
    const history = () => {
      const rows = S.spoke.map((n, i) => row(n, i + 1));
      if (S.today) rows.push(row(0, 90, 9));
      if (taken) rows.push({ ...row(0, 99, 19), id: "rep-live", client_id: "rep-live", created_at: new Date(Date.now() + (CLOCK.getTime() - Date.now())).toISOString(), ethos_index: F.analyzeBody.ethosIndex });
      return rows;
    };
    await context.route("http://supabase.local/**", F.supabaseRoute);
    await context.route("http://supabase.local/rest/v1/reps**", (route) => {
      const req = route.request();
      if (req.method() !== "GET") return route.fallback();
      const url = new URL(req.url());
      let rows = history();
      if ((url.searchParams.get("lesson_id") ?? "").startsWith("like.game:")) rows = [];
      const order = url.searchParams.get("order");
      if (order) {
        const [col, dir] = order.split(".");
        const sign = dir === "desc" ? -1 : 1;
        rows = [...rows].sort((a, b) => (a[col] < b[col] ? -sign : a[col] > b[col] ? sign : 0));
      }
      const limit = Number(url.searchParams.get("limit"));
      if (limit > 0) rows = rows.slice(0, limit);
      const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
      if (single) return route.fulfill(rows[0] ? F.json(rows[0]) : F.json({ code: "PGRST116", message: "0 rows" }, 406));
      return route.fulfill(F.json(rows));
    });
    await context.route("http://supabase.local/rest/v1/streak_freezes**", (route) => {
      if (route.request().method() !== "GET") return route.fulfill(F.json([]));
      return route.fulfill(F.json(S.frozen.map((n) => ({ used_on: dateOnly(n) }))));
    });
    await context.route("**/api/analyze", async (route) => {
      await sleep(900);
      taken = true;
      await route.fulfill(F.json({ ...F.analyzeBody, previousIndex: S.spoke.length ? F.analyzeBody.previousIndex : null }));
    });
    await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
    await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
    /* The reminder ask has had today's showing, and Since day one has been
       seen, except where the scene is about it. */
    await context.addInitScript((pro) => {
      const d = new Date();
      localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      if (!pro && !localStorage.getItem("ethos.pro.day3")) localStorage.setItem("ethos.pro.day3", new Date().toISOString());
    }, !!S.pro);
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
    const shot = (beat) => `${OUT}${TAG}-${scene}-${beat}-${size.name}.png`;

    const lessonBack = S.lesson ? `/lessons/${S.lesson}` : null;
    if (S.lesson) {
      await page.goto(`${BASE}/rep?lesson=${S.lesson}&q=1&back=${encodeURIComponent(lessonBack)}`);
    } else {
      await page.goto(`${BASE}/`);
      await page.waitForSelector("main .arrive", { timeout: 30000 });
      await sleep(800);
      await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
    }
    await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
    await sleep(1200);
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
    await sleep(S.short ? 300 : 3000);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });

    if (S.short) {
      await sleep(1500);
      const results = await page.locator("main [data-glance]").count();
      const moment = await page.locator("[data-streak-moment], [data-look='streak-moment']").count();
      await page.screenshot({ path: shot("stopped") });
      console.log(`${at}: results ${results}, moment ${moment}, analyze called ${taken}`);
      if (results || moment || taken) fail(`${at}: a take inside 1.5s reached results or a moment`);
      await context.close();
      continue;
    }

    await page.waitForSelector("main [data-glance]", { timeout: 30000 });
    /* A build from before #480: the celebration rises over the glance. */
    const old = await page
      .waitForSelector("[data-look='streak-moment']", { timeout: 2500 })
      .then(() => true)
      .catch(() => false);
    if (old) {
      await page.screenshot({ path: shot("start") });
      await sleep(260);
      await page.screenshot({ path: shot("mid") });
      await sleep(700);
      await page.screenshot({ path: shot("end") });
      await page.waitForSelector("[data-look='streak-moment']", { state: "detached", timeout: 5000 }).catch(() => {});
      console.log(`${at}: the celebration came up over the glance`);
    }
    await sleep(2600);
    await page.screenshot({ path: shot("glance") });

    if (S.lesson) {
      /* "Practice 2 of 3" stays in the lesson: nothing stands in it. */
      await page.locator("main [data-step-action]").click();
      await page.waitForSelector('button[data-record="start"]', { timeout: 20000 });
      const between = await page.locator("[data-streak-moment]").count();
      console.log(`${at}: moment between practices ${between > 0}`);
      if (between) fail(`${at}: the moment stood between a lesson's practices`);
      await sleep(800);
      await page.screenshot({ path: shot("practice2") });
      /* The way back from the idle recorder leaves, so the owed moment plays. */
      await page.locator("a.screen-bar-back").first().click();
    } else if (S.viaTap) {
      /* The glance's one tap, its words read first (#493: it named the
         old road's next lesson). */
      const tap = page.locator("main [data-step-action]").first();
      const words = ((await tap.textContent()) ?? "").trim();
      console.log(`${at}: the tap reads "${words}"`);
      if (words !== S.viaTap) fail(`${at}: the tap reads "${words}", wanted "${S.viaTap}"`);
      await tap.click();
    } else {
      await page.locator("main [data-results-back]").click();
    }
    const moment = await page
      .waitForSelector("[data-streak-moment]", { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    console.log(`${at}: moment on the exit ${moment}`);
    if (moment !== S.moment && !(old && TAG === "before")) fail(`${at}: moment ${moment}, wanted ${S.moment}`);

    if (moment) {
      /* Every animation in the moment, paused and sought: a frame is its moment. */
      const timeline = await page.evaluate(() => {
        const el = document.querySelector("[data-streak-moment]");
        for (const a of document.getAnimations()) a.pause();
        return {
          lightAt: Number(el.getAttribute("data-light-at")),
          rollAt: Number(el.getAttribute("data-roll-at")),
          rollMs: Number(el.getAttribute("data-roll-ms")),
          end: Number(el.getAttribute("data-end-ms")),
          /* What the first frame drew, before anything was sought. */
          first: el.querySelector(".streak-count")?.textContent ?? null,
          /* The flame's file was there for that frame (#496 review: the
             large cut, fetched only as the moment mounted, left the slot
             empty, and the reduced-motion end stood without its flame). */
          flame: [...el.querySelectorAll(".streak-flame img")].map((i) => i.complete && i.naturalWidth > 0),
          animations: document.getAnimations().length,
        };
      });
      const seek = (t) =>
        page.evaluate((t) => {
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = t;
          }
        }, t);
      const read = () =>
        page.evaluate(() => {
          const el = document.querySelector("[data-streak-moment]");
          const r = el.querySelector("[data-continue]")?.getBoundingClientRect();
          return {
            label: el.querySelector("h1")?.textContent ?? null,
            line: el.querySelector("[data-streak-line]")?.textContent ?? null,
            from: el.getAttribute("data-from"),
            to: el.getAttribute("data-to"),
            taps: [...el.querySelectorAll(".tap, .tap-tonal")].length,
            continueBottom: r ? Math.round(r.bottom) : null,
            frozen: el.querySelectorAll("[data-day='frozen']").length,
            scrolls: document.scrollingElement.scrollHeight > innerHeight + 1,
            /* Today's block at rest: no transform held on it, or its layer
               snaps a pixel short of its slot and a sand seam shows. */
            fillHeld: (() => {
              const f = el.querySelector("[data-fill]");
              return f ? getComputedStyle(f).transform !== "none" : false;
            })(),
            /* The ground between what is drawn (#496): over the flame,
               flame to count, words to the week, and the week (or the
               freeze's line) to Continue. The flame's square holds the
               drawing with 4u of air over and under it (88u tall on the
               96u grid, components/icons/flat/stat-drawings.ts), so its
               band is read from the drawing, not the square. */
            bands: (() => {
              const box = (q) => el.querySelector(q)?.getBoundingClientRect() ?? null;
              const flame = box(".streak-flame");
              const air = flame ? (flame.height * 4) / 96 : 0;
              const count = box(".streak-count");
              const words = box("h1 [data-line]");
              const week = box(".streak-week");
              const freeze = box(".streak-week ~ p[data-line]");
              const go = box("[data-continue]");
              const top = el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop || "0");
              if (!flame || !count || !words || !week || !go) return null;
              return {
                top: Math.round(flame.top + air - top),
                count: Math.round(count.top - (flame.bottom - air)),
                week: Math.round(week.top - words.bottom),
                foot: Math.round(go.top - (freeze ?? week).bottom),
                flame: Math.round(flame.height),
                countPx: Math.round(parseFloat(getComputedStyle(el.querySelector(".streak-count")).fontSize)),
              };
            })(),
          };
        });
      if (TAG !== "before" && !(timeline.flame.length && timeline.flame.every(Boolean)))
        fail(`${at}: the flame's file was not there on the moment's first frame (${JSON.stringify(timeline.flame)})`);
      if (S.calm) {
        /* Reduced motion: lit and at today's count from the first frame, nothing rolling. */
        console.log(`${at}: first frame "${timeline.first}", ${timeline.animations} animation(s)`);
        if (timeline.first !== String(S.to)) fail(`${at}: the first frame drew "${timeline.first}", wanted ${S.to}`);
        if (timeline.animations !== 0) fail(`${at}: ${timeline.animations} animation(s) under reduced motion`);
      } else {
        /* The start is the screen arrived, the flame not yet lit. */
        await seek(timeline.lightAt - 1);
        await page.screenshot({ path: shot("start") });
        /* About half way through the turn: a spring front-loads its travel. */
        await seek(timeline.rollAt + timeline.rollMs * 0.18);
        await page.screenshot({ path: shot("mid") });
      }
      await seek(timeline.end + 1000);
      await page.screenshot({ path: shot("end") });
      const m = await read();
      console.log(`${at}: ${m.from} to ${m.to}; "${m.line}"; ${m.taps} tap(s); Continue bottom ${m.continueBottom}; frozen days ${m.frozen}; scrolls ${m.scrolls}`);
      if (m.bands) {
        const b = m.bands;
        console.log(`${at}: flame ${b.flame}, count ${b.countPx}px; bands over the flame ${b.top}, to the count ${b.count}, to the week ${b.week}, to Continue ${b.foot}`);
        /* No band of bare ground over 64 (#496, DESIGN principle 7). A
           build from before #496 is measured and printed, never failed. */
        for (const [name, v] of Object.entries({ top: b.top, count: b.count, week: b.week, foot: b.foot })) {
          if (v > 64 && TAG !== "before") fail(`${at}: ${v}px of ground ${name === "top" ? "over the flame" : name === "foot" ? "over Continue" : `before the ${name}`}`);
        }
      } else if (TAG !== "before") fail(`${at}: the moment's parts were not found to measure`);
      if (Number(m.from) !== S.from || Number(m.to) !== S.to) fail(`${at}: rolled ${m.from} to ${m.to}, wanted ${S.from} to ${S.to}`);
      if (m.taps !== 1) fail(`${at}: ${m.taps} filled taps`);
      if (m.continueBottom === null || m.continueBottom > size.h) fail(`${at}: Continue is under the fold (${m.continueBottom} > ${size.h})`);
      if (m.scrolls) fail(`${at}: the moment scrolls`);
      if (m.fillHeld) fail(`${at}: today's block still holds a transform at rest (a 1px seam at its edge)`);
      if (S.frozen.length && m.frozen !== S.frozen.length) fail(`${at}: ${m.frozen} frozen days drawn, wanted ${S.frozen.length}`);
      await page.evaluate(() => {
        for (const a of document.getAnimations()) a.play();
      });
      await page.locator("[data-streak-moment] [data-continue]").click();
      if (S.pro) {
        /* The ask that follows the moment in the same exit: Since day one. */
        const pro = await page
          .getByText("Since day one", { exact: true })
          .waitFor({ timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        console.log(`${at}: Since day one after Continue ${pro}`);
        if (!pro) fail(`${at}: Since day one did not follow the moment`);
        else {
          await sleep(600);
          await page.screenshot({ path: shot("since") });
          await page.getByRole("button", { name: "Not now", exact: true }).click();
        }
      }
    }
    const where = lessonBack ?? "/";
    await page
      .waitForURL((u) => new URL(u).pathname === where, { timeout: 10000 })
      .catch(() => fail(`${at}: the exit did not reach ${where} (at ${new URL(page.url()).pathname})`));
    await page.waitForSelector("main .arrive", { timeout: 30000 }).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: shot(S.lesson ? "lesson" : "today") });
    await context.close();
  }
}

await browser.close();
console.log(`\n${TAG}: ${failures.length ? `${failures.length} failure(s)` : "every check passed"}`);
process.exit(failures.length ? 1 : 0);
