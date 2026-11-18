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
 *   returning  an account that has not done the introduction meets the
 *              door without Sign in or Tester code (#497); a finished one
 *              never sees the room; without an account both doors stay
 *   hidden     the phone put away mid-turn: the mic closes, the scene
 *              waits, and the turn is asked again once it is back
 *   skip       Skip mid-turn: the name, and the mic let go
 *   quiet      Sound off in Settings: not one pop
 *   click      a press that is not a finger's (a screen reader's double
 *              tap, a mouse) opens the room on its click
 *   frames     no frame loop runs while nothing moves
 *   places     a finished walk, and a walk left part way through the
 *              old three-screen pitch, never land on the room or off
 *              their place
 *   tester     the door's Tester code with the clock before the test's
 *              end and after it: offered, then gone (#496)
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
/* content/tester.ts TEST.endsAt: 00:00 on 16 November 2026 in Melbourne. */
const TEST_ENDS = Date.parse("2026-11-15T13:00:00Z");
const TEST_OVER = Date.now() >= TEST_ENDS;
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
  const r = (window.__room = { pops: [], live: 0, opened: 0, said: [], bubble: [], demos: [], frames: 0 });
  /* Every frame callback asked for, to see a loop left running. */
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    r.frames += 1;
    return raf(cb);
  };
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
  /* Everything the page sends that is not a read of the app's own pages
     and files (an API, the database, anyone else, any write): the room
     must send nothing. */
  const sent = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    const own = u.origin === new URL(BASE).origin && r.method() === "GET" && !u.pathname.startsWith("/api/");
    if (!own) sent.push(`${r.method()} ${u.origin}${u.pathname}`);
  });
  const cdp = await context.newCDPSession(page);
  return { browser, context, page, cdp, errors, sent };
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

