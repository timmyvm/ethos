/**
 * The undo toast on Say it better, in a real browser (#435, #507).
 *
 * A removal acts at once and offers itself back for six seconds. It is
 * made from a swap's sheet: Remove closes the sheet, the row leaves and
 * the toast says so as a status. This walks what that promises: Undo
 * puts the same swap (its id, its date) back in its own place; the offer
 * lapses by itself; a second removal replaces the first's offer; the
 * keyboard lands on the next row and Ctrl+Z undoes, never from inside a
 * field; an undo tapped before its removal has answered never overtakes
 * it; a removal or an undo that fails says so with a retry; and a coach's
 * pair, which has no row of its own to take off, is hidden and shown
 * again through the test's table.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-undo.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { SAY_SAVED, json, sayMode, savedWordsMode, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
/** What the table does to a write: refuse it, or hold it. */
const mode = { removeFails: false, restoreFails: false, removeDelay: 0 };
const wire = [];
/** "very cold → freezing", saved from a transcript: a row of saved_words. */
const FREEZING = SAY_SAVED[0].id;

async function open() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/rest/v1/saved_words") && req.method() !== "GET" && req.method() !== "OPTIONS") {
      wire.push(`${req.method()} ${(url.searchParams.get("id") ?? (req.postDataJSON?.()?.id ?? "")).replace(/^eq\./, "")}`);
      if (req.method() === "DELETE") {
        if (mode.removeDelay) await sleep(mode.removeDelay);
        if (mode.removeFails) return route.fulfill(json({ code: "XX000", message: "check: refused" }, 500));
      }
      if (req.method() === "POST" && mode.restoreFails) return route.fulfill(json({ code: "XX000", message: "check: refused" }, 500));
    }
    return supabaseRoute(route);
  });
  await context.route("**/api/audio**", (route) => route.fulfill(json({ error: "Not here." }, 404)));
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  Object.assign(sayMode, { on: true, dry: false, empty: false, table: "ok", written: [] });
  savedWordsMode.rows = SAY_SAVED.map((r) => ({ ...r }));
  savedWordsMode.fail = false;
  Object.assign(mode, { removeFails: false, restoreFails: false, removeDelay: 0 });
  wire.length = 0;
  await page.goto(`${BASE}/say`);
  await page.waitForSelector("[data-say-list='learning'] [data-say-row]", { timeout: 30000 });
  await sleep(500);
  return { context, page };
}

/** The better phrases a list shows, top to bottom (as seen: the pair's spoken "say" is for screen readers). */
const list = (page, which) =>
  page.evaluate(
    (w) => [...document.querySelectorAll(`[data-say-list='${w}'] .you-word`)].map((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim()),
    which
  );
const row = (page, better) => page.locator("[data-say-row]").filter({ has: page.locator(".you-word", { hasText: new RegExp(`(^|\\s)${better}$`) }) });
/** Open a swap's sheet from its row, and Remove from it. */
async function removeFromSheet(page, better) {
  await row(page, better).click();
  await page.waitForSelector("[data-say-remove]");
  await sleep(500);
  await page.locator("[data-say-remove]").click();
}
const toast = (page) =>
  page.evaluate(() => {
    const t = document.querySelector(".toast");
    return t ? { role: t.getAttribute("role"), text: t.querySelector(".toast-text")?.textContent, leaving: t.hasAttribute("data-leaving") } : null;
  });

// ---- 1. remove, then undo ---------------------------------------------------
{
  const { context, page } = await open();
  const before = await list(page, "learning");
  await removeFromSheet(page, "freezing");
  await page.waitForSelector(".toast");
  const t = await toast(page);
  ok("Remove closes the sheet and the swap is off the list at once", (await page.locator("[data-say-sheet]").count()) === 0 || !(await list(page, "learning")).includes("freezing"));
  await sleep(600);
  ok("the sheet has gone and so has the row", (await page.locator("[data-say-sheet]").count()) === 0 && !(await list(page, "learning")).includes("freezing"), (await list(page, "learning")).join("|"));
  ok("the toast is a status and says what left", t?.role === "status" && t.text === "freezing removed", JSON.stringify(t));
  ok("no dialog asked first", (await page.locator('[role="alertdialog"]').count()) === 0);
  const box = await page.evaluate(() => {
    const a = document.querySelector(".toast-action");
    const hit = getComputedStyle(a, "::after");
    const r = a.getBoundingClientRect();
    const nav = document.querySelector(".nav-glass").getBoundingClientRect();
    const tr = document.querySelector(".toast").getBoundingClientRect();
    return { hitH: r.height + 8, hitW: r.width + 4, after: hit.content !== "none", gap: Math.round(nav.top - tr.bottom), inColumn: tr.left >= 20 && tr.right <= 370 };
  });
  ok("Undo is a 44px target, and the toast floats over the tab bar inside the column", box.hitH >= 44 && box.hitW >= 44 && box.after && box.gap >= 8 && box.inColumn, JSON.stringify(box));
  await page.locator(".toast-action").click();
  await sleep(500);
  const back = await list(page, "learning");
  ok("Undo puts the swap back in its own place", back.join("|") === before.join("|"), `${back.join("|")} (was ${before.join("|")})`);
  ok(
    "the same row went back: its id and its date",
    wire.join(" | ") === `DELETE ${FREEZING} | POST ${FREEZING}` && savedWordsMode.rows.find((r) => r.id === FREEZING)?.created_at === SAY_SAVED[0].created_at,
    wire.join(" | ")
  );
  ok("the toast is gone once taken", (await toast(page)) === null);
  ok("the return is announced", (await page.locator("main p[role='status'].sr-only").textContent()) === "freezing is back");
  await context.close();
}

// ---- 2. it lapses by itself, and a second removal replaces the first --------
{
  const { context, page } = await open();
  await removeFromSheet(page, "freezing");
  await page.waitForSelector(".toast");
  await sleep(1500);
  await removeFromSheet(page, "landed");
  /* The swap comes off as its sheet goes, and the toast with it. */
  await page.waitForFunction(() => document.querySelector(".toast-text")?.textContent === "landed removed", null, { timeout: 3000 }).catch(() => {});
  await sleep(100);
  const t = await toast(page);
  ok("a second removal replaces the offer: one toast, the newest", (await page.locator(".toast").count()) === 1 && t?.text === "landed removed", JSON.stringify(t));
  await sleep(4200);
  ok("still offered just short of six seconds", (await toast(page)) !== null);
  await sleep(2300);
  ok("gone by itself after six", (await toast(page)) === null);
  ok(
    "what lapsed stays removed",
    !(await list(page, "learning")).includes("freezing") && !(await list(page, "now")).includes("landed") && savedWordsMode.rows.length === 1,
    `${savedWordsMode.rows.length} saved`
  );
  await context.close();
}

// ---- 3. the keyboard --------------------------------------------------------
{
  const { context, page } = await open();
  await row(page, "freezing").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-say-remove]");
  await sleep(500);
  await page.locator("[data-say-remove]").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".toast");
  await sleep(700);
  const focused = await page.evaluate(() => {
    const w = document.activeElement?.querySelector?.(".you-word");
    return w ? [...w.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() : document.activeElement?.tagName;
  });
  ok("the keyboard lands on the next row once the sheet has gone", focused === "heavy rain", String(focused));
  await page.keyboard.press("Control+z");
  await sleep(500);
  ok("Ctrl+Z undoes", (await list(page, "learning")).includes("freezing") && (await toast(page)) === null);
  await context.close();
}

