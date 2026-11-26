/**
 * The lines on the money and sign-up screens, and the reminder's body,
 * photographed (the reel's builds 3 and 4, 26 Nov):
 *
 *   paywall   the plum sheet over Practice, at rest and scrolled to its
 *             foot (the benefits, the Stair, the closing line)
 *   have      PremiumHave, the paywall's benefits on a neutral sheet
 *             (an invite code's Explore on You, LOOK_PLAN=code by itself)
 *   about     About's sample stage and the caption under it
 *   push      the reminder as a phone draws it: lib/reminder-copy.ts read
 *             through jiti, one banner per carried cue kind, the longest
 *             realistic filler, a cue too long for a push, and no cue
 *
 *   LOOK_BASE=http://localhost:4133 node scripts/look-true-lines.mjs after
 *   LOOK_BASE=http://localhost:4133 node scripts/look-true-lines.mjs after paywall about
 *
 * Shots: LOOK_OUT (default docs/look/true-lines/), as
 * <tag>-<scene>-<size>-<theme>[-<beat>].png. LOOK_SIZES as elsewhere, by
 * default 390x844, 375x667 and 320x568 in both themes; `have` shoots at
 * 375 only and `push` at 390 only. Since day one is look-glance.mjs's
 * daily variant (its exit-leaves beat).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { createJiti } from "jiti";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CJS ?? "/opt/node-tools/node_modules/playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
const BASE = process.env.LOOK_BASE ?? "http://localhost:4133";
const ROOT = new URL("../", import.meta.url).pathname;
const OUT = (process.env.LOOK_OUT ?? `${ROOT}docs/look/true-lines/`).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,375x667-light,375x667-dark,320x568-light,320x568-dark")
  .split(",")
  .map((s) => {
    const [wh, theme] = s.split("-");
    const [w, h] = wh.split("x").map(Number);
    return { w, h, theme, name: wh };
  });
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.log(`FAIL  ${m}`);
};
const file = (scene, size, beat) => `${OUT}${TAG}-${scene}-${size.name}-${size.theme}${beat ? `-${beat}` : ""}.png`;

const browser = await chromium.launch();

async function phone(size, plan = "free") {
  F.resetPlan(plan);
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: size.theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  return { context, page: await context.newPage() };
}

/** The text of every benefit row and the closing line, as drawn. */
const ROWS = () => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return null;
  const rows = [...dialog.querySelectorAll("li")].map((li) => ({
    text: li.innerText.trim(),
    lines: Math.round(li.getBoundingClientRect().height / parseFloat(getComputedStyle(li).lineHeight || "20")),
    h: Math.round(li.getBoundingClientRect().height),
  }));
  const closing = [...dialog.querySelectorAll("p")].map((p) => p.innerText.trim()).find((t) => /^Money never buys/.test(t)) ?? null;
  return { rows, closing };
};

