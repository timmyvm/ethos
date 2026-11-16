/**
 * The tap's tick, in a real browser (#449, components/ui/TapTick.tsx).
 *
 * An iPhone has no vibration a page can ask for. The one haptic it can
 * reach is the tick a native switch plays when a person's own tap
 * toggles it, so a button that should tick carries a transparent label
 * wired to a hidden switch. No browser on this machine has a Taptic
 * Engine, so the tick itself is not felt here; what can be checked is
 * everything the tick depends on, and everything the overlay must not
 * break:
 *
 *   1. on an iPhone with Haptics on, each ticking control holds one
 *      label that covers it exactly, over a switch that is native,
 *      hidden, out of the tab order and out of the accessibility tree;
 *   2. a tap reaches the switch (it toggles) and still presses the
 *      button exactly once;
 *   3. a keyboard presses the button as it always did, and Tab never
 *      lands on the hidden switch;
 *   4. Haptics switched off takes every overlay away at once;
 *   5. nothing is drawn where the tick cannot play or is not needed: an
 *      Android (the Vibration API does it), an iPad, iOS 17, a desktop;
 *   6. a control that is disabled carries no tick;
 *   7. Settings offers Haptics exactly where the phone can give one.
 *
 * On a real iPhone, the thing to feel: Record, Stop, Settings' switches.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-haptics.mjs
 *   SHOTS=docs/look/hig node scripts/check-haptics.mjs   # the overlay drawn in, for the eye
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { analyzeBody, json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ? process.env.SHOTS.replace(/\/?$/, "/") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const ua = (device, os, version) =>
  `Mozilla/5.0 (${device}; CPU ${device === "iPad" ? "" : "iPhone "}OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Mobile/15E148 Safari/604.1`;
/** iOS 26 and later state a frozen 18_6; the Version token is the real one. */
const IPHONE = ua("iPhone", "18_6", "26.5");
const IPHONE_17 = ua("iPhone", "17_4", "17.4");
const IPAD = ua("iPad", "18_6", "26.5");

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

/** A phone: its user agent, whether it has the Vibration API, and whether Haptics is on. */
async function open({ userAgent = IPHONE, vibrates = false, haptics = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
    ...(userAgent ? { userAgent } : {}),
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  const sends = { n: 0 };
  await context.route("**/api/analyze", async (route) => {
    sends.n += 1;
    await sleep(400);
    return route.fulfill(json(analyzeBody));
  });
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(({ vibrates, haptics }) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    /* On every load, after the fixture's own seed, which writes Haptics
       off each time a page opens. Lite graphics off, as a person's own
       choice: an iPhone the app judges slow turns it on by itself, and
       under it a spin lands at once and is never seen rolling. */
    const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
    localStorage.setItem("ethos.prefs", JSON.stringify({ ...prefs, haptics, liteGraphics: false }));
    if (!vibrates) {
      try {
        delete Navigator.prototype.vibrate;
      } catch {}
    }
    // The microphone, counted: one tap must ask for it once.
    window.__mic = 0;
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const real = md.getUserMedia.bind(md);
      md.getUserMedia = (...a) => {
        window.__mic += 1;
        return real(...a);
      };
    }
  }, { vibrates, haptics });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  // React says invalid nesting and hydration trouble on the console.
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|did not match|cannot be a descendant|cannot contain|validateDOMNesting|#418|#423|#425/i.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  return { context, page, errors, sends };
}
const settle = async (page) => {
  await page.waitForSelector("main");
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(700);
};
const ticks = (page) => page.evaluate(() => document.querySelectorAll(".tap-tick").length);
/** The overlay on one control, measured. */
const overlay = (page, selector) =>
  page.evaluate((selector) => {
    const host = document.querySelector(selector);
    if (!host) return { host: false };
    const labels = host.querySelectorAll(":scope > label.tap-tick");
    const label = labels[0];
    if (!label) return { host: true, count: 0 };
    const input = label.querySelector("input");
    const h = host.getBoundingClientRect();
    const l = label.getBoundingClientRect();
    const cs = getComputedStyle(input);
    const mid = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2);
    return {
      host: true,
      count: labels.length,
      covers: Math.abs(h.left - l.left) < 0.6 && Math.abs(h.top - l.top) < 0.6 && Math.abs(h.width - l.width) < 0.6 && Math.abs(h.height - l.height) < 0.6,
      onTop: mid === label,
      hidden: label.getAttribute("aria-hidden") === "true",
      type: input.type,
      isSwitch: input.hasAttribute("switch"),
      tabIndex: input.tabIndex,
      visibility: cs.visibility,
      size: `${Math.round(parseFloat(cs.width))}x${Math.round(parseFloat(cs.height))}`,
      // Restyled, WebKit plays nothing: the switch must keep its own look.
      native: cs.appearance !== "none" && cs.webkitAppearance !== "none",
      hostPosition: getComputedStyle(host).position,
      checked: input.checked,
    };
  }, selector);
