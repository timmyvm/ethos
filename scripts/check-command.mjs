/**
 * The command menu, in a real browser, on a keyboard (#438).
 *
 * Ctrl K (⌘K on a Mac) opens a search of every page and action; the
 * digits 1 to 5 open the tabs. This walks what a keyboard is promised:
 * the menu opens with the field focused and the first row lit; the
 * arrows move the lit row and focus never leaves the field; Enter goes;
 * Escape closes and hands focus back; the field is a combobox over a
 * listbox whose lit row it names; a digit opens its tab, and never over
 * a field, under a sheet or on a screen that keeps the keyboard; the
 * menu stays shut on the recorder and the introduction; a theme row
 * changes the theme; a phone sees no hint; and one press never opens
 * two sheets.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-command.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function open({ phone = false, fresh = false } = {}) {
  const context = await browser.newContext({
    ...(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1180, height: 800 } }),
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  if (!fresh) await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { context, page, errors };
}
const go = async (page, path, wait = "main") => {
  await page.goto(`${BASE}${path}`);
  await page.waitForSelector(wait, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(500);
};
const path = (page) => new URL(page.url()).pathname;
const menu = (page) =>
  page.evaluate(() => {
    const sheet = document.querySelector(".command-sheet");
    if (!sheet) return null;
    const input = sheet.querySelector("input");
    const lit = sheet.querySelector('[role="option"][aria-selected="true"]');
    return {
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      label: sheet.closest('[role="dialog"]')?.getAttribute("aria-label"),
      focusInField: document.activeElement === input,
      role: input.getAttribute("role"),
      controls: !!document.getElementById(input.getAttribute("aria-controls") ?? "x")?.matches('[role="listbox"]'),
      active: input.getAttribute("aria-activedescendant"),
      lit: lit?.querySelector("span.truncate, span.flex-1")?.textContent ?? null,
      litId: lit?.id ?? null,
      options: sheet.querySelectorAll('[role="option"]').length,
      heads: [...sheet.querySelectorAll(".command-group")].map((h) => h.textContent),
      keys: [...sheet.querySelectorAll('[role="option"] .keycap')].map((k) => k.textContent),
    };
  });

// ---- 1. opening, moving, going ----------------------------------------------
{
  const { context, page, errors } = await open();
  await go(page, "/you");
  await page.locator('a[href="/settings"]').first().focus();
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-sheet", { timeout: 8000 }).catch(() => {});
  await sleep(700);
  let m = await menu(page);
  ok("Ctrl K opens the menu: one dialog, named", m?.dialogs === 1 && m.label === "Search Ethos", JSON.stringify(m?.label));
  ok("the field has focus and is a combobox over its listbox", !!m?.focusInField && m.role === "combobox" && m.controls);
  ok("the first row is lit and the field names it", m?.lit === "Start today's practice" && m.active === m.litId, `${m?.lit}`);
  ok("the tabs print their keys, 1 to 5", (m?.keys ?? []).join("") === "12345", (m?.keys ?? []).join(","));
  ok("every row is there, under each head once", (m?.options ?? 0) >= 35 && new Set(m.heads).size === m.heads.length, `${m?.options} rows, ${m?.heads.join("/")}`);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  m = await menu(page);
  ok("the arrows move the lit row and focus stays in the field", m?.lit === "Lessons" && m.focusInField && m.active === m.litId, `${m?.lit}`);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  m = await menu(page);
  ok("up from the first row wraps to the last", m?.lit === "Terms", `${m?.lit}`);

  await page.keyboard.type("closed");
  await sleep(200);
  m = await menu(page);
  ok("typing filters and lights the best match", m?.options === 1 && m.lit === "The closed mouth", `${m?.options} rows, ${m?.lit}`);
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => new URL(u).pathname.startsWith("/lessons/"), { timeout: 8000 }).catch(() => {});
  await sleep(900);
  ok("Enter goes there and the menu is gone", path(page).startsWith("/lessons/") && (await menu(page)) === null, path(page));

  // Escape hands focus back to what opened it.
  await go(page, "/you");
  await page.locator('a[href="/settings"]').first().focus();
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-sheet");
  await sleep(600);
  await page.keyboard.type("zzz");
  await sleep(150);
  const none = await page.evaluate(() => document.querySelector(".command-list [role='status']")?.textContent);
  ok("nothing found says so, as a status", /Nothing called “zzz”\./.test(none ?? ""), String(none));
  await page.keyboard.press("Enter");
  ok("Enter on nothing does nothing", (await menu(page)) !== null && path(page) === "/you");
  await page.keyboard.press("Escape");
  await sleep(900);
  const back = await page.evaluate(() => document.activeElement?.getAttribute("href"));
  ok("Escape closes it and focus returns to where it was", (await menu(page)) === null && back === "/settings", String(back));

  // The same keys close it; one press never stacks a second sheet.
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-sheet");
  await sleep(500);
  await page.keyboard.press("Control+k");
  await sleep(900);
  ok("Ctrl K again closes it", (await menu(page)) === null);

  // A pointer lights the row it is over; a click opens it.
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-sheet");
  await sleep(600);
  await page.locator('[data-command="go:shop"]').hover();
  m = await menu(page);
  ok("a pointer lights the row it is over", m?.lit === "Shop");
  await page.locator('[data-command="go:shop"]').click();
  await page.waitForURL((u) => new URL(u).pathname === "/shop", { timeout: 8000 }).catch(() => {});
  ok("and a click opens it", path(page) === "/shop");

  // A theme row changes the theme and stays on the page.
  await go(page, "/you");
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-sheet");
  await sleep(500);
  await page.keyboard.type("dark");
  await sleep(150);
  await page.keyboard.press("Enter");
  await sleep(900);
  const theme = await page.evaluate(() => ({ attr: document.documentElement.dataset.theme, pref: JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}").theme }));
  ok("Theme: Dark turns the page dark and keeps the choice", theme.attr === "dark" && theme.pref === "dark" && path(page) === "/you", JSON.stringify(theme));
  ok("nothing threw", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 2. the tabs by number ---------------------------------------------------
{
  const { context, page } = await open();
  await go(page, "/");
  await page.keyboard.press("4");
  await page.waitForURL((u) => new URL(u).pathname === "/history", { timeout: 8000 }).catch(() => {});
  ok("4 opens the Log", path(page) === "/history", path(page));
  await sleep(500);
  await page.keyboard.press("5");
  await page.waitForURL((u) => new URL(u).pathname === "/you", { timeout: 8000 }).catch(() => {});
  ok("5 opens You", path(page) === "/you", path(page));
  await sleep(600);
  await page.keyboard.press("Shift+2");
  await page.keyboard.press("Alt+2");
  await sleep(400);
  ok("a digit with a modifier is not a tab's key", path(page) === "/you");

  // Never over a field.
  await page.locator('button[aria-label*="name" i], button:has(svg)').first().waitFor({ timeout: 3000 }).catch(() => {});
  await go(page, "/boss");
  await sleep(300);
  await page.keyboard.press("2");
  await sleep(400);
  ok("not on a screen that keeps the keyboard (Boss)", path(page) === "/boss");
  await page.keyboard.press("Control+k");
  await sleep(600);
  ok("and Ctrl K stays shut there", (await menu(page)) === null);

  await go(page, "/settings");
  const field = page.locator('main input[type="text"], main input:not([type])').first();
  if (await field.count()) {
    await field.focus();
    await page.keyboard.press("3");
    await sleep(400);
    ok("a digit typed into a field is typed, not travelled", path(page) === "/settings");
  }

  // Never under a sheet.
  await go(page, "/games?paywall=1", '[role="dialog"]');
  await sleep(700);
  await page.keyboard.press("1");
  await sleep(500);
  ok("a digit under an open sheet goes nowhere", path(page) === "/games" && (await page.locator('[role="dialog"]').count()) === 1);
  await context.close();
}

// ---- 3. where it stays shut --------------------------------------------------
{
  const { context, page } = await open();
  await go(page, "/rep?lesson=h4");
  await page.keyboard.press("Control+k");
  await sleep(700);
  ok("the recorder keeps the keyboard: no menu", (await menu(page)) === null);
  ok("and no hint", (await page.locator(".command-hint").count()) === 0);
  await page.keyboard.press("1");
  await sleep(400);
  ok("and no tab by number", path(page) === "/rep");
  await context.close();
}
{
  const { context, page } = await open({ fresh: true });
  await go(page, "/welcome", "main .intro-stage");
  await page.keyboard.press("Control+k");
  await sleep(700);
  ok("the introduction keeps the keyboard: no menu, no hint", (await menu(page)) === null && (await page.locator(".command-hint").count()) === 0);
  await context.close();
}

// ---- 4. the hint ---------------------------------------------------------------
{
  const { context, page } = await open();
  await go(page, "/");
  const hint = await page.evaluate(() => {
    const h = document.querySelector(".command-hint");
    if (!h) return null;
    const r = h.getBoundingClientRect();
    const column = document.querySelector("main").getBoundingClientRect();
    return { shown: getComputedStyle(h).display !== "none", text: h.textContent, h: r.height, clear: r.left > column.right, keys: h.getAttribute("aria-keyshortcuts") };
  });
  ok("a desktop window shows the hint, outside the column, 44px tall", !!hint?.shown && hint.clear && hint.h >= 44 && /Search/.test(hint.text) && /K/.test(hint.text), JSON.stringify(hint));
  await page.locator(".command-hint").click();
  await page.waitForSelector(".command-sheet", { timeout: 8000 }).catch(() => {});
  ok("and a click on it opens the menu", (await menu(page)) !== null);
  await context.close();
}
{
  const { context, page } = await open({ phone: true });
  await go(page, "/");
  const shown = await page.evaluate(() => {
    const h = document.querySelector(".command-hint");
    return h ? getComputedStyle(h).display !== "none" : false;
  });
  const fetched = await page.evaluate(() => performance.getEntriesByType("resource").some((r) => /CommandSheet/.test(r.name)));
  ok("a phone draws no hint and never fetches the sheet", !shown && !fetched);
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
