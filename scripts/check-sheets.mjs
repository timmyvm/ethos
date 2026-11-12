/**
 * Sheets and confirms, in a real browser (#445).
 *
 * Four things a phone's own sheets and alerts do, that ours did not:
 *
 *   1. A confirm opens where it can be read and used. "Delete my
 *      account" is the last row of Settings, and its confirm opened
 *      under the tab bar with both buttons below the screen. It comes
 *      into view whole, its field takes the focus, the way back leads
 *      and the deletion trails, Return deletes nothing, and backing out
 *      puts the focus back on the row.
 *   2. Every way out of a sheet is the same way out. The paywall's "Not
 *      yet" cut to nothing where Escape, the scrim and a pull all send
 *      the sheet back down.
 *   3. A sheet that goes down keeps what was typed into it. A code typed
 *      and not sent is still in its field when the sheet comes back.
 *   4. In dark, a sheet stands one step up from the page under it.
 *
 * (The streak moment leaving on a tap is checked where the take that
 * raises it already is: scripts/check-motion.mjs.)
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-sheets.mjs
 *   SHOTS=docs/look/hig node scripts/check-sheets.mjs
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

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

async function open({ theme = "light", width = 390, height = 844 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/analyze", async (route) => {
    await sleep(500);
    return route.fulfill(json(analyzeBody));
  });
  const deletes = { n: 0 };
  // Counted, never run: this gate must not be able to delete anything.
  await context.route("**/api/account", (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deletes.n += 1;
    return route.fulfill(json({ error: "The gate does not delete." }, 500));
  });
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { context, page, errors, deletes };
}

const settle = async (page) => {
  await page.waitForSelector("main");
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(500);
};

