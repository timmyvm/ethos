/**
 * "If i try sign up instead of sign in just sign me in instead of
 * sending me back" (Timothy, 7 Nov, #426). Walked and held.
 *
 * Sign-up meeting an account that already has the email, every way the
 * auth server says so, with the Supabase host mocked the way GoTrue
 * answers (scripts/look-fixtures.mjs serves the rest of the app):
 *
 *   A guest (an anonymous session, the email-only form): `PUT /user`
 *     answers 422 `email_exists`. The form keeps the email and asks for
 *     that account's password in place; the right one signs in and lands
 *     where a sign-in lands, testing carried; a wrong one says so and
 *     offers Sign in and Forgot? there.
 *   No session (email and password): `POST /signup` answers 200 with an
 *     obfuscated user, `identities: []`, when the email is confirmed and
 *     confirmations are on; the same password signs in at once. A wrong
 *     one stays on the form as above.
 *   An account that signed up and never confirmed: `POST /signup`
 *     resends its link and answers with the real user; a guest's sign-in
 *     meets `email_not_confirmed`, and the link goes again (`/resend`).
 *     Both end on the inbox with Sign in, never back on the form.
 *   Google: a sign-up whose Google account already has Ethos is switched
 *     to a Google sign-in (#414) from /signup and from the introduction,
 *     and ends signed in; the leftover screen signs in with one tap.
 *
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     BASE=http://localhost:3123 node scripts/check-signup-existing.mjs
 *   SHOTS=before|after   also writes docs/look/signup-existing/*.png
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute, cors, json, session as accountSession, seed } from "./look-fixtures.mjs";

const BASE = process.env.BASE ?? process.env.LOOK_BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ?? "";
const OUT = new URL("../docs/look/signup-existing/", import.meta.url).pathname;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The auth server ------------------------------------------------------
const EMAIL = "tim@example.com";
const PASSWORD = "the right password";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const guestToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "guest1", aud: "authenticated", role: "authenticated", exp, is_anonymous: true, session_id: "g1" })}.sig`;
const guestUser = { id: "guest1", aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const guestSession = { access_token: guestToken, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "rg", user: guestUser };
const accountUser = accountSession.user;
/** GoTrue's modern error body, as auth-js asks for it (X-Supabase-Api-Version). */
const fail = (status, code, message) => ({
  status,
  headers: { ...cors, "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
  body: JSON.stringify({ code, message }),
});
const payload = (auth) => {
  try {
    return JSON.parse(Buffer.from((auth ?? "").replace(/^Bearer /, "").split(".")[1] ?? "", "base64url").toString());
  } catch {
    return {};
  }
};

/**
 * `existing`: "confirmed" | "unconfirmed" | null, the account that has
 * EMAIL. `recordings`: what this device holds (0 is the guest #410 made,
 * who has not recorded yet). `google`: "taken" sends a link back with
 * Supabase's error, a plain sign-in back with the account's session.
 */
function host({ existing = "confirmed", recordings = 0, tester = false } = {}) {
  const calls = { updateUser: [], signup: [], token: [], resend: [], recover: [], link: 0, authorize: [], carry: [] };
  const handler = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    let body = {};
    try {
      body = req.postDataJSON() ?? {};
    } catch {}
    if (p === "/auth/v1/user" && req.method() === "PUT") {
      calls.updateUser.push(body);
      if (existing && body.email === EMAIL) return route.fulfill(fail(422, "email_exists", "A user with this email address has already been registered"));
      return route.fulfill(json({ ...guestUser, new_email: body.email }));
    }
    if (p === "/auth/v1/user") {
      const who = payload(req.headers()["authorization"]);
      if (!who.sub) return route.fulfill(fail(401, "no_authorization", "no session"));
      return route.fulfill(json(who.is_anonymous ? guestUser : accountUser));
    }
    if (p === "/auth/v1/signup") {
      calls.signup.push(body);
      const now = new Date().toISOString();
      if (existing === "confirmed" && body.email === EMAIL) {
        // The obfuscated user: a fresh id, no identities, no session.
        return route.fulfill(json({ id: "0f0f0f0f-0000-4000-8000-000000000000", aud: "authenticated", role: "", email: EMAIL, phone: "", confirmation_sent_at: now, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: now, updated_at: now, is_anonymous: false }));
      }
      if (existing === "unconfirmed" && body.email === EMAIL) {
        const then = new Date(Date.now() - 3 * 86400_000).toISOString();
        return route.fulfill(json({ id: "u-unconfirmed", aud: "authenticated", role: "authenticated", email: EMAIL, confirmation_sent_at: now, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [{ identity_id: "i1", id: "u-unconfirmed", user_id: "u-unconfirmed", provider: "email", email: EMAIL, created_at: then }], created_at: then, updated_at: now, is_anonymous: false }));
      }
      return route.fulfill(json({ id: "u-new", aud: "authenticated", role: "authenticated", email: body.email, confirmation_sent_at: now, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [{ identity_id: "i2", id: "u-new", user_id: "u-new", provider: "email", email: body.email, created_at: now }], created_at: now, updated_at: now, is_anonymous: false }));
    }
    if (p === "/auth/v1/token") {
      calls.token.push({ grant: url.searchParams.get("grant_type"), ...body });
      if (url.searchParams.get("grant_type") === "password") {
        if (!existing || body.email !== EMAIL || body.password !== PASSWORD) return route.fulfill(fail(400, "invalid_credentials", "Invalid login credentials"));
        if (existing === "unconfirmed") return route.fulfill(fail(400, "email_not_confirmed", "Email not confirmed"));
        return route.fulfill(json(accountSession));
      }
      return route.fulfill(json(accountSession));
    }
    if (p === "/auth/v1/resend") {
      calls.resend.push(body);
      return route.fulfill(json({}));
    }
    if (p === "/auth/v1/recover") {
      calls.recover.push(body);
      return route.fulfill(json({}));
    }
    if (p === "/auth/v1/user/identities/authorize") {
      calls.link++;
      const back = url.searchParams.get("redirect_to") ?? `${BASE}/auth/callback`;
      return route.fulfill(json({ url: `http://supabase.local/auth/v1/authorize?provider=google&link=1&redirect_to=${encodeURIComponent(back)}` }));
    }
    if (p === "/auth/v1/authorize") {
      const link = url.searchParams.get("link") === "1";
      calls.authorize.push(link ? "link" : "signin");
      const back = url.searchParams.get("redirect_to") ?? `${BASE}/auth/callback`;
      const to = link
        ? `${back}#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user`
        : `${back}#access_token=${accountSession.access_token}&expires_in=86400&expires_at=${exp}&refresh_token=r1&token_type=bearer`;
      return route.fulfill({ status: 302, headers: { Location: to } });
    }
    if (p.startsWith("/rest/v1/reps") && recordings === 0) return route.fulfill(json([]));
    if (p.startsWith("/rest/v1/testers")) {
      // A guest who joined testing on the introduction has a testers row.
      const row = tester ? { consent_version: 3, consented_at: new Date().toISOString(), created_at: new Date().toISOString(), stopped_at: null } : null;
      const single = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
      if (single) return route.fulfill(row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406));
      return route.fulfill(json(row ? [row] : []));
    }
    return supabaseRoute(route);
  };
  return { handler, calls };
}

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function open(opts = {}, { theme = "light", width = 390, height = 844, tester = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: theme, timezoneId: "Australia/Melbourne" });
  const { handler, calls } = host({ ...opts, tester });
  await context.route("http://supabase.local/**", handler);
  await context.route(`${BASE}/api/tester`, async (route) => {
    let body = null;
    try {
      body = route.request().postDataJSON();
    } catch {}
    calls.carry.push({ body, auth: route.request().headers()["authorization"] ?? null });
    return route.fulfill(json({ ok: true, tester: { consent_version: 3, consented_at: new Date().toISOString() } }));
  });
  await context.addInitScript(({ theme, guest, tester }) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
      localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", pains: [] }, step: 99, done: true, synced: false }));
      if (guest) localStorage.setItem("sb-supabase-auth-token", JSON.stringify(guest));
      if (tester) localStorage.setItem("ethos.tester", "1");
    } catch {}
  }, { theme, guest: opts.who === "anon" ? guestSession : null, tester });
  const page = await context.newPage();
  const visited = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) visited.push(f.url());
  });
  return { page, context, calls, visited, close: () => context.close() };
}
void seed;