// ---- 4. an undo never overtakes the removal it undoes ------------------------
{
  const { context, page } = await open();
  mode.removeDelay = 900;
  await removeFromSheet(page, "freezing");
  await page.waitForSelector(".toast");
  await page.locator(".toast-action").click();
  await sleep(200);
  ok("the swap is back on screen before the removal has answered", (await list(page, "learning")).includes("freezing"));
  await sleep(1500);
  ok(
    "the put-back was sent after the removal landed, and the row is stored",
    wire.join(" | ") === `DELETE ${FREEZING} | POST ${FREEZING}` && savedWordsMode.rows.some((r) => r.id === FREEZING),
    wire.join(" | ")
  );
  await context.close();
}

// ---- 5. a removal that fails -------------------------------------------------
{
  const { context, page } = await open();
  mode.removeFails = true;
  await removeFromSheet(page, "freezing");
  await sleep(1000);
  const line = await page.locator("main [role='alert']").first().textContent().catch(() => "");
  ok(
    "a removal that fails puts the swap back and says so, with a retry",
    (await list(page, "learning")).includes("freezing") && /freezing didn't come off the list\./.test(line ?? "") && /Try again/.test(line ?? ""),
    String(line)
  );
  ok("and its offer is withdrawn", (await toast(page)) === null);
  await context.close();
}

// ---- 6. an undo that fails ---------------------------------------------------
{
  const { context, page } = await open();
  mode.restoreFails = true;
  await removeFromSheet(page, "freezing");
  await page.waitForSelector(".toast");
  await sleep(300);
  await page.locator(".toast-action").click();
  await sleep(800);
  const line = await page.locator("main [role='alert']").first().textContent().catch(() => "");
  ok("an undo that fails takes the swap off again and says so", !(await list(page, "learning")).includes("freezing") && /freezing didn't come back\./.test(line ?? ""), String(line));
  mode.restoreFails = false;
  await page.locator("main [role='alert'] button").first().click();
  await sleep(600);
  ok("its Try again puts it back", (await list(page, "learning")).includes("freezing") && savedWordsMode.rows.some((r) => r.id === FREEZING));
  await context.close();
}

// ---- 7. a coach's pair: hidden through the test's table, and back -----------
{
  const { context, page } = await open();
  await removeFromSheet(page, "heavy rain");
  await page.waitForSelector(".toast");
  await sleep(500);
  const off = sayMode.written.filter((w) => /^c:/.test(w.swap ?? "")).pop();
  ok("a coach's pair comes off the list and its state says hidden", !(await list(page, "learning")).includes("heavy rain") && off?.hidden === true, JSON.stringify(off));
  await page.locator(".toast-action").click();
  await sleep(700);
  const on = sayMode.written.filter((w) => /^c:/.test(w.swap ?? "")).pop();
  ok("Undo shows it again, same place, its test day kept", (await list(page, "learning")).includes("heavy rain") && on?.hidden === false && on?.due === off?.due, JSON.stringify(on));
  ok("the coach's own row was never touched", !wire.some((w) => w.startsWith("DELETE") && !w.includes(FREEZING)));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
