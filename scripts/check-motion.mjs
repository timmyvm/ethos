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
 * to itself under docs/devibe/motion-check/.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3123";
const OUT = new URL("../docs/devibe/motion-check/", import.meta.url).pathname;
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
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", aud: "authenticated", role: "authenticated", exp, is_anonymous: true, session_id: "s1" })}.sig`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: null, is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
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
  if (url.pathname.startsWith("/rest/v1/reps")) return route.fulfill(json(req.method() === "GET" ? reps : []));
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
    supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
    coachLine: "4 fillers in 62s. Tomorrow: kill 'um'.",
    dimensions: {
      structure: dim(64, '"the mistake people make is waiting to feel ready"'),
      credibility: dim(58, '"ready is a feeling that shows up after you start"'),
      engagement: dim(61, '"the big version arrives on its own"'),
      confidence: dim(66, '"you do the small version every day"'),
    },
  },
  ethosIndex: 612, previousIndex: null, repId: "rep-1", scorable: true,
  pauseHeadline: "Two silences landed a point; one was searching.",
  accuracy: null, mode: "daily", mods: [], xpMultiplier: 1, captureMode: "voice",
  delivery: null, deliveryMoments: [], previousPresence: null,
  judged: { ran: true, unlimited: false, remaining: 0, capped: false },
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
let a = await anim(page, "main .arrive-x");
ok("welcome step arrives from the right", a.name === "arrive-x" && a.duration === "0.2s", `${a.name} ${a.duration} ${a.easing}`);
await sleep(400);
await page.getByRole("button", { name: "Next" }).click();
await sleep(30);
a = await anim(page, "main .arrive-x");
const restarted = await page.$eval("main .arrive-x", (el) => el.getAnimations().map((x) => x.currentTime)[0]);
ok("next step re-runs the arrival", a.name === "arrive-x" && restarted !== undefined && restarted < 150, `t=${restarted}`);
await sleep(600);

// 2. Home: fetched content arrives once; the mods reveal; the sheet rises and leaves.
await page.goto(`${BASE}/`);
await page.getByText("Day one starts today.").waitFor();
a = await anim(page, "main > .arrive");
ok("home's fetched block arrives once", a.name === "arrive", `${a.name}`);
const navT = await page.$eval("nav a", (el) => getComputedStyle(el).transitionDuration);
ok("nav tab colour steps at the press duration", navT === "0.12s", navT);
await page.getByRole("button", { name: "Turn up the difficulty" }).click();
a = await anim(page, ".reveal");
ok("mod picker reveals out of its row", a.name === "reveal", a.name);
await sleep(500);
await page.getByRole("button", { name: /Crowd noise/ }).click();
await page.waitForSelector("[role=dialog] .sheet-panel");
a = await anim(page, "[role=dialog] .sheet-panel");
const scrim = await anim(page, "[role=dialog].sheet-scrim");
ok("sheet rises from the bottom edge", a.name === "sheet-in" && a.duration === "0.3s", `${a.name} ${a.duration}`);
ok("scrim fades on its own", scrim.name === "fade-in", scrim.name);
await sleep(700);
await page.keyboard.press("Escape");
await page.waitForSelector('[role=dialog] .sheet-panel[data-closing="true"]', { timeout: 500 });
a = await anim(page, '[role=dialog] .sheet-panel[data-closing="true"]');
ok("Escape plays the exit before unmount", a.name === "sheet-out", a.name);
const t0 = Date.now();
await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 1000 });
ok("sheet is gone after the exit", Date.now() - t0 < 600, `${Date.now() - t0}ms`);
const focused = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 12));
ok("focus returns to the opener", (focused ?? "").startsWith("Crowd noise"), focused);
await sleep(400);

