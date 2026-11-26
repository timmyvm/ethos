/**
 * The line under Record once today's scored recordings are used (the
 * reel's honest wins, build 5; lib/scored-left.ts, SCORED_USED).
 *
 * Scenes, each at every size and theme:
 *   capped   a free account's fourth take today (its three scored ones
 *            stored earlier), its glance, then Retake: the idle recorder
 *            the take left says the line, kept from the take's own reply.
 *   idle     the recorder opened on a phone that already knows (the copy
 *            this account kept today, left 0).
 *   ready    the same phone on the ready recorder (`ready=1`, the day's
 *            first take): never the line.
 *   premium  the same copy on a Premium account: never the line.
 *   stale    a copy from yesterday, and one from another account: never.
 *   game-qa, game-rush, game-interview
 *            a game's idle recorder on the same phone, as an iPhone opens
 *            it (no Voice/Video switch): the level's row and the best's
 *            plaque stand over Record, so its stack is the tallest.
 *   game-new Q&A with no round played yet (no plaque): the psych review's
 *            case, where the line's second sentence ran 2px under the
 *            first screen at 320x568 and the page scrolled 22px.
 *
 * On `after` it asserts the line where it belongs and nowhere else, grey
 * (stone-600 in light), in place of the milestone line, no Premium door
 * under Record, Record and both of the line's sentences on the first
 * screen at every size, 320x568 included.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 4132
 *   LOOK_BASE=http://localhost:4132 LOOK_OUT=/tmp/shots node scripts/look-scored-used.mjs after
 *
 * Sizes: LOOK_SIZES, default 390x844-light,390x844-dark,375x667-light,
 * 375x667-dark,320x568-light,320x568-dark. Scenes: LOOK_SCENES.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/home/user/ethos/package.json");
const { chromium } = require("playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const BASE = process.env.LOOK_BASE ?? "http://localhost:4132";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/scored-used/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light,375x667-dark,320x568-light,320x568-dark")
  .split(",")
  .map((s) => {
    const [wh, theme] = s.split("-");
    const [w, h] = wh.split("x").map(Number);
    return { w, h, theme, name: s };
  });
const SCENES = (process.env.LOOK_SCENES ?? "capped,idle,ready,premium,stale,game-qa,game-rush,game-interview,game-new").split(",");
/* A game's idle recorder, opened as an iPhone opens it. */
const GAME_URL = { "game-qa": "/rep?game=qa", "game-rush": "/rep?game=rush", "game-interview": "/rep?game=interview", "game-new": "/rep?game=qa" };
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const LINE = "You've used today's 3 scored recordings. Ethos score back tomorrow.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.log(`FAIL  ${m}`);
};
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const UID = F.session.user.id;

/* The fourth take's reply: measured, no Ethos score, the cap said so (#514). */
const CAPPED = { ...F.analyzeBody, coach: null, ethosIndex: null, judged: { ran: false, unlimited: false, remaining: 0, capped: true, counted: false } };
/* Today holds the three scored takes before it. */
const at = (min) => new Date(new Date(F.TODAY_REP.created_at).getTime() + min * 60000).toISOString();
F.extraReps.push(
  { ...F.TODAY_REP, id: "used-2", client_id: "used-2", created_at: at(40), ethos_index: 671 },
  { ...F.TODAY_REP, id: "used-3", client_id: "used-3", created_at: at(95), ethos_index: 668 }
);

/* A take needs a microphone: the fake one, as scripts/look-glance.mjs records with. */
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });

/** What the slot under Record holds, and the screen around it. */
async function measure(page) {
  return page.evaluate(() => {
    const used = document.querySelector("main [data-scored-used]");
    const record = document.querySelector('main button[data-record="start"]');
    const r = record?.getBoundingClientRect();
    const under = record ? [...document.querySelectorAll("main p")].filter((p) => p.getBoundingClientRect().top > (r?.bottom ?? 0) - 1) : [];
    return {
      used: used ? used.textContent?.trim() : null,
      colour: used ? getComputedStyle(used).color : null,
      usedBox: used ? (() => { const b = used.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), lines: Math.round(b.height / parseFloat(getComputedStyle(used).lineHeight)) }; })() : null,
      under: under.map((p) => p.textContent?.trim()).filter(Boolean),
      premiumUnder: under.some((p) => /Premium/.test(p.textContent ?? "")) || !!document.querySelector("main [data-premium-door]"),
      recordBottom: r ? Math.round(r.bottom) : null,
      scrollH: document.scrollingElement.scrollHeight,
      innerH: innerHeight,
    };
  });
}

