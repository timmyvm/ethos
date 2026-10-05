/**
 * "After trying with Google, after you click out you can't click back
 * into sign in with Google." Reproduced, then held.
 *
 * The Google button used to set `busy` and hand the page to Google, and
 * only a returned error ever cleared it. So when somebody comes BACK
 * without finishing, the page they see is the one they left, with the
 * button still disabled: an installed PWA or iOS shows the same live
 * page when the OAuth sheet is dismissed, and a browser's back button
 * restores it whole from the back/forward cache. On /signup and /signin
 * the email form shared the flag and went dead with it.
 *
 * The dismissed sheet is simulated exactly: the authorize URL answers
 * 204, which a browser does not navigate to, so the live page stays with
 * whatever state the tap left. Then the return signals a phone actually
 * sends (focus, visibilitychange, a persisted pageshow) and the button
 * is pressed again. A real back navigation is tried too, with Chromium's
 * back/forward cache switched back on; the dev server's HMR socket
 * usually keeps a page out of that cache, and the check says so rather
 * than passing on a fresh load.
 *
 * On /welcome a real back that RELOADS the page (no back/forward cache)
 * must reopen the account ask, not the plan, and so must the callback's
 * "Try again" (section 3b).
 *
 * Then the callback: cancelling AT Google lands on /auth/callback with
 * error=access_denied, which used to read "That link has already been
 * used." with a Sign in button.
 *
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-google-return.mjs
 *   SHOTS=before|after   also writes docs/look/feedback/auth/*.png
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ?? "";
const OUT = new URL("../docs/look/feedback/auth/", import.meta.url).pathname;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The mocked Supabase host --------------------------------------------
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
const json = (body, status = 200) => ({ status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const token = (anon) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", aud: "authenticated", role: "authenticated", exp, is_anonymous: anon, session_id: "s1" })}.sig`;
const userOf = (anon) => ({ id: "u1", aud: "authenticated", role: "authenticated", email: anon ? null : "tim@example.com", is_anonymous: anon, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
const sessionOf = (anon) => ({ access_token: token(anon), token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "r1", user: userOf(anon) });

/**
 * `who`: "none" (no session), "anon" (an anonymous session with
 * progress, the linking path), "real" (a signed-in account, what a
 * finished Google round trip leaves). `authorize`: "dismiss" answers 204
 * (the sheet closed, the page never left), "page" serves a stand-in
 * Google page to navigate back from.
 */
function host(opts) {
  const seen = { authorize: 0, link: 0 };
  const handler = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === "/auth/v1/authorize") {
      seen.authorize++;
      if (opts.authorize === "page") {
        return route.fulfill({ status: 200, headers: { "Content-Type": "text/html" }, body: "<!doctype html><title>Google</title><h1>Choose an account</h1>" });
      }
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/auth/v1/user/identities/authorize") {
      seen.link++;
      return route.fulfill(json({ url: "http://supabase.local/auth/v1/authorize?provider=google&link=1" }));
    }
    if (url.pathname === "/auth/v1/user") {
      if (opts.userDelay) await sleep(opts.userDelay);
      if (opts.who === "none") return route.fulfill(json({ code: 401, msg: "no session" }, 401));
      return route.fulfill(json(userOf(opts.who === "anon")));
    }
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill(json({}));
    if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill(json(0));
    return route.fulfill(json([]));
  };
  return { handler, seen };
}

const browser = await chromium.launch();

async function open(opts, { theme = "light", bfcache = false } = {}) {
  const b = bfcache ? await chromium.launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] }) : browser;
  const context = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: theme });
  const { handler, seen } = host(opts);
  await context.route("http://supabase.local/**", handler);
  await context.addInitScript(({ who, session, theme }) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    try {
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      if (who !== "none" && !localStorage.getItem("sb-supabase-auth-token")) {
        localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
      }
    } catch {}
    window.__pageshows = [];
    addEventListener("pageshow", (e) => window.__pageshows.push(e.persisted));
  }, { who: opts.who, session: sessionOf(opts.who === "anon"), theme });
  const page = await context.newPage();
  return { page, context, seen, close: async () => { await context.close(); if (bfcache) await b.close(); } };
}

