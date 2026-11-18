/**
 * "i tried to get onto the immersion. If i sign up it wont take me to
 * it. or maybe i signed in w an acc that was anyway. Say signing into
 * account or account exists after u sign in. if u sign into an account
 * that somehow hasnt done the onboarding make them onboard. email or
 * google make them onboard." (Timothy, 17 Nov, #497). Walked and held.
 *
 * Every way onto an account reads whether it has finished the
 * introduction (the account's onboarding row, merged with this device's
 * walk): not finished, the introduction, the room first; finished, where
 * it was going. The landing says which account this was, once.
 *
 *   signin-unfinished  email sign-in to an account with no row: the room,
 *                      its door without Sign in or Tester code, "Signed in
 *                      to your account." once; no loop (a reload is the
 *                      room again, Today is not bounced, Not now is the name)
 *   signin-finished    an account with a row: Today, the line, the row
 *                      taken down so /welcome opens on the plan, never the room
 *   signup-new         a new account (confirmations off): the room, "Account created."
 *   signup-existing    a sign-up meeting a finished account: Today, "That email
 *                      already has an account, so you're signed in."
 *   google-finished    the callback: "Signed in to your account as ...", the way on Today
 *   google-unfinished  the callback for a new Google account: "Account created ...",
 *                      Next, and Next is the room
 *   guest-finished     a guest who finished the walk here signs in to an account
 *                      with no row: finished, Today, the walk goes up to the account
 *   two-accounts       (#499) that guest signs in to A by email, signs out in
 *                      Settings, then to B with Google: B gets the walk too, once,
 *                      and lands on Today; C, which finished the introduction
 *                      itself, keeps its own
 *
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     BASE=http://localhost:3123 node scripts/check-auth-onboard.mjs
 *   SHOTS=1   also writes docs/look/auth-onboard/*.png (390x844, light)
 *   ONLY=signin-unfinished,google-finished   runs those walks
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute, cors, json, session as accountSession } from "./look-fixtures.mjs";

const BASE = process.env.BASE ?? process.env.LOOK_BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ?? "";
const OUT = new URL("../docs/look/auth-onboard/", import.meta.url).pathname;
if (SHOTS) mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const run = (name) => !ONLY || ONLY.has(name);

const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EMAIL = "tim@example.com";
const PASSWORD = "the right password";
const NOTE = {
  signedIn: "Signed in to your account.",
  existing: "That email already has an account, so you're signed in.",
  created: "Account created.",
};
/* The account's finished walk, as the onboarding table holds it. */
const ROW = { age_band: "18_24", goal: "feet", pains: ["fillers"], level: "some", context: "work", reminder_hour: 18, portfolio: {}, rules_version: 1 };
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const guestToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "guest1", aud: "authenticated", role: "authenticated", exp, is_anonymous: true, session_id: "g1" })}.sig`;
const guestUser = { id: "guest1", aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const guestSession = { access_token: guestToken, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "rg", user: guestUser };
/* Two more accounts on the same device (#499): B by Google, C by email. */
const other = (id, email) => {
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, aud: "authenticated", role: "authenticated", exp, is_anonymous: false, session_id: `s-${id}` })}.sig`;
  const user = { ...accountSession.user, id, email };
  return { user, session: { ...accountSession, access_token: token, refresh_token: `r-${id}`, user } };
};
const B = other("u2", "bee@example.com");
const C = other("u3", "cee@example.com");
const payload = (auth) => {
  try {
    return JSON.parse(Buffer.from((auth ?? "").replace(/^Bearer /, "").split(".")[1] ?? "", "base64url").toString());
  } catch {
    return {};
  }
};

/**
 * `row`: the account's onboarding row, or null. `signup`: "new" (a new
 * account, confirmations off) or "existing" (a confirmed account, the
 * obfuscated user). `fresh`: the account's one way in was made just now
 * (a new Google account).
 */