for (const size of SIZES) {
  for (const scene of SCENES) {
    F.resetPlan(scene === "premium" ? "code" : "free");
    F.testerMode.today = true;
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      permissions: ["microphone"],
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
      colorScheme: size.theme,
      serviceWorkers: "block",
      ...(GAME_URL[scene] ? { userAgent: IPHONE_UA } : {}),
    });
    await context.route("http://supabase.local/**", F.supabaseRoute);
    /* No round played yet: no best, so no plaque. */
    if (scene === "game-new") {
      await context.route("http://supabase.local/rest/v1/reps**", (route) =>
        (new URL(route.request().url()).searchParams.get("lesson_id") ?? "").startsWith("like.game:") ? route.fulfill(F.json([])) : route.fallback()
      );
    }
    await context.route("**/api/analyze", async (route) => {
      await sleep(900);
      await route.fulfill(F.json(CAPPED));
    });
    await context.route("**/api/billing/*", F.billingApiRoute);
    await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
    await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
    await context.addInitScript(() => {
      const d = new Date();
      localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    /* What this phone already knows, per scene. */
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const copy =
      scene === "capped"
        ? null
        : scene === "stale"
          ? [{ uid: UID, day: yesterday, left: 0 }, { uid: "someone-else", day: today, left: 0 }]
          : [{ uid: UID, day: today, left: 0 }];
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
    const tag = `${scene} ${size.name}`;
    const shot = async (name) => {
      await page.screenshot({ path: `${OUT}${TAG}-${scene}-${name}-${size.name}.png` });
    };
    try {
      for (const [i, c] of (copy ?? [null]).entries()) {
        if (c) {
          await context.addInitScript((v) => localStorage.setItem("ethos.scored.left", JSON.stringify(v)), c);
        }
        const url = GAME_URL[scene] ? `${BASE}${GAME_URL[scene]}` : scene === "ready" ? `${BASE}/rep?lesson=f1&ready=1` : `${BASE}/rep?lesson=f1`;
        await page.goto(url);
        await page.waitForSelector('main button[data-record="start"]', { timeout: 30000 });
        await sleep(2200);
        if (scene === "capped") {
          /* Before: the idle recorder the fourth take starts from. */
          await shot("before-take");
          await page.click('main button[data-record="start"]', { force: true });
          await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
          await sleep(2500);
          await page.click('button[aria-label="Stop and score this recording"]', { force: true });
          await page.waitForSelector("main [data-step-action]", { state: "visible", timeout: 30000 });
          await sleep(2500);
          await shot("glance");
          const kept = await page.evaluate(() => localStorage.getItem("ethos.scored.left"));
          console.log(`${tag}: kept ${kept}`);
          if (TAG !== "before" && !kept) fail(`${tag}: the capped reply kept nothing`);
          await page.getByRole("button", { name: "Retake", exact: true }).click();
          await page.waitForSelector('main button[data-record="start"]', { timeout: 20000 });
          await sleep(1500);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        const name = copy && copy.length > 1 ? `idle-${i}` : "idle";
        await shot(name);
        const m = await measure(page);
        console.log(`${tag} ${name}: under Record ${JSON.stringify(m.under)}; line ${m.used ? `"${m.used}" ${m.colour} ${JSON.stringify(m.usedBox)}` : "none"}; Record bottom ${m.recordBottom}/${m.innerH}; scroll ${m.scrollH}/${m.innerH}`);
        if (TAG === "before") continue;
        const should = scene === "capped" || scene === "idle" || !!GAME_URL[scene];
        if (should && m.used !== LINE) fail(`${tag}: the line reads ${JSON.stringify(m.used)}`);
        if (!should && m.used !== null) fail(`${tag}: the line shows where it must not`);
        if (m.premiumUnder) fail(`${tag}: a Premium door under Record`);
        if (should && m.under.length !== 1 + (m.under.some((t) => /^Mic is only on/.test(t ?? "")) ? 1 : 0)) fail(`${tag}: under Record holds ${JSON.stringify(m.under)}`);
        if (should && size.theme === "light" && m.colour !== "rgb(87, 83, 78)" && !/stone/.test(m.colour ?? "")) console.log(`${tag}: the line's colour is ${m.colour}`);
        if (m.recordBottom !== null && m.recordBottom > m.innerH) fail(`${tag}: Record is under the first screen (${m.recordBottom} > ${m.innerH})`);
        if (should && m.usedBox && m.usedBox.lines > 2) fail(`${tag}: the line takes ${m.usedBox.lines} lines`);
        /* Both of its sentences on the first screen: the second is the
           one that says when the score comes back (the review of build 5:
           at 320x568 it stood under the fold). */
        if (should && m.usedBox && m.usedBox.bottom > m.innerH) fail(`${tag}: the line runs under the first screen (${m.usedBox.bottom} > ${m.innerH})`);
        /* A game's stack is the tallest idle stack: at 320x568 it may not
           scroll either (the psych review: Q&A scrolled 22px). */
        if (GAME_URL[scene] && m.scrollH > m.innerH + 1) fail(`${tag}: the idle screen scrolls (${m.scrollH} > ${m.innerH})`);
      }
    } catch (e) {
      fail(`${tag}: ${String(e.message ?? e).split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall clear");
process.exit(failures.length ? 1 : 0);
