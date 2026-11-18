/**
 * The motion layer, checked in a real browser (DECISIONS #221 to #230).
 *
 * Drives the built app through the welcome carousel, home, a sheet, a
 * recording, its debrief and the celebration, and reads the computed
 * animation of each moment: that the attribute is on <html> before
 * paint, that a sheet rises and plays its exit before it unmounts,
 * that the ring grows out of the Record button, that the Index counts
 * and the stars land after it, that the bars fill, and that the
 * Settings switch collapses all of it to fades. Supabase and the
 * scoring route are mocked in-page, so it runs against a build with
 * NEXT_PUBLIC_SUPABASE_URL=http://supabase.local (the host is never
 * resolved; Playwright answers it).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npm run build && npx next start -p 3123
 *   node scripts/check-motion.mjs            # playwright resolvable, or
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-motion.mjs
 *
 * Writes findings.json, a screenshot and a 390px video of the run next
 * to itself under docs/devibe/motion-check/, or under CHECK_OUT (set it
 * to a folder outside the repo when the app is `next dev`).
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
/* CHECK_OUT sends the video and the findings somewhere else. Against
   `next dev` it has to: the dev server watches the repo, a video being
   written into it is a change on every frame, and a page loaded during
   the rebuild that follows is handed a layout chunk cut off part way
   ("Invalid or unexpected token", an empty <main>). A built app has no
   watcher, so the default is fine there. */
const OUT = (process.env.CHECK_OUT ?? new URL("../docs/devibe/motion-check/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Supabase mock -------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
/* An account, not a guest: since #410 a guest anywhere past the
   introduction is sent to sign up, so a guest's walk never reached Today. */
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", aud: "authenticated", role: "authenticated", exp, is_anonymous: false, session_id: "s1" })}.sig`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "tim@example.com", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r1", user };
const reps = [];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
const json = (body, status = 200) => ({ status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function supabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (url.pathname.startsWith("/auth/v1/signup") || url.pathname.startsWith("/auth/v1/token")) return route.fulfill(json(session));
  if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(json(user));
  if (url.pathname.startsWith("/auth/v1/")) return route.fulfill(json({}));
  if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill(json(0));
  // fetchReps asks for the newest first (order=created_at.desc) and reverses.
  if (url.pathname.startsWith("/rest/v1/reps")) return route.fulfill(json(req.method() === "GET" ? [...reps].reverse() : []));
  if (url.pathname.startsWith("/rest/v1/")) return route.fulfill(json([]));
  if (url.pathname.startsWith("/storage/")) return route.fulfill(json({ signedURL: "/x.wav" }));
  return route.fulfill(json({}, 404));
}

// ---- The scoring mock ----------------------------------------------------
const dim = (score, moment) => ({ score, citedMoment: moment, improve: "Open with the claim, then the example." });
const analyze = {
  transcript: "So the thing about habits is, um, they compound. You do the small version every day and, like, the big version arrives on its own. Um, the mistake people make is waiting to feel ready. You know, ready is a feeling that shows up after you start, not before.",
  metrics: {
    durationS: 62, wordCount: 150, wpm: 145, fillerCount: 4, fillersPerMin: 3.9,
    fillers: [{ word: "um", t: 5.2 }, { word: "like", t: 18.4 }, { word: "um", t: 33.1 }, { word: "you know", t: 50.7 }],
    fillerCounts: { um: 2, like: 1, "you know": 1 }, topFiller: "um",
    repairCount: 1, repairsPerMin: 1, unvoicedHesitations: 1, disfluenciesPerMin: 4.8,
    pauses: [{ t: 2.1, len: 1.2, kind: "pre", verdict: "opening" }, { t: 20, len: 0.9, kind: "mid" }, { t: 41, len: 1.5, kind: "pre", verdict: "landing" }, { t: 58, len: 1.1, kind: "pre" }],
    heldPauses: 4, composedPauses: 3, midSentencePauses: 1, stars: 2,
    substance: { wordCount: 150, distinctRatio: 0.62, repeatShare: 0.05 },
  },
  tier1: { pause: 72, fillers: 55, repairs: 66, pace: 90, range: 64 },
  anchors: { hedgeCount: 2, restartCount: 1 },
  coach: {
    focus: "Kill 'um'. 2 of your 4 fillers.",
    strength: "Held the pause before 'the mistake people make'.",
    supply: { original: "a week nobody could really do", upgrade: "an impossible week", note: "It says the same in fewer words." },
    coachLine: "4 fillers in 62s. Tomorrow: kill 'um'.",
    dimensions: {
      structure: dim(64, '"the mistake people make is waiting to feel ready"'),
      credibility: dim(58, '"ready is a feeling that shows up after you start"'),
      engagement: dim(61, '"the big version arrives on its own"'),
      confidence: dim(66, '"you do the small version every day"'),
    },
  },
  ethosIndex: 612, previousIndex: null, repId: "rep-1", scorable: true,
  pauseHeadline: "3 pauses between sentences.",
  accuracy: null, mode: "daily", mods: [], xpMultiplier: 1, captureMode: "voice",
  delivery: null, deliveryMoments: [], previousPresence: null,
  judged: { ran: true, unlimited: false, remaining: 2, capped: false },
};
const repRow = {
  id: "rep-1", lesson_id: "f1", created_at: new Date().toISOString(), duration_s: 62, transcript: analyze.transcript,
  wpm: 145, filler_count: 4, fillers: analyze.metrics.fillers, pauses: analyze.metrics.pauses, stars: 2,
  focus: analyze.coach.focus, strength: analyze.coach.strength, supply: analyze.coach.supply, ethos_index: 612, audio_path: null,
  dimensions: { tier1: analyze.tier1, anchors: analyze.anchors, tier2: analyze.coach.dimensions },
  mode: "daily", mods: [], xp_multiplier: 1, boss_topic_id: null, accuracy: null, capture_mode: "voice",
  delivery_metrics: null, presence_score: null, delivery_moments: null,
};

// ---- helpers --------------------------------------------------------------
const anim = (page, sel) => page.$eval(sel, (el) => { const cs = getComputedStyle(el); return { name: cs.animationName, duration: cs.animationDuration, delay: cs.animationDelay, easing: cs.animationTimingFunction, opacity: cs.opacity, transform: cs.transform }; });

const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
  recordVideo: { dir: OUT + "video", size: { width: 390, height: 844 } },
});
await context.route("http://supabase.local/**", supabase);
await context.route("**/api/analyze", async (route) => { await sleep(1400); reps.push(repRow); await route.fulfill(json(analyze)); });
/*
 * The dev tools button is labelled "Next", so `getByRole("button", {
 * name: "Next" })` matches it as well as the carousel's own control and
 * the run dies on a strict-mode violation. Hiding the overlay also stops
 * its portal swallowing pointer events whenever a route fails to build.
 */
