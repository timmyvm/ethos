/**
 * The three taps, photographed (#459; Timothy, 12 Nov: "8 for home and
 * 10 for feedback", from the ten directions in docs/look/buttons).
 *
 * A tap has no colour of its own: ink on the page, cut from the card on
 * a coloured card, and with an arrow where it moves you on. This shoots
 * what a still of one screen cannot show:
 *
 *   today-families-<theme>.jpg  Today's card in each of the five trait
 *                               families and with no colour yet, so the
 *                               tonal Start is seen on every colour.
 *   states-<theme>.jpg          each tap at rest, pressed and focused
 *                               from the keyboard: Today's Start, an ink
 *                               tap (Lessons), Record, and the results'
 *                               way on at 390 and at 320.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/look-taps.mjs
 *
 * Out: LOOK_OUT, default docs/look/taps/. LOOK_THEMES narrows a run.
 * Every screen in the app with a main tap is `scripts/look.mjs`'s job;
 * `scripts/sheet.mjs` lays its shots out side by side.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync, rmSync } from "node:fs";
const F = await import("./look-fixtures.mjs");

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/taps/", import.meta.url).pathname).replace(/\/?$/, "/");
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAMILIES = [
  ["pause", "Pausing"],
  ["fillers", "Fillers"],
  ["repairs", "Restarts"],
  ["pace", "Pace"],
  ["range", "Variety"],
  ["none", "No colour yet"],
];

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

/** Lay shots out in one image: `cols` to a row, each under its name. */
const sheets = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
async function lay(cells, cols, width, name, ground) {
  const page = await sheets.newPage();
  const cell = (c) =>
    `<div><div style="font:600 14px ui-sans-serif,system-ui,sans-serif;color:${ground === "dark" ? "#bbb" : "#444"};margin-bottom:6px">${c.label}</div><img src="data:image/png;base64,${readFileSync(c.file).toString("base64")}" style="display:block;width:${width}px;border-radius:12px"></div>`;
  await page.setContent(
    `<body style="margin:0"><div id="s" style="display:grid;grid-template-columns:repeat(${cols},${width}px);gap:16px 12px;background:${ground === "dark" ? "#2a2a2a" : "#dcdcdc"};padding:14px;width:max-content">${cells.map(cell).join("")}</div></body>`
  );
  await page.locator("#s").screenshot({ path: `${OUT}${name}`, type: "jpeg", quality: 86 });
  await page.close();
  for (const c of cells) rmSync(c.file, { force: true });
}

for (const theme of THEMES) {
  F.resetPlan("free");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    permissions: ["microphone", "camera", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/analyze", async (route) => {
    await sleep(1200);
    await route.fulfill(F.json(F.analyzeBody));
  });
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.route("**/api/words", (r) => r.fulfill(F.json({ alternatives: ["point", "idea", "claim"], source: "model" })));
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.addInitScript(F.seed, { theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const d = new Date();
    localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 900)));

  /** A shot of `selector` with `pad` px of the screen around it. */
  let n = 0;
  const crop = async (selector, pad = 14) => {
    const box = await page.locator(selector).first().boundingBox();
    const file = `${OUT}.${theme}-${n++}.png`;
    const [px, py] = Array.isArray(pad) ? pad : [pad, pad];
    await page.screenshot({
      path: file,
      clip: {
        x: Math.max(0, box.x - px),
        y: Math.max(0, box.y - py),
        width: Math.min(page.viewportSize().width, box.width + px * 2),
        height: box.height + py * 2,
      },
    });
    return file;
  };
  /** Rest, pressed (a pointer held down on it) and focused from the keyboard. */
  const states = async (selector, name, pad) => {
    const el = page.locator(selector).first();
    // Not Playwright's own scroll: it waits for the element to hold
    // still, and Record breathes (DESIGN.md, the tools' gotchas).
    await el.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await sleep(250);
    const out = [{ label: `${name}: at rest`, file: await crop(selector, pad) }];
    const box = await el.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await sleep(260);
    out.push({ label: "pressed", file: await crop(selector, pad) });
    // Let go somewhere else, so the press presses nothing.
    await page.mouse.move(2, 2);
    await page.mouse.up();
    await sleep(350);
    await el.evaluate((node) => node.blur());
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      if (await el.evaluate((node) => node === document.activeElement)) break;
    }
    await sleep(200);
    out.push({ label: "focused", file: await crop(selector, pad) });
    await el.evaluate((node) => node.blur());
    return out;
  };

  /* ---- Today: the tonal Start on every family ----------------------------- */
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main .home-start", { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector("main .skeleton"), null, { timeout: 30000 }).catch(() => {});
  await sleep(1800);
  const families = [];
  for (const [family, label] of FAMILIES) {
    await page.evaluate((f) => (document.querySelector(".home-hero").dataset.family = f), family);
    await sleep(700);
    families.push({ label, file: await crop(".home-hero", [14, 44]) });
  }
  await page.evaluate(() => (document.querySelector(".home-hero").dataset.family = "pause"));
  await sleep(500);
  await lay(families, 3, 360, `today-families-${theme}.jpg`, theme);

  const cells = [];
  cells.push(...(await states(".home-start", "On a coloured card (Today)", [40, 26])));

  /* ---- An ink tap on the page -------------------------------------------- */
  await page.goto(`${BASE}/lessons`);
  await page.waitForSelector("main .tap", { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector("main .skeleton"), null, { timeout: 30000 }).catch(() => {});
  await sleep(1200);
  cells.push(...(await states("main .tap", "On the page (Lessons)", [20, 26])));

  /* ---- Record, then the results' way on ----------------------------------- */
  // In from Today, as a person comes: the recording screen is told
  // what to play by the link that opens it.
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main .home-start", { timeout: 60000 });
  await sleep(1500);
  await page.locator("main .home-start").first().click();
  await page.waitForSelector('button[data-record="start"]', { timeout: 60000 });
  await sleep(1500);
  cells.push(...(await states('button[data-record="start"]', "Record", [120, 26])));
  await page.click('button[data-record="start"]', { force: true });
  await page.waitForSelector('button[data-record="stop"]', { timeout: 20000 });
  await sleep(5000);
  await page.click('button[data-record="stop"]', { force: true });
  await page.waitForSelector("main [data-step-action]", { state: "visible", timeout: 45000 });
  await sleep(3400);
  cells.push(...(await states("main [data-step-action]", "The way on (results)", [20, 26])));
  await lay(cells, 3, 390, `states-${theme}.jpg`, theme);

  /* The same tap on the narrowest phone, where its words have least room. */
  await page.setViewportSize({ width: 320, height: 700 });
  await sleep(600);
  const narrow = [{ label: "The way on at 320", file: await crop("main [data-step-action]", [20, 26]) }];
  await lay(narrow, 1, 320, `way-on-320-${theme}.jpg`, theme);
  console.log(`${theme}: families, states and the 320 shot written`);
  await context.close();
}
await browser.close();
