/**
 * The shift's camera (DECISIONS #252-#260).
 *
 * The screens THE SHIFT introduces, shot at the same 390px and the same
 * two themes as `scripts/look.mjs`, into `docs/look/shift/` where
 * `scripts/gallery-shift.mjs` composes them:
 *
 *   today-shift-before   what the first card was
 *   home-cards           the three it could become, in one shell
 *   traits               the five rings underneath it
 *   lesson-1..6          the lesson those rings choose
 *
 * These live apart from look.mjs because they are a set that gets
 * re-shot together every time the norms change, and because two of them
 * are workbench pages rather than screens.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-shift.mjs
 *   node scripts/look-shift.mjs traits          # a subset
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute as supabase, analyzeBody as analyze, json, session } from "./look-fixtures.mjs";

const ONLY = process.argv.slice(2);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/shift/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.some((o) => name.startsWith(o));

/** The lesson's six steps, in the order the screen walks them. */
const STEPS = ["1-name", "2-why", "3-how", "4-example", "5-practice", "6-after"];
/** Which trait the lesson shot walks. Pausing is the one with a worked example. */
const LESSON = process.env.LOOK_TRAIT ?? "pause";

const browser = await chromium.launch();

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme,
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(analyze)); });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(({ theme, session }) => {
    localStorage.setItem("ethos.welcomed", new Date().toISOString());
    localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
    localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
    localStorage.setItem("ethos.gates.streak", new Date().toISOString());
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
  }, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = 'nextjs-portal{display:none!important} body{position:relative} nav[aria-label="Sections"]{position:absolute!important}';
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });

  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", page.url(), m.text().slice(0, 200)); });

  const shot = async (name, opts = {}) => {
    if (!want(name)) return;
    await sleep(opts.settle ?? 1100);
    await page.screenshot({ path: `${OUT}${name}-${theme}.png`, fullPage: opts.fullPage ?? true });
    console.log(`shot  ${name}-${theme}`);
  };
  const go = async (path, waitFor) => {
    await page.goto(`${BASE}${path}`).catch(async () => { await sleep(500); await page.goto(`${BASE}${path}`); });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => console.log("WAIT-TIMEOUT", path, waitFor));
    // A screen is ready when its skeletons are gone, and the rings need
    // one beat beyond that: they start at zero and travel on the next
    // frame, so a shot taken on arrival photographs five empty troughs.
    await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
      .catch(() => console.log("SKELETONS-REMAIN", page.url()));
  };
  const step = async (fn) => { try { await fn(); } catch (e) { console.log("STEP-FAILED", theme, String(e.message ?? e).split("\n")[0]); } };

  await step(async () => { await go("/", "main .arrive"); await shot("today-shift-before"); });
  await step(async () => { await go("/workbench/home-cards", "main"); await shot("home-cards"); });
  await step(async () => { await go("/workbench/traits", "main .label-data"); await shot("traits"); });

  await step(async () => {
    await go(`/practice/${LESSON}`, "main");
    for (const [i, name] of STEPS.entries()) {
      await shot(`lesson-${name}`);
      if (i === STEPS.length - 1) break;
      // The last step is reached by coming back from a recording, not by
      // advancing, so the walk jumps there rather than pressing through.
      if (STEPS[i + 1] === "6-after") { await go(`/practice/${LESSON}?done=1`, "main"); continue; }
      const next = page.locator("main button, main a").filter({ hasNot: page.locator("[hidden]") }).last();
      await next.click({ force: true }).catch(() => console.log("STEP-CLICK-FAILED", name));
      // The pointer stays where it clicked, and the next screen puts its
      // own button under it: without this every shot after the first
      // photographs a hovered control and the walk looks like it uses
      // two different terracottas.
      await page.mouse.move(2, 2);
      await sleep(500);
    }
  });

  await context.close();
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
