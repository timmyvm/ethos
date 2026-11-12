/**
 * Show / Hide on every password field (#463), in a real browser: sign-up
 * and sign-in, light and dark. The button sits inside the field at 44px,
 * is named "Show password", shows the password without taking the focus
 * or moving the caret, says Hide, hides again, and sending the form puts
 * the dots back so a password manager sees a password field.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-show-password.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { supabaseRoute } = await import("./look-fixtures.mjs");
const OUT = process.env.SHOTS ?? null;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const check = [];
const ok = (n, p, d = "") => { check.push(p); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); };
for (const theme of ["light", "dark"]) for (const path of ["/signup", "/signin"]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: theme });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript((theme) => { localStorage.setItem("ethos.prefs", JSON.stringify({ theme })); const c = document.createElement("style"); c.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(c)); }, theme);
  const page = await context.newPage();
  await page.goto(BASE + path);
  const field = page.locator("#password");
  await field.waitFor({ timeout: 30000 });
  await page.fill("#email", "tim@example.com");
  await field.fill("my red bike");
  await field.focus();
  await page.evaluate(() => document.querySelector("#password").setSelectionRange(3, 3));
  const btn = page.locator("[data-show-password]");
  const b = await btn.boundingBox(); const f = await field.boundingBox();
  ok(`${theme} ${path}: Show sits inside the field, 44px tall`, b.height >= 44 && b.x + b.width <= f.x + f.width + 0.5 && b.y >= f.y - 0.5, `${Math.round(b.width)}x${Math.round(b.height)}`);
  ok(`${theme} ${path}: named Show password`, (await btn.getAttribute("aria-label")) === "Show password" && (await btn.textContent()) === "Show");
  await page.waitForTimeout(400);
  if (OUT) await page.screenshot({ path: `${OUT}/show-hidden-${path.slice(1)}-${theme}.png`, clip: { x: 0, y: f.y - 40, width: 390, height: 140 } });
  await btn.tap();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ type: document.querySelector("#password").type, focused: document.activeElement?.id, caret: document.querySelector("#password").selectionStart }));
  ok(`${theme} ${path}: a tap shows it, keeps the focus and the caret`, after.type === "text" && after.focused === "password" && after.caret === 3, JSON.stringify(after));
  ok(`${theme} ${path}: the button now says Hide`, (await btn.textContent()) === "Hide" && (await btn.getAttribute("aria-pressed")) === "true");
  if (OUT) await page.screenshot({ path: `${OUT}/show-shown-${path.slice(1)}-${theme}.png`, clip: { x: 0, y: f.y - 40, width: 390, height: 140 } });
  const text = await field.evaluate((el) => { const cs = getComputedStyle(el); return { pr: cs.paddingRight }; });
  ok(`${theme} ${path}: typed text stops before the button`, parseFloat(text.pr) >= b.width, text.pr);
  await btn.tap();
  ok(`${theme} ${path}: and hides again`, (await field.getAttribute("type")) === "password");
  await btn.tap();
  await page.locator("form").evaluate((f) => f.requestSubmit());
  await page.waitForTimeout(300);
  ok(`${theme} ${path}: sending the form puts the dots back`, (await page.locator("#password").getAttribute("type").catch(() => "password")) === "password");
  await context.close();
}
await browser.close();
console.log(`${check.filter(Boolean).length}/${check.length} passed`);
process.exit(check.every(Boolean) ? 0 : 1);
