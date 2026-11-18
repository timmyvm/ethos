/**
 * One picture, photographed (#488): every place a picture of the person
 * shows, in each state the picture can be in, so a before and an after
 * line up surface by surface.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3911
 *   LOOK_BASE=http://localhost:3911 node scripts/look-picture.mjs after
 *   LOOK_BASE=... node scripts/look-picture.mjs after photo you settings   (scenes and screens)
 *
 * Scenes (the account's stored choice, `profiles.equipped_pose`, and
 * whether the avatars bucket holds a photo; the speaking pose is bought
 * in every scene, scripts/look-fixtures.mjs):
 *   photo    the photo chosen, and a photo kept
 *   pose     the speaking pose chosen, no photo
 *   neither  nothing chosen, no photo: the fallback
 *   hello    Demos's hello chosen, no photo (the fallback that was not taken)
 *   both     the speaking pose chosen over a kept photo
 *
 * Screens: today (the header's coin), you (the card, then its sheet on
 * an `after`), settings (the index's profile row), profile (Settings'
 * Profile, its Picture list), shop (the pose cards).
 *
 * Shots: LOOK_OUT (default docs/look/picture/) as
 * <tag>-<scene>-<screen>-<w>x<h>-<theme>.png, the viewport, and the same
 * name ending -clip.png: the picture's own surface, cut out, for the
 * side-by-side sheets. LOOK_SIZES defaults to 390x844 and 320x568 in
 * light and dark.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require("playwright");
const F = await import("./look-fixtures.mjs");

const [, , TAG = "after", ...ONLY] = process.argv;
const SCENES = ["photo", "pose", "neither", "hello", "both"];
const SCREENS = ["today", "you", "settings", "profile", "shop"];
const scenes = ONLY.filter((o) => SCENES.includes(o));
const screens = ONLY.filter((o) => SCREENS.includes(o));
const BASE = process.env.LOOK_BASE ?? "http://localhost:3911";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/picture/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,320x568-light,320x568-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
/** LOOK_STRIP=1: on You's sheet, pick a row and shoot 0, 80, 160, 240 and 400ms. */
const STRIP = process.env.LOOK_STRIP === "1";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * A photo someone might pick: a dusk over hills, drawn here so the
 * camera needs no file and so it can never be mistaken for Demos (the
 * app's own icon, his head, was the photo in #485's camera).
 */