const googleBtn = (page) => page.getByRole("button", { name: /Continue with Google/ }).first();
const enabled = async (loc) => loc.isEnabled();
/** The page's title once it has one (the callback resolves after a read). */
const h1Text = async (page) => {
  const h = page.locator("main h1").filter({ hasText: /\S/ }).first();
  await h.waitFor({ timeout: 8000 }).catch(() => {});
  return ((await h.textContent().catch(() => "")) ?? "").trim();
};

/** Tap Google, wait for the authorize hit, and give the page a beat to
    settle into whatever state the tap leaves when nothing navigates. */
async function tapGoogle(page, seen) {
  const before = seen.authorize;
  await googleBtn(page).click();
  for (let i = 0; i < 40 && seen.authorize === before; i++) await sleep(50);
  await sleep(250);
  return seen.authorize > before;
}

const RETURNS = {
  focus: (page) => page.evaluate(() => { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus")); }),
  visibility: (page) => page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  }),
  pageshow: (page) => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))),
};

// ---- 1. /signup and /signin, the sheet dismissed ------------------------
for (const [path, who] of [["/signup", "none"], ["/signup", "anon"], ["/signin", "none"]]) {
  const label = `${path} (${who === "anon" ? "anonymous, linking" : "no session"})`;
  const { page, seen, close } = await open({ who, authorize: "dismiss" });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await googleBtn(page).waitFor();
  ok(`${label}: the Google tap reaches Google`, await tapGoogle(page, seen), `authorize hits ${seen.authorize}`);
  if (who === "anon") ok(`${label}: an anonymous session LINKS rather than signing in fresh`, seen.link === 1, `link calls ${seen.link}`);
  const submit = page.locator('form button[type="submit"]');
  ok(`${label}: the Google attempt leaves the email form usable`, await enabled(submit));
  for (const [signal, fire] of Object.entries(RETURNS)) {
    await fire(page);
    await sleep(120);
    const back = await enabled(googleBtn(page));
    ok(`${label}: after the sheet closes (${signal}) Google can be pressed again`, back);
    if (back) {
      ok(`${label}: and pressing it again goes to Google again (${signal})`, await tapGoogle(page, seen), `authorize hits ${seen.authorize}`);
    }
  }
  await close();
}

// ---- 2. Nothing fires at all: the button still comes back ---------------
{
  const { page, seen, close } = await open({ who: "none", authorize: "dismiss" });
  await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
  await googleBtn(page).waitFor();
  await tapGoogle(page, seen);
  await sleep(6500);
  ok("with no return signal at all, the button comes back on its own", await enabled(googleBtn(page)));
  await close();
}

// ---- 3. The introduction's account ask ----------------------------------
{
  const { page, seen, close } = await open({ who: "none", authorize: "dismiss" });
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", pains: [] }, step: 99, done: true, synced: false }));
        sessionStorage.setItem("seeded", "1");
      }
    } catch {}
  });
  await page.goto(BASE + "/welcome", { waitUntil: "networkidle" });
  // The plan's one tap hands over to the account ask.
  const primary = page.locator("main button").filter({ hasNotText: /^(Back|Skip|←)/ }).last();
  await sleep(600);
  await primary.click().catch(() => {});
  const reached = await googleBtn(page).waitFor({ timeout: 5000 }).then(() => true, () => false);
  ok("/welcome: the plan hands over to the account ask", reached);
  if (reached) {
    ok("/welcome: the Google tap reaches Google", await tapGoogle(page, seen));
    await RETURNS.focus(page);
    await sleep(120);
    ok("/welcome: after the sheet closes Google can be pressed again", await enabled(googleBtn(page)));
    await RETURNS.pageshow(page);
    await sleep(120);
    ok("/welcome: and after a restore from the back/forward cache", await enabled(googleBtn(page)));
    const origin = await page.evaluate(() => sessionStorage.getItem("ethos.oauth"));
    ok("/welcome: the attempt remembers where it started", /"from":"\/welcome/.test(origin ?? ""), origin ?? "none");
  }
  await close();
}