await context.addInitScript(() => {
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});
/* The account's session on the device, as a signed-in phone holds it:
   since #410 a device with no account that has been through the
   introduction is sent to sign up from Today. */
await context.addInitScript((s) => {
  localStorage.setItem("sb-supabase-auth-token", JSON.stringify(s));
  localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(s));
}, session);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 80)));

// 1. Welcome: the carousel turns pages, and the attribute is there before paint.
await page.goto(`${BASE}/welcome`);
await page.waitForSelector("main");
const rootVars = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { motion: document.documentElement.dataset.motion, easeOut: cs.getPropertyValue("--ease-out").trim(), dflt: cs.getPropertyValue("--default-transition-duration").trim(), base: cs.getPropertyValue("--duration-base").trim() }; });
ok("html[data-motion] is set", rootVars.motion === "full", rootVars.motion);
const norm = (v) => v.replace(/\s+/g, "").replace(/(^|[^\d])\./g, "$10.");
ok("--ease-out is the token", norm(rootVars.easeOut) === "cubic-bezier(0.25,1,0.5,1)", rootVars.easeOut);
ok("transition default is 120ms", /^(120ms|0?\.12s)$/.test(rootVars.dflt), rootVars.dflt);
ok("--duration-base is 200ms", /^(200ms|0?\.2s)$/.test(rootVars.base), rootVars.base);
// The walk is a swipe carousel (25 Sep): a step slides in from the side it
// came from, `.step-in-next` forward and `.step-in-back` back, on the sheet spring.
/* Since #497 an account whose introduction is not finished opens on the
   room too; Not now is its way on to the name. */
if (await page.locator("[data-room-hold]").count()) {
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await page.waitForSelector("main .step-in-next");
}
let a = await anim(page, "main .step-in-next");
ok("welcome step arrives from the right, on the sheet spring", a.name === "step-in-next" && a.easing.startsWith("linear("), `${a.name} ${a.duration} ${a.easing.slice(0, 20)}`);
await sleep(400);
/* Restarted means it began after the tap, measured against the tap's
   own pointerdown rather than a wall-clock limit: under load the
   click's own wait pushed a fresh arrival past a fixed 150ms (R7). */