/* Soft: before the change some of these are not on screen, and the
   walk still has to reach its shots. */
const fillSoft = (loc, v) => loc.fill(v, { timeout: 2500 }).catch(() => {});
const clickSoft = (loc) => loc.click({ timeout: 3000 }).catch(() => {});
const submit = (page) => page.locator('form button[type="submit"]');
const emailField = (page) => page.locator("#email");
const passwordField = (page) => page.locator("#password");
const storedUser = (page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("sb-supabase-auth-token") ?? "null")?.user ?? null;
    } catch {
      return null;
    }
  });
const path = (page) => new URL(page.url()).pathname;
async function shot(page, name) {
  if (!SHOTS) return;
  await sleep(500);
  await page.screenshot({ path: `${OUT}${name}-${SHOTS}.png` });
}
async function typeEmailAndSend(page, email, password) {
  await emailField(page).waitFor({ timeout: 10000 }).catch(() => {});
  await fillSoft(emailField(page), email);
  if (password !== undefined && (await passwordField(page).count())) await fillSoft(passwordField(page), password);
  await clickSoft(submit(page));
  await sleep(700);
}
/** Waits for the page to leave /signup and settle, then where it is. */
async function landed(page, from = "/signup") {
  for (let i = 0; i < 60 && path(page) === from; i++) await sleep(100);
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(1800);
  return path(page);
}

