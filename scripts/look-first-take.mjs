/**
 * The camera for #491's second half: Practice's door to the Log's Games
 * side. Practice at 390x844 and 320x568 in both themes, the first screen
 * and the whole page, with the fixtures' games played (`gamesMode.on`)
 * so the tiles carry their ladders and bests; then the door tapped, and
 * where it lands (the Log, Games side).
 *
 * The first take's note under the delta and the round card's door are
 * shot by scripts/look-glance.mjs (variants `rules` and `game`) with
 * LOOK_OUT=docs/look/first-take.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3917
 *   LOOK_BASE=http://localhost:3917 node scripts/look-first-take.mjs before
 *   LOOK_BASE=http://localhost:3917 node scripts/look-first-take.mjs after
 *
 * Asserts, on `after`: the door is on Practice, at least 44px tall,
 * inside the page's width, and one tap lands on /history?view=games
 * with the Games side chosen.
 *
 * Then Upload's results (the #491 review): a file uploaded as the first
 * take under #476's pause rules, against the fixtures' newest stored take
 * scored before them (Pause 26 then, 73 now, +71 on the Index), shot as
 * `upload`. Asserts, on `after`: the note under the delta, once.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import {
  supabaseRoute as supabase,
  analyzeBody as analyze,
  reps,
  json,
  session,
  billingApiRoute,
  resetPlan,
  gamesMode,
  POSE_PREF,
} from "./look-fixtures.mjs";

const [, , TAG = "before"] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3917";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/first-take/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = (process.env.LOOK_SIZES ?? "390x844,320x568").split(",").map((s) => s.split("x").map(Number));
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.log(`FAIL  ${m}`);
};

gamesMode.on = true;

/* Upload's take (#491 review): the newest stored take as scored before
   #476 (its Pause 26, its Index 71 under this take's), the answer under
   #476 with Pause 73. Swapped in only while Upload is shot. */
const LAST = reps[reps.length - 1];
const KEPT = JSON.parse(JSON.stringify(LAST));
const pts = (s) => Math.round((Math.max(0, Math.min(100, s)) / 100) * 150);
const OLD_INDEX = KEPT.ethos_index - pts(KEPT.dimensions.tier1.pause) + pts(26);
const oldRules = (on) => {
  Object.assign(LAST, JSON.parse(JSON.stringify(KEPT)));
  if (on) {
    LAST.ethos_index = OLD_INDEX;
    LAST.dimensions = { ...LAST.dimensions, tier1: { ...LAST.dimensions.tier1, pause: 26 } };
  }
};
const uploadAnswer = { ...analyze, pauseRules: 476, tier1: { ...analyze.tier1, pause: 73 }, previousIndex: OLD_INDEX, ethosIndex: OLD_INDEX + 71 };
/* A second of silence as a WAV: Upload reads its length, then sends it. */
const wav = (() => {
  const rate = 16000;
  const n = rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
})();
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

for (const theme of ["light", "dark"]) {
  for (const [width, height] of SIZES) {
    resetPlan();
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
      colorScheme: theme,
      serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", supabase);
    await context.route("**/api/analyze", (route) => route.fulfill(json(page.url().includes("/upload") ? uploadAnswer : analyze)));
    await context.route("**/api/billing/*", billingApiRoute);
    await context.addInitScript(({ theme, session, pose }) => {
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose, skipIntros: true, haptics: false }));
      localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
      localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
      localStorage.setItem("ethos.gates.streak", new Date().toISOString());
      localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
      localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
    }, { theme, session, pose: POSE_PREF });
    await context.addInitScript(() => {
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
    const tag = `${width}x${height}`;
    const snap = async (name, full = false) => {
      await page.screenshot({ path: `${OUT}${name}-${tag}-${TAG}-${theme}.png`, fullPage: full });
      console.log(`shot  ${name}-${tag}-${TAG}-${theme}`);
    };
    try {
      await page.goto(`${BASE}/games`);
      await page.waitForSelector("main .section-head", { timeout: 15000 });
      await page
        .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
        .catch(() => console.log("SKELETONS-REMAIN"));
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
      await sleep(1200);
      await snap("practice");
      await snap("practice-full", true);
      const door = page.locator("main [data-games-log-door]");
      if ((await door.count()) === 0) {
        if (TAG !== "before") fail(`${tag} ${theme}: no door to the Log's Games side on Practice`);
      } else {
        await door.scrollIntoViewIfNeeded();
        await sleep(300);
        const box = await door.boundingBox();
        if (!box || box.height < 44) fail(`${tag} ${theme}: the door is ${box?.height ?? 0}px tall`);
        if (box && box.x + box.width > width + 0.5) fail(`${tag} ${theme}: the door runs off the page`);
        await snap("practice-door");
        await door.click();
        await page.waitForURL(/\/history\?view=games/, { timeout: 10000 }).catch(() => fail(`${tag} ${theme}: the door did not land on the Games side`));
        await page.waitForSelector("#games-boss", { timeout: 10000 }).catch(() => fail(`${tag} ${theme}: the Games side did not draw`));
        await sleep(900);
        await snap("log-games");
      }
    } catch (e) {
      fail(`${tag} ${theme}: ${String(e.message ?? e).split("\n")[0]}`);
    }
    /* Upload's results: the first take under #476, its note under the delta. */
    try {
      oldRules(true);
      await page.goto(`${BASE}/upload`);
      await page.waitForSelector('main input[type="file"]', { state: "attached", timeout: 15000 });
      await sleep(1500);
      await page.setInputFiles('main input[type="file"]', { name: "take.wav", mimeType: "audio/wav", buffer: wav });
      await page.waitForSelector("main [data-score]", { timeout: 20000 });
      await sleep(1600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await snap("upload");
      const text = await page.evaluate(() => [...document.querySelectorAll("main [data-rules-note]")].map((e) => e.textContent));
      if (TAG !== "before") {
        if (text.length !== 1) fail(`${tag} ${theme}: ${text.length} notes on Upload's results`);
        else if (!/26 to 73/.test(text[0] ?? "")) fail(`${tag} ${theme}: Upload's note reads "${text[0]}"`);
        const told = await page.evaluate(() => localStorage.getItem("ethos.pauseRules.told"));
        if (told !== "476") fail(`${tag} ${theme}: Upload's note did not mark this phone told`);
      }
    } catch (e) {
      fail(`${tag} ${theme} upload: ${String(e.message ?? e).split("\n")[0]}`);
    } finally {
      oldRules(false);
    }
    await context.close();
  }
}
await browser.close();
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall clear");
process.exit(failures.length ? 1 : 0);
