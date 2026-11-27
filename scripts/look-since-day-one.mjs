/**
 * Since day one and Before you go, shot the same way for everyone who
 * changes them: the shared camera for the two screens on the results'
 * way out, so a before and every designer's after are taken alike.
 *
 * Both are in app/rep/page.tsx and neither has a route of its own:
 *   - `ProgressMoment`, "Since day one": a free account's day-3 progress
 *     moment, the paywall's one proactive placement (DECISIONS #11,
 *     #232), with components/ComparisonCard.tsx, PRO_MOMENT_LINE and the
 *     taps "See Premium" and "Not now".
 *   - `SaveGate`, "Before you go": the save-progress wall for someone
 *     with no account (#134), after the first recording and again at a
 *     3-day streak, with "Save my progress" and "Not now". No Demos.
 *     Since #410 a guest is sent to sign up before recording, so the one
 *     guest who still meets it is one whose email link is on its way
 *     (lib/account-gate.ts `pendingEmail`): the camera's guest is that.
 * Each is the one beat an exit that leaves the results passes through
 * (lib/rep-screen.ts `exitBeat`). The results are restored from nowhere
 * (a reload loses them, and the outbox replays a take only into the
 * screen that stopped it), so there is no shorter way in than a take.
 *
 * The route, per shot, in a fresh browser context (the once-per-browser
 * flags, `ethos.pro.day3` and `ethos.gates.*`, start as the scene says):
 *   1. /rep?mode=daily, the day's practice, opened directly;
 *   2. Record, 2.5 s of Chromium's fake mic, Stop (the take is over
 *      lib/unheard.ts MIN_TAKE_MS, 1.5 s);
 *   3. /api/analyze answers at once with the fixture's scored take
 *      (scripts/look-fixtures.mjs `analyzeBody`, or the scene's own);
 *   4. the results land, and the camera waits for the reads the page
 *      makes after a take (the recordings list, the spine, the session), which
 *      decide whether the moment or the wall is due;
 *   5. the header's back ([data-results-back]), an exit that leaves.
 * The streak's moment is marked shown today (`ethos.streak.moment`) and
 * the reminder ask asked (`ethos.reminder.asked`), so the exit's one beat
 * is the screen under test. About 8 s a shot on a production build.
 *
 * Scenes (LOOK_SCENES, a comma list of names; a name ending in * takes
 * every scene it starts, so "save*" is the three save walls):
 *   progress          Since day one on the fixture's 22 recordings over
 *                     26 days ("Day 1 to day 26"), the introduction's
 *                     focus fillers (pains: fillers), so the card leads
 *                     with "All fillers a minute", the Ethos row present.
 *   progress-wpm      the same, the introduction's pain "I rush": the
 *                     card leads with "Words a minute".
 *   progress-noindex  the first recording has no Ethos number (one the
 *                     coach never read): three rows, no Ethos row.
 *   progress-worse    a mixed story: the lead (fillers a minute, 9.3 to
 *                     11.1) and pauses between sentences (1 to 0) got
 *                     worse, in rust; Ethos and words a minute better.
 *   progress-sheet    See Premium tapped: the plum paywall over the
 *                     moment. Its band and tap are the paywall's,
 *                     measured inside the sheet as check-gaps measures
 *                     it, and reported, never failed.
 *   save-rep1         Before you go after a guest's first recording,
 *                     with its Ethos number: "Day 1 is on the board."
 *   save-streak       a guest's take on the third day running (two days
 *                     stored, this one today): "3 days on the board."
 *   save-noindex      the same day with no Ethos number (a capped take,
 *                     coach null): SaveGate draws no "Your Ethos".
 *
 * Sizes (LOOK_SIZES, a comma list of WxH or WxH-theme; themes from
 * LOOK_THEMES, default light,dark): 390x844, 375x667, 320x568, 430x932,
 * and 320x692, an iPhone with its text two steps up (DESIGN 11: a
 * 390x844 iPhone's layout at that size), shot with an iPhone's user agent
 * and a Dynamic Island's insets, 59 over and 34 under, as
 * scripts/check-text-size.mjs gives them. LOOK_IPHONE=1 puts the iPhone
 * user agent on every size.
 *
 * Per shot it prints, and writes into report.json beside the shots:
 *   - the largest empty band in the first viewport, by check-gaps.mjs's
 *     own `measure` (read out of scripts/check-gaps.mjs at run time and
 *     run in the page, so the camera and the gate cannot drift apart),
 *     with what stands over and under it;
 *   - whether the page scrolls, and by how much;
 *   - whether the one filled tap (`.tap`, `.tap-tonal`) and Not now are
 *     wholly on the first screen, with their tops and bottoms;
 *   - the visible text on the first screen, and its word count.
 *
 * It FAILS (exit 1) when, on a scene that is not the sheet:
 *   - a band over 64px stands at 390x844 or 430x932 (DESIGN 7, #368);
 *   - the filled tap, or Not now, is not wholly on the first screen at
 *     any size (the decline is held too: a wall whose way out needs a
 *     scroll is the bait #134 rules out);
 *   - a 320x568 or 320x692 screen scrolls, unless its tap is docked
 *     (fixed, sticky or in FooterShelf) and whole on the first screen;
 *   - the exit lands anywhere but the expected screen, twice running
 *     (a way in that misses is tried once more, and says so);
 *   - the run crosses midnight in Melbourne, where the fixtures' days are
 *     counted from: it stops there, and wants running again.
 * It is expected to fail on the build of 27 Nov 2026: that is the before.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 4141
 *   LOOK_BASE=http://localhost:4141 LOOK_OUT=/tmp/sdo/before node scripts/look-since-day-one.mjs
 *   LOOK_SCENES='progress,save*' LOOK_SIZES=390x844,320x568-light node scripts/look-since-day-one.mjs
 *   node scripts/sheet-since-day-one.mjs out.jpg /tmp/sdo/before /tmp/sdo/after
 *
 * PLAYWRIGHT_MODULE names Playwright's ESM entry (default: the machine's
 * global one under /opt/node22). Shots are <scene>-<WxH>-<theme>.png in
 * LOOK_OUT, plus -full.png for a screen that scrolls.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const GLOBAL_PW = "/opt/node22/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? (existsSync(GLOBAL_PW) ? GLOBAL_PW : "playwright"));
const F = await import("./look-fixtures.mjs");

const BASE = process.env.LOOK_BASE ?? "http://localhost:4141";
const OUT = (process.env.LOOK_OUT ?? "/tmp/claude-0/-home-user-ethos/ac48bec4-7cf9-5e1f-9ede-55af1e9b0655/scratchpad/sdo/shots").replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- the gate's own measure ------------------------------------------- */
/*
 * scripts/check-gaps.mjs runs its whole gate on import, so its measure is
 * read out of the file and run in the page as text: the bands printed here
 * are the gate's bands, by construction. The function ends at the first
 * closing brace in column 0 after its head.
 */