// ---- 3b. /welcome, a REAL back that reloads the page ---------------------
// The review's repro: with no back/forward cache the back button reloads
// /welcome, and a finished walk used to open on its plan ("Take the
// floor") with no Google button anywhere. Same for the callback's
// "Try again", which goes back to /welcome.
async function welcomeTab(theme = "light") {
  const s = await open({ who: "none", authorize: "page" }, { theme });
  await s.page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", pains: [] }, step: 99, done: true, synced: false }));
        sessionStorage.setItem("seeded", "1");
      }
    } catch {}
  });
  await s.page.goto(BASE + "/welcome", { waitUntil: "networkidle" });
  await sleep(600);
  await s.page.locator("main button").filter({ hasNotText: /^(Back|Skip|←)/ }).last().click().catch(() => {});
  await googleBtn(s.page).waitFor({ timeout: 5000 });
  await sleep(400);
  await googleBtn(s.page).click();
  await s.page.waitForURL(/supabase\.local/, { timeout: 5000 }).catch(() => {});
  return s;
}
{
  const s = await welcomeTab();
  ok("/welcome: a real tap leaves for Google", s.page.url().includes("supabase.local"), s.page.url());
  await s.page.goBack({ waitUntil: "load" });
  const shown = await googleBtn(s.page).waitFor({ timeout: 6000 }).then(() => true, () => false);
  ok("/welcome: back from Google (reloaded), the Google button is on screen", shown, ((await s.page.locator("main h1").first().textContent().catch(() => "")) ?? "").trim());
  if (shown) ok("/welcome: back from Google (reloaded), it can be pressed", await enabled(googleBtn(s.page)));
  const tapped = s.seen.authorize;
  if (shown) {
    await googleBtn(s.page).click();
    await s.page.waitForURL(/supabase\.local/, { timeout: 5000 }).catch(() => {});
    ok("/welcome: and pressing it goes to Google again", s.seen.authorize > tapped, `authorize hits ${s.seen.authorize}`);
  }
  // Cancelled AT Google this time: the callback's way back.
  await s.page.goto(BASE + "/auth/callback?" + "error=access_denied&error_code=access_denied", { waitUntil: "networkidle" });
  const again = s.page.getByRole("link", { name: /Try again/ });
  const has = await again.first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (has) await again.first().click();
  const back = await googleBtn(s.page).waitFor({ timeout: 6000 }).then(() => true, () => false);
  ok("/welcome: the callback's Try again lands on the Google button", has && back, s.page.url());
  await s.close();
}
{
  // Once there IS an account, a leftover attempt does not hold the walk
  // on the account ask: it opens on the plan as a finished walk does.
  const { page, close } = await open({ who: "real", authorize: "dismiss" });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", pains: [] }, step: 99, done: true, synced: false }));
      sessionStorage.setItem("ethos.oauth", JSON.stringify({ from: "/welcome", mode: "signup", at: Date.now() }));
    } catch {}
  });
  await page.goto(BASE + "/welcome", { waitUntil: "networkidle" });
  await sleep(1200);
  ok("/welcome: a signed-in account is not sent back to the account ask", !(await googleBtn(page).isVisible().catch(() => false)));
  await close();
}
if (SHOTS) {
  for (const theme of ["light", "dark"]) {
    const s = await welcomeTab(theme);
    await s.page.goBack({ waitUntil: "load" });
    await googleBtn(s.page).waitFor({ timeout: 6000 }).catch(() => {});
    await sleep(1500);
    await s.page.screenshot({ path: `${OUT}welcome-return-${SHOTS}-${theme}.png` });
    await s.close();
    // The Google account that already has its own Ethos account.
    const t = await open({ who: "anon", authorize: "dismiss" }, { theme });
    await t.page.goto(BASE + "/auth/callback#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user", { waitUntil: "networkidle" });
    await sleep(1200);
    await t.page.screenshot({ path: `${OUT}callback-taken-${SHOTS}-${theme}.png` });
    await t.close();
  }
}