/* Demos's bubble, whole, stands clear of Next: never over it. */
const clearOfNext = (page) =>
  page.evaluate(() => {
    const b = document.querySelector(".room-demos-bubble")?.getBoundingClientRect();
    const n = [...document.querySelectorAll("main.room button")].find((x) => x.textContent === "Next")?.getBoundingClientRect();
    return b && n ? { gap: Math.round(n.top - b.bottom), clear: b.bottom <= n.top } : { gap: null, clear: false };
  });

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
  const { browser, page, cdp, errors, sent } = await open();
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/welcome/, { timeout: 20_000 });
  await page.waitForSelector("[data-room-hold]");
  ok("a fresh browser opens on the room's door", (await room(page))?.stage === "door");
  ok("the room has a name for a screen reader", (await heading(page)) === "An interview", await heading(page));
  ok("one tap on the door, Hold to step in", (await page.locator("main button", { hasText: "Hold to step in" }).count()) === 1);
  ok("Not now is there", (await page.getByRole("button", { name: "Not now" }).count()) === 1);
  ok("a new phone for an account can sign in", (await page.getByRole("link", { name: "Sign in" }).getAttribute("href")) === "/signin");
  /* The tester's door stands on the first screen until the test is over (#496). */
  ok(
    TEST_OVER ? "the test is over: the door offers no tester code" : "the tester's door is still on the first screen",
    TEST_OVER
      ? (await page.getByRole("link", { name: "Tester code" }).count()) === 0
      : (await page.getByRole("link", { name: "Tester code" }).getAttribute("href")) === "/tester?from=welcome"
  );

  const quick = await hold(page, cdp, 150);
  await sleep(500);
  ok("a quick tap does not open the room", (await room(page))?.stage === "door", `filled to ${quick.toFixed(2)}`);
  ok("and the fill empties again", (await page.$eval("[data-room-hold]", (b) => Number(b.style.getPropertyValue("--hold") || 0))) < 0.05);
  ok("nothing was asked for by a tap", (await log(page)).opened === 0);

  const sentAtDoor = sent.length;
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
  ok("and lets the mic go: no track left live", (await log(page)).live === 0);
  ok("his verdict", await beat(page, "verdict"));
  ok("Demos steps in", await beat(page, "demos"));
  await page.waitForFunction(() => !document.querySelector("main.room button.invisible") && [...document.querySelectorAll("main.room button")].some((b) => b.textContent === "Next" && !b.disabled), null, { timeout: 15_000 }).catch(() => {});
  const r = await log(page);
  const end = await room(page);
  ok("steady speech is alright", end?.verdict === "alright", end?.verdict);
  const clear390 = await clearOfNext(page);
  ok("Demos's bubble stands clear of Next", clear390.clear, `${clear390.gap}px`);
  ok("Demos says so, then what if it was real", (r.demos.at(-1) ?? "").trim() === "That was alright.What if that was real?" || /That was alright\.\s*What if that was real\?/.test(r.demos.at(-1) ?? ""), r.demos.at(-1));
  for (const line of LINES) {
    const partial = r.bubble.filter((t) => t.length < line.length && line.startsWith(t) && t.length > 0);
    ok(`"${line}" streams in chunks`, partial.length >= 1 && r.bubble.includes(line), `${partial.length} partials`);
  }
  const said = r.said.filter((s) => s !== "");
  /* And the guide's line after Timothy's (#501): what Ethos is for. */
  const want = [LINES[0], "Your turn", LINES[1], LINES[2], "Your turn", LINES[3], "That was alright.", "What if that was real?", "Let's get you ready for it."];
  ok("a screen reader hears every line once, in order", JSON.stringify(said) === JSON.stringify(want), JSON.stringify(said));
  ok("every chunk pops", r.pops.length >= 16, `${r.pops.length} pops`);
  ok("and nothing pops while the mic is open", r.pops.every((p) => !p.mic), `${r.pops.filter((p) => p.mic).length} over an open mic`);
  ok("the mic opened for the two turns and the ask, nothing more", r.opened === 3, String(r.opened));
  ok("the room shows no number", (await digits(page)) === "", await digits(page));
  ok("the scene over, no mic track is live", r.live === 0, String(r.live));
  const asked = sent.slice(sentAtDoor);
  ok("from the lift to Demos's Next, nothing was sent anywhere", asked.length === 0, asked.slice(0, 4).join(" | "));
  const f0 = (await log(page)).frames;
  await sleep(1500);
  const idle = (await log(page)).frames - f0;
  ok("Demos waiting on Next runs no frame loop", idle <= 3, `${idle} frames in 1.5 s`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForFunction(() => /What do I call you\?/.test(document.querySelector("main h1")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
  ok("Next is the questions, the name first", /What do I call you\?/.test((await heading(page)) ?? ""), await heading(page));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForSelector("[data-room-hold]", { timeout: 5000 }).catch(() => {});
  ok("back from the name is the room's door", (await room(page))?.stage === "door");
  ok("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
/* The tester's door with the phone's clock either side of the test's
   end (#496): offered while the test can be joined, gone once it is
   over, Sign in kept either way. */
if (want("tester")) {
  for (const [when, at, offered] of [
    ["during the test", new Date(TEST_ENDS - 5 * 86_400_000), true],
    ["the minute before the end", new Date(TEST_ENDS - 60_000), true],
    ["at the end", new Date(TEST_ENDS), false],
    ["the day after", new Date(TEST_ENDS + 86_400_000), false],
  ]) {
    const { browser, page, errors } = await open();
    await page.clock.setFixedTime(at);
    await page.goto(`${BASE}/`);
    await page.waitForURL(/\/welcome/, { timeout: 20_000 });
    await page.waitForSelector("[data-room-hold]");
    const code = page.getByRole("link", { name: "Tester code" });
    ok(
      `${when}, the door ${offered ? "offers" : "does not offer"} the tester code`,
      offered ? (await code.getAttribute("href")) === "/tester?from=welcome" : (await code.count()) === 0
    );
    ok(`${when}, Sign in stays`, (await page.getByRole("link", { name: "Sign in" }).getAttribute("href")) === "/signin");
    ok(`${when}, no page error`, errors.length === 0, errors.join(" | "));
    await browser.close();
  }
}

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
  /* At the smallest phone: his line wraps the most there. */
  const { browser, page, cdp, errors } = await open({ deny: true, motion: "denied", width: 320, height: 568 });
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
  ok("mic denied: Demos says it plainly", /I couldn't hear you, so let's get you set up\./.test(r.demos.at(-1) ?? ""), r.demos.at(-1));
  ok("mic denied: and no verdict is made up", (await room(page))?.verdict === undefined);
  const clear320 = await clearOfNext(page);
  ok("mic denied: at 320x568 his bubble stands clear of Next", clear320.clear, `${clear320.gap}px`);
  ok("motion denied: nothing is said about it", !r.said.some((s) => /motion|tilt/i.test(s)));
  await page.getByRole("button", { name: "Next", exact: true }).click();
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
  /* #497: a session no longer rules the room out. An account that has
     not done the introduction meets the door, without the doors that
     are not theirs (Sign in, Tester code). */
  ok("returning: a signed-in browser that has not done the introduction opens on the room", (await room(page)) !== null && (await page.locator("[data-room-hold]").count()) === 1);
  ok("returning: its door has no Sign in and no Tester code", (await page.locator("main.room .room-top a").count()) === 0, String(await page.locator("main.room .room-top a").count()));
  await browser.close();
}
if (want("returning")) {
  /* Finished, signed in: never the room, and the walk opens on its plan. */
  const { browser, page } = await open();
  await page.addInitScript((s) => {
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify(s));
    localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(s));
    localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { name: "Tim", ageBand: "18_24", goal: "feet", pains: ["fillers"], level: "some", context: "work" }, step: 9, done: true, synced: true, walk: 2 }));
  }, session);
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("main h1");
  await sleep(800);
  ok("returning: a signed-in browser whose introduction is finished never sees the room", (await room(page)) === null, await heading(page));
  await browser.close();
}
if (want("returning")) {
  /* A guest (no account) on the door keeps both doors. */
  const { browser, page } = await open();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  const links = await page.locator("main.room .room-top a").allTextContents();
  ok("returning: without an account the door keeps Sign in and Tester code", links.length === 2, JSON.stringify(links));
  await browser.close();
}

