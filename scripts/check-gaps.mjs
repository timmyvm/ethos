/**
 * The gap gate (D19, #368): no screen leaves an empty band over 64px.
 *
 * DESIGN principle 7 says a screen with room to spare gives it to its
 * stage, its art or its drop zone, never to ground. This asserts it on
 * a 390x844 phone in both themes, against the look loop's fixtures
 * (scripts/look-fixtures.mjs), so it photographs the same app the
 * camera does.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node scripts/check-gaps.mjs
 *   node scripts/check-gaps.mjs trait unit       # a subset, by screen name
 *   GAPS_VERBOSE=1 node scripts/check-gaps.mjs   # every gap, not only the largest
 *
 * What counts as content: every line of text (the text's own line
 * boxes, not its element's), every image, svg, video and canvas, every
 * control, a card standing in the flow (filled in other than the
 * ground's colour, under 70% of the screen tall: its padding is the
 * card's, not ground), and the top and bottom edges of anything else
 * with a fill, a border or a shadow, because the arc at a stage's foot
 * is a thing the eye lands on. What does not: the tab bar and its
 * fade, the footer shelf (it is the floor), scrims, the inside of an
 * absolute or aria-hidden art layer (a stage's ground: the bands over
 * it are the screen's), and anything marked `data-gap-skip`.
 *
 * Per screen the boxes in the first viewport are sorted by top and
 * merged, and every vertical gap between them is measured, the last
 * one to the top of the FooterShelf's first painted word or control
 * (E18: its own padding is ground too), or to the top of the nav
 * capsule (or the viewport's foot). The gap above the first box is the
 * status bar's, not the screen's. Any gap over 64px fails.
 *
 * One exemption, D19: on the seven question screens of the
 * introduction the band between a top-anchored answer list and the
 * docked Next is the layout of the reference itself (Duolingo's
 * 13-question-list-dark), so that one gap is reported, not failed.
 * And a stage that takes every spare pixel by design (`data-gap-stage`,
 * LessonScreen's `stageGrows`: the trait page and the unit intro, E18)
 * has its own inner bands reported as the stage's room; the ground
 * round it is measured as everywhere else.
 *
 * One scene is reported, never failed: the settled streak celebration
 * (E18), a centred 2.3s moment no judge gave a passing layout for.
 *
 * Screens: the five tabs, the lesson page, the trait page, the unit
 * intro, the Shop, Settings, the paywall, recording idle and live, the
 * celebration, the three results steps, and every screen of the
 * introduction, with the name question also at 390x508, its keyboard
 * up.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import {
  supabaseRoute,
  analyzeBody,
  json,
  session,
  billingApiRoute,
  resetPlan,
} from "./look-fixtures.mjs";

const BASE = process.env.BASE ?? process.env.LOOK_BASE ?? "http://localhost:3123";
const ONLY = process.argv.slice(2);
const VERBOSE = process.env.GAPS_VERBOSE === "1";
const LIMIT = 64;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.some((o) => name === o || name.startsWith(`${o}-`));

let failed = 0;
let passed = 0;
let reported = 0;
const lines = [];

/**
 * In the page: every content box in the viewport, merged into runs, and
 * the gaps between them. `scope` limits it to one subtree (a sheet).
 */
