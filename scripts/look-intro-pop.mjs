/**
 * The look loop's camera for the introduction end to end (#501): the
 * room (door, his first line, your turn, Demos's ending) with a fake mic
 * speaking, then every screen after it to the account ask, each shot
 * unanswered and answered, at 390x844 light and dark and 320x568, and a
 * frame strip of a line arriving and of a reply popping in.
 *
 *   LOOK_BASE=http://localhost:3963 node scripts/look-intro-pop.mjs before
 *   LOOK_BASE=http://localhost:3963 node scripts/look-intro-pop.mjs after
 *   ONLY=390x844-light node scripts/look-intro-pop.mjs after      one set
 *   SKIP_ROOM=1 ...                                               questions only
 *
 * Writes docs/look/intro-pop/<tag>/<size>-<theme>-<nn>-<screen>.png and,
 * for 390 light, frames/ and the strips beside them.
 *
 * It walks by what is on the screen, not by a list of questions, so the
 * same camera shoots a walk with more steps or fewer.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { supabaseRoute } from "./look-fixtures.mjs";
import { writeRoomWavs } from "./room-wavs.mjs";

const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
const TAG = process.argv[2] ?? "after";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = new URL(`../docs/look/intro-pop/${TAG}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const wavs = writeRoomWavs(join(tmpdir(), "ethos-room-wavs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SETS = [
  { width: 390, height: 844, theme: "light" },
  { width: 390, height: 844, theme: "dark" },
  { width: 320, height: 568, theme: "light" },
].filter((s) => !process.env.ONLY || process.env.ONLY.split(",").includes(`${s.width}x${s.height}-${s.theme}`));

async function open({ width, height, theme }) {
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${wavs.speaking}`,
      "--autoplay-policy=no-user-gesture-required",
      "--font-render-hinting=none",
    ],
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    colorScheme: theme,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
  });
  await context.grantPermissions(["microphone"]);
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(
    (t) => localStorage.setItem("ethos.prefs", JSON.stringify({ theme: t, reducedMotion: false, haptics: false })),
    theme
  );
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  const cdp = await context.newCDPSession(page);
  return { browser, page, cdp };
}

const until = (page, fn, arg, timeout = 60_000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 16 }).then(() => true, () => false);

const slug = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);

const heading = (page) =>
  page.evaluate(() => (document.querySelector("main h1 .sr-only") ?? document.querySelector("main h1"))?.textContent?.trim() ?? "");

async function holdDoor(page, cdp) {
  const box = await page.locator("[data-room-hold]").boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(950);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Frames `every` ms apart for `count` frames, each labelled by when it was actually taken. */
async function frames(page, name, act, { every = 80, count = 8, dir }) {
  mkdirSync(dir, { recursive: true });
  const files = [];
  const t0 = Date.now();
  await act();
  for (let k = 0; k < count; k++) {
    const target = t0 + k * every;
    const wait = target - Date.now();
    if (wait > 0) await sleep(wait);
    const at = Date.now() - t0;
    const file = `${dir}${name}-${String(k).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, scale: "css" });
    files.push(`${at}ms=${file}`);
  }
  return files;
}

async function walk(set) {
  const tag = `${set.width}x${set.height}-${set.theme}`;
  const { browser, page, cdp } = await open(set);
  let n = 0;
  const shot = async (name, settle = 600) => {
    await sleep(settle);
    n += 1;
    const file = `${OUT}${tag}-${String(n).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: file });
    console.log("shot", `${tag}-${String(n).padStart(2, "0")}-${name}`);
  };
  const strips = set.width === 390 && set.theme === "light";
  const frameDir = `${OUT}frames/`;

  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await shot("room-door", 900);

  if (!process.env.SKIP_ROOM) {
    await holdDoor(page, cdp);
    await until(page, () => (document.querySelector(".room-bubble-text")?.textContent ?? "").length > 0);
    if (strips) {
      /* The first line, streaming. */
      const fs = await frames(page, "room-line", async () => {}, { every: 120, count: 8, dir: frameDir });
      execFileSync("node", [new URL("./sheet.mjs", import.meta.url).pathname, `${OUT}strip-room-line.jpg`, "8", "200", "440", ...fs], { stdio: "inherit" });
    }
    await until(page, () => document.querySelector(".room-bubble-text")?.textContent === "Sell me this pen.");
    await shot("room-first-line", 300);
    await page.waitForSelector("[data-room-turn]", { timeout: 60_000 });
    await shot("room-your-turn", 1500);
    await until(page, () => document.querySelector("main.room")?.dataset.beat === "demos", null, 120_000);
    await until(
      page,
      () => [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled),
      null,
      30_000
    );
    await shot("room-demos", 600);
    await page.getByRole("button", { name: "Next", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Not now", exact: true }).click();
  }

  /* Every screen after the room, by what is on it. */
  for (let guard = 0; guard < 20; guard++) {
    await sleep(700);
    if ((await page.getByRole("button", { name: /Continue with Google/ }).count()) > 0) {
      await shot("account", 600);
      break;
    }
    const h = slug(await heading(page));
    const field = page.getByLabel("Your name");
    const radios = page.locator("main [role=radio]");
    const boxes = page.locator("main [role=checkbox]");
    if ((await field.count()) > 0) {
      await shot(`${h}`);
      await field.fill("Tim");
      await field.blur();
      await shot(`${h}-answered`, 700);
    } else if ((await boxes.count()) > 0) {
      await shot(`${h}`);
      await boxes.nth(1).click();
      await sleep(250);
      await boxes.nth(5).click();
      await shot(`${h}-answered`, 700);
    } else if ((await radios.count()) > 0) {
      await shot(`${h}`);
      const pick = radios.nth(Math.min(1, (await radios.count()) - 1));
      if (strips && h.startsWith("how-old")) {
        /* A reply popping in, frame by frame. */
        const fs = await frames(page, "reply", () => radios.nth(0).click(), { every: 80, count: 8, dir: frameDir });
        execFileSync("node", [new URL("./sheet.mjs", import.meta.url).pathname, `${OUT}strip-reply.jpg`, "8", "200", "440", ...fs], { stdio: "inherit" });
      } else {
        await pick.click();
      }
      await shot(`${h}-answered`, 700);
    } else {
      await shot(h || "screen", 900);
    }
    const next = page.getByRole("button", { name: "Next", exact: true });
    if ((await next.count()) === 0) break;
    if (strips && h.startsWith("what-do-i-call")) {
      /* The next screen arriving and its line said, frame by frame. */
      const fs = await frames(page, "arrive", () => next.click(), { every: 80, count: 10, dir: frameDir });
      execFileSync("node", [new URL("./sheet.mjs", import.meta.url).pathname, `${OUT}strip-arrive.jpg`, "10", "180", "400", ...fs], { stdio: "inherit" });
    } else {
      await next.click();
    }
  }
  await browser.close();
}

for (const set of SETS) await walk(set);
console.log(`done → ${OUT}`);
