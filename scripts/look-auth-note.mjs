/**
 * The sign-in's note (#497, components/AuthNote.tsx) where it lands:
 * over the room's dark sky, over Today and over the introduction's
 * first question, light and dark, and the room again under Increase
 * Contrast (#499). Each screen is shot whole and as a crop of the
 * capsule, so its edge can be seen against what is behind it (Increase
 * Contrast only as the crop: the rest of the screen is #448's).
 *
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     LOOK_BASE=http://localhost:3123 node scripts/look-auth-note.mjs after
 *   LOOK_OUT=docs/look/auth-note/before node scripts/look-auth-note.mjs before
 *
 * Writes docs/look/auth-note/<screen>-<theme>-<tag>.png and
 * <screen>-<theme>[-more]-<tag>-crop.png. The note's own timers (4s, then
 * its fade) are stretched so a slow screen is never shot after it left. LOOK_CSS adds a style to every
 * page, to try a value before it goes into app/globals.css.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { supabaseRoute, json, session } from "./look-fixtures.mjs";

const [, , TAG = "after"] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/auth-note/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXTRA_CSS = process.env.LOOK_CSS ?? "";

const FINISHED = { answers: { name: "Tim", ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true };

/* What each screen needs on this device before it opens. */
const SCREENS = [
  { name: "room", path: "/welcome", onboarding: null, ready: "main.room [data-room-hold]" },
  { name: "today", path: "/", onboarding: FINISHED, ready: "main" },
  { name: "intro", path: "/welcome?step=name", onboarding: { answers: { pains: [] }, step: 1, done: false, synced: false, walk: 2 }, ready: "main" },
];

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function shoot(screen, theme, contrast) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, contrast,
    reducedMotion: "reduce", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  /* The note stays up for the camera: only its two timers are stretched. */
  await context.addInitScript(() => {
    const real = window.setTimeout;
    window.setTimeout = (fn, ms, ...rest) => real(fn, ms === 4000 || ms === 4200 ? 60000 : ms, ...rest);
  });
  await context.addInitScript(({ theme, session, onboarding }) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      /* The note a sign-in leaves for the page it lands on. */
      sessionStorage.setItem("ethos.auth-note", "signedIn");
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
      localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
      localStorage.setItem("ethos.gates.streak", new Date().toISOString());
      if (onboarding) localStorage.setItem("ethos.onboarding", JSON.stringify(onboarding));
      localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
    } catch {}
  }, { theme, session, onboarding: screen.onboarding });
  if (EXTRA_CSS) {
    await context.addInitScript((extra) => {
      const css = document.createElement("style");
      css.textContent = extra;
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    }, EXTRA_CSS);
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", screen.name, e.message.slice(0, 160)));
  await page.goto(BASE + screen.path, { waitUntil: "networkidle" });
  await page.waitForSelector(screen.ready, { timeout: 10000 }).catch(() => console.log("NOT READY", screen.name));
  const note = page.locator(".toast[data-note]");
  const there = await note.waitFor({ timeout: 4000 }).then(() => true, () => false);
  await sleep(500);
  const name = `${screen.name}-${theme}${contrast === "more" ? "-more" : ""}-${TAG}`;
  if (contrast !== "more") await page.screenshot({ path: `${OUT}${name}.png` });
  if (there) {
    const box = await note.boundingBox();
    if (box) {
      const pad = 18;
      await page.screenshot({
        path: `${OUT}${name}-crop.png`,
        clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(390, box.width + pad * 2), height: box.height + pad * 2 },
      });
    }
  }
  console.log(`${there ? "shot" : "NO NOTE"}  ${name}`);
  await context.close();
}

for (const theme of ["light", "dark"]) {
  for (const screen of SCREENS) await shoot(screen, theme, "no-preference");
  await shoot(SCREENS[0], theme, "more");
}
await browser.close();
