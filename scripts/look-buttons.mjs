/**
 * Ten ways to draw the one tap (Timothy, 12 Nov: "the orange button is
 * ugly ... a futuristic gradient 3D against a flat button ... show me
 * heaps of different button styles ... just the home screen and the
 * first feedback screen").
 *
 * Kept as the record of the choice. Timothy picked 8 for Home and 10
 * for the feedback screen, and #437 shipped them (lib/ui.ts, `.tap`,
 * `.tap-tonal`; `scripts/look-taps.mjs` shoots the result). Run again
 * now, "As it ships" is drawn from the app as it is today, not from the
 * terracotta pill its note describes.
 *
 * Nothing in the app changes. The camera opens Today, then walks a take
 * to its results, and on each screen swaps a stylesheet that redraws
 * only the main tap (Today's Start, the results' way on), shooting each
 * direction on the real screen with everything else as it ships.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/look-buttons.mjs
 *
 * Out: LOOK_OUT, default docs/look/buttons/. One image per direction,
 * home beside results, numbered and named, and `overview.png` with the
 * ten cropped to the button so they can be compared at a glance.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const F = await import("./look-fixtures.mjs");

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/buttons/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HOME = ".home-start";
const TAP = "main [data-step-action]";
const BOTH = `:is(${HOME}, ${TAP})`;
const svg = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${body}</svg>`)}")`;
const ARROW = (stroke) => svg(`<path d='M5 12h14M13 6l6 6-6 6' fill='none' stroke='${stroke}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>`);
const PLAY = (fill) => svg(`<path d='M8 5.5v13l11-6.5z' fill='${fill}'/>`);

/**
 * The ten. Three keep terracotta and change what it is made of, four
 * go neutral and leave the colour to the card, one takes its colour
 * from the lesson, two change the shape. `css` is written for
 * `html[data-tap="<id>"]`, which `&` stands for.
 */
