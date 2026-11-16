/**
 * The look loop's camera for the room (#475): every beat of the scene,
 * shot at 390x844, 375x667 and 320x568 (2x), with a fake mic speaking,
 * and the ending again in dark and with no mic.
 *
 *   LOOK_BASE=http://localhost:3822 node scripts/look-room.mjs
 *   SIZES=390x844 node scripts/look-room.mjs        one size only
 *
 * Writes docs/look/room/<width>x<height>-<nn>-<beat>.png.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRoomWavs } from "./room-wavs.mjs";

const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/room/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const SIZES = (process.env.SIZES ?? "390x844,375x667,320x568").split(",").map((s) => s.split("x").map(Number));
const wavs = writeRoomWavs(join(tmpdir(), "ethos-room-wavs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" };

async function open({ width, height, theme = "light", deny = false }) {
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
  });
  await context.grantPermissions(["microphone"]);
  await context.route("http://supabase.local/**", (r) =>
    r.fulfill({ status: r.request().method() === "OPTIONS" ? 204 : 200, headers: cors, body: "[]" })
  );
  await context.addInitScript((t) => localStorage.setItem("ethos.prefs", JSON.stringify({ theme: t, haptics: false })), theme);
  if (deny) {
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
  }
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  return { browser, page, cdp };
}

const until = (page, fn, arg, timeout = 40_000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 16 }).then(() => true, () => false);
/* The beat goes to the page as an argument: a closure over a Node variable cannot. */
const onBeat = (page, b, timeout = 40_000) =>
  until(page, (b) => document.querySelector("main.room")?.dataset.beat === b, b, timeout);
const bubbleIs = (page, pred, arg) => until(page, pred, arg, 30_000);

async function walk([width, height]) {
  const tag = `${width}x${height}`;
  const { browser, page, cdp } = await open({ width, height });
  const shot = (n) => page.screenshot({ path: `${OUT}${tag}-${n}.png` });
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await sleep(500);
  await shot("01-door");

  const box = await page.locator("[data-room-hold]").boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(420);
  await shot("02-holding");
  await sleep(500);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(380);
  await shot("03-stepping-in");

  /* His first line, as it lands. */
  await until(page, () => (document.querySelector(".room-bubble-text")?.textContent ?? "").length > 0);
  await shot("04-open-streaming");
  await until(page, () => document.querySelector(".room-bubble-text")?.textContent === "Sell me this pen.");
  await sleep(250);
  await shot("05-open");

  /* The window: tilt the phone each way while he waits. */
  const tilt = async (gamma, beta = 50) => {
    for (let k = 0; k < 18; k++) {
      await page.evaluate(([b, g]) => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: b, gamma: g })), [beta, gamma]);
      await sleep(22);
    }
  };
  await tilt(0);
  await tilt(20, 62);
  await sleep(200);
  await shot("06-tilt-right");
  await tilt(-20, 38);
  await sleep(200);
  await shot("07-tilt-left");
  await tilt(0);

  await onBeat(page, "pitch");
  await page.waitForSelector("[data-room-turn]");
  await until(page, () =>
    [...document.querySelectorAll(".room-meter span")].some((s) => Number(s.style.getPropertyValue("--l") || 0) > 0.5)
  );
  await shot("08-your-turn");

  await onBeat(page, "push");
  await until(page, () => document.querySelector(".room-bubble-text")?.textContent === "What are you even saying?");
  await sleep(250);
  await shot("09-push");
  await onBeat(page, "why");
  await until(page, () => document.querySelector(".room-bubble-text")?.textContent === "Why would I need this pen?");
  await sleep(250);
  await shot("10-why");
  await onBeat(page, "answer");
  await page.waitForSelector("[data-room-turn]");
  await sleep(1500);
  await shot("11-your-turn-again");

  await onBeat(page, "verdict");
  await bubbleIs(page, () => {
    const t = document.querySelector(".room-bubble-text")?.textContent ?? "";
    return t.startsWith("I'm") && t.split(" ").length >= 4 && t.length < 44;
  });
  await shot("12-verdict-streaming");
  await until(page, () => document.querySelector(".room-bubble-text")?.textContent === "I'm sorry, but you're not who we're looking for.");
  await sleep(300);
  await shot("13-verdict");

  await onBeat(page, "demos");
  await sleep(900);
  await shot("14-demos-steps-in");
  await until(page, () =>
    [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled)
  );
  await sleep(500);
  await shot("15-demos");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForFunction(() => /What do I call you\?/.test(document.querySelector("main h1")?.textContent ?? ""));
  await sleep(700);
  await shot("16-the-name");
  await browser.close();
}

async function ending({ theme = "light", deny = false, name }) {
  const { browser, page, cdp } = await open({ width: 390, height: 844, theme, deny });
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await sleep(400);
  if (theme === "dark") await page.screenshot({ path: `${OUT}390x844-${name}-door.png` });
  const box = await page.locator("[data-room-hold]").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await sleep(950);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await onBeat(page, "demos", 80_000);
  await until(page, () => [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled), null, 20_000);
  await sleep(500);
  await page.screenshot({ path: `${OUT}390x844-${name}.png` });
  await browser.close();
}

for (const size of SIZES) {
  await walk(size);
  console.log("shot", size.join("x"));
}
if (!process.env.SIZES) {
  await ending({ theme: "dark", name: "dark-ending" });
  await ending({ deny: true, name: "no-mic-ending" });
  console.log("shot the endings");
}