// ---- 1. the delete confirm --------------------------------------------------
for (const [name, width, height] of [["390", 390, 844], ["320", 320, 568]]) {
  const { context, page, errors, deletes } = await open({ width, height });
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const door = page.getByRole("button", { name: "Delete my account" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(250);
  await door.tap();
  // The scroll is smooth: let it land.
  await sleep(900);
  const at = await page.evaluate(() => {
    const field = document.getElementById("delete-confirm");
    const card = field?.closest(".card");
    const nav = document.querySelector("nav");
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left };
    };
    const buttons = [...(card?.querySelectorAll("button") ?? [])].map((b) => ({
      text: b.textContent?.trim(), disabled: b.disabled, ...rect(b),
    }));
    return {
      focused: document.activeElement?.id ?? null,
      card: card ? rect(card) : null,
      navTop: nav ? nav.getBoundingClientRect().top : innerHeight,
      buttons,
    };
  });
  ok(`${name}: the confirm opens whole, above the tab bar`, !!at.card && at.card.top >= 0 && at.card.bottom <= at.navTop + 0.5, JSON.stringify({ card: at.card, navTop: at.navTop }));
  ok(`${name}: its field has the focus`, at.focused === "delete-confirm", String(at.focused));
  const [first, second] = at.buttons;
  ok(
    `${name}: the way back leads, the deletion trails`,
    at.buttons.length === 2 && first.text === "Keep it" && second.text === "Delete everything" && first.left < second.left,
    at.buttons.map((b) => b.text).join(" | ")
  );
  ok(`${name}: nothing deletes until DELETE is typed`, second?.disabled === true && first?.disabled === false);
  if (SHOTS && name === "390") await page.screenshot({ path: `${SHOTS}delete-confirm-after-light.png` });

  // Return puts the keyboard away. It is never the deletion.
  await page.keyboard.type("DELETE");
  await page.keyboard.press("Enter");
  await sleep(300);
  const afterReturn = await page.evaluate(() => ({
    focused: document.activeElement?.id ?? null,
    still: !!document.getElementById("delete-confirm"),
  }));
  ok(`${name}: Return leaves the field and deletes nothing`, afterReturn.still && afterReturn.focused !== "delete-confirm" && deletes.n === 0, JSON.stringify({ ...afterReturn, deletes: deletes.n }));

  await page.getByRole("button", { name: "Keep it" }).tap();
  await sleep(250);
  const back = await page.evaluate(() => ({
    gone: !document.getElementById("delete-confirm"),
    focused: document.activeElement?.textContent?.trim() ?? null,
  }));
  ok(`${name}: backing out returns the focus to the row that opened it`, back.gone && back.focused === "Delete my account", JSON.stringify(back));

  // What was typed is not kept for the next time: an armed DELETE is a trap.
  await door.tap();
  await sleep(400);
  const again = await page.evaluate(() => document.getElementById("delete-confirm")?.value ?? null);
  ok(`${name}: opened again, the field is empty`, again === "", JSON.stringify(again));
  await page.keyboard.press("Escape");
  await sleep(250);
  ok(`${name}: Escape backs out too`, await page.evaluate(() => !document.getElementById("delete-confirm")));
  ok(`${name}: threw nothing`, errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 2 and 3. the paywall's own way out, and what was typed ------------------
{
  const { context, page, errors } = await open();
  const openPaywall = async () => {
    await page.click(".premium-wall", { force: true });
    await page.waitForSelector('[role="dialog"] [role="slider"]', { timeout: 8000 });
    await sleep(900);
  };
  await page.goto(`${BASE}/games`);
  await settle(page);
  await openPaywall();
  /* The page keeps its own clock, from the tap to the dialog leaving the
     DOM: a sheet that plays its exit is there for the spring's length. */
  await page.evaluate(() => {
    const t = (window.__exit = {});
    document.addEventListener("click", () => { t.tap = performance.now(); }, { capture: true, once: true });
    const mo = new MutationObserver(() => {
      if (t.tap !== undefined && !document.querySelector("[role=dialog]")) { t.gone = performance.now(); mo.disconnect(); }
    });
    mo.observe(document.body, { subtree: true, childList: true });
  });
  await page.locator('[role="dialog"] button', { hasText: /^Not yet$/ }).click();
  const closing = await page
    .waitForSelector('[role="dialog"] .sheet-panel[data-closing="true"]', { timeout: 400 })
    .then(() => true)
    .catch(() => false);
  ok('"Not yet" sends the sheet back down, still mounted while it goes', closing);
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 2000 }).catch(() => {});
  const ms = await page.evaluate(() => Math.round((window.__exit.gone ?? NaN) - (window.__exit.tap ?? NaN)));
  ok("and it is gone once the exit has played", ms > 150 && ms < 900, `${ms}ms`);
  const focus = await page.evaluate(() => document.activeElement?.closest(".premium-wall") !== null || document.activeElement?.classList.contains("premium-wall"));
  ok("focus returns to what opened it", focus === true);

  // A code typed, the sheet sent down, the sheet back up: the code is there.
  await openPaywall();
  const live = (await page.locator('[role="dialog"] button', { hasText: "I have a code" }).count()) > 0;
  const toCode = () =>
    live
      ? page.locator('[role="dialog"] button', { hasText: "I have a code" }).click()
      : page.locator('[role="dialog"] button', { hasText: /^Start at/ }).click();
  await toCode();
  await page.waitForSelector("#premium-code", { timeout: 4000 });
  await page.fill("#premium-code", "ETHOS-FRIEND");
  const attrs = await page.$eval("#premium-code", (el) => ({
    autocorrect: el.getAttribute("autocorrect"), autocapitalize: el.getAttribute("autocapitalize"), spellcheck: el.getAttribute("spellcheck"),
  }));
  ok("the code's field corrects, capitalises and spell-checks nothing", attrs.autocorrect === "off" && attrs.autocapitalize === "off" && attrs.spellcheck === "false", JSON.stringify(attrs));
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 2000 });
  await sleep(300);
  await openPaywall();
  await toCode();
  await page.waitForSelector("#premium-code", { timeout: 4000 });
  const kept = await page.$eval("#premium-code", (el) => el.value);
  ok("a code typed and not sent is still there when the sheet comes back", kept === "ETHOS-FRIEND", JSON.stringify(kept));
  if (SHOTS) {
    await sleep(500);
    await page.screenshot({ path: `${SHOTS}paywall-code-kept-after-light.png` });
  }
  ok("the paywall threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 4. in dark, the results sheet stands a step up from the page ------------
for (const theme of ["dark", "light"]) {
  const { context, page } = await open({ theme });
  await page.goto(`${BASE}/rep?lesson=h4`);
  await page.waitForSelector('button[data-record="start"]', { timeout: 20000 });
  await sleep(700);
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 15000 });
  await sleep(2800);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main [data-glance-door]", { timeout: 20000 });
  await sleep(1500);
  await page.locator("main [data-glance-door]").click();
  await page.waitForSelector("[data-whole-recording]", { timeout: 4000 });
  await sleep(900);
  const tone = await page.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return Math.round(0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]);
    };
    const sheet = document.querySelector("[data-whole-recording]");
    const card = sheet.querySelector(".card");
    return {
      page: lum(getComputedStyle(document.body).backgroundColor),
      sheet: lum(getComputedStyle(sheet).backgroundColor),
      card: card ? lum(getComputedStyle(card).backgroundColor) : null,
    };
  });
  if (theme === "dark") {
    ok("dark: the sheet is lighter than the page, and its cards lighter again", tone.sheet > tone.page && tone.card !== null && tone.card > tone.sheet, JSON.stringify(tone));
  } else {
    ok("light: the sheet keeps the ground's white (its shadow lifts it)", tone.sheet === tone.page, JSON.stringify(tone));
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}every-number-after-${theme}.png` });
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