const ONLY = process.env.ONLY ?? "";
const run = (name) => !ONLY || ONLY.split(",").includes(name);

// ---- 1. A guest, the account exists, the right password -----------------
if (run("guest")) {
  const { page, calls, close } = await open({ who: "anon", existing: "confirmed" }, { tester: true });
  await page.goto(`${BASE}/signup?next=${encodeURIComponent("/history")}`, { waitUntil: "networkidle" });
  await emailField(page).waitFor({ timeout: 10000 });
  ok("guest: the sign-up form asks for the email only", (await passwordField(page).count()) === 0);
  await typeEmailAndSend(page, EMAIL);
  ok("guest: the email is offered to this guest once, never signed up again", calls.updateUser.length === 1 && calls.signup.length === 0, `updateUser ${calls.updateUser.length}, signup ${calls.signup.length}`);
  ok("guest: it stays on the form", path(page) === "/signup", page.url());
  ok("guest: the email is kept", (await emailField(page).inputValue({ timeout: 2000 }).catch(() => "")) === EMAIL);
  const asked = await passwordField(page).waitFor({ timeout: 3000 }).then(() => true, () => false);
  ok("guest: the account's password is asked for in place", asked);
  const said = ((await page.locator('[role="status"], [role="alert"]').allTextContents()).join(" ") || "").trim();
  ok("guest: it says the email has an account", /already has an Ethos account|has an Ethos account/.test(said), said);
  ok("guest: the old send-back line is gone", !/Sign in instead/.test(said), said);
  const title = ((await page.locator("main h1").first().textContent({ timeout: 2000 }).catch(() => "")) ?? "").trim();
  ok("guest: the screen is the sign-in's own now (its title)", title === "Welcome back", title);
  ok("guest: Already have one? goes, since the form is that now", (await page.getByText("Already have one?").count()) === 0);
  ok("guest: the tap signs in", /^Sign in$/.test(((await submit(page).textContent({ timeout: 2000 }).catch(() => "")) ?? "").trim()), (await submit(page).textContent({ timeout: 2000 }).catch(() => "")) ?? "");
  ok("guest: the password field is where the cursor is", await passwordField(page).evaluate((el) => el === document.activeElement, null, { timeout: 2000 }).catch(() => false));
  const forgot = page.getByRole("link", { name: /Forgot/ });
  const forgotHref = (await forgot.count()) ? await forgot.first().getAttribute("href", { timeout: 2000 }).catch(() => null) : null;
  ok("guest: Forgot? is on the password row with the email filled", !!forgotHref && forgotHref.includes(encodeURIComponent(EMAIL)), String(forgotHref));
  await shot(page, "guest-asked-light");
  await fillSoft(passwordField(page), PASSWORD);
  await clickSoft(submit(page));
  const where = await landed(page);
  ok("guest: the right password signs in and lands where a sign-in lands (next)", where === "/history", page.url());
  const user = await storedUser(page);
  ok("guest: the session is the account, not a guest", user?.id === accountUser.id && user?.is_anonymous === false, JSON.stringify(user?.id));
  ok("guest: signed in once, with the email typed", calls.token.length === 1 && calls.token[0].email === EMAIL, JSON.stringify(calls.token.map((t) => t.email)));
  ok("guest: testing rides along as on every sign-in (carried_from)", calls.carry.some((c) => c.body?.carry === guestToken && c.auth === `Bearer ${accountSession.access_token}`), JSON.stringify(calls.carry.map((c) => Object.keys(c.body ?? {}))));
  ok("guest: the account gate lets them stay", path(page) === "/history", page.url());
  await close();
}