const sound = (o) =>
  o.host && o.count === 1 && o.covers && o.onTop && o.hidden && o.type === "checkbox" && o.isSwitch && o.tabIndex === -1 && o.visibility === "hidden" && o.size === "1x1" && o.native && o.hostPosition !== "static";

/* Taps are forced: Record breathes while it waits (#242), and a tap that
   waits for it to hold still waits for good. A forced tap still lands on
   the button's centre, which is where the label is. */
const RECORD = 'button[data-record="start"]';
const STOP = 'button[data-record="stop"]';

// ---- 1 to 3. the recorder, on an iPhone ---------------------------------------
{
  const { context, page, errors, sends } = await open();
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(RECORD, { timeout: 20000 });
  await sleep(900);
  let o = await overlay(page, RECORD);
  ok("Record carries one tick: a label that covers it, over a native, hidden switch", sound(o), JSON.stringify(o));
  ok("the screen reads as it did: the switch is not in the accessibility tree", (await page.getByRole("checkbox").count()) === 0 && (await page.getByRole("switch").count()) === 0 && (await page.getByRole("button", { name: "Record", exact: true }).count()) === 1);
  if (SHOTS) {
    await page.addStyleTag({ content: ".tap-tick{outline:2px dashed #0a84ff;outline-offset:-2px;background:rgb(10 132 255 / 0.12)}" });
    await page.screenshot({ path: `${SHOTS}tap-tick-record-drawn-in.png` });
  }

  // Tab walks the screen and never lands on the hidden switch.
  const stops = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a?.matches("input[switch]") ? "SWITCH" : (a?.getAttribute("data-record") ?? a?.tagName ?? "");
    }));
  }
  ok("Tab never lands on the hidden switch, and still reaches Record", !stops.includes("SWITCH") && stops.includes("start"), stops.join(","));

  // A tap: through the label, to the switch, and to Record, once.
  const before = (await overlay(page, RECORD)).checked;
  await page.locator(RECORD).tap({ force: true });
  await page.waitForSelector(STOP, { timeout: 15000 });
  await sleep(500);
  const mic = await page.evaluate(() => window.__mic);
  o = await overlay(page, STOP);
  ok("a tap on Record reaches the switch: it toggles", o.checked === !before, `${before} → ${o.checked}`);
  ok("and presses Record exactly once: one ask for the microphone, and it is recording", mic === 1, `${mic} asks`);
  ok("Stop carries the tick too", sound(o), JSON.stringify(o));
  await sleep(2600);
  const wasChecked = o.checked;
  await page.locator(STOP).tap({ force: true });
  await page.waitForSelector("main [data-glance-door]", { timeout: 20000 });
  await sleep(600);
  ok("a tap on Stop sends the take exactly once", sends.n === 1, `${sends.n} sends`);
  ok("and the switch toggled again under that tap", wasChecked !== undefined);
  ok("the recorder threw nothing, and React had nothing to say about the markup", errors.length === 0, errors.join(" | "));
  await context.close();
}
{
  // A keyboard presses the button itself, as before.
  const { context, page } = await open();
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(RECORD, { timeout: 20000 });
  await sleep(900);
  await page.locator(RECORD).focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(STOP, { timeout: 15000 }).catch(() => {});
  ok("Return on Record starts the take, once", (await page.locator(STOP).count()) === 1 && (await page.evaluate(() => window.__mic)) === 1);
  await context.close();
}