/* The name, whose Next waits for one. */
await page.getByLabel("Your name").fill("Tim");
await sleep(200);
await page.evaluate(() => {
  window.__tapAt = null;
  document.addEventListener("pointerdown", () => (window.__tapAt = performance.now()), { once: true, capture: true });
});
await page.getByRole("button", { name: "Next" }).click();
await sleep(30);
a = await anim(page, "main .step-in-next");
const restart = await page.$eval("main .step-in-next", (el) => ({
  t: el.getAnimations().map((x) => x.currentTime)[0],
  since: window.__tapAt === null ? null : performance.now() - window.__tapAt,
}));
ok(
  "next step re-runs the arrival",
  a.name === "step-in-next" && restart.t != null && restart.since !== null && restart.t <= restart.since + 17,
  `t=${restart.t} since the tap ${restart.since?.toFixed(0)}`
);
await sleep(600);

// 2. Home: fetched content arrives once; the mods reveal; the sheet rises and leaves.
await page.goto(`${BASE}/`);
await page.getByText("Day one starts today.").waitFor();
/* What lands after the first paint on a first day: the two games' rows
   take their claim and topic once the clock is read (#500, ModeRows).
   The tiles' block that used to be `main > .arrive` went with #500, and
   a first day has no foot (TodayFoot is the fetched block on any other). */
await page.waitForSelector("main .home-mode-subject > .arrive");
a = await anim(page, "main .home-mode-subject > .arrive");
ok("home's late words arrive once", a.name === "arrive", `${a.name}`);
const navT = await page.$eval("nav a", (el) => getComputedStyle(el).transitionDuration);
ok("nav tab colour steps at the press duration", navT === "0.12s", navT);
await page.getByRole("button", { name: "Turn up the difficulty" }).click();
a = await anim(page, ".reveal");
ok("mod picker reveals out of its row", a.name === "reveal", a.name);
await sleep(500);
/* The scrim's material is the dialog's ::before, and only it fades (#415).
   It is read in the first frame the dialog is on the page, from a watch
   set before the tap: since #508 the paywall's code is fetched on its
   first tap when the phone has not yet been idle, so the dialog lands
   about 300 ms after the click returns, and the harness's own poll then
   saw it as late as 500 ms on, its 300 ms fade already over (the final
   pass of 18 Nov). The watch reads the fade while it runs, and that the
   dialog itself, the sheet's parent, has no fade of its own. */
await page.evaluate(() => {
  const t0 = performance.now();
  const look = () => {
    const d = document.querySelector("[role=dialog].sheet-scrim");
    if (d) {
      const all = d.getAnimations({ subtree: true });
      window.__scrimSeen = {
        name: all.find((x) => x.effect?.pseudoElement === "::before")?.animationName ?? null,
        own: all.filter((x) => x.effect?.target === d && !x.effect?.pseudoElement).map((x) => x.animationName),
      };
      return;
    }
    if (performance.now() - t0 < 5000) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
});
await page.getByRole("button", { name: /Crowd noise/ }).click();
await page.waitForSelector("[role=dialog] .sheet-panel");
a = await anim(page, "[role=dialog] .sheet-panel");
const scrim = await page
  .waitForFunction(() => window.__scrimSeen, null, { timeout: 2000 })
  .then((h) => h.jsonValue())
  .catch(() => ({ name: null, own: [] }));
ok("sheet rises on the sheet spring", a.name === "sheet-in" && a.easing.startsWith("linear("), `${a.name} ${a.easing.slice(0, 20)}`);
ok("scrim fades on its own", scrim.name === "fade-in" && scrim.own.length === 0, `${scrim.name}; the dialog's own: ${scrim.own.join(",") || "none"}`);
await sleep(700);
/* The page keeps its own clock (C2): from the key to the dialog leaving
   the DOM. Timed from the harness, the same exit read 799 to 855ms with
   about 275ms of it being the press's round trip and the detach poll
   under video capture; in the page it is the base spring's 515ms plus
   one render. */
await page.evaluate(() => {
  const t = (window.__sheetExit = {});
  document.addEventListener("keydown", () => { t.key = performance.now(); }, { capture: true, once: true });
  const mo = new MutationObserver(() => {
    if (t.key !== undefined && !document.querySelector("[role=dialog]")) { t.gone = performance.now(); mo.disconnect(); }
  });
  mo.observe(document.body, { subtree: true, childList: true });
});
await page.keyboard.press("Escape");
await page.waitForSelector('[role=dialog] .sheet-panel[data-closing="true"]', { timeout: 500 });
// The exit is a script spring from the live position (lib/spring.ts).
const exiting = await page.$eval('[role=dialog] .sheet-panel[data-closing="true"]', (el) => el.getAnimations().some((x) => !("animationName" in x)));
ok("Escape plays the exit before unmount", exiting, String(exiting));
await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 1000 });
const exitMs = await page.evaluate(() => Math.round(window.__sheetExit.gone - window.__sheetExit.key));
ok("sheet is gone after the exit", exitMs > 0 && exitMs < 800, `${exitMs}ms`);
const focused = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 12));
ok("focus returns to the opener", (focused ?? "").startsWith("Crowd noise"), focused);
await sleep(400);