const DIRECTIONS = [
  {
    id: "ember",
    name: "Ember",
    note: "Terracotta, lit. Hotter orange, a white label, light on its top edge and its own glow under it.",
    css: `& ${BOTH} { background: linear-gradient(180deg, #ff8f52 0%, #ee5f27 100%) !important; color: #fff !important;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 -1px 0 rgb(0 0 0 / 0.14), 0 12px 24px -10px rgb(238 95 39 / 0.75) !important; }`,
  },
  {
    id: "apricot",
    name: "Apricot",
    note: "Terracotta, lightened. The same family three steps paler, ink label: soft where the orange was heavy.",
    css: `& ${BOTH} { background: #f8cda9 !important; color: #2a1a10 !important;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7), 0 10px 20px -12px rgb(0 0 0 / 0.4) !important; }`,
  },
  {
    id: "lip",
    name: "Lip",
    note: "Terracotta as an object. A hard lower edge, like the path's tiles: a thing you press, not a sticker.",
    css: `& ${BOTH} { background: #d97a3e !important; color: #1f1410 !important; transform: translateY(-2px);
      box-shadow: 0 4px 0 #a2521f, 0 12px 18px -10px rgb(0 0 0 / 0.35) !important; }`,
  },
  {
    id: "white",
    name: "White",
    note: "No colour of its own. White on the card, ink on the page: whatever stands out most where it sits.",
    css: `& ${HOME} { background: #fff !important; color: #1b1a19 !important;
      box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.06), 0 10px 22px -10px rgb(0 0 0 / 0.5) !important; }
    & ${TAP} { background: #1b1a19 !important; color: #fff !important; box-shadow: none !important; }`,
  },
  {
    id: "ink",
    name: "Ink",
    note: "Near-black everywhere, white label. The card keeps all the colour; the tap is the darkest thing on it.",
    css: `& ${BOTH} { background: #151517 !important; color: #fff !important;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.16), 0 10px 20px -10px rgb(0 0 0 / 0.55) !important; }`,
  },
  {
    id: "cream",
    name: "Cream",
    note: "Warm paper, ink label. White's quiet with the brand's warmth left in.",
    css: `& ${HOME} { background: #f7efe3 !important; color: #2a211b !important;
      box-shadow: inset 0 1px 0 #fff, 0 10px 22px -10px rgb(0 0 0 / 0.5) !important; }
    & ${TAP} { background: #f4eadb !important; color: #2a211b !important;
      box-shadow: inset 0 0 0 1px rgb(70 45 20 / 0.14), 0 8px 16px -10px rgb(70 45 20 / 0.35) !important; }`,
  },
  {
    id: "mark",
    name: "White, terracotta mark",
    note: "Terracotta shrinks to a signal: a small play mark on a white tap (ink on the page).",
    css: `& ${BOTH} { display: flex !important; align-items: center; justify-content: center; gap: 10px; }
    & ${BOTH}::before { content: ""; width: 22px; height: 22px; flex: none; border-radius: 999px;
      background: #c9642c ${PLAY("#fff")} 58% 50% / 12px no-repeat; }
    & ${HOME} { background: #fff !important; color: #1b1a19 !important;
      box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.06), 0 10px 22px -10px rgb(0 0 0 / 0.5) !important; }
    & ${TAP} { background: #1b1a19 !important; color: #fff !important; box-shadow: none !important; }`,
  },
  {
    id: "tonal",
    name: "Tonal",
    note: "The lesson's own colour. A pale tint of the card on the card, the trait's deep colour on the page.",
    css: `& ${HOME} { background: color-mix(in srgb, var(--home-a) 16%, #fff) !important; color: var(--home-b) !important;
      box-shadow: inset 0 1px 0 #fff, 0 10px 22px -10px rgb(0 0 0 / 0.5) !important; }
    & ${TAP} { background: var(--look-tone, #1f3f99) !important; color: #fff !important; box-shadow: none !important; }`,
  },
  {
    id: "outline",
    name: "Outline",
    note: "No fill at all. A drawn edge and a label; the lightest a main tap can be.",
    css: `& ${HOME} { background: transparent !important; color: #fff !important; box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.92) !important; }
    & ${TAP} { background: transparent !important; color: #1b1a19 !important; box-shadow: inset 0 0 0 1.5px #1b1a19 !important; }`,
  },
  {
    id: "arrow",
    name: "Arrow",
    note: "A different shape of tap: the label at the left, a round arrow at the right end, moving on drawn in.",
    css: `& ${BOTH} { display: flex !important; align-items: center; justify-content: space-between !important;
      text-align: left !important; padding: 6px 6px 6px 22px !important; }
    & ${BOTH}::after { content: ""; width: 36px; height: 36px; flex: none; border-radius: 999px; }
    & ${HOME} { background: #fff !important; color: #1b1a19 !important;
      box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.06), 0 10px 22px -10px rgb(0 0 0 / 0.5) !important; }
    & ${HOME}::after { background: #1b1a19 ${ARROW("#fff")} center / 16px no-repeat; }
    & ${TAP} { background: #1b1a19 !important; color: #fff !important; box-shadow: none !important; }
    & ${TAP}::after { background: #fff ${ARROW("#1b1a19")} center / 16px no-repeat; }`,
  },
];