const GAPS = readFileSync(new URL("./check-gaps.mjs", import.meta.url), "utf8");
const HEAD = "function measure({ scope }) {";
const from = GAPS.indexOf(HEAD);
const to = from < 0 ? -1 : GAPS.indexOf("\n}\n", from);
if (from < 0 || to < 0) throw new Error(`scripts/check-gaps.mjs has no "${HEAD}" to borrow`);
const MEASURE = GAPS.slice(from, to + 2);
const LIMIT = Number(/const LIMIT = (\d+);/.exec(GAPS)?.[1] ?? 64);
const gapsIn = (page, scope = null) => page.evaluate(`(${MEASURE})(${JSON.stringify({ scope })})`);

/* ---- sizes ------------------------------------------------------------- */
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ALL_SIZES = ["390x844", "375x667", "320x568", "430x932", "320x692"];
/* 320x692: the text two steps up (DESIGN 11), under a Dynamic Island. */
const TEXT_UP = "320x692";
const BAND_HELD = new Set(["390x844", "430x932"]);
const NO_SCROLL = new Set(["320x568", "320x692"]);
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",").map((s) => s.trim()).filter(Boolean);
const SHOTS = [];
{
  const asked = (process.env.LOOK_SIZES ?? ALL_SIZES.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
  for (const a of asked) {
    const [size, theme] = a.split("-");
    if (!/^\d+x\d+$/.test(size)) throw new Error(`LOOK_SIZES: "${a}" is not WxH or WxH-theme`);
    for (const t of theme ? [theme] : THEMES) SHOTS.push({ size, theme: t });
  }
}

/* ---- the scenes ---------------------------------------------------------- */
const A = F.analyzeBody;
const clones = () => F.reps.map((r) => ({ ...r }));
/** The fixture's two newest recordings, yesterday's and the day before's: a guest two days in. */
const twoDays = () => clones().slice(-2);
const CAPPED = { coach: null, ethosIndex: null, judged: { ran: false, unlimited: false, remaining: 0, capped: true } };
const SCENES = {
  progress: { screen: "progress" },
  "progress-wpm": { screen: "progress", pains: ["rushing"] },
  "progress-noindex": {
    screen: "progress",
    rows: () => {
      const r = clones();
      r[0].ethos_index = null;
      return r;
    },
  },
  "progress-worse": {
    screen: "progress",
    rows: () => {
      const r = clones();
      const last = r[r.length - 1];
      /* 12 in 65 s is 11.1 a minute, past the first's 9.3; no pause
         between sentences, under the first's one. Ethos and pace hold. */
      last.filler_count = 12;
      last.pauses = [{ t: 8, len: 1.2, kind: "mid" }];
      return r;
    },
  },
  "progress-sheet": { screen: "progress", sheet: true },
  "save-rep1": { screen: "save", guest: true, rows: () => [], stored: true, body: () => ({ ...A, previousIndex: null }), unseen: ["rep1"] },
  "save-streak": { screen: "save", guest: true, rows: twoDays, stored: true, body: () => A, unseen: ["streak"] },
  "save-noindex": { screen: "save", guest: true, rows: twoDays, stored: true, body: () => ({ ...A, ...CAPPED }), unseen: ["streak"] },
};
const ONLY = (process.env.LOOK_SCENES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const scenes = Object.keys(SCENES).filter((n) => ONLY.length === 0 || ONLY.some((o) => (o.endsWith("*") ? n.startsWith(o.slice(0, -1)) : n === o)));
if (scenes.length === 0) throw new Error(`LOOK_SCENES matches none of ${Object.keys(SCENES).join(", ")}`);

/*
 * A guest the app still lets record: since #410 the account gate
 * (components/AccountGate.tsx, lib/account-gate.ts) sends every guest to
 * /signup from /rep, except one whose email link is on its way (the
 * account exists once they open it). That guest is the save wall's only
 * audience today, so the camera's guest is an anonymous session with
 * `new_email` set, as Supabase sets it when a guest asks for an email
 * account.
 */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86_400;
const guestUser = {
  id: "guest1", aud: "authenticated", role: "authenticated", email: "", new_email: "guest@example.com", is_anonymous: true,
  app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};
const guestSession = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "guest1", aud: "authenticated", role: "authenticated", exp, is_anonymous: true, session_id: "g1" })}.sig`,
  token_type: "bearer", expires_in: 86_400, expires_at: exp, refresh_token: "g-r1", user: guestUser,
};

/* ---- in the page --------------------------------------------------------- */
/** Scroll, the taps, Not now and the first screen's words. `scope` is the sheet's panel, or main. */
function PROBE({ scope }) {
  const vh = innerHeight;
  const root = document.querySelector(scope) ?? document.body;
  const visible = (el) => el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, text: (el.innerText ?? "").trim().replace(/\s+/g, " ") };
  };
  const docked = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.matches?.("[data-footer-shelf]")) return true;
      const p = getComputedStyle(e).position;
      if (p === "fixed" || p === "sticky") return true;
    }
    return false;
  };
  const taps = [...root.querySelectorAll(".tap, .tap-tonal")].filter(visible).map((el) => ({ ...box(el), docked: docked(el) }));
  const not = [...root.querySelectorAll("button, a[href]")].filter((el) => visible(el) && (el.innerText ?? "").trim() === "Not now").map(box);
  /* The words on the first screen: every text node's line boxes that meet [0, vh). */
  const words = [];
  const below = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode;
    const t = n.nodeValue.replace(/\s+/g, " ").trim();
    if (!t || !n.parentElement || n.parentElement.closest(".sr-only") || !visible(n.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    if (rects.length === 0) continue;
    (rects.some((r) => r.top < vh && r.bottom > 0) ? words : below).push(t);
  }
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
  document.body.appendChild(probe);
  const inset = { top: parseFloat(getComputedStyle(probe).paddingTop) || 0, bottom: parseFloat(getComputedStyle(probe).paddingBottom) || 0 };
  probe.remove();
  /* The first painted text's top, for the status bar's inset. */
  let firstText = null;
  const t2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (t2.nextNode() && firstText === null) {
    const n = t2.currentNode;
    if (!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest(".sr-only") || !visible(n.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = [...range.getClientRects()].find((x) => x.width > 0);
    if (r) firstText = { top: Math.round(r.top), text: n.nodeValue.trim().slice(0, 32) };
  }
  const se = document.scrollingElement;
  return {
    vh,
    vw: innerWidth,
    scrollH: se.scrollHeight,
    scrolls: se.scrollHeight > vh + 1,
    taps,
    notNow: not,
    text: words.join(" "),
    below: below.join(" "),
    words: words.join(" ").split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)).length,
    inset,
    firstText,
  };
}

/* ---- the browser --------------------------------------------------------- */
const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};
const reportFile = `${OUT}report.json`;
let report = {};
try {
  report = JSON.parse(readFileSync(reportFile, "utf8"));
} catch {}
report.base = BASE;
report.shots ??= {};

/** A way in that went wrong (the exit's beat, the paywall): tried once more before it fails. */
class Miss extends Error {}
/* The fixtures date every recording from Melbourne's today, fixed when they
   load; a run that crosses midnight there shoots a day the rows were not
   made for (a 3-day guest becomes a 1-day one). Checked before each shot. */
const melDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
const RUN_DAY = melDay();

async function shoot(name, scene, { size, theme }, attempt = 1) {
  const [w, h] = size.split("x").map(Number);
  const at = `${name} ${size} ${theme}`;
  const iphone = size === TEXT_UP || process.env.LOOK_IPHONE === "1";
  F.resetPlan("free");
  F.repsMode.rows = scene.rows ? scene.rows() : null;
  F.extraReps.splice(0, F.extraReps.length);
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    screen: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
    ...(iphone ? { userAgent: IPHONE_UA } : {}),
  });
  /* What the page has read since the take was answered: the exit's beat
     is decided on those reads, so the back waits for them. */
  const watch = { answered: false, listed: 0, user: 0, last: Date.now() };
  await context.route("http://supabase.local/**", async (route) => {
    const url = new URL(route.request().url());
    watch.last = Date.now();
    if (watch.answered && route.request().method() === "GET" && url.pathname.startsWith("/rest/v1/reps")) watch.listed += 1;
    /* The session read that decides the save wall comes after both lists. */
    if (watch.answered && watch.listed >= 2 && url.pathname.startsWith("/auth/v1/user")) watch.user += 1;
    if (scene.guest) {
      if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(F.json(guestUser));
      if (url.pathname.startsWith("/auth/v1/signup") || url.pathname.startsWith("/auth/v1/token")) return route.fulfill(F.json(guestSession));
    }
    return F.supabaseRoute(route);
  });
  await context.route("**/api/analyze", async (route) => {
    const body = scene.body ? scene.body() : A;
    /* The take is stored: the reads after it hold it, today. */
    if (scene.stored) {
      const last = F.reps[F.reps.length - 1];
      F.extraReps.splice(0, F.extraReps.length, { ...last, id: "rep-live", client_id: "rep-live", created_at: new Date().toISOString(), ethos_index: body.ethosIndex ?? null });
    }
    watch.answered = true;
    watch.last = Date.now();
    await route.fulfill(F.json(body));
  });
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.route("**/api/words", (r) => r.fulfill(F.json({ alternatives: ["point", "idea", "claim"], source: "model" })));
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.addInitScript(F.seed, { theme, session: scene.guest ? guestSession : F.session, pose: F.POSE_PREF });
  await context.addInitScript(
    ({ unseen, pains }) => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      /* One beat per exit: the streak's moment already played today, the reminder already asked. */
      localStorage.setItem("ethos.streak.moment", today);
      localStorage.setItem("ethos.reminder.asked", today);
      for (const g of unseen) localStorage.removeItem(`ethos.gates.${g}`);
      if (pains) {
        const o = JSON.parse(localStorage.getItem("ethos.onboarding") ?? "{}");
        localStorage.setItem("ethos.onboarding", JSON.stringify({ ...o, answers: { ...o.answers, pains } }));
      }
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    },
    { unseen: scene.unseen ?? [], pains: scene.pains ?? null }
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  if (size === TEXT_UP) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
  }
  const entry = { scene: name, screen: scene.screen, size, theme, iphone, file: null };
  try {
    await page.goto(`${BASE}/rep?mode=daily`);
    await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
    await sleep(700);
    // `force`: Record breathes, and Playwright waits for it to hold still (#242).
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[data-record="stop"]', { timeout: 20000 });
    await sleep(2500);
    await page.click('button[data-record="stop"]', { force: true });
    await page.waitForSelector("main [data-results-back]", { state: "visible", timeout: 30000 });
    /* The reads after the take: the list and the spine (two reads of the
       recordings table), and for a guest the session; then a quiet half
       second. */
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      const read = watch.listed >= 2 && (!scene.guest || watch.user >= 1);
      if (read && Date.now() - watch.last > 600) break;
      await sleep(100);
    }
    await sleep(400);
    await page.locator("main [data-results-back]").click();
    /* The beat: the results gone and a Not now standing. */
    const landed = await page
      .waitForFunction(
        () =>
          !document.querySelector("[data-results-back]") &&
          [...document.querySelectorAll("main button, main a[href]")].some((b) => (b.innerText ?? "").trim() === "Not now"),
        null,
        { timeout: 8000 }
      )
      .then(() => true)
      .catch(() => false);
    if (!landed) throw new Miss(`the exit landed on ${new URL(page.url()).pathname}, not on the ${scene.screen === "save" ? "save wall" : "progress moment"}`);
    const wall = await page.locator('main a[href="/signup"]').count();
    if (scene.screen === "save" && wall === 0) throw new Miss("no way to /signup: this is not the save wall");
    if (scene.screen === "progress" && wall > 0) throw new Miss("a way to /signup: the save wall came instead of Since day one");
    await page.evaluate(() => document.fonts.ready);
    await sleep(700);
    let scope = "main";
    if (scene.sheet) {
      await page.locator("main .tap, main .tap-tonal").first().click();
      const up = await page.waitForSelector('[role="dialog"] [role="slider"]', { timeout: 8000 }).catch(() => null);
      if (!up) throw new Miss("the tap opened no paywall");
      await sleep(1200);
      scope = '[role="dialog"] .card-premium';
    }
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        try {
          a.finish();
        } catch {}
      }
      window.scrollTo(0, 0);
    });
    await page.mouse.move(0, 0).catch(() => {});
    await sleep(300);
    const m = await gapsIn(page, scene.sheet ? scope : null);
    const p = await page.evaluate(PROBE, { scope });
    const file = `${OUT}${name}-${size}-${theme}.png`;
    await page.screenshot({ path: file });
    entry.file = file;
    if (p.scrolls && !scene.sheet) {
      await page.screenshot({ path: `${OUT}${name}-${size}-${theme}-full.png`, fullPage: true });
      entry.full = `${OUT}${name}-${size}-${theme}-full.png`;
    }

    /* The band, as check-gaps counts it (a stage's own room aside). */
    const counted = (m.gaps ?? []).filter((g) => !g.stage);
    const worst = counted.reduce((a, g) => (g.size > (a?.size ?? -1) ? g : a), null);
    const say = (g) => `${Math.round(g.size)}px at y${Math.round(g.at)} between ${g.above} and ${g.below}`;
    entry.band = worst ? { size: Math.round(worst.size), at: Math.round(worst.at), above: worst.above, below: worst.below } : null;
    entry.bands = counted.filter((g) => g.size > 24).map((g) => ({ size: Math.round(g.size), at: Math.round(g.at), above: g.above, below: g.below }));
    entry.scrolls = p.scrolls;
    entry.scrollBy = Math.max(0, p.scrollH - p.vh);
    const whole = (b) => b.top >= -0.5 && b.bottom <= p.vh + 0.5;
    entry.taps = p.taps;
    entry.tapCount = p.taps.length;
    entry.tapOnScreen = p.taps.length > 0 && p.taps.every(whole);
    entry.tapDocked = p.taps.length > 0 && p.taps.every((t) => t.docked);
    entry.notNow = p.notNow;
    entry.notNowOnScreen = p.notNow.length > 0 && p.notNow.every(whole);
    entry.text = p.text;
    entry.below = p.below;
    entry.words = p.words;
    entry.inset = p.inset;
    entry.firstText = p.firstText;
    entry.errors = errors;

    const tap = p.taps[0];
    const not = p.notNow[0];
    console.log(
      `${at}: band ${worst ? say(worst) : "none"}; scroll ${p.scrolls ? `yes, ${entry.scrollBy}px` : "no"}; ` +
        `tap ${tap ? `${entry.tapOnScreen ? "on" : "OFF"} the first screen ("${tap.text}" ${tap.top} to ${tap.bottom}${tap.docked ? ", docked" : ""})` : "none"}; ` +
        `Not now ${not ? `${entry.notNowOnScreen ? "on" : "OFF"} (${not.top} to ${not.bottom})` : "none"} of ${p.vh}`
    );
    if (p.taps.length !== 1) console.log(`      ${p.taps.length} filled taps (principle 2 asks for one)`);
    if (p.inset.top > 0 && p.firstText && p.firstText.top < p.inset.top)
      console.log(`      the first words ("${p.firstText.text}", y${p.firstText.top}) stand under the ${p.inset.top}px status bar inset`);
    if (p.inset.bottom > 0 && not && not.bottom > p.vh - p.inset.bottom)
      console.log(`      Not now's foot (${not.bottom}) is inside the ${p.inset.bottom}px home bar inset`);
    for (const g of entry.bands.filter((g) => g.at !== entry.band?.at && g.size > LIMIT)) console.log(`      also ${g.size}px at y${g.at} between ${g.above} and ${g.below}`);
    console.log(`      text (${p.words} words): ${p.text}`);
    if (p.below) console.log(`      under the fold: ${p.below}`);
    if (errors.length) console.log(`      page errors: ${errors.join(" | ")}`);

    if (!scene.sheet) {
      if (BAND_HELD.has(size) && worst && worst.size > LIMIT) fail(`${at}: a ${Math.round(worst.size)}px band (DESIGN 7 holds ${LIMIT} at ${size})`);
      if (!tap) fail(`${at}: no filled tap`);
      else if (!entry.tapOnScreen) fail(`${at}: the tap is not wholly on the first screen (${tap.top} to ${tap.bottom} of ${p.vh})`);
      if (!not) fail(`${at}: no Not now`);
      else if (!entry.notNowOnScreen) fail(`${at}: Not now is not wholly on the first screen (${not.top} to ${not.bottom} of ${p.vh})`);
      if (NO_SCROLL.has(size) && p.scrolls && !(entry.tapDocked && entry.tapOnScreen))
        fail(`${at}: scrolls ${entry.scrollBy}px on a ${size} screen to reach the tap`);
    }
  } catch (e) {
    const why = String(e.message ?? e).split("\n")[0];
    if (e instanceof Miss && attempt === 1) {
      console.log(`      ${at}: ${why}; once more`);
      return "again";
    }
    fail(`${at}: ${why}`);
    await page.screenshot({ path: `${OUT}${name}-${size}-${theme}-missed.png` }).catch(() => {});
  } finally {
    report.shots[`${name}-${size}-${theme}`] = entry;
    await context.close();
    F.repsMode.rows = null;
    F.extraReps.splice(0, F.extraReps.length);
  }
}

const started = Date.now();
run: for (const name of scenes) {
  for (const s of SHOTS) {
    if (melDay() !== RUN_DAY) {
      fail(`the run crossed midnight in Melbourne (${RUN_DAY} to ${melDay()}): the fixtures' days are a day out, so run it again`);
      break run;
    }
    if ((await shoot(name, SCENES[name], s)) === "again") await shoot(name, SCENES[name], s, 2);
  }
}
await browser.close();
report.taken = new Date().toISOString();
writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`\n${scenes.length} scenes x ${SHOTS.length} sizes in ${Math.round((Date.now() - started) / 1000)}s, shots and report.json in ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log("no failures");