// ---- 2. A guest, the wrong password, then the right one -----------------
for (const [theme, width, height] of run("wrong") ? [["light", 390, 844], ["dark", 390, 844], ["light", 375, 667]] : []) {
  const label = `${width}x${height} ${theme}`;
  const first = theme === "light" && width === 390;
  const { page, calls, close } = await open({ who: "anon", existing: "confirmed" }, { theme, width, height });
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await typeEmailAndSend(page, EMAIL);
  await passwordField(page).waitFor({ timeout: 3000 }).catch(() => {});
  if (!first) await shot(page, `guest-asked-${theme}${width === 375 ? "-375" : ""}`);
  await fillSoft(passwordField(page), "not the password");
  await clickSoft(submit(page));
  await sleep(900);
  const alert = ((await page.locator('[role="alert"]').allTextContents()).join(" ") || "").trim();
  if (first) {
    ok("wrong password: it stays on the form", path(page) === "/signup", page.url());
    ok("wrong password: it says the email has an account and the password doesn't match it", /has an Ethos account/.test(alert) && /match/.test(alert), alert);
    ok("wrong password: the email is kept", (await emailField(page).inputValue({ timeout: 2000 }).catch(() => "")) === EMAIL);
    ok("wrong password: the password is cleared for another go, cursor in it", (await passwordField(page).inputValue({ timeout: 2000 }).catch(() => "x")) === "" && (await passwordField(page).evaluate((el) => el === document.activeElement, null, { timeout: 2000 }).catch(() => false)));
    ok("wrong password: Sign in is the tap", /^Sign in$/.test(((await submit(page).textContent({ timeout: 2000 }).catch(() => "")) ?? "").trim()));
    const forgot = page.getByRole("link", { name: /Forgot/ });
    const href = (await forgot.count()) ? await forgot.first().getAttribute("href", { timeout: 2000 }).catch(() => null) : null;
    ok("wrong password: reset is offered there, the email filled", !!href && href.startsWith("/auth/forgot") && href.includes(encodeURIComponent(EMAIL)), String(href));
    ok("wrong password: nothing was signed up", calls.signup.length === 0 && calls.updateUser.length === 1);
  }
  await shot(page, `guest-wrong-${theme}${width === 375 ? "-375" : ""}`);
  if (first) {
    // Forgot? opens the reset page with the address already in it.
    const forgot = page.getByRole("link", { name: /Forgot/ }).first();
    await clickSoft(forgot);
    await page.waitForURL(/\/auth\/forgot/, { timeout: 5000 }).catch(() => {});
    await sleep(600);
    ok("Forgot? lands on the reset page with the email filled", path(page) === "/auth/forgot" && (await emailField(page).inputValue().catch(() => "")) === EMAIL, page.url());
    await page.goBack({ waitUntil: "networkidle" });
    await sleep(600);
    // Back on the form (a fresh load): typing it again works end to end.
    if ((await passwordField(page).count()) === 0) {
      await typeEmailAndSend(page, EMAIL);
      await passwordField(page).waitFor({ timeout: 3000 }).catch(() => {});
    }
    await fillSoft(passwordField(page), PASSWORD);
    await clickSoft(submit(page));
    const where = await landed(page);
    ok("wrong password, then the right one: signed in, on Today", where === "/" && (await storedUser(page))?.is_anonymous === false, page.url());
  }
  await close();
}