// 3. The rep: ring grows out of the button; phases arrive; the debrief lands its values.
await page.getByRole("link", { name: /Take the floor/ }).first().click();
await page.waitForURL(/\/(lesson|rep)/);
if (page.url().includes("/lesson/")) {
  await sleep(500);
  await page.getByRole("link", { name: "Start" }).click();
  await page.waitForURL(/\/rep/);
}
await page.waitForSelector('button[aria-label="Start recording"]');
let ring = await anim(page, ".rec-ring");
ok("ring is hidden before recording", ring.opacity === "0", ring.opacity);
await sleep(600);
// The Record button breathes while it waits (#242), so the
// actionability check would wait for a stillness that never comes.
await page.click('button[aria-label="Start recording"]', { force: true });
await page.waitForSelector('button[aria-label="Stop and score this recording"]');
await sleep(350);
ring = await anim(page, '.rec-ring[data-on="true"]');
ok("ring grows out of the button on Record", ring.opacity === "1" && (ring.transform === "none" || ring.transform === "matrix(1, 0, 0, 1, 0, 0)"), `${ring.opacity} ${ring.transform}`);
a = await anim(page, "main .arrive");
ok("recording phase arrives as one block", a.name === "arrive", a.name);
await sleep(3000);
await page.click('button[aria-label="Stop and score this recording"]', { force: true });
await page.waitForSelector('[role="status"].arrive');
ok("scoring wait arrives", true);
const dialogP = page.waitForSelector('[role="dialog"][aria-label="1 day in a row"]', { timeout: 8000 });
await page.waitForSelector("main .arrive-x", { timeout: 8000 });
const dialog = await dialogP;
const before = await dialog.$eval("[aria-hidden] > div", (el) => getComputedStyle(el).transform);
const SCORE = 'main .arrive-x span.font-display.text-\\[64px\\]';
const early = await page.$eval(SCORE, (el) => el.textContent);
await sleep(900);
const late = await page.$eval(SCORE, (el) => el.textContent);
ok("the Index counts up to 612", Number(early) < 612 && late === "612", `${early} → ${late}`);
const stars = await page.$$eval(".star-land", (els) => els.map((el) => getComputedStyle(el).animationDelay));
ok("two earned stars land after the count, staggered", stars.length === 2 && stars[0] === "0.6s" && stars[1] === "0.72s", stars.join(","));
// The celebration: rolled 0 → 1 on the chime's landing note (read at mount, then now).
const after = await dialog.$eval("[aria-hidden] > div", (el) => ({ transform: getComputedStyle(el).transform, dur: getComputedStyle(el).transitionDuration }));
const rolling = before === "none" || /^matrix\(1, 0, 0, 1, 0, -?(\d+(\.\d+)?)\)$/.test(before);
ok("streak number rolls up one line on the landing note", rolling && after.transform === "matrix(1, 0, 0, 1, 0, -64)" && after.dur === "0.3s", `${before} → ${after.transform} ${after.dur}`);
await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 5000 });
await sleep(300);
await page.getByRole("button", { name: /The numbers/ }).click();
await sleep(60);
const fills = await page.$$eval("main .arrive-x .fill", (els) => els.map((el) => getComputedStyle(el).animationName));
ok("dimension bars fill on the numbers step", fills.length >= 5 && fills.every((n) => n === "fill"), `${fills.length} bars`);
await sleep(900);
await page.locator("details summary").first().click();
a = await anim(page, "details[open] .reveal");
ok("a dimension's why reveals", a.name === "reveal", a.name);
await sleep(700);
await page.getByRole("button", { name: /Your words/ }).click();
await sleep(1200);
await page.screenshot({ path: OUT + "debrief-words.png" });
await page.getByRole("button", { name: "Done for today" }).click();
await sleep(800);

// 4. Reduced motion via the Settings switch reaches CSS at once.
await page.goto(`${BASE}/settings`);
await page.getByRole("switch", { name: /Reduced motion/ }).click();
const reduced = await page.evaluate(() => document.documentElement.dataset.motion);
ok("Settings switch flips data-motion", reduced === "reduce", reduced);
await page.goto(`${BASE}/welcome`);
await page.waitForSelector("main .arrive-x");
a = await anim(page, "main .arrive-x");
ok("under reduced motion an arrival is a plain fade", a.name === "fade-in", a.name);
await page.evaluate(() => localStorage.removeItem("ethos.prefs"));

await page.close();
await context.close();
await browser.close();
writeFileSync(OUT + "findings.json", JSON.stringify(findings, null, 2));
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