// 3. The rep: ring grows out of the button; phases arrive; the debrief lands its values.
await page.getByRole("link", { name: /^Start$/ }).first().click();
await page.waitForURL(/\/(lesson|rep)/);
if (page.url().includes("/lesson/")) {
  await sleep(500);
  await page.getByRole("link", { name: "Start" }).click();
  await page.waitForURL(/\/rep/);
}
await page.waitForSelector('button[data-record="start"]');
let ring = await anim(page, ".rec-ring");
ok("ring is hidden before recording", ring.opacity === "0", ring.opacity);
await sleep(600);
// The Record button breathes while it waits (#242), so the
// actionability check would wait for a stillness that never comes.
await page.click('button[data-record="start"]', { force: true });
await page.waitForSelector('button[aria-label="Stop and score this recording"]');
await sleep(350);
ring = await anim(page, '.rec-ring[data-on="true"]');
ok("ring grows out of the button on Record", ring.opacity === "1" && (ring.transform === "none" || ring.transform === "matrix(1, 0, 0, 1, 0, 0)"), `${ring.opacity} ${ring.transform}`);
a = await anim(page, "main .arrive");
ok("recording phase arrives as one block", a.name === "arrive", a.name);
await sleep(3000);
await page.click('button[aria-label="Stop and score this recording"]', { force: true });
/* The wait arrives as one block; since #472 only its stages are the live
   region, so the block is found by its own hook. */
await page.waitForSelector('[data-scoring-wait].arrive:has([role="status"])');
ok("scoring wait arrives", true);
await page.waitForSelector("main .arrive-x", { timeout: 8000 });
/* The Index is read the moment the results land, before anything else is
   awaited: a slow machine (software WebGL drawing Demos's clip on the
   scoring wait) can finish the count before the first reading. */
/* RepResult marks the Index with data-score (A4): the score step's
   number moved from text-[64px] to the num-xl token, and a hook that
   names the job outlives any size. */
const SCORE = "main .arrive-x [data-score]";
const early = await page.$eval(SCORE, (el) => el.textContent);
await sleep(900);
const late = await page.$eval(SCORE, (el) => el.textContent);
ok("the Index counts up to 612", Number(early) < 612 && late === "612", `${early} → ${late}`);
const stars = await page.$$eval(".star-land", (els) => els.map((el) => getComputedStyle(el).animationDelay));
ok("two earned stars land after the count, staggered", stars.length === 2 && stars[0] === "0.6s" && stars[1] === "0.72s", stars.join(","));
/* #480: nothing rises over the results now; the streak's moment waits for
   the way out. */
const over = await page.$$eval('[role="dialog"]', (els) => els.length);
ok("nothing rises over the results (the streak's moment waits for the exit)", over === 0, `${over} dialog(s)`);
await sleep(300);
/* #427: the results are one glance and one door. The door's sheet,
   "Every number", rises on the sheet spring and holds the dimension
   bars, which fill as it opens; Escape closes it back to the door. */