function host({ row = null, signup = "new", fresh = false, rows = null } = {}) {
  const calls = { token: 0, signup: 0, onboardingRead: 0, onboardingWrite: [] };
  const now = new Date().toISOString();
  const user = fresh
    ? { ...accountSession.user, created_at: now, identities: [{ identity_id: "g", id: "u1", user_id: "u1", provider: "google", created_at: now }] }
    : accountSession.user;
  const session = { ...accountSession, user };
  const handler = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    let body = {};
    try {
      body = req.postDataJSON() ?? {};
    } catch {}
    if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      calls.token++;
      if (rows && body.email === C.user.email && body.password === PASSWORD) return route.fulfill(json(C.session));
      if (body.email !== EMAIL || body.password !== PASSWORD) {
        return route.fulfill({ status: 400, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ code: "invalid_credentials", message: "Invalid login credentials" }) });
      }
      return route.fulfill(json(session));
    }
    if (p === "/auth/v1/signup") {
      calls.signup++;
      if (signup === "existing") {
        return route.fulfill(json({ id: "0f0f0f0f-0000-4000-8000-000000000000", aud: "authenticated", role: "", email: body.email, confirmation_sent_at: now, app_metadata: {}, user_metadata: {}, identities: [], created_at: now, updated_at: now, is_anonymous: false }));
      }
      return route.fulfill(json({ ...session, user: { ...user, email: body.email, created_at: now } }));
    }
    if (p === "/auth/v1/user" && req.method() === "GET") {
      const who = payload(req.headers()["authorization"]);
      if (!who.sub) return route.fulfill(json({ code: 401, message: "no session" }, 401));
      return route.fulfill(json(who.is_anonymous ? guestUser : who.sub === B.user.id ? B.user : who.sub === C.user.id ? C.user : user));
    }
    if (p.startsWith("/rest/v1/onboarding")) {
      /* `rows`: each account's own row, by user id, as the owner policy reads it. */
      const by = payload(req.headers()["authorization"]).sub ?? null;
      const theirs = rows ? rows[by] ?? null : row;
      if (req.method() === "GET") {
        calls.onboardingRead++;
        const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
        if (single) return route.fulfill(theirs ? json(theirs) : json({ code: "PGRST116", message: "0 rows" }, 406));
        return route.fulfill(json(theirs ? [theirs] : []));
      }
      if (rows && by) rows[by] = body;
      calls.onboardingWrite.push({ ...body, by });
      return route.fulfill({ status: 201, headers: cors, body: "" });
    }
    return supabaseRoute(route);
  };
  return { handler, calls };
}

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

/**
 * `walk`: this device's introduction ("none", or "done" for a walk
 * finished here). `guest`: an anonymous session in storage. `signedIn`:
 * the account's session in storage already (a callback's return).
 */
async function open(opts = {}, { walk = "none", guest = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: "light", timezoneId: "Australia/Melbourne", reducedMotion: "reduce" });
  const { handler, calls } = host(opts);
  await context.route("http://supabase.local/**", handler);
  await context.route(`${BASE}/api/tester`, (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(({ walk, guest }) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme: "light", reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
      if (walk === "done") {
        localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", ageBand: "18_24", goal: "feet", pains: ["fillers"], level: "some", context: "work" }, step: 9, done: true, synced: false }));
      }
      if (guest) localStorage.setItem("sb-supabase-auth-token", JSON.stringify(guest));
    } catch {}
  }, { walk, guest: guest ? guestSession : null });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, calls, errors, close: () => context.close() };
}

const path = (page) => new URL(page.url()).pathname;
const noteText = (page) =>
  page
    .locator(".toast[data-note]")
    .first()
    .textContent({ timeout: 6000 })
    .then((t) => (t ?? "").trim(), () => "");
const notes = (page) => page.locator(".toast[data-note]").count();
const onRoom = (page) => page.waitForSelector("main.room [data-room-hold]", { timeout: 10000 }).then(() => true, () => false);
const doorLinks = (page) => page.locator("main.room .room-top a").allTextContents();
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("ethos.onboarding") ?? "null"));
const shot = async (page, name) => {
  if (!SHOTS) return;
  await sleep(350);
  await page.screenshot({ path: `${OUT}${name}.png` });
};

async function signInOn(page, route) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
}