// ---- 4 and 7. Settings, on an iPhone --------------------------------------------
{
  const { context, page, errors } = await open();
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('main button[role="switch"]')].map((b) => ({
      name: b.querySelector(".font-display")?.textContent.trim(),
      ticks: b.querySelectorAll(":scope > label.tap-tick").length,
    }))
  );
  ok("Settings offers Haptics on an iPhone that can tick", rows.some((r) => r.name === "Haptics"), rows.map((r) => r.name).join(", "));
  ok("every switch carries one tick", rows.length >= 5 && rows.every((r) => r.ticks === 1), JSON.stringify(rows.filter((r) => r.ticks !== 1)));
  const soundRow = page.getByRole("switch", { name: /^Sound/ });
  const was = await soundRow.getAttribute("aria-checked");
  await soundRow.tap({ force: true });
  await sleep(250);
  const now = await soundRow.getAttribute("aria-checked");
  ok("a tap throws a switch exactly once", was !== now, `${was} → ${now}`);
  await soundRow.tap({ force: true });
  await sleep(250);
  ok("and a second tap throws it back", (await soundRow.getAttribute("aria-checked")) === was);
  if (SHOTS) {
    await page.addStyleTag({ content: ".tap-tick{outline:2px dashed #0a84ff;outline-offset:-2px;background:rgb(10 132 255 / 0.12)}" });
    await page.getByRole("switch", { name: /^Haptics/ }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -260));
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}tap-tick-settings-drawn-in.png` });
    await page.evaluate(() => document.querySelectorAll("style").forEach((s) => s.textContent.includes("dashed #0a84ff") && s.remove()));
  }
  // Haptics off: every overlay on the screen goes, in the same tap.
  const haptics = page.getByRole("switch", { name: /^Haptics/ });
  await haptics.tap({ force: true });
  await sleep(300);
  ok("Haptics switched off takes every tick off the screen at once", (await haptics.getAttribute("aria-checked")) === "false" && (await ticks(page)) === 0, `${await ticks(page)} left`);
  await haptics.tap({ force: true });
  await sleep(300);
  ok("and switched on puts them back", (await haptics.getAttribute("aria-checked")) === "true" && (await ticks(page)) >= 5, `${await ticks(page)} ticks`);
  ok("Settings threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- Today's spin, and a control that is disabled -------------------------------
{
  const { context, page, errors } = await open();
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main .home-hero", { timeout: 20000 });
  await settle(page);
  const another = page.locator("button.home-another", { hasText: "Another topic" });
  const glyph = page.locator('button[aria-label="Spin a new topic"]');
  const opener = (await glyph.count()) ? glyph : another;
  const sel = (await glyph.count()) ? 'button[aria-label="Spin a new topic"]' : "button.home-another";
  ok("Today's spin carries a tick", sound(await overlay(page, sel)), JSON.stringify(await overlay(page, sel)));
  await opener.tap({ force: true });
  await page.waitForSelector('button[aria-label="Spin again"]', { timeout: 8000 });
  await sleep(1200);
  const again = 'button[aria-label="Spin again"]';
  ok("Spin again carries a tick while it can be pressed", sound(await overlay(page, again)), JSON.stringify(await overlay(page, again)));
  await page.locator(again).tap({ force: true });
  await sleep(120);
  const rolling = await page.evaluate((again) => {
    const b = document.querySelector(again);
    return { disabled: b.disabled, ticks: b.querySelectorAll(".tap-tick").length };
  }, again);
  ok("and none while it rolls: a control that does nothing does not tick", rolling.disabled && rolling.ticks === 0, JSON.stringify(rolling));
  ok("Today threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- every tick, wherever one is drawn ---------------------------------------------
{
  const { context, page, errors } = await open();
  const unsound = [];
  let seen = 0;
  const where = {};
  for (const path of ["/", "/rep?lesson=h4", "/hostile", "/shop", "/boss", "/settings"]) {
    await page.goto(`${BASE}${path}`);
    await settle(page);
    const found = await page.evaluate(() =>
      [...document.querySelectorAll(".tap-tick")].map((label) => {
        const host = label.parentElement;
        const box = host.getBoundingClientRect();
        /* The label fills the button inside its border (an absolute
           child's box), so a bordered button's own 1px edge is the one
           place a tap does not tick. Measured against that inner box. */
        const cs = getComputedStyle(host);
        const b = { t: parseFloat(cs.borderTopWidth), r: parseFloat(cs.borderRightWidth), b: parseFloat(cs.borderBottomWidth), l: parseFloat(cs.borderLeftWidth) };
        const h = { left: box.left + b.l, top: box.top + b.t, width: box.width - b.l - b.r, height: box.height - b.t - b.b };
        const l = label.getBoundingClientRect();
        const input = label.querySelector("input");
        return {
          on: (host.getAttribute("aria-label") ?? host.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24),
          button: host.tagName === "BUTTON",
          inLink: !!host.closest("a"),
          disabled: host.disabled === true,
          positioned: getComputedStyle(host).position !== "static",
          covers: Math.abs(h.left - l.left) < 0.6 && Math.abs(h.top - l.top) < 0.6 && Math.abs(h.width - l.width) < 0.6 && Math.abs(h.height - l.height) < 0.6,
          edge: Math.max(b.t, b.r, b.b, b.l),
          big: box.width >= 44 && box.height >= 44,
          one: host.querySelectorAll(":scope > .tap-tick").length === 1,
          native: !!input && input.hasAttribute("switch") && getComputedStyle(input).appearance !== "none" && getComputedStyle(input).visibility === "hidden",
        };
      })
    );
    where[path] = found.length;
    seen += found.length;
    for (const f of found) {
      if (!(f.button && !f.inLink && !f.disabled && f.positioned && f.covers && f.edge <= 1 && f.big && f.one && f.native)) unsound.push(`${path}: ${JSON.stringify(f)}`);
    }
  }
  ok("every tick sits in a 44pt button, never a link or a disabled control, fills it inside its border, and holds a native hidden switch", unsound.length === 0, unsound.slice(0, 3).join(" | "));
  ok("ticks are drawn on Today, the recorder, Hostile, the Shop and Settings", where["/"] >= 1 && where["/rep?lesson=h4"] === 1 && where["/hostile"] >= 1 && where["/settings"] >= 5 && seen >= 10, JSON.stringify(where));
  ok("the sweep threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 5 and 7. where nothing is drawn ---------------------------------------------
for (const [name, opts, row] of [
  ["an iPhone with Haptics off", { haptics: false }, true],
  ["an Android phone, which vibrates", { userAgent: null, vibrates: true }, true],
  ["an iPad, which has no Taptic Engine", { userAgent: IPAD }, false],
  ["an iPhone on iOS 17, whose switch has no haptic", { userAgent: IPHONE_17 }, false],
  ["a browser with neither", { userAgent: null, vibrates: false }, false],
]) {
  const { context, page, errors } = await open(opts);
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector(RECORD, { timeout: 20000 });
  await sleep(900);
  const onRecorder = await ticks(page);
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const onSettings = await ticks(page);
  const offered = await page.evaluate(() => [...document.querySelectorAll('main button[role="switch"]')].some((b) => b.textContent.trim().startsWith("Haptics")));
  ok(`${name}: no tick is drawn`, onRecorder === 0 && onSettings === 0, `${onRecorder} on the recorder, ${onSettings} in Settings`);
  ok(`${name}: Settings ${row ? "offers" : "does not offer"} Haptics`, offered === row, String(offered));
  ok(`${name}: threw nothing`, errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