// ---- 3. A guest who edits the email goes back to making an account ------
if (run("edit")) {
  const { page, calls, close } = await open({ who: "anon", existing: "confirmed" });
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await typeEmailAndSend(page, EMAIL);
  await passwordField(page).waitFor({ timeout: 3000 }).catch(() => {});
  await fillSoft(emailField(page), "new@example.com");
  await sleep(200);
  ok("guest: another email takes the password field away again", (await passwordField(page).count()) === 0);
  const title = ((await page.locator("main h1").first().textContent({ timeout: 2000 }).catch(() => "")) ?? "").trim();
  ok("guest: and the title is Create your account again", title === "Create your account", title);
  ok("guest: and the tap makes an account again", /Create my account/.test(((await submit(page).textContent({ timeout: 2000 }).catch(() => "")) ?? "").trim()));
  await clickSoft(submit(page));
  await sleep(900);
  ok("guest: a new email still gets its link", (await page.locator("main h1").first().textContent({ timeout: 4000 }).catch(() => ""))?.includes("Check your inbox") && calls.updateUser.length === 2);
  await close();
}

// ---- 4. A pre-#410 guest with recordings is told what a sign-in leaves --
if (run("recordings")) {
  const { page, close } = await open({ who: "anon", existing: "confirmed", recordings: 22 });
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await typeEmailAndSend(page, EMAIL);
  await passwordField(page).waitFor({ timeout: 3000 }).catch(() => {});
  const tile = ((await page.getByText(/On this device/).locator("..").textContent().catch(() => "")) ?? "").trim();
  ok("guest with recordings: before signing in, the tile says they stay on this device", /leaves them on this device/.test(tile), tile.slice(0, 140));
  ok("guest with recordings: and nothing under Google says they attach", (await page.getByText("Your recordings attach to it the same way.").count()) === 0);
  await shot(page, "guest-recordings-light");
  await close();
}

// ---- 5. No session: the obfuscated user, then a sign-in -----------------
if (run("none")) {
  const { page, calls, close } = await open({ who: "none", existing: "confirmed" });
  await page.goto(`${BASE}/signup?next=${encodeURIComponent("/history")}`, { waitUntil: "networkidle" });
  await emailField(page).waitFor({ timeout: 10000 });
  ok("no session: the form asks for a password", (await passwordField(page).count()) === 1);
  await typeEmailAndSend(page, EMAIL, PASSWORD);
  const where = await landed(page);
  ok("no session, right password: signed in at once, not sent to an inbox that never gets mail", where === "/history" && calls.token.length === 1, `${page.url()}, token ${calls.token.length}`);
  ok("no session: signed up once, never twice, never a resend", calls.signup.length === 1 && calls.resend.length === 0);
  ok("no session: the session is the account", (await storedUser(page))?.id === accountUser.id);
  await close();
}
for (const [theme, width, height] of run("none") ? [["light", 390, 844], ["dark", 390, 844], ["light", 375, 667]] : []) {
  const first = theme === "light" && width === 390;
  const { page, calls, close } = await open({ who: "none", existing: "confirmed" }, { theme, width, height });
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await typeEmailAndSend(page, EMAIL, "not the password");
  await sleep(500);
  if (first) {
    const alert = ((await page.locator('[role="alert"]').allTextContents()).join(" ") || "").trim();
    ok("no session, wrong password: it stays on the form", path(page) === "/signup" && !/Check your inbox/.test((await page.locator("main h1").first().textContent({ timeout: 4000 }).catch(() => "")) ?? ""), page.url());
    ok("no session, wrong password: it says the email has an account and the password doesn't match", /has an Ethos account/.test(alert) && /match/.test(alert), alert);
    ok("no session, wrong password: the email is kept, the password cleared", (await emailField(page).inputValue({ timeout: 2000 }).catch(() => "")) === EMAIL && (await passwordField(page).inputValue({ timeout: 2000 }).catch(() => "x")) === "");
    ok("no session, wrong password: Sign in is the tap", /^Sign in$/.test(((await submit(page).textContent({ timeout: 2000 }).catch(() => "")) ?? "").trim()));
    const href = await page.getByRole("link", { name: /Forgot/ }).first().getAttribute("href", { timeout: 2000 }).catch(() => null);
    ok("no session, wrong password: Forgot? carries the email", !!href && href.includes(encodeURIComponent(EMAIL)), String(href));
    await fillSoft(passwordField(page), PASSWORD);
    await clickSoft(submit(page));
    const where = await landed(page);
    ok("no session, then the right password: signed in in place", where === "/" && calls.signup.length === 1, `${page.url()} signup ${calls.signup.length}`);
  } else await shot(page, `none-wrong-${theme}${width === 375 ? "-375" : ""}`);
  if (first && SHOTS) {
    // The shot, taken on a fresh form in the same state.
    const again = await open({ who: "none", existing: "confirmed" }, { theme, width, height });
    await again.page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
    await typeEmailAndSend(again.page, EMAIL, "not the password");
    await shot(again.page, "none-wrong-light");
    await again.close();
  }
  await close();
}