const SHEET = DIRECTIONS.map((d) => d.css.replaceAll("&", `html[data-tap="${d.id}"]`)).join("\n");

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
F.resetPlan("free");
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  permissions: ["microphone", "camera", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
  colorScheme: "light", serviceWorkers: "block",
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
await context.addInitScript(F.seed, { theme: "light", session: F.session, pose: F.POSE_PREF });
await context.addInitScript(() => {
  const d = new Date();
  localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));

/** Shoot the screen once as it ships, then once per direction. */
async function shootAll(screen) {
  await page.addStyleTag({ content: SHEET });
  // The page's tap takes the lesson's colour in "tonal": read it off the screen.
  await page.evaluate(() => {
    const t = document.querySelector("main [data-trait]");
    const ink = t ? getComputedStyle(t).getPropertyValue("--tone-ink").trim() : "";
    if (ink) document.documentElement.style.setProperty("--look-tone", ink);
  });
  const files = {};
  for (const d of [{ id: "now" }, ...DIRECTIONS]) {
    await page.evaluate((id) => {
      if (id === "now") delete document.documentElement.dataset.tap;
      else document.documentElement.dataset.tap = id;
    }, d.id);
    await sleep(350);
    files[d.id] = `${OUT}.${screen}-${d.id}.png`;
    await page.screenshot({ path: files[d.id] });
  }
  await page.evaluate(() => delete document.documentElement.dataset.tap);
  return files;
}

/* ---- the home screen ----------------------------------------------------- */
await page.goto(`${BASE}/`);
await page.waitForSelector("main .arrive", { timeout: 60000 });
await page.waitForSelector(HOME, { timeout: 30000 });
await sleep(1800);
const home = await shootAll("home");
console.log("home: shot", Object.keys(home).length);

/* ---- the first feedback screen: a take, walked to its results ------------ */
await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
await sleep(900);
await page.click('button[aria-label="Start recording"]', { force: true });
await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
await sleep(5000);
await page.click('button[aria-label="Stop and score this recording"]', { force: true });
await page.waitForSelector("main .arrive-x", { timeout: 30000 });
await page.waitForSelector(TAP, { state: "visible", timeout: 15000 });
await sleep(3400);
const feedback = await shootAll("feedback");
console.log("feedback: shot", Object.keys(feedback).length);
await context.close();

/* ---- the sheets: one per direction, and the overview ---------------------- */
const sheets = await browser.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
const sheet = await sheets.newPage();
const uri = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const FONT = "font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const all = [{ id: "now", name: "As it ships", note: "Terracotta, flat, ink label. The one you called ugly, for comparison." }, ...DIRECTIONS];

for (const [i, d] of all.entries()) {
  const n = i === 0 ? "00" : String(i).padStart(2, "0");
  await sheet.setContent(`<body style="margin:0;background:#ececec;${FONT}">
    <div id="s" style="width:1000px;padding:28px 30px 30px;background:#ececec">
      <div style="display:flex;align-items:baseline;gap:14px">
        <div style="font-size:44px;font-weight:800;color:#1b1a19">${i === 0 ? "0" : i}</div>
        <div style="font-size:30px;font-weight:800;color:#1b1a19">${d.name}</div>
      </div>
      <div style="margin-top:6px;font-size:19px;line-height:1.35;color:#555;max-width:900px">${d.note}</div>
      <div style="display:flex;gap:28px;margin-top:22px">
        ${["home", "feedback"].map((s) => `<div style="flex:1">
          <div style="font-size:15px;font-weight:700;color:#777;margin-bottom:8px">${s === "home" ? "Home" : "First feedback screen"}</div>
          <img src="${uri(`${OUT}.${s}-${d.id}.png`)}" style="display:block;width:100%;border-radius:22px;box-shadow:0 10px 30px -14px rgb(0 0 0 / .45)">
        </div>`).join("")}
      </div>
    </div></body>`);
  // JPEG: eleven full-size PNGs were 11 MB in the repository.
  await sheet.locator("#s").screenshot({ path: `${OUT}${n}-${d.id}.jpg`, type: "jpeg", quality: 86 });
}

/* The overview: each direction cropped to the button, twice (on the
   card, on the page), in two columns of five. Source shots are 780 x
   1688 (2x); the crops are the card's lower half and the page's foot. */
const crop = (f, top, height) =>
  `<div style="height:${height / 2}px;overflow:hidden;border-radius:14px"><img src="${uri(f)}" style="display:block;width:390px;margin-top:-${top / 2}px"></div>`;
await sheet.setContent(`<body style="margin:0;background:#ececec;${FONT}">
  <div id="s" style="width:870px;padding:26px 26px 30px;background:#ececec">
    <div style="font-size:30px;font-weight:800;color:#1b1a19">Ten ways to draw the main button</div>
    <div style="margin-top:4px;font-size:17px;color:#555">Each shown where it sits on Home (top) and on the first feedback screen (bottom). 0 is today's.</div>
    <div style="display:grid;grid-template-columns:390px 390px;gap:26px 30px;margin-top:20px">
      ${all.map((d, i) => `<div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
          <span style="font-size:24px;font-weight:800;color:#1b1a19">${i}</span>
          <span style="font-size:19px;font-weight:800;color:#1b1a19">${d.name}</span>
        </div>
        ${crop(`${OUT}.home-${d.id}.png`, Number(process.env.HOME_CROP_TOP ?? 560), 640)}
        <div style="height:8px"></div>
        ${crop(`${OUT}.feedback-${d.id}.png`, 1300, 388)}
      </div>`).join("")}
    </div>
  </div></body>`);
await sheet.locator("#s").screenshot({ path: `${OUT}overview.jpg`, type: "jpeg", quality: 86 });
writeFileSync(`${OUT}directions.json`, JSON.stringify(all.map((d, i) => ({ n: i, id: d.id, name: d.name, note: d.note })), null, 2));
await browser.close();
// The single shots the sheets were laid out from: 20 MB nobody opens.
for (const d of all) for (const screen of ["home", "feedback"]) rmSync(`${OUT}.${screen}-${d.id}.png`, { force: true });
console.log("wrote", all.length, "sheets and the overview to", OUT);