// ---- 4. A real back navigation, with the cache switched on --------------
{
  const { page, seen, close } = await open({ who: "none", authorize: "page" }, { bfcache: true });
  await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
  await googleBtn(page).waitFor();
  await googleBtn(page).click();
  await page.waitForURL(/supabase\.local\/auth\/v1\/authorize/, { timeout: 5000 }).catch(() => {});
  ok("a real tap leaves for Google", seen.authorize === 1 && page.url().includes("supabase.local"), page.url());
  await page.goBack({ waitUntil: "load" });
  await sleep(400);
  const shows = await page.evaluate(() => window.__pageshows);
  const restored = shows.includes(true);
  console.log(`      back/forward cache ${restored ? "restored the page" : "not used (dev HMR socket); a fresh load was checked"}`);
  ok("back from Google, the button can be pressed again", await enabled(googleBtn(page)));
  if (SHOTS) {
    // The screen she saw: back on /signup after trying. Shot in the state
    // a dismissed sheet leaves, which is the same page, not a reload.
    for (const theme of ["light", "dark"]) {
      const s = await open({ who: "none", authorize: "dismiss" }, { theme });
      await s.page.goto(BASE + "/signup", { waitUntil: "networkidle" });
      await googleBtn(s.page).waitFor();
      await tapGoogle(s.page, s.seen);
      await RETURNS.focus(s.page);
      await sleep(500);
      await s.page.screenshot({ path: `${OUT}signup-return-${SHOTS}-${theme}.png` });
      await s.close();
    }
  }
  await close();
}

// ---- 5. The callback -------------------------------------------------------
const CANCEL = "error=access_denied&error_code=access_denied&error_description=The+user+denied+the+request";
for (const where of ["query", "hash"]) {
  const { page, seen, close } = await open({ who: "none", authorize: "dismiss" });
  await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
  await googleBtn(page).waitFor();
  await tapGoogle(page, seen);
  await page.goto(BASE + "/auth/callback" + (where === "query" ? "?" : "#") + CANCEL, { waitUntil: "networkidle" });
  const h1 = await h1Text(page);
  ok(`callback, cancelled at Google (${where}): says Google did not finish`, /Google/.test(h1) && !/already been used/.test(h1), h1);
  const again = page.getByRole("link", { name: /Try again/ });
  const href = (await again.count()) ? await again.first().getAttribute("href") : null;
  ok(`callback, cancelled at Google (${where}): the way back is to where they started`, href === "/signup", String(href));
  await close();
}
if (SHOTS) {
  for (const theme of ["light", "dark"]) {
    const s = await open({ who: "none", authorize: "dismiss" }, { theme });
    await s.page.goto(BASE + "/signup", { waitUntil: "networkidle" });
    await googleBtn(s.page).waitFor();
    await tapGoogle(s.page, s.seen);
    await s.page.goto(BASE + "/auth/callback#" + CANCEL, { waitUntil: "networkidle" });
    await sleep(1200);
    await s.page.screenshot({ path: `${OUT}callback-cancelled-${SHOTS}-${theme}.png` });
    await s.close();
  }
}
{
  // An expired email link is a different thing and keeps its own words.
  const { page, close } = await open({ who: "none", authorize: "dismiss" });
  await page.goto(BASE + "/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", { waitUntil: "networkidle" });
  const h1 = await h1Text(page);
  ok("callback, an expired email link: talks about the link, not Google", /link/i.test(h1) && !/Google/.test(h1), h1 || `${page.url()} :: ${(await page.textContent("body")).slice(0, 160)}`);
  await close();
}
{
  // A finished round trip whose user lookup is slow still lands as signed in.
  const { page, close } = await open({ who: "real", authorize: "dismiss", userDelay: 1200 });
  await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("ethos.oauth", JSON.stringify({ from: "/signup", mode: "signup", at: Date.now() })));
  await page.evaluate(() => localStorage.removeItem("sb-supabase-auth-token"));
  await page.goto(`${BASE}/auth/callback#access_token=${token(false)}&expires_in=86400&expires_at=${exp}&refresh_token=r1&token_type=bearer`, { waitUntil: "load" });
  const landed = await page.getByText("You're in", { exact: true }).waitFor({ timeout: 8000 }).then(() => true, () => false);
  const h1 = (await page.locator("main h1").first().textContent().catch(() => "")) ?? "";
  ok("callback, a finished Google return with a slow server: lands as signed in", landed, h1);
  await close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