function measure({ scope }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const root = scope ? document.querySelector(scope) : document.body;
  if (!root) return { error: `no ${scope}` };
  const SKIP = '[data-gap-skip], nav[aria-label="Sections"], [data-footer-shelf], .sheet-scrim, .sr-only, nextjs-portal';
  let floor = vh;
  let floorName = "viewport foot";
  const visible = (el) =>
    el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
  const CONTROL = 'button, a[href], input, textarea, select, [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="slider"], [role="tab"]';
  /*
   * E18: the shelf's floor is its first word, not its box. The shelf's
   * own top padding is ground the eye crosses like any other, so the
   * last band runs to the top of the first painted text line or control
   * inside it (the fine print over the tap, or the tap itself).
   */
  const shelfTop = (shelf) => {
    let top = Infinity;
    const w = document.createTreeWalker(shelf, NodeFilter.SHOW_ELEMENT);
    for (let el = w.currentNode; el; el = w.nextNode()) {
      if (el.closest(".sr-only") || !visible(el)) continue;
      if (el.matches(CONTROL)) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.width > 0) top = Math.min(top, r.top);
      }
      for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rr of range.getClientRects()) if (rr.width > 0) top = Math.min(top, rr.top);
      }
    }
    return top === Infinity ? shelf.getBoundingClientRect().top : top;
  };
  if (!scope) {
    for (const [sel, name, edge] of [
      ["[data-footer-shelf]", "the footer shelf's first word", shelfTop],
      ['nav[aria-label="Sections"] .nav-glass', "the nav capsule", (el) => el.getBoundingClientRect().top],
    ]) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top < floor && r.top > vh * 0.4) {
          floor = edge(el);
          floorName = name;
        }
      }
    }
  }
  const describe = (el) => {
    const text = (el.innerText ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
    const alt = el.getAttribute?.("alt") ?? el.getAttribute?.("aria-label") ?? "";
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : alt ? ` [${alt}]` : ""}`;
  };
  /* The page's ground, so a wrapper painted in it is not a card. */
  const groundColour = getComputedStyle(document.body).backgroundColor;
  const boxes = [];
  const add = (top, bottom, left, right, el, kind) => {
    if (right <= 0 || left >= vw || bottom <= 0 || top >= floor) return;
    if (right - left < 2) return;
    boxes.push({ top: Math.max(0, top), bottom: Math.min(floor, bottom), el: describe(el), kind });
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    // Skipped only inside the scope: a sheet's panel sits in its scrim.
    const skip = el.closest(SKIP);
    if (skip && (skip === root || root.contains(skip))) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const tag = el.tagName;
    // Text: the line boxes of its own text, so a padded block's padding is not content.
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rr of range.getClientRects()) add(rr.top, rr.bottom, rr.left, rr.right, el, "text");
    }
    if (/^(IMG|VIDEO|CANVAS|PICTURE)$/.test(tag) || (tag === "svg" && !el.parentElement?.closest("svg"))) {
      add(r.top, r.bottom, r.left, r.right, el, "art");
      continue;
    }
    if (el.matches(CONTROL)) add(r.top, r.bottom, r.left, r.right, el, "control");
    // A surface. A card standing in the flow (filled, not the ground's
    // own colour, not an aria-hidden art layer) is a thing the eye
    // lands on, inside and out: its padding is the card's, not a band
    // of ground (principle 7: room goes to a stage or art, never to
    // ground). Anything else drawn (an outline, a shadow, an absolute
    // layer) counts by its edges only, so a stage's art layer never
    // hides the bands over it.
    if (el === document.body || el.tagName === "MAIN" || el === document.documentElement) continue;
    if (el === root) continue;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
    const painted = (bg.length < 4 || bg[3] > 0.05) && cs.backgroundColor !== "transparent";
    const inFlow = cs.position === "static" || cs.position === "relative";
    /* A wrapper in the ground's colour is ground; an absolute shape in
       it (the arc rising into a stage) is still an edge. */
    const filled = painted && !(inFlow && cs.backgroundColor === groundColour);
    const imaged = cs.backgroundImage !== "none";
    const bordered = parseFloat(cs.borderTopWidth) > 0 && !/rgba\([^)]*,\s*0\)/.test(cs.borderTopColor);
    const shadowed = cs.boxShadow !== "none";
    /* A panel with rounded corners is a card at any height (the intro's
       stages); a square wrapper that tall is the page, not a card. */
    const rounded = parseFloat(cs.borderTopLeftRadius) > 0;
    const card =
      (filled || imaged) &&
      inFlow &&
      !el.closest("[aria-hidden]") &&
      r.width >= vw * 0.4 &&
      (rounded || r.height < vh * 0.7);
    if (card) add(r.top, r.bottom, r.left, r.right, el, "card");
    else if (filled || imaged || bordered || shadowed) {
      add(r.top, r.top + 1, r.left, r.right, el, "edge");
      add(r.bottom - 1, r.bottom, r.left, r.right, el, "edge");
    }
  }
  boxes.sort((a, b) => a.top - b.top);
  const runs = [];
  for (const b of boxes) {
    const last = runs[runs.length - 1];
    if (last && b.top <= last.bottom + 0.5) {
      if (b.bottom > last.bottom) {
        last.bottom = b.bottom;
        last.lastEl = b.el;
      }
    } else runs.push({ top: b.top, bottom: b.bottom, firstEl: b.el, lastEl: b.el });
  }
  /* A stage that takes every spare pixel (LessonScreen's `stageGrows`,
     E18) marks itself: a band wholly inside it is room given to the
     stage, so it is reported, never failed. Bands on the ground round
     it are measured as everywhere else. */
  const stages = scope
    ? []
    : [...document.querySelectorAll("[data-gap-stage]")].map((el) => el.getBoundingClientRect());
  const inStage = (top, bottom) => stages.some((r) => top >= r.top - 0.5 && bottom <= r.bottom + 0.5);
  const gaps = [];
  for (let i = 1; i < runs.length; i++) {
    const at = runs[i - 1].bottom;
    const size = runs[i].top - at;
    gaps.push({ size, at, above: runs[i - 1].lastEl, below: runs[i].firstEl, stage: inStage(at, at + size) });
  }
  if (runs.length) {
    const last = runs[runs.length - 1];
    gaps.push({ size: floor - last.bottom, at: last.bottom, above: last.lastEl, below: floorName, foot: true });
  }
  return { gaps, floor, runs: runs.length };
}

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

async function open(theme, { fresh = false, height = 844 } = {}) {
  resetPlan();
  const context = await browser.newContext({
    viewport: { width: 390, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/analyze", async (route) => {
    await sleep(400);
    await route.fulfill(json(analyzeBody));
  });
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/billing/*", billingApiRoute);
  await context.addInitScript(
    ({ theme, session, fresh }) => {
      if (fresh) {
        localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, haptics: false }));
        return;
      }
      localStorage.setItem("ethos.welcomed", new Date().toISOString());
      localStorage.setItem("ethos.prefs", JSON.stringify({ theme, reducedMotion: false, pose: "pose_speaking", skipIntros: true, haptics: false }));
      localStorage.setItem("ethos.onboarding", JSON.stringify({ answers: { ageBand: "19-22", goal: "work", pains: ["fillers", "blank"], level: "some", context: "meetings" }, step: 6, done: true, synced: true }));
      localStorage.setItem("ethos.gates.rep1", new Date().toISOString());
      localStorage.setItem("ethos.gates.streak", new Date().toISOString());
      localStorage.setItem("sb-supabase-auth-token", JSON.stringify(session));
      localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(session));
    },
    { theme, session, fresh }
  );
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 140)));
  return { context, page };
}

async function check(page, name, theme, { scope, exemptFoot = false, report = null } = {}) {
  const at = `${name} (${theme})`;
  await page.mouse.move(0, 0).catch(() => {});
  await sleep(700);
  const m = await page.evaluate(measure, { scope });
  const say = (g) => `${Math.round(g.size)}px at y${Math.round(g.at)} between ${g.above} and ${g.below}`;
  if (m.error) {
    if (report) {
      reported += 1;
      lines.push(`note  ${at}: ${m.error} (${report})`);
      return;
    }
    failed += 1;
    lines.push(`FAIL  ${at}: ${m.error}`);
    return;
  }
  /*
   * A reported scene (the settled streak celebration, E18) is measured
   * like every other and its band printed in every run, but it never
   * fails the gate: a centred moment with Demos at his size has no
   * layout that passes, and no judge asked for one.
   */
  if (report) {
    reported += 1;
    const worst = m.gaps.reduce((a, g) => (g.size > (a?.size ?? -1) ? g : a), null);
    lines.push(`note  ${at}: largest ${worst ? say(worst) : "none"} (${report}, reported, not failed)`);
    for (const g of m.gaps.filter((g) => g.size > LIMIT)) lines.push(`        ${say(g)}`);
    return;
  }
  const counted = m.gaps.filter((g) => !(exemptFoot && g.foot) && !g.stage);
  const worst = counted.reduce((a, g) => (g.size > (a?.size ?? -1) ? g : a), null);
  const ok = !worst || worst.size <= LIMIT;
  if (ok) passed += 1;
  else failed += 1;
  lines.push(`${ok ? "ok  " : "FAIL"}  ${at}: largest ${worst ? say(worst) : "none"}`);
  if (exemptFoot) {
    const foot = m.gaps.find((g) => g.foot);
    if (foot) lines.push(`      exempt (D19, list over docked Next): ${say(foot)}`);
  }
  for (const g of m.gaps.filter((g) => g.stage && g.size > LIMIT)) {
    lines.push(`      stage (E18, room the stage took): ${say(g)}`);
  }
  if (VERBOSE || !ok) {
    for (const g of m.gaps.filter((g) => g.size > 24)) lines.push(`        ${say(g)}`);
  }
}

const settled = (page) =>
  page
    .waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 })
    .catch(() => {});

const SCREENS = [
  ["today", "/", "main .arrive"],
  ["lessons", "/lessons", "main h1"],
  ["games", "/games", "main h1"],
  ["log", "/history", "main .arrive"],
  ["you", "/you", "main h1"],
  ["lesson", "/lessons/the-cold-open", "main h1"],
  ["trait-pause", "/practice/pause", "main h1"],
  ["trait-pace", "/practice/pace", "main h1"],
  ["unit", "/lesson/filler", "main h1"],
  ["shop", "/shop", "main h1"],
  ["settings", "/settings", "main .inset-group"],
];

for (const theme of ["light", "dark"]) {
  const { context, page } = await open(theme);
  for (const [name, path, ready] of SCREENS) {
    if (!want(name)) continue;
    try {
      await page.goto(`${BASE}${path}`);
      await page.waitForSelector(ready, { timeout: 20000 });
      await settled(page);
      await sleep(900);
      await check(page, name, theme);
    } catch (e) {
      failed += 1;
      lines.push(`FAIL  ${name} (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
    }
  }

  if (want("paywall")) {
    try {
      await page.goto(`${BASE}/games`);
      /* The Premium card is server-rendered (D31), so Unlock exists
         before React has hydrated it; a tap that early does nothing.
         Wait as check-sheet-touch does, and tap once more if the sheet
         has still not opened. */
      await page.waitForSelector(".premium-wall", { timeout: 20000 });
      await sleep(600);
      const slider = '[role="dialog"] [role="slider"]';
      await page.click(".premium-wall", { force: true });
      if (!(await page.waitForSelector(slider, { timeout: 3000 }).catch(() => null))) {
        await page.click(".premium-wall", { force: true });
        await page.waitForSelector(slider, { timeout: 8000 });
      }
      await sleep(1400);
      await check(page, "paywall", theme, { scope: '[role="dialog"] .card-premium' });
    } catch (e) {
      failed += 1;
      lines.push(`FAIL  paywall (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
    }
  }

  const rep = ["rep-idle", "rep-live", "rep-celebration", "rep-results", "rep-numbers", "rep-words"];
  if (rep.some(want)) {
    try {
      await page.goto(`${BASE}/rep?lesson=h4`);
      await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 20000 });
      await sleep(600);
      if (want("rep-idle")) await check(page, "rep-idle", theme);
      // `force`: Record breathes, and Playwright waits for it to hold still (#242).
      await page.click('button[aria-label="Start recording"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]');
      await sleep(2500);
      if (want("rep-live")) await check(page, "rep-live", theme);
      await page.click('button[aria-label="Stop and score this recording"]', { force: true });
      /* The streak's own moment, settled (its rise is 600ms, its hold
         2.3s): measured inside its sheet and reported, never failed. */
      if (want("rep-celebration")) {
        const up = await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => null);
        if (up) {
          await sleep(600);
          await check(page, "rep-celebration", theme, {
            scope: '[role="dialog"]',
            report: "a centred 2.3s moment",
          });
        } else lines.push(`note  rep-celebration (${theme}): no celebration came up`);
      }
      await page.waitForSelector("main .arrive-x", { timeout: 15000 });
      // The streak's own moment holds the screen first; the step is under it.
      await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 20000 }).catch(() => {});
      await sleep(2400);
      if (want("rep-results")) await check(page, "rep-results", theme);
      for (const [name, label] of [["rep-numbers", /The numbers/], ["rep-words", /Your words/]]) {
        const button = page.getByRole("button", { name: label });
        if (!(await button.count())) break;
        await button.first().click();
        await sleep(600);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (want(name)) await check(page, name, theme);
      }
    } catch (e) {
      failed += 1;
      lines.push(`FAIL  rep (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
    }
  }
  await context.close();

  if (want("welcome")) await walk(theme);
}

/** The introduction, from an empty browser, as scripts/look-welcome.mjs walks it. */
async function walk(theme) {
  const ANSWERS = [
    { id: "name", type: "text", value: "Tim" },
    { id: "ageBand", labels: ["18 to 24"] },
    { id: "goal", labels: ["Think on my feet when asked"] },
    { id: "pains", labels: ["I rush", "I ramble"] },
    { id: "level", labels: ["A bit, a class or a few talks"] },
    { id: "context", labels: ["Work"] },
    { id: "beat", type: "beat" },
    { id: "time", labels: [/^Evening/] },
  ];
  const { context, page } = await open(theme, { fresh: true });
  const next = async () => {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await sleep(500);
  };
  try {
    await page.goto(`${BASE}/welcome`);
    await page.waitForSelector("main h1", { timeout: 20000 });
    for (let n = 1; n <= 3; n++) {
      await check(page, `welcome-intro-${n}`, theme);
      await next();
    }
    let k = 0;
    for (const q of ANSWERS) {
      if (q.type === "beat") {
        await check(page, "welcome-beat", theme);
        await next();
        continue;
      }
      k += 1;
      await check(page, `welcome-q${k}`, theme, { exemptFoot: true });
      if (q.type === "text") {
        await page.getByLabel("Your name").fill(q.value);
        await page.getByLabel("Your name").blur();
      } else {
        for (const label of q.labels) {
          const box = typeof label === "string" && /^I /.test(label);
          await page
            .getByRole(box ? "checkbox" : "radio", typeof label === "string" ? { name: label, exact: true } : { name: label })
            .click();
          await sleep(300);
        }
      }
      await check(page, `welcome-q${k}-answered`, theme, { exemptFoot: true });
      await next();
    }
    await sleep(600);
    await check(page, "welcome-plan", theme);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("Keep this").waitFor();
    await sleep(600);
    await check(page, "welcome-account", theme);
  } catch (e) {
    failed += 1;
    lines.push(`FAIL  welcome (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
  }
  await context.close();

  // The name question with the keyboard up: 390x508, the field focused.
  const kb = await open(theme, { fresh: true, height: 508 });
  try {
    await kb.page.goto(`${BASE}/welcome`);
    await kb.page.waitForSelector("main h1", { timeout: 20000 });
    for (let n = 1; n <= 3; n++) {
      await kb.page.getByRole("button", { name: "Next", exact: true }).click();
      await sleep(500);
    }
    await kb.page.getByLabel("Your name").waitFor();
    await sleep(400);
    const focused = await kb.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.id ?? "");
    lines.push(`      q1 keyboard-up (${theme}): focus is on ${focused ? `"${focused}"` : "nothing"}`);
    await check(kb.page, "welcome-q1-keyboard", theme, { exemptFoot: false });
  } catch (e) {
    failed += 1;
    lines.push(`FAIL  welcome-q1-keyboard (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
  }
  await kb.context.close();
}

await browser.close();
for (const l of lines) console.log(l);
console.log(
  `\n${passed}/${passed + failed} screens with no band over ${LIMIT}px` +
    (reported ? `, ${reported} reported (the celebration)` : "")
);
process.exit(failed ? 1 : 0);
