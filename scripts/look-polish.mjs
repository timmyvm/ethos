/**
 * The polish pass's camera (#474): the ten front-end rules from Timothy's
 * reel, photographed where they touch Ethos. A production build with the
 * Supabase host mocked, the shared fixtures (scripts/look-fixtures.mjs).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
 *     NEXT_DIST_DIR=.next-build npx next build
 *   NEXT_DIST_DIR=.next-build npx next start -p 3804
 *   LOOK_BASE=http://localhost:3804 node scripts/look-polish.mjs before
 *   LOOK_BASE=http://localhost:3804 node scripts/look-polish.mjs after settings lessons
 *
 * Scenes: stems (prints the faces' stems and each matched icon's line
 * against its words, no shot), audit (prints nested corners off the
 * parent's radius less the inset, and in dark each lifted box's step
 * over what it stands on; no shot), settings (the theme switch in its group), lessons (Up next's
 * Carry on and its arrow), lesson (the back chevron and its word),
 * today, log, hostile, sheet-save (a word's sheet, Save then Saved,
 * with a frame strip of the swap), scrubber (Hear it back on an upload's
 * result, Play then Pause, with a frame strip).
 * Sizes: LOOK_SIZES, default "390x844-light,390x844-dark,375x667-light".
 * Shots: docs/look/polish/<scene>-<size>-<tag>.png, a 2x crop of the
 * detail as <scene>-zoom-<size>-<tag>.png, and the strips as
 * <scene>-strip-<size>-<tag>.jpg: frame 0 is the moment before the tap,
 * then 20, 40, 80 and 200ms of the swap's own clock, shot with the page
 * running at a fifth of its speed. The full screens are kept in the
 * repository as one before-and-after sheet per size
 * (screens-<size>.jpg, scripts/sheet.mjs); the PNGs stay out of it.
 */
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "/opt/node-tools/node_modules/playwright");
const F = await import("./look-fixtures.mjs");

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3804";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/polish/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
/** A mono 16-bit WAV of `seconds` of silence, for the upload's picker (as scripts/look.mjs). */
const silentWav = (seconds, rate = 8000) => {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
};

/** The words route, answered as v2 would, after a beat. */
async function wordsRoute(route) {
  await sleep(300);
  let body = null;
  try { body = route.request().postDataJSON(); } catch {}
  const word = String(body?.word ?? "word");
  return route.fulfill(F.json({ v: 2, verdict: "swap", replaces: word, alternatives: ["moment", "point"], note: "", source: "model" }));
}

const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--autoplay-policy=no-user-gesture-required"] });