/* ------------------------------------------------------------------ */
/* The page put away and brought back, as a phone's app switcher does. */
const showPage = (page, state) =>
  page.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => s });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => s === "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

if (want("hidden")) {
  const { browser, page, cdp, errors } = await open();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await hold(page, cdp, 950);
  ok("hidden: the room opens to your turn", await beat(page, "pitch"));
  await page.waitForSelector("[data-room-turn]", { timeout: 8000 }).catch(() => {});
  await sleep(600);
  const before = await log(page);
  ok("hidden: the mic is open for the turn", before.live === 1, String(before.live));
  await showPage(page, "hidden");
  await sleep(300);
  ok("hidden: put away mid-turn, the mic closes at once", (await log(page)).live === 0);
  await sleep(5000);
  const away = await log(page);
  ok(
    "hidden: the scene waits: no line, no mic, while it is away",
    (await room(page))?.beat === "pitch" && away.opened === before.opened && away.live === 0,
    `${(await room(page))?.beat}, opened ${away.opened - before.opened} more`
  );
  await showPage(page, "visible");
  await page.waitForSelector("[data-room-turn]", { timeout: 8000 }).catch(() => {});
  await sleep(400);
  const back = await log(page);
  ok("hidden: back in front, the turn is asked again", back.opened === before.opened + 1 && back.live === 1, `opened ${back.opened - before.opened} more, ${back.live} live`);
  ok("hidden: and the scene goes on", await beat(page, "push", 30_000));
  ok("hidden: no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("skip")) {
  const { browser, page, cdp, errors } = await open();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await hold(page, cdp, 950);
  await beat(page, "pitch");
  await page.waitForSelector("[data-room-turn]", { timeout: 8000 }).catch(() => {});
  await sleep(600);
  ok("skip: mid-turn, the mic is open", (await log(page)).live === 1);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.waitForFunction(() => /What do I call you\?/.test(document.querySelector("main h1")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
  ok("skip: Skip is the name", /What do I call you\?/.test((await heading(page)) ?? ""), await heading(page));
  await sleep(300);
  ok("skip: and every mic track is stopped", (await log(page)).live === 0, String((await log(page)).live));
  ok("skip: no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("quiet")) {
  const { browser, context, page, cdp } = await open({ reduced: false });
  await context.addInitScript(() => localStorage.setItem("ethos.prefs", JSON.stringify({ sound: false })));
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await hold(page, cdp, 950);
  ok("quiet: the room opens", await beat(page, "pitch"));
  const r = await log(page);
  ok("quiet: his line streamed", r.bubble.includes(LINES[0]), JSON.stringify(r.bubble));
  ok("quiet: with Sound off, not one pop", r.pops.length === 0, `${r.pops.length} pops`);
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("click")) {
  const { browser, page, errors } = await open();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await page.locator("[data-room-hold]").click();
  await sleep(400);
  ok("click: a press that is not a finger's opens the room on its click", (await room(page))?.stage === "scene");
  await page.waitForFunction(() => document.querySelector("main.room")?.dataset.mic === "granted", null, { timeout: 5000 }).catch(() => {});
  ok("click: and the mic was asked in it", (await room(page))?.mic === "granted");
  ok("click: no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("frames")) {
  const { browser, page } = await open();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("[data-room-hold]");
  await sleep(1500);
  const f0 = (await log(page)).frames;
  await sleep(1500);
  const door = (await log(page)).frames - f0;
  ok("frames: the door, untouched, runs no frame loop", door <= 3, `${door} frames in 1.5 s`);
  const f1 = (await log(page)).frames;
  for (let k = 0; k < 10; k++) {
    await tiltTo(page, 50, k < 2 ? 0 : 15);
    await sleep(30);
  }
  await sleep(150);
  const moving = (await log(page)).frames - f1;
  ok("frames: a tilt wakes it", moving >= 5, `${moving} frames while it moved`);
  await sleep(1500);
  const f2 = (await log(page)).frames;
  await sleep(1500);
  const still = (await log(page)).frames - f2;
  ok("frames: once the room has landed it stops again", still <= 3, `${still} frames in 1.5 s`);
  ok("frames: where the phone points", (await tiltX(page)) > 0.7, String(await tiltX(page)));
  await browser.close();
}

/* ------------------------------------------------------------------ */
if (want("places")) {
  const seed = async (state) => {
    const o = await open();
    await o.context.addInitScript((s) => localStorage.setItem("ethos.onboarding", JSON.stringify(s)), state);
    await o.page.goto(`${BASE}/welcome`);
    await o.page.waitForSelector("main h1");
    await sleep(800);
    return o;
  };
  {
    const { browser, page } = await seed({ answers: { name: "Tim", pains: [] }, step: 9, done: true, synced: false, walk: 2 });
    ok("places: a finished walk opens on its plan, never the room", (await room(page)) === null && (await page.locator("[data-room-hold]").count()) === 0, await heading(page));
    await browser.close();
  }
  {
    /* Left on the third question of the old walk (step 5, no mark): the
       goal, which went with #501, so the question in its place. */
    const { browser, page } = await seed({ answers: { name: "Tim", ageBand: "19-22", pains: [] }, step: 5, done: false, synced: false });
    ok("places: a walk left on the old third question comes back to its place, the question after it", (await room(page)) === null && /What do you notice when you talk\?/.test((await heading(page)) ?? ""), await heading(page));
    await browser.close();
  }
  {
    /* Left on the beat of the room's walk (layout 2, step 7): the hour. */
    const { browser, page } = await seed({ answers: { name: "Tim", pains: [] }, step: 7, done: false, synced: false, walk: 2 });
    ok("places: a walk left on the beat, which went (#501), comes back on the hour", (await room(page)) === null && /When do you want your minute\?/.test((await heading(page)) ?? ""), await heading(page));
    await browser.close();
  }
  {
    /* Left in the old pitch: the room stands where it stood. */
    const { browser, page } = await seed({ answers: { name: null, pains: [] }, step: 2, done: false, synced: false });
    ok("places: a walk left in the old pitch opens on the room in its place", (await room(page))?.stage === "door");
    await browser.close();
  }
}

const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
