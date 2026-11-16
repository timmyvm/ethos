/**
 * The room (#475), walked in a real browser with a fake microphone.
 *
 *   speaking   a fresh browser lands on the door; a quick tap does not
 *              open it and a hold does; his four lines stream into his
 *              bubble chunk by chunk with a pop under each, each said to
 *              a screen reader once; your two turns open the mic (and
 *              only they do), show the level and end on silence; the
 *              phone's tilt moves the room; Demos says "That was
 *              alright." and "What if that was real?"; Next is the name.
 *   silent     the same scene entered from the keyboard, with a silent
 *              mic: "That was horrible."
 *   not now    straight to the name, and a refresh stays there
 *   mic denied his lines play, no turn opens, Demos says it plainly,
 *              Next is the name; motion denied says nothing
 *   reduced    each line arrives whole with one pop; the tilt holds still
 *   returning  a browser holding a session never sees the room
 *
 * Against a production build (the room's timings are real: the walk
 * takes about two and a half minutes):
 *
 *   LOOK_BASE=http://localhost:3822 node scripts/check-room.mjs
 */
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { session } from "./look-fixtures.mjs";
import { writeRoomWavs } from "./room-wavs.mjs";

/* PLAYWRIGHT_MODULE as the other gates take it, else wherever require finds it. */
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const want = (name) => !ONLY || ONLY.has(name);
const wavs = writeRoomWavs(join(tmpdir(), "ethos-room-wavs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" };

const LINES = [
  "Sell me this pen.",
  "What are you even saying?",
  "Why would I need this pen?",
  "I'm sorry, but you're not who we're looking for.",
];

/*
 * What the page did, kept on the window: every pop (an oscillator made,
 * and whether a mic was open then), how many mic tracks are live, every
 * change to what a screen reader is told, and every text his bubble
 * showed.
 */
function instrument() {
  const r = (window.__room = { pops: [], live: 0, opened: 0, said: [], bubble: [], demos: [] });
  const AC = window.AudioContext;
  if (AC) {
    const make = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      r.pops.push({ t: performance.now(), mic: r.live > 0 });
      return make.call(this);
    };
  }
  const md = navigator.mediaDevices;
  if (md?.getUserMedia) {
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      if (window.__denyMic) throw new DOMException("denied", "NotAllowedError");
      const s = await gum(c);
      r.opened += 1;
      for (const t of s.getTracks()) {
        r.live += 1;
        const stop = t.stop.bind(t);
        let stopped = false;
        t.stop = () => {
          if (!stopped) r.live -= 1;
          stopped = true;
          stop();
        };
      }
      return s;
    };
  }
  const push = (list, v) => {
    if (list[list.length - 1] !== v) list.push(v);
  };
  const watch = () => {
    new MutationObserver(() => {
      const live = document.querySelector('main.room p[aria-live]');
      if (live && live.textContent) push(r.said, live.textContent);
      const b = document.querySelector(".room-bubble-text");
      if (b) push(r.bubble, b.textContent);
      const d = document.querySelector(".room-demos-bubble");
      if (d) push(r.demos, d.textContent);
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
}

async function open({ wav = wavs.speaking, width = 390, height = 844, reduced = false, deny = false, motion = "granted" } = {}) {
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${wav}`,
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
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.grantPermissions(["microphone"]);
  await context.route("http://supabase.local/**", (r) =>
    r.fulfill({ status: r.request().method() === "OPTIONS" ? 204 : 200, headers: cors, body: "[]" })
  );
  await context.addInitScript(instrument);
  if (deny) await context.addInitScript(() => (window.__denyMic = true));
  /* An iPhone asks for motion; this one answers as told. */
  await context.addInitScript((answer) => {
    if (typeof DeviceOrientationEvent !== "undefined") DeviceOrientationEvent.requestPermission = () => Promise.resolve(answer);
  }, motion);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  return { browser, context, page, cdp, errors };
}

const room = (page) =>
  page.evaluate(() => {
    const m = document.querySelector("main.room");
    return m ? { ...m.dataset } : null;
  });
const log = (page) => page.evaluate(() => window.__room);
const heading = (page) => page.evaluate(() => (document.querySelector("main h1 .sr-only") ?? document.querySelector("main h1"))?.textContent?.trim());
const beat = (page, b, timeout = 40_000) =>
  page.waitForFunction((b) => document.querySelector("main.room")?.dataset.beat === b, b, { timeout }).then(() => true, () => false);

async function hold(page, cdp, ms = 950) {
  const box = await page.locator("[data-room-hold]").boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(ms);
  const fill = await page.$eval("[data-room-hold]", (b) => Number(b.style.getPropertyValue("--hold") || 0));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return fill;
}

const tiltTo = (page, beta, gamma) =>
  page.evaluate(
    ([beta, gamma]) => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta, gamma })),
    [beta, gamma]
  );
const tiltX = (page) => page.$eval("main.room", (m) => Number(m.style.getPropertyValue("--room-tilt-x") || 0));
const digits = (page) =>
  page.evaluate(() => {
    const m = document.querySelector("main.room");
    if (!m) return "";
    const seen = m.innerText;
    return (seen.match(/\d/g) ?? []).join("");
  });

/* ------------------------------------------------------------------ */
if (want("speaking")) {
  const { browser, page, cdp, errors } = await open();
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/welcome/, { timeout: 20_000 });
  await page.waitForSelector("[data-room-hold]");
  ok("a fresh browser opens on the room's door", (await room(page))?.stage === "door");
  ok("the room has a name for a screen reader", (await heading(page)) === "An interview", await heading(page));
  ok("one tap on the door, Hold to step in", (await page.locator("main button", { hasText: "Hold to step in" }).count()) === 1);
  ok("Not now is there", (await page.getByRole("button", { name: "Not now" }).count()) === 1);
  ok("a new phone for an account can sign in", (await page.getByRole("link", { name: "Sign in" }).getAttribute("href")) === "/signin");
  ok("the tester's door is still on the first screen", (await page.getByRole("link", { name: "Tester code" }).getAttribute("href")) === "/tester?from=welcome");

  const quick = await hold(page, cdp, 150);
  await sleep(500);
  ok("a quick tap does not open the room", (await room(page))?.stage === "door", `filled to ${quick.toFixed(2)}`);
  ok("and the fill empties again", (await page.$eval("[data-room-hold]", (b) => Number(b.style.getPropertyValue("--hold") || 0))) < 0.05);
  ok("nothing was asked for by a tap", (await log(page)).opened === 0);

  const filled = await hold(page, cdp, 950);
  ok("held, it fills all the way", filled >= 0.99, filled.toFixed(2));
  await page.waitForFunction(() => document.querySelector("main.room")?.dataset.stage === "scene", null, { timeout: 3000 }).catch(() => {});
  ok("and the lift opens the room", (await room(page))?.stage === "scene");
  await page.waitForFunction(() => document.querySelector("main.room")?.dataset.mic === "granted", null, { timeout: 5000 }).catch(() => {});
  ok("the lift asked for the mic", (await room(page))?.mic === "granted");

  ok("he opens: Sell me this pen.", await beat(page, "open"));
  /* The window: the scene began here, so this is the centre. */
  for (let k = 0; k < 6; k++) {
    await tiltTo(page, 50, 0);
    await sleep(30);
  }
  for (let k = 0; k < 20; k++) {
    await tiltTo(page, 50, 20);
    await sleep(25);
  }
  const right = await tiltX(page);
  for (let k = 0; k < 20; k++) {
    await tiltTo(page, 50, -20);
    await sleep(25);
  }
  const left = await tiltX(page);
  ok("tilting the phone moves the room, the whole range each way", right > 0.9 && left < -0.9, `${right.toFixed(2)} / ${left.toFixed(2)}`);
  for (let k = 0; k < 10; k++) {
    await tiltTo(page, 50, 0);
    await sleep(25);
  }

  ok("your first turn comes after his ask", await beat(page, "pitch"));
  await page.waitForSelector("[data-room-turn]", { timeout: 8000 }).catch(() => {});
  ok("it says it is your turn", (await page.locator(".room-turn-label").textContent().catch(() => "")) === "Your turn" && (await page.locator(".room-turn-label").isVisible()));
  ok("with Done to end it", await page.getByRole("button", { name: "Done" }).isVisible().catch(() => false));
  let peak = 0;
  for (let k = 0; k < 40; k++) {
    const l = await page.evaluate(() =>
      Math.max(0, ...[...document.querySelectorAll(".room-meter span")].map((s) => Number(s.style.getPropertyValue("--l") || 0)))
    );
    peak = Math.max(peak, l);
    await sleep(100);
  }
  ok("the level shows the room hears you", peak > 0.3, peak.toFixed(2));
  ok("the mic is open for your turn", (await log(page)).live === 1);

  ok("he pushes back", await beat(page, "push", 30_000));
  ok("the turn ended on its own, on the silence after speech", (await room(page))?.turn === undefined);
  ok("and the mic closed with it", (await log(page)).live === 0);
  ok("he asks why", await beat(page, "why"));
  ok("your second turn", await beat(page, "answer"));
  await page.waitForSelector("[data-room-turn]", { timeout: 8000 }).catch(() => {});
  /* Mid-sentence: Done ends a turn at once, with what was said kept. */
  await sleep(5500);
  await page.getByRole("button", { name: "Done" }).click();
  await sleep(300);
  ok("Done ends the turn at once", (await room(page))?.turn === undefined);
  ok("his verdict", await beat(page, "verdict"));
  ok("Demos steps in", await beat(page, "demos"));
  await page.waitForFunction(() => !document.querySelector("main.room button.invisible") && [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled), null, { timeout: 15_000 }).catch(() => {});
  const r = await log(page);
  const end = await room(page);
  ok("steady speech is alright", end?.verdict === "alright", end?.verdict);
  ok("Demos says so, then what if it was real", (r.demos.at(-1) ?? "").trim() === "That was alright.What if that was real?" || /That was alright\.\s*What if that was real\?/.test(r.demos.at(-1) ?? ""), r.demos.at(-1));
  for (const line of LINES) {
    const partial = r.bubble.filter((t) => t.length < line.length && line.startsWith(t) && t.length > 0);
    ok(`"${line}" streams in chunks`, partial.length >= 1 && r.bubble.includes(line), `${partial.length} partials`);
  }
  const said = r.said.filter((s) => s !== "");
  const want = [LINES[0], "Your turn", LINES[1], LINES[2], "Your turn", LINES[3], "That was alright.", "What if that was real?"];
  ok("a screen reader hears every line once, in order", JSON.stringify(said) === JSON.stringify(want), JSON.stringify(said));
  ok("every chunk pops", r.pops.length >= 16, `${r.pops.length} pops`);
  ok("and nothing pops while the mic is open", r.pops.every((p) => !p.mic), `${r.pops.filter((p) => p.mic).length} over an open mic`);
  ok("the mic opened for the two turns and the ask, nothing more", r.opened === 3, String(r.opened));
  ok("the room shows no number", (await digits(page)) === "", await digits(page));
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForFunction(() => /What do I call you\?/.test(document.querySelector("main h1")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
  ok("Next is the questions, the name first", /What do I call you\?/.test((await heading(page)) ?? ""), await heading(page));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForSelector("[data-room-hold]", { timeout: 5000 }).catch(() => {});
  ok("back from the name is the room's door", (await room(page))?.stage === "door");
  ok("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("silent")) {
  const { browser, page, errors } = await open({ wav: wavs.silent });
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await page.locator("[data-room-hold]").focus();
  await page.keyboard.press("Enter");
  await sleep(300);
  ok("silent: a keyboard press opens the room, no hold asked of it", (await room(page))?.stage === "scene");
  ok("silent: he says his line", await beat(page, "open"));
  ok("silent: your turn comes", await beat(page, "pitch"));
  ok("silent: and ends when nobody speaks", await beat(page, "push", 20_000));
  ok("silent: Demos steps in", await beat(page, "demos", 45_000));
  await page.waitForFunction(() => [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled), null, { timeout: 15_000 }).catch(() => {});
  const r = await log(page);
  ok("silent: silence is horrible", (await room(page))?.verdict === "horrible", (await room(page))?.verdict);
  ok("silent: Demos says so", /That was horrible\./.test(r.demos.at(-1) ?? ""), r.demos.at(-1));
  ok("silent: no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("notnow")) {
  const { browser, page } = await open();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await page.getByRole("button", { name: "Not now" }).click();
  await page.waitForFunction(() => /What do I call you\?/.test(document.querySelector("main h1")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
  ok("not now: straight to the questions", /What do I call you\?/.test((await heading(page)) ?? ""));
  ok("not now: nothing was asked for", (await log(page)).opened === 0);
  await page.reload();
  await page.waitForSelector("main h1");
  await sleep(600);
  ok("not now: a refresh stays on the name", /What do I call you\?/.test((await heading(page)) ?? "") && (await room(page)) === null);
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("denied")) {
  const { browser, page, cdp, errors } = await open({ deny: true, motion: "denied" });
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await hold(page, cdp, 950);
  ok("mic denied: the room still opens", await beat(page, "open"));
  ok("mic denied: the phone says no", await page.waitForFunction(() => document.querySelector("main.room")?.dataset.mic === "denied", null, { timeout: 5000 }).then(() => true, () => false));
  ok("mic denied: his lines play on", await beat(page, "verdict", 30_000));
  ok("mic denied: Demos steps in", await beat(page, "demos"));
  await page.waitForFunction(() => [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled), null, { timeout: 15_000 }).catch(() => {});
  const r = await log(page);
  ok("mic denied: no turn ever opened", r.opened === 0 && !r.said.includes("Your turn"), JSON.stringify(r.said));
  ok("mic denied: Demos says it plainly", /No mic, no room\. Let's set you up instead\./.test(r.demos.at(-1) ?? ""), r.demos.at(-1));
  ok("mic denied: and no verdict is made up", (await room(page))?.verdict === undefined);
  ok("motion denied: nothing is said about it", !r.said.some((s) => /motion|tilt/i.test(s)));
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForFunction(() => /What do I call you\?/.test(document.querySelector("main h1")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
  ok("mic denied: the questions follow", /What do I call you\?/.test((await heading(page)) ?? ""));
  ok("mic denied: no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("reduced")) {
  const { browser, page, cdp } = await open({ reduced: true });
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await hold(page, cdp, 950);
  ok("reduced: the room opens", await beat(page, "open"));
  for (let k = 0; k < 10; k++) {
    await tiltTo(page, 50, k < 3 ? 0 : 20);
    await sleep(40);
  }
  ok("reduced: the tilt holds the room still", Math.abs(await tiltX(page)) < 0.001, String(await tiltX(page)));
  const art = await page.evaluate(() =>
    [...document.querySelectorAll(".room-art *")].filter((e) => {
      const m = /translate3d\(([^)]*)\)/.exec(e.style.transform ?? "");
      return m !== null && m[1].split(",").some((n) => Math.abs(parseFloat(n)) > 0.01);
    }).length
  );
  ok("reduced: no layer is moved", art === 0, String(art));
  await beat(page, "pitch");
  const r = await log(page);
  ok("reduced: his line arrives whole", r.bubble.filter((t) => t).every((t) => LINES.includes(t)), JSON.stringify(r.bubble));
  ok("reduced: with one pop", r.pops.length === 1, String(r.pops.length));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("returning")) {
  const { browser, page } = await open();
  await page.addInitScript((s) => {
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(s));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(s));
  }, session);
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("main h1");
  await sleep(800);
  ok("returning: a signed-in browser never sees the room", (await room(page)) === null && /What do I call you\?/.test((await heading(page)) ?? ""), await heading(page));
  ok("returning: and the name has no way back to it", (await page.getByRole("button", { name: "Back", exact: true }).count()) === 0);
  await browser.close();
}

const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
