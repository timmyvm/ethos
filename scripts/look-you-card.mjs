/**
 * You's top card, photographed (#485): the one card that holds the
 * photo, the name, the level, the XP bar and its two lines, and the three
 * numbers; the gear on its own; and the Premium line at the page's foot.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3895
 *   LOOK_BASE=http://localhost:3895 node scripts/look-you-card.mjs after
 *   LOOK_BASE=... node scripts/look-you-card.mjs after near photo   (scenes)
 *
 * Scenes:
 *   card     the fixtures' three weeks: Level 7, today not yet spoken
 *   near     Timothy's account on 16 Nov: Level 1, 40 XP, 10 to level 2
 *   high     a long road: Level 20
 *   spoken   today spoken (its XP paid today): the lit flame
 *   photo    a profile photo on the card, then its sheet
 *   none     no name and no photo: the silhouette and "Add your name"
 *   premium  an invite code's Premium (LOOK_PLAN code), its line and its sheet
 *
 * Shots: LOOK_OUT, default docs/look/you-card/, as
 * <tag>-<scene>-<size>[-<beat>].png. Sizes: LOOK_SIZES, default every
 * one of 390x844, 375x667 and 320x568 in light and dark.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3895";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/you-card/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (
  process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light,375x667-dark,320x568-light,320x568-dark"
)
  .split(",")
  .map((s) => {
    const [wh, theme] = s.split("-");
    const [w, h] = wh.split("x").map(Number);
    return { w, h, theme, name: s };
  });
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The fixtures' XP, one event a recording (scripts/look-fixtures.mjs). */
const XP_ROWS = F.reps.map((r, i) => ({ amount: 40 + (i % 3) * 15, created_at: r.created_at }));
/** What the xp_events read answers in this scene. */
const xp = { rows: XP_ROWS };
/** The profile photo the avatar route answers with, or none (404). */
const avatar = { has: false };
/* A photo someone might pick: the app's own icon, Demos's head on sky. */
const PHOTO = readFileSync(new URL("../app/icon.png", import.meta.url));

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

for (const size of SIZES) {
  F.resetPlan("free");
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: size.theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  // Registered after the mock, so these answer first (Playwright runs the newest match).
  await context.route("http://supabase.local/rest/v1/xp_events**", (route) =>
    route.fulfill(F.json([...xp.rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))))
  );
  await context.route("http://supabase.local/storage/v1/**", (route) =>
    route.fulfill({ status: 200, headers: { ...F.cors, "Content-Type": "image/png" }, body: PHOTO })
  );
  await context.route("**/api/avatar", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return avatar.has
        ? route.fulfill(F.json({ url: "http://supabase.local/storage/v1/object/sign/avatars/u1/1.png?token=look" }))
        : route.fulfill(F.json({ none: true }, 404));
    }
    if (method === "DELETE") {
      avatar.has = false;
      return route.fulfill(F.json({ ok: true }));
    }
    avatar.has = true;
    return route.fulfill(F.json({ url: "http://supabase.local/storage/v1/object/sign/avatars/u1/2.png?token=look" }));
  });
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  const file = (scene, beat) => `${OUT}${TAG}-${scene}-${size.name}${beat ? `-${beat}` : ""}.png`;
  const shoot = async (scene, beat) => {
    await sleep(500);
    await page.screenshot({ path: file(scene, beat) });
    console.log(`shot  ${scene} ${size.name}${beat ? ` ${beat}` : ""}`);
  };
  const open = async () => {
    await page.goto(`${BASE}/you`);
    await page.waitForSelector("main :is(h1, h2, .section-head)", { timeout: 20000 });
    await page
      .waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
    await sleep(1600);
  };
  const reset = () => {
    xp.rows = XP_ROWS;
    avatar.has = false;
    F.testerMode.today = false;
    F.profile.display_name = "Timothy";
    F.resetPlan("free");
  };

  if (want("card")) {
    reset();
    await open();
    await shoot("card");
  }

  if (want("near")) {
    reset();
    // Timothy's 16 Nov: 40 XP, none of it this week.
    xp.rows = [
      { amount: 10, created_at: F.reps[0].created_at },
      { amount: 10, created_at: F.reps[1].created_at },
      { amount: 10, created_at: F.reps[2].created_at },
      { amount: 10, created_at: F.reps[3].created_at },
    ];
    await open();
    await shoot("near");
  }

  if (want("high")) {
    reset();
    xp.rows = [...XP_ROWS, { amount: 8425, created_at: F.reps[0].created_at }];
    await open();
    await shoot("high");
  }

  if (want("spoken")) {
    reset();
    F.testerMode.today = true;
    xp.rows = [...XP_ROWS, { amount: 10, created_at: F.TODAY_REP.created_at }];
    await open();
    await shoot("spoken");
  }

  if (want("photo")) {
    reset();
    avatar.has = true;
    await open();
    await shoot("photo");
    const pfp = page.locator('main [data-look="avatar"]').first();
    if ((await pfp.count()) > 0) {
      await pfp.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await sleep(700);
      await shoot("photo", "sheet");
      await page.keyboard.press("Escape");
      await sleep(500);
    }
  }

  if (want("none")) {
    reset();
    F.profile.display_name = null;
    await open();
    await shoot("none");
  }

  if (want("premium")) {
    reset();
    F.resetPlan("code");
    await open();
    const slot = page.locator('main [data-look="plan-slot"]').first();
    await slot.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.55));
    await shoot("premium");
    const explore = page.locator('main [data-look="premium-explore"]').first();
    if ((await explore.count()) > 0) {
      await explore.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await sleep(800);
      await shoot("premium", "sheet");
      await page.keyboard.press("Escape");
      await sleep(500);
    }
  }

  reset();
  await context.close();
}

await browser.close();