await page.locator("main [data-glance-door]").click();
const SHEET = '[role="dialog"][aria-label="Every number"]';
await page.waitForSelector(SHEET, { timeout: 1500 });
a = await anim(page, `${SHEET} > .sheet-panel`);
ok("Every number rises on the sheet spring", a.name === "sheet-in", a.name);
await page.waitForSelector(`${SHEET} .fill`, { timeout: 1500 });
const fills = await page.$$eval(`${SHEET} .fill`, (els) => els.map((el) => getComputedStyle(el).animationName));
ok("dimension bars fill as the sheet opens", fills.length >= 5 && fills.every((n) => n === "fill"), `${fills.length} bars`);
await sleep(900);
/* The practice's own row is open on arrival; another opens with its why. */
await page.$eval(`${SHEET} details:not([open])`, (el) => el.setAttribute("data-probe", ""));
await page.locator(`${SHEET} details[data-probe] summary`).scrollIntoViewIfNeeded();
await page.locator(`${SHEET} details[data-probe] summary`).click();
a = await anim(page, `${SHEET} details[data-probe][open] .reveal`);
ok("a dimension's why reveals", a.name === "reveal", a.name);
await sleep(700);
await page.screenshot({ path: OUT + "debrief-sheet.png" });
await page.keyboard.press("Escape");
await page.waitForSelector(SHEET, { state: "detached", timeout: 2000 });
const onDoor = await page.evaluate(() => !!document.activeElement?.matches("[data-glance-door]"));
ok("Escape closes the sheet and hands focus back to the door", onDoor);
/* #480: the take made today count (a new account, 0 to 1), so the way
   out plays the streak's moment first: the flame lights on the thrown
   spring as the chime starts, and the count rolls one place on the
   chime's landing note, with today's day filling under it. */
await page.locator("main [data-results-back]").click();
await page.waitForSelector("[data-streak-moment]", { timeout: 4000 });
const moment = await page.$eval("[data-streak-moment]", (el) => {
  const of = (sel) => el.querySelector(sel)?.getAnimations()[0] ?? null;
  const timing = (a) => (a ? { delay: a.effect.getTiming().delay, easing: a.effect.getTiming().easing, end: a.effect.getKeyframes().at(-1)?.transform ?? null } : null);
  return {
    from: el.getAttribute("data-from"),
    to: el.getAttribute("data-to"),
    lightAt: Number(el.getAttribute("data-light-at")),
    rollAt: Number(el.getAttribute("data-roll-at")),
    lit: timing(of("[data-flame='lit']")),
    turn: timing(of("[data-turn]")),
    fill: timing(of("[data-fill]")),
  };
});
ok("the streak's moment comes on the way out, 0 to 1", moment.from === "0" && moment.to === "1", `${moment.from} → ${moment.to}`);
ok(
  "the flame lights on the thrown spring as the chime starts",
  moment.lit !== null && moment.lit.delay === moment.lightAt && moment.lit.easing.startsWith("linear("),
  JSON.stringify(moment.lit)
);
/* The count rolls on the streak sound's landing note (#505): its D6 at
   0.32s after a 0.06s lead, 380ms after the light (lib/sound-recipes.ts
   STREAK_LAND_S.daily; lib/streak-moment.test.ts holds the timeline to
   the recipe). It was the old chime's 320 until the sound kit. */
const LAND_MS = 380;
ok(
  `the count rolls one place on the sound's landing note (${LAND_MS}ms after the light)`,
  moment.turn !== null && moment.turn.delay === moment.rollAt && moment.rollAt - moment.lightAt === LAND_MS && moment.turn.end === "translateY(-50%)",
  `${moment.rollAt - moment.lightAt}ms after the light; ${JSON.stringify({ delay: moment.turn?.delay, end: moment.turn?.end })}`
);
ok("today's day fills with the roll", moment.fill !== null && moment.fill.delay === moment.rollAt, JSON.stringify(moment.fill));
// STREAK_SHOT=path keeps a frame of the moment, landed, for the look loop.
await sleep(1600);
if (process.env.STREAK_SHOT) await page.screenshot({ path: process.env.STREAK_SHOT });
await page.locator("[data-streak-moment] [data-continue]").click();
await page.waitForSelector("[data-streak-moment]", { state: "detached", timeout: 5000 });
ok("Continue goes on to where the exit was going", !new URL(page.url()).pathname.startsWith("/rep"), new URL(page.url()).pathname);
await sleep(800);

// 4. Reduced motion via the Settings switch reaches CSS at once.
await page.goto(`${BASE}/settings/accessibility`);
await page.getByRole("switch", { name: /Reduced motion/ }).click();
const reduced = await page.evaluate(() => document.documentElement.dataset.motion);
ok("Settings switch flips data-motion", reduced === "reduce", reduced);
await page.goto(`${BASE}/welcome`);
await page.waitForSelector("main .step-in-next");
a = await anim(page, "main .step-in-next");
ok("under reduced motion an arrival is a plain fade", a.name === "fade-in", a.name);
await page.evaluate(() => localStorage.removeItem("ethos.prefs"));

await page.close();
await context.close();
await browser.close();
writeFileSync(OUT + "findings.json", JSON.stringify(findings, null, 2));
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