async function shootSize(size) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: size.theme, serviceWorkers: "block",
  });
  F.resetPlan?.();
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(F.json({ ok: true })));
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/words", wordsRoute);
  await context.route("**/api/analyze", async (route) => { await sleep(400); await route.fulfill(F.json(F.analyzeBody)); });
  await context.addInitScript(({ theme, session, pose }) => {
    localStorage.setItem("ethos.welcomed", new Date().toISOString());
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose, skipIntros: true, haptics: false }));
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
    localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
    localStorage.setItem("ethos.gates.streak", new Date().toISOString());
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
    try { localStorage.removeItem("ethos.words.v2"); } catch {}
    // The fixture's audio never loads here: a take "plays" as the element
    // would say it does, so the key's own state change is what is shot.
    HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event("play")); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")); };
  }, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));

  const settled = () =>
    page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => console.log("SKELETONS-REMAIN", page.url()));
  const go = async (path, waitFor = "main :is(h1, h2, .section-head, .eyebrow)") => {
    await page.goto(`${BASE}${path}`).catch(async () => { await sleep(500); await page.goto(`${BASE}${path}`); });
    await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT", path, waitFor));
    await settled();
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  };
  const file = (scene, kind = "") => `${OUT}${scene}${kind ? "-" + kind : ""}-${size.name}-${TAG}.png`;
  const shot = async (scene, settle = 900) => {
    await sleep(settle);
    await page.screenshot({ path: file(scene) });
    console.log("shot ", scene, size.name, TAG);
  };
  /** A crop around `selector`, padded, at the context's 2x. */
  const zoom = async (scene, selector, pad = 12) => {
    const el = page.locator(selector).first();
    if (!(await el.count())) return console.log("NO-ZOOM", scene, selector);
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(300);
    const b = await el.boundingBox();
    if (!b) return console.log("NO-BOX", scene, selector);
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
    await page.screenshot({ path: file(scene, "zoom"), clip: { x, y, width: Math.min(size.w - x, b.width + pad * 2), height: b.height + pad * 2 } });
    console.log("zoom ", scene, size.name, TAG);
  };
  /** Frames 0, 80, 160, 240 and 400ms around a tap on `selector`, cropped to `area`, laid side by side. */
  const strip = async (scene, selector, area, pad = 16) => {
    const el = page.locator(selector).first();
    if (!(await el.count())) return console.log("NO-STRIP", scene, selector);
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(400);
    const box = await page.locator(area).first().boundingBox();
    if (!box) return console.log("NO-STRIP-AREA", scene, area);
    const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(size.w, box.width + pad * 2), height: box.height + pad * 2 };
    const frames = [];
    const tmp = `${OUT}.strip-${scene}-${size.name}`;
    /* A swap is 200ms on a front-loaded curve and a screenshot takes 40
       to 80ms to come back, so at full speed the 80ms frame is already
       the landing. The page's clock runs at a fifth for the strip, and
       each frame is labelled with the animation's own time. */
    const cdp = await context.newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.2 });
    await page.screenshot({ path: `${tmp}-0.png`, clip });
    frames.push(`0ms=${tmp}-0.png`);
    const t0 = Date.now();
    await el.click({ force: true });
    for (const at of [20, 40, 80, 200]) {
      const wait = at * 5 - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
      await page.screenshot({ path: `${tmp}-${at}.png`, clip });
      frames.push(`${at}ms, 1/5 speed=${tmp}-${at}.png`);
    }
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
    await cdp.detach();
    execFileSync(
      "node",
      [new URL("./sheet.mjs", import.meta.url).pathname, file(scene, "strip").replace(/\.png$/, ".jpg"), String(frames.length), String(Math.round(clip.width * 2)), String(Math.round(clip.height * 2)), ...frames],
      { env: { ...process.env, PLAYWRIGHT_MODULE: process.env.PLAYWRIGHT_MODULE ?? "/opt/node-tools/node_modules/playwright/index.mjs", ...(size.theme === "dark" ? { SHEET_GROUND: "dark" } : {}) } },
    );
    for (const f of frames) rmSync(f.split("=")[1], { force: true });
    console.log("strip", scene, size.name, TAG);
  };
  const step = async (name, fn) => {
    if (!want(name)) return;
    try { await fn(); } catch (e) { console.log("STEP-FAILED", name, size.name, String(e.message ?? e).split("\n")[0]); }
  };

  /*
   * Rule 5's numbers, printed once: the faces' stems per em (the ink
   * across the middle of an "l" drawn at 400px; lib/icon-polish.test.ts
   * holds the weights to them), then each icon the pass matched, its line
   * against the stem of the words beside it.
   */
  if (size === SIZES[0]) await step("stems", async () => {
    await go("/lessons");
    const stems = await page.evaluate(async () => {
      await document.fonts.ready;
      const out = {};
      const S = 400;
      const cv = document.createElement("canvas");
      cv.width = 600; cv.height = 600;
      const c = cv.getContext("2d", { willReadFrequently: true });
      for (const fam of ['Outfit, "Outfit Fallback"', 'Figtree, "Figtree Fallback"']) {
        for (const w of [400, 600, 700, 800]) {
          await document.fonts.load(`${w} ${S}px ${fam}`).catch(() => {});
          c.clearRect(0, 0, 600, 600);
          c.font = `${w} ${S}px ${fam}`;
          c.fillText("l", 100, 450);
          const row = c.getImageData(0, 450 - S * 0.3, 600, 1).data;
          let ink = 0;
          for (let i = 3; i < row.length; i += 4) ink += row[i] / 255;
          out[`${fam.split(",")[0]} ${w}`] = +(ink / S).toFixed(4);
        }
      }
      return out;
    });
    console.log("stems per em", JSON.stringify(stems));
    const pairs = [["/lessons", "main .tap-arrow-disc > svg", "main a:has(.tap-arrow-disc)"], ["/lessons/the-cold-open", ".screen-bar-back > svg", ".screen-bar-back"], ["/", "main .home-flag > svg, main .home-check > svg", "main .home-wide-line .eyebrow"]];
    for (const [path, icon, words] of pairs) {
      await go(path, "main");
      const r = await page.evaluate(({ icon, words, stems }) => {
        const svg = document.querySelector(icon);
        const w = document.querySelector(words);
        if (!svg || !w) return null;
        const line = parseFloat(getComputedStyle(svg).strokeWidth) * svg.getBoundingClientRect().width / 24;
        const cs = getComputedStyle(w);
        const stem = stems[`${cs.fontFamily.split(",")[0].replace(/"/g, "")} ${cs.fontWeight}`] * parseFloat(cs.fontSize);
        return { line: +line.toFixed(2), stem: +stem.toFixed(2), words: `${cs.fontFamily.split(",")[0]} ${cs.fontWeight} ${cs.fontSize}` };
      }, { icon, words, stems });
      console.log("stroke", icon, JSON.stringify(r));
    }
  });
  /*
   * Rules 1 and 8, counted on sixteen screens (no shot). Nested corners:
   * every painted rounded box (or picture) whose corner sits inside its
   * painted rounded parent's curve, printed where its radius is not the
   * parent's less the inset (a pill's radius is half its height). Dark
   * depth: every lifted box (a shadow with blur) and how much lighter its
   * own fill is than what it stands on; null is a gradient or glass fill.
   */
  await step("audit", async () => {
    for (const path of ["/", "/lessons", "/lessons/the-cold-open", "/history", "/you", "/shop", "/games", "/settings", "/rep/rep-22", "/practice/pause", "/lesson/filler", "/boss", "/hostile", "/upload", "/words", "/about"]) {
      await go(path, "main");
      const r = await page.evaluate(() => {
        const px = (v) => parseFloat(v) || 0;
        const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        const painted = (cs) => cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none" || px(cs.borderTopWidth) > 0 || cs.boxShadow !== "none";
        const name = (el) => (el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 3).join(".")).slice(0, 60);
        const radius = (el, cs, corner) => Math.min(px(cs[`border${corner}Radius`]), el.getBoundingClientRect().width / 2, el.getBoundingClientRect().height / 2);
        const corners = [];
        for (const el of document.querySelectorAll("main *, nav *")) {
          const cs = getComputedStyle(el);
          if (px(cs.borderTopLeftRadius) < 4 || !vis(el) || !(painted(cs) || /^(IMG|VIDEO)$/.test(el.tagName))) continue;
          let p = el.parentElement, pcs;
          while (p && p !== document.body) { pcs = getComputedStyle(p); if (px(pcs.borderTopLeftRadius) >= 4 && painted(pcs)) break; p = p.parentElement; }
          if (!p || p === document.body) continue;
          const a = p.getBoundingClientRect(), b = el.getBoundingClientRect();
          for (const [c, dx, dy] of [["TopLeft", b.left - a.left, b.top - a.top], ["TopRight", a.right - b.right, b.top - a.top], ["BottomLeft", b.left - a.left, a.bottom - b.bottom], ["BottomRight", a.right - b.right, a.bottom - b.bottom]]) {
            const R = radius(p, pcs, c), r = radius(el, cs, c);
            if (R < 4 || dx < -0.5 || dy < -0.5 || Math.max(dx, dy) >= R) continue;
            const ideal = Math.max(0, R - Math.min(dx, dy));
            if (Math.abs(r - ideal) > 2) corners.push(`${name(el)} in ${name(p)} ${c}: radius ${r.toFixed(1)}, parent ${R.toFixed(1)} less ${Math.min(dx, dy).toFixed(0)} is ${ideal.toFixed(1)}`);
          }
        }
        const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return v.length > 3 && v[3] < 0.5 ? null : v; };
        const lum = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        const lifted = [];
        for (const el of document.querySelectorAll("main *, nav *")) {
          const cs = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          if (cs.boxShadow === "none" || b.width < 60 || b.height < 30 || !/ [1-9]\d*px [-\d]/.test(cs.boxShadow)) continue;
          let p = el.parentElement, under = null;
          while (p && !under) { under = rgb(getComputedStyle(p).backgroundColor); p = p.parentElement; }
          under ??= rgb(getComputedStyle(document.body).backgroundColor);
          const own = rgb(cs.backgroundColor);
          lifted.push(`${name(el)} ${own && under ? `+${(lum(own) - lum(under)).toFixed(0)}` : "null"}`);
        }
        return { corners: [...new Set(corners)], lifted: [...new Set(lifted)] };
      });
      for (const c of r.corners) console.log("corner", size.theme, path, c);
      if (size.theme === "dark") for (const l of r.lifted) console.log("lifted", path, l);
    }
  });
  // Rule 1: the theme's segmented control, the first thing in its group.
  await step("settings", async () => {
    await go("/settings", "main .inset-group");
    await page.locator("main .inset-group .segmented").first().evaluate((e) => e.scrollIntoView({ block: "center" }));
    await shot("settings");
    await zoom("settings", "main .inset-group:has(.segmented)", 0);
  });
  // Rule 5: the tap's arrow beside its word.
  await step("lessons", async () => {
    await go("/lessons");
    await shot("lessons");
    await zoom("lessons", "main a:has(.tap-arrow-disc)", 10);
  });
  // Rule 5: the back chevron beside its word.
  await step("lesson", async () => {
    await go("/lessons/the-cold-open", "main h1");
    await shot("lesson");
    await zoom("lesson", ".screen-bar-back, main a[href='/lessons']", 10);
  });
  await step("today", async () => {
    await go("/", "main .arrive");
    await shot("today");
    await zoom("today", "main .home-flag", 40);
  });
  await step("log", async () => {
    await go("/history", "main .arrive");
    await shot("log");
  });
  await step("hostile", async () => {
    await go("/hostile", "main");
    await shot("hostile");
  });
  // Rule 7: a word's Save, Plus to Check.
  await step("sheet-save", async () => {
    await go("/rep/rep-22", "main :is([data-score], h1, .section-head)");
    const word = page.locator('main .tw[data-word-key="habits"]').first();
    await word.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await word.click();
    await page.locator(".word-sheet").waitFor({ timeout: 6000 });
    await page.locator('.word-sheet button:has-text("Save")').first().waitFor({ timeout: 6000 });
    await shot("sheet-save", 700);
    await strip("sheet-save", '.word-sheet button:has-text("Save")', '.word-sheet button:has-text("Save")', 12);
    await shot("sheet-saved", 500);
  });
  // Rule 7: Hear it back's key, Play to Pause, on an upload's result (a
  // stored fixture recording has no audio to play).
  await step("scrubber", async () => {
    await go("/upload", "main h1");
    await page.setInputFiles('main input[type="file"]', { name: "memo.wav", mimeType: "audio/wav", buffer: silentWav(4) });
    await page.waitForSelector("main [data-score]", { timeout: 15000 });
    await settled();
    const key = page.locator('main button[aria-label="Play"]').first();
    if (!(await key.count())) return console.log("NO-PLAY-KEY");
    await key.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await shot("scrubber", 600);
    await strip("scrubber", 'main button[aria-label="Play"]', 'main button[aria-label="Play"]', 24);
    await zoom("scrubber", 'main button[aria-label="Pause"]', 24);
  });
  await context.close();
}

for (const size of SIZES) await shootSize(size);
await browser.close();
