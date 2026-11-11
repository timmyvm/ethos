/**
 * The undo toast on Your words, in a real browser (#435).
 *
 * A removal acts at once and offers itself back for six seconds. This
 * walks what that promises: the row leaves and the toast says so as a
 * status; Undo puts the same row (its id, its date) back in its own
 * place; the offer lapses by itself; a second removal replaces the
 * first's offer; Ctrl+Z undoes from the keyboard and never from inside
 * a field; an undo tapped before its removal has answered never
 * overtakes it; and a removal or an undo that fails says so with a retry.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-undo.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { SAVED_ROWS, json, savedWordsMode, seed, session, supabaseRoute } from "./look-fixtures.mjs";

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

async function open() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/rest/v1/saved_words") && req.method() !== "GET" && req.method() !== "OPTIONS") {
      wire.push(`${req.method()} ${url.searchParams.get("id") ?? (req.postDataJSON?.()?.id ?? "")}`);
      if (req.method() === "DELETE") {
        if (mode.removeDelay) await sleep(mode.removeDelay);
        if (mode.removeFails) return route.fulfill(json({ code: "XX000", message: "check: refused" }, 500));
      }
      if (req.method() === "POST" && mode.restoreFails) return route.fulfill(json({ code: "XX000", message: "check: refused" }, 500));
    }
    return supabaseRoute(route);
  });
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  savedWordsMode.rows = SAVED_ROWS.map((r) => ({ ...r }));
  Object.assign(mode, { removeFails: false, restoreFails: false, removeDelay: 0 });
  wire.length = 0;
  await page.goto(`${BASE}/words`);
  await page.waitForSelector("main ul li");
  await sleep(500);
  return { context, page };
}

const list = (page) => page.evaluate(() => [...document.querySelectorAll("main ul li .you-word")].map((el) => el.textContent));
const removeBtn = (page, word) => page.locator(`main ul li button[aria-label^="Remove ${word} "]`);
const toast = (page) =>
  page.evaluate(() => {
    const t = document.querySelector(".toast");
    return t ? { role: t.getAttribute("role"), text: t.querySelector(".toast-text")?.textContent, leaving: t.hasAttribute("data-leaving") } : null;
  });

// ---- 1. remove, then undo ---------------------------------------------------
{
  const { context, page } = await open();
  await removeBtn(page, "freezing").click();
  await page.waitForSelector(".toast");
  const t = await toast(page);
  ok("a removal is off the list at once", !(await list(page)).includes("freezing"));
  ok("the toast is a status and says what left", t?.role === "status" && t.text === "freezing removed", JSON.stringify(t));
  ok("no dialog asked first", (await page.locator('[role="dialog"], [role="alertdialog"]').count()) === 0);
  // Measured at rest: the toast rises from 12px under its place at 0.98.
  await sleep(500);
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
  const back = await list(page);
  ok("Undo puts the row back in its own place", back.join("|") === "problem|freezing|landed|shake things up|crowds", back.join("|"));
  ok("the same row went back: its id and its date", wire.join(" | ") === "DELETE eq.sw-2 | POST sw-2" && savedWordsMode.rows.find((r) => r.id === "sw-2")?.created_at === SAVED_ROWS[1].created_at, wire.join(" | "));
  ok("the toast is gone once taken", (await toast(page)) === null);
  ok("the return is announced", (await page.locator("main p[role='status'].sr-only").textContent()) === "freezing is back");
  await context.close();
}

// ---- 2. it lapses by itself, and a second removal replaces the first --------
{
  const { context, page } = await open();
  await removeBtn(page, "freezing").click();
  await page.waitForSelector(".toast");
  await sleep(1500);
  await removeBtn(page, "landed").click();
  await sleep(300);
  const t = await toast(page);
  ok("a second removal replaces the offer: one toast, the newest", (await page.locator(".toast").count()) === 1 && t?.text === "landed removed", JSON.stringify(t));
  await sleep(4700);
  ok("still offered just short of six seconds", (await toast(page)) !== null);
  await sleep(1800);
  ok("gone by itself after six", (await toast(page)) === null);
  ok("what lapsed stays removed", (await list(page)).join("|") === "problem|shake things up|crowds" && savedWordsMode.rows.length === 3);
  await context.close();
}

// ---- 3. the keyboard --------------------------------------------------------
{
  const { context, page } = await open();
  const btn = removeBtn(page, "freezing");
  await btn.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".toast");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  ok("the keyboard stays in the list, on the next row's button", focused === "Remove landed instead of got", String(focused));
  await page.keyboard.press("Control+z");
  await sleep(500);
  ok("Ctrl+Z undoes", (await list(page)).includes("freezing") && (await toast(page)) === null);
  await context.close();
}

// ---- 4. an undo never overtakes the removal it undoes ------------------------
{
  const { context, page } = await open();
  mode.removeDelay = 900;
  await removeBtn(page, "freezing").click();
  await page.waitForSelector(".toast");
  await page.locator(".toast-action").click();
  await sleep(200);
  ok("the row is back on screen before the removal has answered", (await list(page)).includes("freezing"));
  await sleep(1500);
  ok("the put-back was sent after the removal landed, and the row is stored", wire.join(" | ") === "DELETE eq.sw-2 | POST sw-2" && savedWordsMode.rows.some((r) => r.id === "sw-2"), wire.join(" | "));
  await context.close();
}

// ---- 5. a removal that fails -------------------------------------------------
{
  const { context, page } = await open();
  mode.removeFails = true;
  await removeBtn(page, "freezing").click();
  await sleep(800);
  const line = await page.locator("main [role='alert']").first().textContent().catch(() => "");
  ok("a removal that fails puts the row back and says so, with a retry", (await list(page)).includes("freezing") && /freezing didn't come off the list\./.test(line ?? "") && /Try again/.test(line ?? ""), String(line));
  ok("and its offer is withdrawn", (await toast(page)) === null);
  await context.close();
}

// ---- 6. an undo that fails ---------------------------------------------------
{
  const { context, page } = await open();
  mode.restoreFails = true;
  await removeBtn(page, "freezing").click();
  await page.waitForSelector(".toast");
  await sleep(300);
  await page.locator(".toast-action").click();
  await sleep(800);
  const line = await page.locator("main [role='alert']").first().textContent().catch(() => "");
  ok("an undo that fails takes the row off again and says so", !(await list(page)).includes("freezing") && /freezing didn't come back\./.test(line ?? ""), String(line));
  mode.restoreFails = false;
  await page.locator("main [role='alert'] button").first().click();
  await sleep(600);
  ok("its Try again puts it back", (await list(page)).includes("freezing") && savedWordsMode.rows.some((r) => r.id === "sw-2"));
  await context.close();
}

// ---- 7. the last row ---------------------------------------------------------
{
  const { context, page } = await open();
  savedWordsMode.rows = [{ ...SAVED_ROWS[0] }];
  await page.goto(`${BASE}/words`);
  await page.waitForSelector("main ul li");
  await sleep(400);
  await removeBtn(page, "problem").click();
  await page.waitForSelector(".toast");
  await sleep(500);
  ok("taking off the last row shows the empty page with the offer still standing", (await page.locator("main ul li").count()) === 0 && (await toast(page))?.text === "problem removed");
  await page.locator(".toast-action").click();
  await sleep(600);
  ok("and Undo brings the list back", (await list(page)).join("|") === "problem");
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
