/**
 * The look loop's camera (DESIGN.md): Playwright at 390px, light and
 * dark, every screen the one-system pass touches, against a mocked
 * Supabase so the shots show a populated app rather than day zero.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look.mjs before            # docs/look/<screen>-before-{light,dark}.png
 *   node scripts/look.mjs after             # docs/look/<screen>-after-{light,dark}.png
 *   node scripts/look.mjs after today you   # a subset of screens
 *   LOOK_OUT=docs/look/x node scripts/look.mjs after   # somewhere else
 *
 * Screens: today, rep-idle, rep-recording, rep-results, log, you, shop,
 * plus rep-detail (the stored result the log links to), games and
 * settings.
 * Full-page shots; the nav is fixed so it appears where the viewport
 * would show it.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";

const [, , TAG = "before", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

// ---- Fixtures: three weeks of practice ------------------------------------
const day = (n, h = 18) => {
  const d = new Date();
  d.setHours(h, 12, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const iso = (n) => day(n).toISOString();
const dateOnly = (n) => {
  const d = day(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Days ago the user spoke (yesterday last, so today is still open).
const SPOKE = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26];
const LESSONS = [
  ["f1", 3], ["f1", 2], ["f2", 3], ["f2", 2], ["f3", 3], ["f3", 3], ["f4", 2], ["f4", 3],
  ["p1", 3], ["p1", 2], ["p2", 2], ["p2", 3], ["p3", 1], ["p3", 2], ["p4", 2],
  ["h1", 3], ["h1", 2], ["h2", 2], ["h2", 1], ["h3", 1], ["h3", 2], ["h4", 1],
];
const pauses = (held) =>
  Array.from({ length: held }, (_, i) => ({ t: 6 + i * 11, len: 1.1 + (i % 3) * 0.3, kind: i % 3 === 1 ? "mid" : "pre" }));
const reps = SPOKE.map((ago, i) => {
  const idx = SPOKE.length - 1 - i; // oldest first below
  return { ago, i, idx };
})
  .sort((a, b) => b.ago - a.ago)
  .map(({ ago }, i) => {
    const [lesson, stars] = LESSONS[i % LESSONS.length];
    const index = 512 + Math.round(i * 5.9 + Math.sin(i) * 14);
    const fillers = Math.max(0, 9 - Math.round(i / 3) + (i % 2));
    return {
      id: `rep-${i + 1}`,
      lesson_id: lesson,
      created_at: iso(ago),
      duration_s: 58 + (i % 4) * 7,
      transcript:
        "So the thing about habits is they compound. You do the small version every day and the big version arrives on its own. The mistake people make is waiting to feel ready. Ready is a feeling that shows up after you start, not before.",
      wpm: 128 + ((i * 7) % 30),
      filler_count: fillers,
      fillers: Array.from({ length: fillers }, (_, k) => ({ word: k % 2 ? "um" : "like", t: 4 + k * 7.3 })),
      pauses: pauses(2 + (i % 4)),
      stars,
      focus: "Kill 'um'. 2 of your 4 fillers.",
      strength: "Held the pause before 'the mistake people make'.",
      supply: { original: "the thing about", upgrade: "what matters about", note: "Names the point instead of pointing at it." },
      ethos_index: index,
      audio_path: null,
      dimensions: {
        tier1: { pause: 60 + (i % 5) * 6, fillers: 40 + i * 2, repairs: 66, pace: 80 + (i % 3) * 5, range: 58 },
        anchors: { hedgeCount: 2, restartCount: 1 },
        tier2: {
          structure: { score: 64, citedMoment: '"the mistake people make is waiting to feel ready"', improve: "Open with the claim, then the example." },
          credibility: { score: 58, citedMoment: '"ready is a feeling that shows up after you start"', improve: "Name one number." },
          engagement: { score: 61, citedMoment: '"the big version arrives on its own"', improve: "One question to the room." },
          confidence: { score: 66, citedMoment: '"you do the small version every day"', improve: "Land the last sentence." },
        },
      },
      mode: "daily",
      mods: [],
      xp_multiplier: 1,
      boss_topic_id: null,
      accuracy: null,
      capture_mode: "voice",
      delivery_metrics: null,
      presence_score: null,
      delivery_moments: null,
    };
  });

const xp_events = reps.map((r, i) => ({ amount: 40 + (i % 3) * 15, created_at: r.created_at }));
// 17 earned, 8 spent on the speaking pose: 9 in hand, so the shop shows
// every button state at once (owned, buy, two "more to go").
const coin_ledger = [
  ...SPOKE.slice(0, 17).map((ago, i) => ({ id: `c${i}`, kind: "earned", amount: 1, reason: "streak_day", earned_on: dateOnly(ago), created_at: iso(ago) })),
  { id: "spent-1", kind: "spent", amount: 8, reason: "shop:pose_speaking", earned_on: null, created_at: iso(9) },
];
const lexicon = [
  { id: "l1", original: "really good", upgrade: "compelling", created_at: iso(1) },
  { id: "l2", original: "sort of shows", upgrade: "demonstrates", created_at: iso(3) },
  { id: "l3", original: "a lot of people", upgrade: "most of us", created_at: iso(5) },
  { id: "l4", original: "the thing about", upgrade: "what matters about", created_at: iso(8) },
  { id: "l5", original: "kind of like", upgrade: "resembles", created_at: iso(12) },
];
const profile = { display_name: "Timothy", premium: false, premium_until: null, equipped_pose: "pose_speaking" };
const streaks = { freezes_equipped: 1 };
const streak_freezes = [{ used_on: dateOnly(11) }];

// ---- Supabase mock ---------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", aud: "authenticated", role: "authenticated", exp, is_anonymous: false, session_id: "s1" })}.sig`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "tim@example.com", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: iso(30), updated_at: iso(0) };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "r1", user };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
const json = (body, status = 200) => ({ status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const TABLES = { reps, xp_events, coin_ledger, lexicon, streak_freezes, onboarding: [] };

async function supabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (url.pathname.startsWith("/auth/v1/signup") || url.pathname.startsWith("/auth/v1/token")) return route.fulfill(json(session));
  if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(json(user));
  if (url.pathname.startsWith("/auth/v1/")) return route.fulfill(json({}));
  if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill(json(0));
  if (url.pathname.startsWith("/rest/v1/profiles")) return route.fulfill(json(single ? profile : [profile]));
  if (url.pathname.startsWith("/rest/v1/streaks")) return route.fulfill(json(single ? streaks : [streaks]));
  const table = url.pathname.replace("/rest/v1/", "").split("/")[0];
  if (req.method() !== "GET") return route.fulfill(json([]));
  const rows = TABLES[table] ?? [];
  const id = url.searchParams.get("id");
  if (id) {
    const found = rows.find((r) => r.id === id.replace(/^eq\./, ""));
    return route.fulfill(single ? (found ? json(found) : json({ code: "PGRST116", message: "0 rows" }, 406)) : json(found ? [found] : []));
  }
  if (single) return route.fulfill(rows[0] ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406));
  return route.fulfill(json(rows));
}

// The scoring mock, for the live results screen.
const dim = (score, moment) => ({ score, citedMoment: moment, improve: "Open with the claim, then the example." });
const analyze = {
  transcript: reps[0].transcript,
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
  ethosIndex: 651, previousIndex: reps[reps.length - 1].ethos_index, repId: "rep-live", scorable: true,
  pauseHeadline: "Two silences landed a point; one was searching.",
  accuracy: null, mode: "daily", mods: [], xpMultiplier: 1, captureMode: "voice",
  delivery: null, deliveryMoments: [], previousPresence: null,
  judged: { ran: true, unlimited: false, remaining: 0, capped: false },
};

// ---- Camera ----------------------------------------------------------------
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme,
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(({ theme, session }) => {
    localStorage.setItem("ethos.welcomed", new Date().toISOString());
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
    localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
    localStorage.setItem("ethos.gates.streak", new Date().toISOString());
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
  }, { theme, session });
  const page = await context.newPage();
  // Full-page shots: the dev badge goes, and the fixed nav sits where
  // the page ends rather than where the first viewport did.
  await page.addStyleTag({ content: "" }).catch(() => {});
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = 'nextjs-portal{display:none!important} body{position:relative} nav[aria-label="Sections"]{position:absolute!important}';
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160), (e.stack ?? "").split("\n").slice(1, 4).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", page.url(), m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && !/supabase\.local/.test(r.url())) console.log("HTTP", r.status(), r.url()); });
  const shot = async (name, opts = {}) => {
    if (!want(name)) return;
    await sleep(opts.settle ?? 900);
    await page.screenshot({ path: `${OUT}${name}-${TAG}-${theme}.png`, fullPage: opts.fullPage ?? true });
    console.log(`shot  ${name}-${TAG}-${theme}`);
  };
  const go = async (path, waitFor) => {
    await page.goto(`${BASE}${path}`).catch(async () => { await sleep(500); await page.goto(`${BASE}${path}`); });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT", path, waitFor));
  };

  const step = async (fn) => { try { await fn(); } catch (e) { console.log("STEP-FAILED", theme, String(e.message ?? e).split("\n")[0]); } };
  await step(async () => { await go("/", "main .arrive");
  await shot("today"); });
  await step(async () => { await go("/history", "main .arrive"); await shot("log"); });
  await step(async () => { await go("/you", "main .label-data"); await sleep(800); await shot("you"); });
  await step(async () => { await go("/shop", 'button:has-text("Buy"), button:has-text("On your card")'); await shot("shop"); });
  await step(async () => { await go("/games", "main .label-data"); await shot("games"); });
  await step(async () => { await go("/settings", "main .label-data"); await shot("settings"); });
  await step(async () => { await go("/rep/rep-22", "main .label-data"); await shot("rep-detail"); });

  // The loop: idle, recording, results (live, via the scoring mock).
  await step(async () => {
  await go("/rep?lesson=h4", 'button[aria-label="Start recording"]');
  await shot("rep-idle", { fullPage: false });
  if (want("rep-recording") || want("rep-results")) {
    await page.click('button[aria-label="Start recording"]');
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(2500);
    await shot("rep-recording", { fullPage: false, settle: 100 });
    await page.click('button[aria-label="Stop and score this recording"]');
    await page.waitForSelector("main .arrive-x", { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT results"));
    // Let the celebration play out, if one comes.
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
    await sleep(1600);
    await shot("rep-results", { settle: 200 });
  }
  });
  await context.close();
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