// ---- 6. An account that signed up and never confirmed --------------------
for (const [theme, width, height] of run("unconfirmed") ? [["light", 390, 844], ["dark", 390, 844], ["light", 375, 667]] : []) {
  const first = theme === "light" && width === 390;
  const suffix = `${theme}${width === 375 ? "-375" : ""}`;
  {
    const { page, calls, close } = await open({ who: "none", existing: "unconfirmed" }, { theme, width, height });
    await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
    await typeEmailAndSend(page, EMAIL, PASSWORD);
    await sleep(400);
    const h1 = ((await page.locator("main h1").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").trim();
    const body = ((await page.locator("main").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (first) {
      ok("unconfirmed, no session: the inbox, not the form", /Check your inbox/.test(h1), h1);
      ok("unconfirmed, no session: it says the link went again", /again/.test(body), body.slice(0, 220));
      const signIn = page.getByRole("link", { name: /^Sign in$/ });
      const href = (await signIn.count()) ? await signIn.first().getAttribute("href", { timeout: 2000 }).catch(() => null) : null;
      ok("unconfirmed, no session: the one tap is Sign in, with the email filled", !!href && href.startsWith("/signin") && href.includes(encodeURIComponent(EMAIL)), String(href));
      ok("unconfirmed, no session: no sign-in was tried on it", calls.token.length === 0);
    }
    await shot(page, `none-unconfirmed-${suffix}`);
    if (first) {
      await clickSoft(page.getByRole("link", { name: /^Sign in$/ }).first());
      await page.waitForURL(/\/signin/, { timeout: 5000 }).catch(() => {});
      await emailField(page).waitFor({ timeout: 8000 }).catch(() => {});
      await sleep(400);
      ok("unconfirmed: Sign in opens with the email filled", (await emailField(page).inputValue().catch(() => "")) === EMAIL, page.url());
    }
    await close();
  }
  {
    const { page, calls, close } = await open({ who: "anon", existing: "unconfirmed" }, { theme, width, height });
    await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
    await typeEmailAndSend(page, EMAIL);
    await passwordField(page).waitFor({ timeout: 3000 }).catch(() => {});
    await fillSoft(passwordField(page), PASSWORD);
    await clickSoft(submit(page));
    await sleep(900);
    const h1 = ((await page.locator("main h1").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").trim();
    if (first) {
      ok("unconfirmed, guest: its link goes again", calls.resend.length === 1 && calls.resend[0].email === EMAIL && calls.resend[0].type === "signup", JSON.stringify(calls.resend));
      ok("unconfirmed, guest: the inbox, with Sign in, never the form again", /Check your inbox/.test(h1) && (await page.getByRole("link", { name: /^Sign in$/ }).count()) === 1, h1);
    }
    await shot(page, `guest-unconfirmed-${suffix}`);
    await close();
  }
}

// ---- 7. A brand-new email still gets its link ----------------------------
if (run("new")) {
  const { page, calls, close } = await open({ who: "none", existing: "confirmed" });
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await typeEmailAndSend(page, "new@example.com", PASSWORD);
  const h1 = ((await page.locator("main h1").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").trim();
  ok("a new email: Check your inbox, no sign-in tried", /Check your inbox/.test(h1) && calls.token.length === 0, h1);
  const body = ((await page.locator("main").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").replace(/\s+/g, " ");
  ok("a new email: no word of an earlier sign-up", !/again/.test(body), body.slice(0, 200));
  await close();
}

// ---- 8. Google: a sign-up whose Google account already has Ethos --------
const signedInAfter = async (page) => {
  const youre = await page.getByText("You're in", { exact: true }).waitFor({ timeout: 12000 }).then(() => true, () => false);
  return youre;
};
for (const [from, start] of run("google") ? [["/signup", "/signup"], ["the introduction", "/welcome"], ["the account gate", "/history"]] : []) {
  const { page, calls, visited, close } = await open({ who: "anon", existing: "confirmed" });
  await page.goto(BASE + start, { waitUntil: "networkidle" });
  if (start === "/welcome") {
    await sleep(600);
    await page.locator("main button").filter({ hasNotText: /^(Back|Skip|←)/ }).last().click().catch(() => {});
  }
  if (start === "/history") await page.waitForURL(/\/signup/, { timeout: 8000 }).catch(() => {});
  const google = page.getByRole("button", { name: /Continue with Google/ }).first();
  await google.waitFor({ timeout: 8000 }).catch(() => {});
  await sleep(300);
  const at = visited.length;
  await clickSoft(google);
  const inn = await signedInAfter(page);
  const after = visited.slice(at).map((u) => new URL(u).pathname);
  ok(`Google from ${from}: the taken link turns into a Google sign-in`, calls.link === 1 && calls.authorize.join(",") === "link,signin", calls.authorize.join(","));
  ok(`Google from ${from}: ends signed in`, inn && (await storedUser(page))?.is_anonymous === false, page.url());
  ok(`Google from ${from}: never back on a sign-up screen on the way`, !after.some((p) => p === "/signup" || p === "/welcome"), after.join(" > "));
  const text = ((await page.locator("main").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").replace(/\s+/g, " ");
  ok(`Google from ${from}: the welcome back does not claim this device's recordings came along`, !/came with you/.test(text), text.slice(0, 160));
  if (from === "the account gate") {
    const next = page.getByRole("link").filter({ hasText: /\S/ }).last();
    const href = await next.getAttribute("href", { timeout: 2000 }).catch(() => null);
    ok("Google from the account gate: the way on is the page it started from", href === "/history", String(href));
  }
  if (from === "/signup" && SHOTS) {
    for (const theme of ["light", "dark"]) {
      const s = await open({ who: "anon", existing: "confirmed" }, { theme });
      await s.page.goto(BASE + "/signup", { waitUntil: "networkidle" });
      await clickSoft(s.page.getByRole("button", { name: /Continue with Google/ }).first());
      await signedInAfter(s.page);
      await shot(s.page, `google-signed-in-${theme}`);
      await s.close();
    }
  }
  await close();
}
if (run("leftover")) {
  // The switch already ran for this attempt (a reload of the taken return):
  // the screen left signs in with Google in one tap, no trip to /signin.
  const { page, calls, close } = await open({ who: "anon", existing: "confirmed" });
  await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
  const at = Date.now();
  await page.evaluate((at) => {
    sessionStorage.setItem("ethos.oauth", JSON.stringify({ from: "/signup", mode: "signup", at }));
    sessionStorage.setItem("ethos.google-switched", String(at));
  }, at);
  await page.goto(BASE + "/auth/callback#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user", { waitUntil: "networkidle" });
  await sleep(800);
  const h1 = ((await page.locator("main h1").first().textContent({ timeout: 4000 }).catch(() => "")) ?? "").trim();
  const google = page.getByRole("button", { name: /Continue with Google/ });
  ok("Google, the leftover screen: offers Google itself, not a trip to sign in", (await google.count()) === 1, h1);
  await shot(page, "google-leftover-light");
  if (SHOTS) {
    const d = await open({ who: "anon", existing: "confirmed" }, { theme: "dark" });
    await d.page.goto(BASE + "/signup", { waitUntil: "networkidle" });
    await d.page.evaluate((at) => {
      sessionStorage.setItem("ethos.oauth", JSON.stringify({ from: "/signup", mode: "signup", at }));
      sessionStorage.setItem("ethos.google-switched", String(at));
    }, at);
    await d.page.goto(BASE + "/auth/callback#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user", { waitUntil: "networkidle" });
    await shot(d.page, "google-leftover-dark");
    await d.close();
  }
  if (await google.count()) {
    await clickSoft(google.first());
    const inn = await signedInAfter(page);
    ok("Google, the leftover screen: one tap ends signed in", inn && calls.authorize.at(-1) === "signin", `${calls.authorize.join(",")} ${page.url()} ${((await page.locator("main").first().textContent({ timeout: 2000 }).catch(() => "")) ?? "").slice(0, 120)}`);
  }
  await close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