const PHOTO = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b4a7a"/><stop offset="0.55" stop-color="#e98a5d"/><stop offset="1" stop-color="#f6c58a"/>
    </linearGradient></defs>
    <rect width="256" height="256" fill="url(#s)"/>
    <circle cx="170" cy="150" r="34" fill="#ffe2a8"/>
    <path d="M0 190 Q60 150 120 180 T256 170 V256 H0Z" fill="#3a2f45"/>
    <path d="M0 220 Q80 190 160 215 T256 205 V256 H0Z" fill="#231c2e"/>
  </svg>`)
)
  .jpeg({ quality: 88 })
  .toBuffer();

/** What each scene stores and keeps. */
const SCENE = {
  photo: { choice: "photo", photo: true },
  pose: { choice: "pose_speaking", photo: false },
  neither: { choice: null, photo: false },
  hello: { choice: "hello", photo: false },
  both: { choice: "pose_speaking", photo: true },
};

/** Each screen: where it is, what says it has drawn, and the part cut out for the sheets. */
const SCREEN = {
  today: { path: "/", ready: ".home-avatar", clip: (w) => ({ x: 0, y: 0, width: w, height: 132 }) },
  you: { path: "/you", ready: '[data-look="you-card"]', part: '[data-look="you-card"]' },
  settings: { path: "/settings", ready: '[data-look="settings-profile"]', part: '[data-look="settings-profile"]' },
  profile: { path: "/settings/profile", ready: "main h1", part: '[data-look="picture-section"], section:has(> h2:text-is("Picture"))' },
  shop: { path: "/shop", ready: "main .card", part: 'main .card:has-text("Demos, talking")' },
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
let problems = 0;

for (const size of SIZES) {
  for (const sceneName of SCENES) {
    if (scenes.length && !scenes.includes(sceneName)) continue;
    const scene = SCENE[sceneName];
    const avatar = { has: scene.photo };
    F.resetPlan("free");
    F.profile.equipped_pose = scene.choice;
    F.profile.display_name = "Timothy";
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: size.theme, serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", F.supabaseRoute);
    // Registered after the mock, so these answer first (Playwright runs the newest match).
    await context.route("http://supabase.local/rest/v1/profiles**", (route) => {
      const method = route.request().method();
      if (method === "GET") return route.fulfill(F.json(F.profile));
      const body = route.request().postDataJSON?.() ?? {};
      if (body && "equipped_pose" in body) F.profile.equipped_pose = body.equipped_pose;
      return route.fulfill(F.json([F.profile], 201));
    });
    await context.route("http://supabase.local/storage/v1/**", (route) =>
      route.fulfill({ status: 200, headers: { ...F.cors, "Content-Type": "image/jpeg" }, body: PHOTO })
    );
    await context.route("**/api/avatar", (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return avatar.has
          ? route.fulfill(F.json({ url: "http://supabase.local/storage/v1/object/sign/avatars/u1/1.jpg?token=look" }))
          : route.fulfill(F.json({ none: true }, 404));
      }
      if (method === "DELETE") {
        avatar.has = false;
        return route.fulfill(F.json({ ok: true }));
      }
      avatar.has = true;
      return route.fulfill(F.json({ url: "http://supabase.local/storage/v1/object/sign/avatars/u1/2.jpg?token=look" }));
    });
    await context.route("**/api/billing/*", F.billingApiRoute);
    await context.route("**/api/tester/collect", F.collectRoute);
    await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: scene.choice });
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      problems++;
      console.log("PAGEERROR", page.url(), e.message.slice(0, 160));
    });

    for (const screenName of SCREENS) {
      if (screens.length && !screens.includes(screenName)) continue;
      const s = SCREEN[screenName];
      const file = (beat = "") => `${OUT}${TAG}-${sceneName}-${screenName}${beat}-${size.name}`;
      try {
        await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
        await page.waitForSelector(s.ready, { timeout: 20000 });
        await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 8000 }).catch(() => {});
        await sleep(1200);
        await page.screenshot({ path: `${file()}.png` });
        if (s.clip) {
          await page.screenshot({ path: `${file()}-clip.png`, clip: s.clip(size.w) });
        } else {
          const part = page.locator(s.part).first();
          if ((await part.count()) > 0) {
            await part.scrollIntoViewIfNeeded();
            await sleep(300);
            await part.screenshot({ path: `${file()}-clip.png` });
          } else {
            problems++;
            console.log("NO PART", screenName, sceneName, size.name);
          }
        }
        const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
        if (sideways) {
          problems++;
          console.log("SCROLLS SIDEWAYS", screenName, sceneName, size.name);
        }
        console.log(`shot  ${sceneName} ${screenName} ${size.name}`);
        // You's coin opens the picture's choices: shoot the sheet too.
        if (screenName === "you" && TAG !== "before") {
          await page.evaluate(() => window.scrollTo(0, 0));
          const coin = page.locator('main [data-look="avatar"]').first();
          if ((await coin.count()) > 0) {
            await coin.click();
            const sheet = await page.waitForSelector('[role="dialog"]', { timeout: 4000 }).catch(() => null);
            await sleep(800);
            if (sheet) {
              await page.screenshot({ path: `${file("-sheet")}.png` });
              console.log(`shot  ${sceneName} you-sheet ${size.name}`);
              if (STRIP) {
                /* The motion strip (DESIGN's look loop): the frame before
                   the tap, then 80, 160, 240 and 400ms after a row is
                   picked, the sheet leaving and the coin under it. */
                const row = page.locator('[role="dialog"] [role="radio"][aria-checked="false"]').first();
                await page.screenshot({ path: `${file("-strip-0")}.png` });
                const t0 = Date.now();
                await row.click();
                for (const ms of [80, 160, 240, 400]) {
                  await sleep(Math.max(0, ms - (Date.now() - t0)));
                  await page.screenshot({ path: `${file(`-strip-${ms}`)}.png` });
                }
                console.log(`strip ${sceneName} you ${size.name}`);
                await sleep(600);
              } else {
                await page.keyboard.press("Escape");
                await sleep(600);
              }
            } else {
              console.log("NO SHEET", sceneName, size.name);
            }
          }
        }
      } catch (e) {
        problems++;
        console.log("FAIL", sceneName, screenName, size.name, e.message.slice(0, 200));
      }
    }
    await context.close();
  }
}
await browser.close();
F.profile.equipped_pose = F.POSE_PREF;
if (problems) {
  console.log(`${problems} problem(s)`);
  process.exitCode = 1;
}