/* ---- paywall ------------------------------------------------------------ */
if (want("paywall")) {
  for (const size of SIZES) {
    const { context, page } = await phone(size);
    await page.goto(`${BASE}/games`);
    await page.waitForSelector(".premium-wall", { timeout: 60000 });
    await sleep(700);
    await page.locator(".premium-wall").click({ force: true });
    await page.waitForSelector('[role="dialog"] [role="slider"]', { timeout: 8000 }).catch(() => fail(`paywall ${size.name} ${size.theme}: no sheet`));
    await sleep(1200);
    await page.screenshot({ path: file("paywall", size) });
    const said = await page.evaluate(ROWS);
    console.log(`paywall ${size.name} ${size.theme}: ${JSON.stringify(said)}`);
    if (said && said.rows.length !== 5) fail(`paywall ${size.name}: ${said.rows.length} benefit rows, not 5`);
    if (size.w >= 375 && said) for (const r of said.rows) if (r.h > 30) fail(`paywall ${size.name}: "${r.text}" takes ${r.h}px, more than one line`);
    await page.evaluate(() => {
      const sc = document.querySelector('[role="dialog"] .paywall-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await sleep(500);
    await page.screenshot({ path: file("paywall", size, "foot") });
    await context.close();
  }
}

/* ---- PremiumHave (an invite code's Explore) ----------------------------- */
if (want("have")) {
  for (const size of SIZES.filter((s) => s.w === 375)) {
    const { context, page } = await phone(size, "code");
    await page.goto(`${BASE}/you`);
    await page.waitForSelector('[data-look="premium-explore"]', { timeout: 60000 }).catch(() => fail(`have ${size.theme}: no Explore`));
    await sleep(600);
    await page.locator('[data-look="premium-explore"]').click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => fail(`have ${size.theme}: no sheet`));
    await sleep(1200);
    await page.screenshot({ path: file("have", size) });
    console.log(`have ${size.name} ${size.theme}: ${JSON.stringify(await page.evaluate(ROWS))}`);
    await context.close();
  }
}

/* ---- About's sample ----------------------------------------------------- */
if (want("about")) {
  for (const size of SIZES.filter((s) => s.w <= 375)) {
    const { context, page } = await phone(size);
    await page.goto(`${BASE}/about`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(800);
    const cap = page.locator("p", { hasText: /sample|Example numbers/ }).first();
    await cap.scrollIntoViewIfNeeded().catch(() => fail(`about ${size.name}: no caption`));
    await page.evaluate(() => window.scrollBy(0, -Math.round(window.innerHeight * 0.45)));
    await sleep(500);
    await page.screenshot({ path: file("about", size) });
    console.log(`about ${size.name} ${size.theme}: ${JSON.stringify(await cap.innerText().catch(() => null))}`);
    await context.close();
  }
}

/* ---- the reminder as a phone draws it ----------------------------------- */
if (want("push")) {
  const jiti = createJiti(new URL(import.meta.url).pathname, { alias: { "@": ROOT.replace(/\/$/, "") } });
  const R = await jiti.import(`${ROOT}lib/reminder-copy.ts`);
  const cue = (kind, word, last) => ({ kind, word, from: last, last, givenOn: "2026-11-25", answeredOn: null, tries: 0, line: null });
  const last = { fillers: 4, seconds: 62 };
  const CASES = [
    ["filler", cue("filler", "like", 9)],
    ["searching", cue("searching", null, 3)],
    ["filled", cue("filled", null, 2)],
    ["unheld", cue("unheld", null, 0)],
    ["restarts", cue("restarts", null, 4)],
    ["fast", cue("fast", null, 184)],
    ["slow", cue("slow", null, 104)],
    ["repeat", cue("repeat", "really", 5)],
    ["longest filler", cue("filler", "you know", 12)],
    ["too long", cue("repeat", "internationalisation-and-localisation", 7)],
    ["no cue", null],
  ];
  const banners = CASES.map(([name, c]) => ({ name, ...R.reminderCopy({ hour: 18, onTime: true, last, cue: c }) }));
  for (const b of banners) console.log(`push ${b.name}: ${b.title} | ${b.body} (${b.body.length})`);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  for (const size of SIZES.filter((s) => s.w === 390)) {
    const dark = size.theme === "dark";
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:12px 8px;font:15px/1.3 -apple-system,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;
        background:${dark ? "linear-gradient(#1b2a3a,#0b0f14)" : "linear-gradient(#8fb3d9,#d9c7b0)"};min-height:100vh;box-sizing:border-box}
      .n{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;margin:0 0 8px;border-radius:22px;
        background:${dark ? "rgba(40,40,44,.82)" : "rgba(246,246,248,.86)"};color:${dark ? "#f2f2f2" : "#111"};backdrop-filter:blur(20px)}
      .i{width:38px;height:38px;border-radius:9px;background:#8fc4ec;flex:none}
      .m{min-width:0;flex:1}.h{display:flex;justify-content:space-between;gap:8px}
      .t{font-weight:600}.w{color:${dark ? "#9a9a9f" : "#6b6b70"};font-size:13px}
      .b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
      .k{font:11px/1.2 ui-monospace,monospace;color:${dark ? "#9a9a9f" : "#444"};margin:0 6px 2px}
    </style>${banners
      .map(
        (b) => `<div class="k">${esc(b.name)} · ${b.body.length} characters</div>
      <div class="n"><div class="i"></div><div class="m"><div class="h"><span class="t">${esc(b.title)}</span><span class="w">now</span></div><div class="b">${esc(b.body)}</div></div></div>`
      )
      .join("")}`;
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, colorScheme: size.theme });
    const page = await context.newPage();
    await page.setContent(html);
    await page.screenshot({ path: file("push", size), fullPage: true });
    await context.close();
  }
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failed` : "\nall shot");
process.exit(failures.length ? 1 : 0);