// ---- 1. Email sign-in, the introduction not finished ----------------------
if (run("signin-unfinished")) {
  const { page, calls, errors, close } = await open({ row: null });
  await signInOn(page, "/signin");
  await page.waitForURL(/\/welcome/, { timeout: 10000 }).catch(() => {});
  ok("email sign-in, unfinished: lands on the introduction", path(page) === "/welcome", page.url());
  ok("email sign-in, unfinished: the account's row was read", calls.onboardingRead >= 1, String(calls.onboardingRead));
  ok("email sign-in, unfinished: it opens on the room", await onRoom(page));
  const said = await noteText(page);
  ok("email sign-in, unfinished: the room says it signed in to the account, once", said === NOTE.signedIn && (await notes(page)) === 1, said);
  const links = await doorLinks(page);
  ok("email sign-in, unfinished: the door has no Sign in and no Tester code", links.length === 0, JSON.stringify(links));
  ok("email sign-in, unfinished: Hold to step in and Not now are there", (await page.locator("[data-room-hold]", { hasText: "Hold to step in" }).count()) === 1 && (await page.getByRole("button", { name: "Not now" }).count()) === 1);
  await shot(page, "01-room-signed-in");
  await page.locator(".toast[data-note]").waitFor({ state: "detached", timeout: 7000 }).catch(() => {});
  await shot(page, "02-room-signed-in-settled");
  // No loop, and the line once: a reload is the room again, saying nothing.
  await page.reload({ waitUntil: "networkidle" });
  ok("no loop: a reload of the introduction is the room again", await onRoom(page));
  await sleep(600);
  ok("once: a reload says nothing", (await notes(page)) === 0);
  // Today never bounces an account back into the introduction.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(1500);
  ok("no loop: Today stays Today", path(page) === "/", page.url());
  // Not now on the door goes on to the name, and the account ask stays skipped.
  await page.goto(BASE + "/welcome", { waitUntil: "networkidle" });
  await onRoom(page);
  await page.getByRole("button", { name: "Not now" }).click();
  const name = await page.getByText("What do I call you?").first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  ok("the room's Not now goes on to the name", name);
  ok("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await close();
}

// ---- 2. Email sign-in, the introduction finished elsewhere ----------------
if (run("signin-finished")) {
  const { page, close } = await open({ row: ROW });
  await signInOn(page, "/signin");
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
  ok("email sign-in, finished: lands on Today", path(page) === "/", page.url());
  const said = await noteText(page);
  ok("email sign-in, finished: Today says it signed in to the account", said === NOTE.signedIn, said);
  await shot(page, "03-today-signed-in");
  const s = await stored(page);
  ok("email sign-in, finished: the account's walk came down to this device", s?.done === true && s?.answers?.goal === "feet", JSON.stringify(s));
  await page.goto(BASE + "/welcome", { waitUntil: "networkidle" });
  await sleep(1000);
  ok("finished: the introduction never opens on the room again", (await page.locator("main.room").count()) === 0);
  await close();
}

// ---- 3. Sign-up, a new account --------------------------------------------
if (run("signup-new")) {
  const { page, close } = await open({ row: null, signup: "new" });
  await signInOn(page, "/signup");
  await page.waitForURL(/\/welcome/, { timeout: 10000 }).catch(() => {});
  ok("sign-up, new account: lands on the introduction, the room first", path(page) === "/welcome" && (await onRoom(page)), page.url());
  const said = await noteText(page);
  ok("sign-up, new account: it says the account was created", said === NOTE.created, said);
  await shot(page, "04-room-account-created");
  await close();
}

// ---- 4. Sign-up meeting an account that has finished ------------------------
if (run("signup-existing")) {
  const { page, calls, close } = await open({ row: ROW, signup: "existing" });
  await signInOn(page, "/signup");
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
  ok("sign-up, existing account: signed in to it and on Today", path(page) === "/" && calls.token === 1 && calls.signup === 1, `${page.url()} token ${calls.token}`);
  const said = await noteText(page);
  ok("sign-up, existing account: it says the email already had an account", said === NOTE.existing, said);
  await shot(page, "05-today-account-exists");
  await close();
}
if (run("signup-existing-unfinished")) {
  const { page, close } = await open({ row: null, signup: "existing" });
  await signInOn(page, "/signup");
  await page.waitForURL(/\/welcome/, { timeout: 10000 }).catch(() => {});
  ok("sign-up, existing account not finished: the room", path(page) === "/welcome" && (await onRoom(page)), page.url());
  ok("sign-up, existing account not finished: says the email had an account", (await noteText(page)) === NOTE.existing);
  await close();
}

// ---- 5 and 6. Google through /auth/callback --------------------------------
async function googleReturn(page, mode, token = accountSession.access_token) {
  await page.goto(BASE + "/about", { waitUntil: "networkidle" });
  await page.evaluate((mode) => sessionStorage.setItem("ethos.oauth", JSON.stringify({ from: "/signin", mode, at: Date.now() })), mode);
  await page.goto(`${BASE}/auth/callback#access_token=${token}&expires_in=86400&expires_at=${exp}&refresh_token=r1&token_type=bearer`, { waitUntil: "load" });
  return page.getByText("You're in", { exact: true }).waitFor({ timeout: 10000 }).then(() => true, () => false);
}
const callbackLine = (page) => page.locator("main p").first().textContent().then((t) => (t ?? "").trim(), () => "");
const callbackTap = (page) => page.locator("main a").last();

if (run("google-finished")) {
  const { page, close } = await open({ row: ROW });
  const inn = await googleReturn(page, "signin");
  ok("Google, finished: signed in", inn);
  const line = await callbackLine(page);
  ok("Google, finished: it says it signed in to the account", line === `Signed in to your account as ${EMAIL}.`, line);
  const href = await callbackTap(page).getAttribute("href").catch(() => null);
  ok("Google, finished: the way on is Today, as before", href === "/", String(href));
  ok("Google, finished: no second line on the callback", (await notes(page)) === 0);
  await shot(page, "06-callback-signed-in");
  await close();
}
if (run("google-unfinished")) {
  const { page, close } = await open({ row: null, fresh: true });
  const inn = await googleReturn(page, "signin");
  ok("Google, a new account: signed in", inn);
  const line = await callbackLine(page);
  ok("Google, a new account: it says the account was created", line === `Account created for ${EMAIL}.`, line);
  const tap = callbackTap(page);
  const href = await tap.getAttribute("href").catch(() => null);
  const label = ((await tap.textContent().catch(() => "")) ?? "").trim();
  ok("Google, unfinished: the way on is the introduction", href === "/welcome" && label === "Next", `${href} ${label}`);
  await shot(page, "07-callback-account-created");
  await tap.click();
  ok("Google, unfinished: Next opens on the room", await onRoom(page), page.url());
  ok("Google, unfinished: the door has no Sign in and no Tester code", (await doorLinks(page)).length === 0);
  ok("Google, unfinished: the line is not said a second time", (await notes(page)) === 0);
  await close();
}
if (run("google-unfinished-existing")) {
  // An old account that never did the introduction, signed in with Google.
  const { page, close } = await open({ row: null });
  await googleReturn(page, "signin");
  const line = await callbackLine(page);
  ok("Google, an old account not finished: says signed in to the account", line === `Signed in to your account as ${EMAIL}.`, line);
  ok("Google, an old account not finished: the way on is the introduction", (await callbackTap(page).getAttribute("href").catch(() => null)) === "/welcome");
  await close();
}

// ---- 7. A guest who finished here, then signs in ---------------------------
if (run("guest-finished")) {
  const { page, calls, close } = await open({ row: null }, { walk: "done", guest: true });
  await signInOn(page, "/signin");
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
  ok("a guest who finished here: counted as finished, on Today", path(page) === "/", page.url());
  ok("a guest who finished here: the walk went up to the account", calls.onboardingWrite.some((b) => b?.goal === "feet"), JSON.stringify(calls.onboardingWrite).slice(0, 160));
  ok("a guest who finished here: says it signed in to the account", (await noteText(page)) === NOTE.signedIn);
  await close();
}

// ---- 8. Two accounts on one device, a sign-out between (#499) ---------------
if (run("two-accounts")) {
  const rows = { u1: null, u2: null, u3: ROW };
  const { page, calls, errors, close } = await open({ rows }, { walk: "done", guest: true });
  const to = (id) => calls.onboardingWrite.filter((b) => b.by === id);
  // A, by email.
  await signInOn(page, "/signin");
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
  ok("two accounts: A, by email, lands on Today", path(page) === "/", page.url());
  await sleep(800);
  ok("two accounts: the walk went up to A", to("u1").length === 1 && to("u1")[0]?.goal === "feet", JSON.stringify(calls.onboardingWrite).slice(0, 200));
  // Sign out, in Settings.
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/signin/, { timeout: 10000 }).catch(() => {});
  const kept = await stored(page);
  ok("two accounts: signed out, the walk stays this device's, settled with A", kept?.done === true && JSON.stringify(kept?.syncedTo) === '["u1"]', JSON.stringify(kept));
  // B, by Google.
  const inn = await googleReturn(page, "signin", B.session.access_token);
  ok("two accounts: B, by Google, signed in", inn);
  const line = await callbackLine(page);
  ok("two accounts: the callback names B", line === `Signed in to your account as ${B.user.email}.`, line);
  const href = await callbackTap(page).getAttribute("href").catch(() => null);
  ok("two accounts: B is not sent through the introduction again: the way on is Today", href === "/", String(href));
  ok("two accounts: the walk went up to B too", to("u2").length === 1 && to("u2")[0]?.goal === "feet" && to("u2")[0]?.level === "some", JSON.stringify(to("u2")).slice(0, 200));
  await callbackTap(page).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
  await sleep(1200);
  await page.reload({ waitUntil: "networkidle" });
  await sleep(1200);
  ok("two accounts: once: Today's syncs send B nothing more, and A nothing more", to("u2").length === 1 && to("u1").length === 1, `A ${to("u1").length}, B ${to("u2").length}`);
  // C, which finished the introduction itself, by email.
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/signin/, { timeout: 10000 }).catch(() => {});
  await page.locator("#email").fill(C.user.email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
  await sleep(1200);
  ok("two accounts: C, finished itself, lands on Today and keeps its own", path(page) === "/" && to("u3").length === 0 && rows.u3 === ROW, `${page.url()} ${to("u3").length}`);
  const last = await stored(page);
  ok("two accounts: the device is settled with A, B and C", JSON.stringify(last?.syncedTo) === '["u1","u2","u3"]', JSON.stringify(last?.syncedTo));
  ok("two accounts: no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
