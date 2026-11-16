/**
 * Settings' camera (#479): the index and every page under it, against
 * the look fixtures (scripts/look-fixtures.mjs), so each page shows a
 * signed-in account twenty-two days in.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3842
 *   LOOK_BASE=http://localhost:3842 node scripts/look-settings.mjs after
 *   LOOK_BASE=http://localhost:3842 node scripts/look-settings.mjs after index account
 *   LOOK_SIZES=390x844-light node scripts/look-settings.mjs after account-google
 *
 * Shots: LOOK_OUT (default docs/look/settings/) as
 * <tag>-<page>-<w>x<h>-<theme>.png, viewport only (LOOK_FULL=1 adds a
 * full-page shot of each). LOOK_SIZES defaults to 390x844 light and
 * dark and 375x667 light.
 *
 * Pages: index, profile, goal, account, account-google (a Google-only
 * account), email, password, notifications, practice, focus,
 * appearance, accessibility, data, data-confirm (Delete my recordings
 * pressed), stored, plan, help. A guest is sent to the account ask by
 * the app's own gate (lib/account-gate.ts) before Settings draws.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require("playwright");
const F = await import("./look-fixtures.mjs");

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3842";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/settings/", import.meta.url).pathname).replace(/\/?$/, "/");
const FULL = process.env.LOOK_FULL === "1";
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Each page: its address, what to wait for, and the account it is shot as. */
const PAGES = {
  index: { path: "/settings" },
  profile: { path: "/settings/profile" },
  goal: { path: "/settings/profile/goal" },
  account: { path: "/settings/account" },
  "account-google": { path: "/settings/account", google: true },
  email: { path: "/settings/account/email" },
  password: { path: "/settings/account/password" },
  notifications: { path: "/settings/notifications", hour: 18 },
  practice: { path: "/settings/practice" },
  focus: { path: "/settings/practice/focus" },
  appearance: { path: "/settings/appearance" },
  accessibility: { path: "/settings/accessibility" },
  data: { path: "/settings/data" },
  "data-confirm": { path: "/settings/data", tap: "Delete my recordings" },
  stored: { path: "/settings/data/stored" },
  plan: { path: "/settings/plan" },
  help: { path: "/settings/help" },
};

const iso = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
function userFor(p) {
  const identities = p.google
    ? [{ id: "g1", provider: "google", identity_id: "g1", user_id: "u1", identity_data: { email: "tim@example.com" } }]
    : [{ id: "e1", provider: "email", identity_id: "e1", user_id: "u1", identity_data: { email: "tim@example.com" } }];
  return {
    id: "u1",
    aud: "authenticated",
    role: "authenticated",
    email: "tim@example.com",
    is_anonymous: false,
    app_metadata: { provider: p.google ? "google" : "email", providers: [p.google ? "google" : "email"] },
    user_metadata: {},
    identities,
    created_at: iso(30),
    updated_at: iso(0),
  };
}

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
let failed = 0;

for (const [name, p] of Object.entries(PAGES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  for (const size of SIZES) {
    F.resetPlan("free");
    const user = userFor(p);
    const session = { ...F.session, user };
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: size.theme, serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(F.json(user));
      return F.supabaseRoute(route);
    });
    await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
    await context.route("**/api/billing/*", F.billingApiRoute);
    await context.addInitScript(F.seed, { theme: size.theme, session, pose: F.POSE_PREF });
    if (p.hour != null) {
      await context.addInitScript((hour) => {
        const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
        localStorage.setItem("ethos.prefs", JSON.stringify({ ...prefs, reminderHour: hour }));
        try {
          Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
        } catch {}
      }, p.hour);
    }
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      failed++;
      console.log("PAGEERROR", name, e.message.slice(0, 200));
    });
    try {
      await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
      await page.waitForSelector("main h1", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 8000 }).catch(() => {});
      await sleep(900);
      if (p.tap) {
        await page.getByRole("button", { name: p.tap }).first().click();
        await sleep(900);
      }
      const file = `${OUT}${TAG}-${name}-${size.w}x${size.h}-${size.theme}.png`;
      await page.screenshot({ path: file });
      if (FULL) await page.screenshot({ path: file.replace(/\.png$/, "-full.png"), fullPage: true });
      const m = await page.evaluate(() => ({
        h: document.scrollingElement.scrollHeight,
        overflowX: document.scrollingElement.scrollWidth > innerWidth,
        small: [...document.querySelectorAll("main a, main button, main [role=switch], main select, main input")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            if (e.matches("select") && getComputedStyle(e).opacity === "0") return false;
            return r.height < 43.5 && !e.closest(".text-link, .sr-only");
          })
          .map((e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 24)),
      }));
      console.log(`${name} ${size.w}x${size.h} ${size.theme}: ${m.h}px tall${m.overflowX ? ", SCROLLS SIDEWAYS" : ""}${m.small.length ? `, under 44: ${m.small.join(" | ")}` : ""}`);
      if (m.overflowX) failed++;
    } catch (e) {
      failed++;
      console.log("FAIL", name, size, e.message.slice(0, 200));
    }
    await context.close();
  }
}
await browser.close();
if (failed) {
  console.log(`${failed} problem(s)`);
  process.exitCode = 1;
}
