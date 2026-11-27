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
 * Two exemptions. D19: on the seven question screens of the
 * introduction the band between a top-anchored answer list and the
 * docked Next is the layout of the reference itself (Duolingo's
 * 13-question-list-dark), so that one gap is reported, not failed. And
 * #494: /boss's lobby stands its stage at the house's tab height, so on
 * a tall phone the band between Pick a topic and the docked Start
 * reading is ground, the room the reading's sheet opens into; given to
 * the stage, it was 300pt of empty sky (the morning tour). That one
 * band is reported too, and every other gap on the screen still counts.
 * And a stage that takes every spare pixel by design (`data-gap-stage`,
 * LessonScreen's `stageGrows`: the trait page and the unit intro, E18)
 * has its own inner bands reported as the stage's room; the ground
 * round it is measured as everywhere else.
 *
 * The streak's moment (since #480 a screen of its own on the results'
 * way out) was reported here and never failed (E18), a centred moment
 * with about 200pt of ground over its flame and over Continue. Since
 * #496 its flame takes the free height and it is measured like every
 * other screen.
 *
 * The two asks on the results' way out (#526, lib/rep-screen.ts
 * `exitBeat`): Since day one (a free account's day-3 progress moment) and
 * the save wall (Before you go, after a guest's first recording and at a
 * 3-day run), reached as a person reaches them, by a take and the
 * header's back (the route scripts/look-since-day-one.mjs takes). Their
 * stage takes the free height, so a band can hide INSIDE it, where the
 * card counts as one box: each is measured twice, its ground as every
 * screen's, and the inside of its stage (`stageBands`: from the stage's
 * top edge to its first mark, mark to mark, the last to its foot, a
 * drawn line by its own extent, not its box). Any band over 64 fails
 * either way. Scenes: since, since-wpm, since-worse, since-noindex,
 * save-rep1, save-streak, save-noindex and save-unscored, at 390x844 in
 * both themes and 430x932 light (the tallest phone the camera holds).
 * On the build of 27 Nov they fail: about 150pt of ground over and under
 * the card.
 *
 * Screens: the five tabs, /boss, the lesson page, the trait page, the unit
 * intro, the Shop, Settings, the paywall, recording idle and live, the
 * celebration, the results' glance and its sheet, Since day one and the
 * save wall, and every screen of the introduction, with the name question
 * also at 390x508, its keyboard up.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import {
  supabaseRoute,
  analyzeBody,
  json,
  session,
  billingApiRoute,
  resetPlan,
  SAY_SAVED,
  sayMode,
  savedWordsMode,
} from "./look-fixtures.mjs";
import * as F from "./look-fixtures.mjs";

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

/**
 * In the page: the bands INSIDE a stage (#526). `measure` counts a card
 * standing in the flow as one box, so the room a stage takes is never a
 * band to it, and a stage can hold 150pt of empty dark and pass. This
 * measures the stage's inside as `measure` measures a screen: every text
 * line, every control, every small painted mark (a ring, a dot), every
 * rule by its edge, and a drawn line by the extent of its own strokes
 * (an svg's paths, not its box: a flat line in a tall plot leaves dark
 * over and under it). The first band runs from the stage's top edge and
 * the last to its foot; nothing inside the stage is skipped for being
 * aria-hidden, since art is what fills a stage. `scope` is a selector
 * list; the first match is measured.
 */
function stageBands({ scope }) {
  const stage = document.querySelector(scope);
  if (!stage) return { none: true };
  const vh = window.innerHeight;
  const sr = stage.getBoundingClientRect();
  const top = Math.max(0, sr.top);
  const bottom = Math.min(vh, sr.bottom);
  const visible = (el) => el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
  const describe = (el) => {
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 2).join(".") : el.tagName === "path" ? "path" : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  const boxes = [];
  const add = (t, b, el) => {
    if (b <= top || t >= bottom || b - t <= 0) return;
    boxes.push({ top: Math.max(top, t), bottom: Math.min(bottom, b), el: describe(el) });
  };
  const w = document.createTreeWalker(stage, NodeFilter.SHOW_ELEMENT);
  for (let el = w.nextNode(); el; el = w.nextNode()) {
    if (el.closest(".sr-only") || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rr of range.getClientRects()) if (rr.width > 0) add(rr.top, rr.bottom, el);
    }
    if (el.tagName === "svg") {
      const marks = [...el.querySelectorAll("path, circle, rect, line, polyline")];
      if (marks.length === 0) add(r.top, r.bottom, el);
      /* A stroke's box grows by half its width; a dot drawn as a
         zero-length stroke has no box of its own but its round cap. */
      for (const m of marks) {
        const mr = m.getBoundingClientRect();
        const half = (parseFloat(getComputedStyle(m).strokeWidth) || 0) / 2;
        add(mr.top - half, mr.bottom + half, m);
      }
      continue;
    }
    if (el.closest("svg")) continue;
    if (/^(IMG|VIDEO|CANVAS|PICTURE|BUTTON|A|INPUT)$/.test(el.tagName)) {
      add(r.top, r.bottom, el);
      continue;
    }
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
    const painted = (bg.length < 4 || bg[3] > 0.05) && cs.backgroundColor !== "transparent";
    if (painted && r.height <= 48) add(r.top, r.bottom, el);
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") add(r.top, r.top + 1, el);
    if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none") add(r.bottom - 1, r.bottom, el);
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
  const gaps = [];
  if (runs.length === 0) return { gaps: [{ size: bottom - top, at: top, above: "the stage's top edge", below: "its foot" }], top, bottom };
  gaps.push({ size: runs[0].top - top, at: top, above: "the stage's top edge", below: runs[0].firstEl });
  for (let i = 1; i < runs.length; i++) {
    gaps.push({ size: runs[i].top - runs[i - 1].bottom, at: runs[i - 1].bottom, above: runs[i - 1].lastEl, below: runs[i].firstEl });
  }
  const last = runs[runs.length - 1];
  if (sr.bottom <= vh) gaps.push({ size: bottom - last.bottom, at: last.bottom, above: last.lastEl, below: "the stage's foot" });
  return { gaps, top, bottom };
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
    const why = typeof exemptFoot === "string" ? exemptFoot : "D19, list over docked Next";
    if (foot) lines.push(`      exempt (${why}): ${say(foot)}`);
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
  // /boss: a pushed screen with no tab bar, its tap in FooterShelf (R2F-09);
  // its stage at the tab height since #494, the band over the shelf reported.
  ["boss", "/boss", "main h1", { exemptFoot: "#494, the boss's stage at the tab height over its docked tap" }],
  ["log", "/history", "main .arrive"],
  ["you", "/you", "main h1"],
  ["lesson", "/lessons/the-cold-open", "main h1"],
  ["trait-pause", "/practice/pause", "main h1"],
  ["trait-pace", "/practice/pace", "main h1"],
  ["unit", "/lesson/filler", "main h1"],
  ["shop", "/shop", "main h1"],
  ["settings", "/settings", "main .inset-group"],
];

/* ---- the two asks on the results' way out (#526) ---------------------- */
/*
 * The take's route, as scripts/look-since-day-one.mjs walks it (see its
 * header for why there is no shorter way in): /rep?mode=daily, Record,
 * 2.5 s of fake mic, Stop, /api/analyze answered at once, the reads after
 * the take, then the header's back, an exit that leaves. The guest of the
 * save wall is the one the app still lets record: an anonymous session
 * whose email link is on its way (lib/account-gate.ts `pendingEmail`).
 */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const guestExp = Math.floor(Date.now() / 1000) + 86_400;
const guestUser = {
  id: "guest1", aud: "authenticated", role: "authenticated", email: "", new_email: "guest@example.com", is_anonymous: true,
  app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};
const guestSession = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "guest1", aud: "authenticated", role: "authenticated", exp: guestExp, is_anonymous: true, session_id: "g1" })}.sig`,
  token_type: "bearer", expires_in: 86_400, expires_at: guestExp, refresh_token: "g-r1", user: guestUser,
};
const fixtureRows = () => F.reps.map((r) => ({ ...r }));
const CAPPED = { coach: null, ethosIndex: null, judged: { ran: false, unlimited: false, remaining: 0, capped: true } };
const UNSCORED = {
  ...analyzeBody, coach: null, ethosIndex: null, previousIndex: null, scorable: false,
  metrics: { ...analyzeBody.metrics, durationS: 6, wordCount: 9, wpm: 90, fillerCount: 0, fillersPerMin: 0, fillers: [], pauses: [], heldPauses: 0, composedPauses: 0, midSentencePauses: 0, stars: 0 },
  judged: { ran: false, unlimited: false, remaining: 3, capped: false },
};
const SINCE_SCENES = {
  since: { screen: "progress" },
  "since-wpm": { screen: "progress", pains: ["rushing"] },
  "since-worse": {
    screen: "progress",
    rows: () => {
      const r = fixtureRows();
      Object.assign(r[r.length - 1], { filler_count: 12, pauses: [{ t: 8, len: 1.2, kind: "mid" }] });
      return r;
    },
  },
  "since-noindex": {
    screen: "progress",
    rows: () => {
      const r = fixtureRows();
      r[0].ethos_index = null;
      return r;
    },
  },
  "save-rep1": { screen: "save", rows: () => [], body: () => ({ ...analyzeBody, previousIndex: null }), unseen: ["rep1"] },
  "save-streak": { screen: "save", rows: () => fixtureRows().slice(-2), body: () => analyzeBody, unseen: ["streak"] },
  "save-noindex": { screen: "save", rows: () => fixtureRows().slice(-2), body: () => ({ ...analyzeBody, ...CAPPED }), unseen: ["streak"] },
  "save-unscored": { screen: "save", rows: () => [], body: () => UNSCORED, unseen: ["rep1"] },
};
const SINCE_SIZES = [
  { width: 390, height: 844, themes: ["light", "dark"] },
  { width: 430, height: 932, themes: ["light"] },
];
const STAGE = "main [data-since-stage], main .card-stage";

async function sinceShot(name, scene, theme, { width, height }) {
  const guest = scene.screen === "save";
  resetPlan("free");
  F.repsMode.rows = scene.rows ? scene.rows() : null;
  F.extraReps.splice(0, F.extraReps.length);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  const watch = { answered: false, listed: 0, user: 0, last: Date.now() };
  await context.route("http://supabase.local/**", async (route) => {
    const url = new URL(route.request().url());
    watch.last = Date.now();
    if (watch.answered && route.request().method() === "GET" && url.pathname.startsWith("/rest/v1/reps")) watch.listed += 1;
    if (watch.answered && watch.listed >= 2 && url.pathname.startsWith("/auth/v1/user")) watch.user += 1;
    if (guest) {
      if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill(json(guestUser));
      if (url.pathname.startsWith("/auth/v1/signup") || url.pathname.startsWith("/auth/v1/token")) return route.fulfill(json(guestSession));
    }
    return supabaseRoute(route);
  });
  await context.route("**/api/analyze", async (route) => {
    const body = scene.body ? scene.body() : analyzeBody;
    if (guest) {
      const last = F.reps[F.reps.length - 1];
      F.extraReps.splice(0, F.extraReps.length, { ...last, id: "rep-live", client_id: "rep-live", created_at: new Date().toISOString(), ethos_index: body.ethosIndex ?? null });
    }
    watch.answered = true;
    watch.last = Date.now();
    await route.fulfill(json(body));
  });
  await context.route("**/api/push", (r) => r.fulfill(json({ ok: true })));
  await context.route("**/api/billing/*", billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.addInitScript(F.seed, { theme, session: guest ? guestSession : session, pose: F.POSE_PREF });
  await context.addInitScript(
    ({ unseen, pains }) => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem("ethos.streak.moment", today);
      localStorage.setItem("ethos.reminder.asked", today);
      for (const g of unseen) localStorage.removeItem(`ethos.gates.${g}`);
      if (pains) {
        const o = JSON.parse(localStorage.getItem("ethos.onboarding") ?? "{}");
        localStorage.setItem("ethos.onboarding", JSON.stringify({ ...o, answers: { ...o.answers, pains } }));
      }
      const css = document.createElement("style");
      css.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    },
    { unseen: scene.unseen ?? [], pains: scene.pains ?? null }
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 140)));
  const at = `${name} ${width}x${height}`;
  try {
    await page.goto(`${BASE}/rep?mode=daily`);
    await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
    await sleep(700);
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[data-record="stop"]', { timeout: 20000 });
    await sleep(2500);
    await page.click('button[data-record="stop"]', { force: true });
    await page.waitForSelector("main [data-results-back]", { state: "visible", timeout: 30000 });
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      const read = watch.listed >= 2 && (!guest || watch.user >= 1);
      if (read && Date.now() - watch.last > 600) break;
      await sleep(100);
    }
    await sleep(400);
    await page.locator("main [data-results-back]").click();
    const landed = await page
      .waitForFunction(
        () =>
          !document.querySelector("[data-results-back]") &&
          [...document.querySelectorAll("main button, main a[href]")].some((b) => (b.innerText ?? "").trim() === "Not now"),
        null,
        { timeout: 8000 }
      )
      .then(() => true)
      .catch(() => false);
    const wall = await page.locator('main a[href="/signup"]').count();
    if (!landed || (scene.screen === "save") !== wall > 0) {
      await context.close();
      return "missed";
    }
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        try {
          a.finish();
        } catch {}
      }
    });
    await check(page, at, theme);
    const inner = await page.evaluate(stageBands, { scope: STAGE });
    const say = (g) => `${Math.round(g.size)}px at y${Math.round(g.at)} between ${g.above} and ${g.below}`;
    if (inner.none) lines.push(`      ${at} (${theme}): no stage to measure inside`);
    else {
      const worst = inner.gaps.reduce((a, g) => (g.size > (a?.size ?? -1) ? g : a), null);
      const ok = !worst || worst.size <= LIMIT;
      if (ok) passed += 1;
      else failed += 1;
      lines.push(`${ok ? "ok  " : "FAIL"}  ${at} inside its stage (${theme}): largest ${worst ? say(worst) : "none"}`);
      if (VERBOSE || !ok) for (const g of inner.gaps.filter((g) => g.size > 24)) lines.push(`        ${say(g)}`);
    }
  } catch (e) {
    failed += 1;
    lines.push(`FAIL  ${at} (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
  } finally {
    await context.close().catch(() => {});
    F.repsMode.rows = null;
    F.extraReps.splice(0, F.extraReps.length);
  }
  return "shot";
}

for (const [name, scene] of Object.entries(SINCE_SCENES)) {
  if (!want(name)) continue;
  for (const size of SINCE_SIZES) {
    for (const theme of size.themes) {
      /* A way in that misses (the exit's beat raced a read) is tried once more. */
      if ((await sinceShot(name, scene, theme, size)) === "missed" && (await sinceShot(name, scene, theme, size)) === "missed") {
        failed += 1;
        lines.push(`FAIL  ${name} ${size.width}x${size.height} (${theme}): the exit never reached the ${scene.screen === "save" ? "save wall" : "progress moment"}`);
      }
    }
  }
}

for (const theme of ["light", "dark"]) {
  const { context, page } = await open(theme);
  for (const [name, path, ready, opts] of SCREENS) {
    if (!want(name)) continue;
    try {
      await page.goto(`${BASE}${path}`);
      await page.waitForSelector(ready, { timeout: 20000 });
      await settled(page);
      await sleep(900);
      await check(page, name, theme, opts);
    } catch (e) {
      failed += 1;
      lines.push(`FAIL  ${name} (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
    }
  }

  /* Say it better (#507), on its own fixtures: You's first card, the
     page full, with nothing due, and new, and the test's first line.
     The fixtures are put back after, for the screens that follow. */
  const SAY_SCREENS = [
    ["say-you", "/you", "[data-look='say-card'] .arrive", {}],
    ["say", "/say", "[data-say-count]", {}],
    ["say-dry", "/say", "[data-say-dry]", { dry: true }],
    ["say-new", "/say", "main h1", { empty: true }],
    ["say-test", "/say/test", "[data-say-sentence]", {}],
  ];
  for (const [name, path, ready, mode] of SAY_SCREENS) {
    if (!want(name)) continue;
    const kept = { ...sayMode };
    const keptRows = savedWordsMode.rows;
    Object.assign(sayMode, { on: true, dry: !!mode.dry, empty: !!mode.empty, table: "ok", written: [] });
    savedWordsMode.rows = mode.empty ? [] : SAY_SAVED.map((r) => ({ ...r }));
    try {
      await page.goto(`${BASE}${path}`);
      await page.waitForSelector(ready, { timeout: 20000 });
      await settled(page);
      await sleep(900);
      await check(page, name, theme);
    } catch (e) {
      failed += 1;
      lines.push(`FAIL  ${name} (${theme}): ${String(e.message ?? e).split("\n")[0]}`);
    } finally {
      Object.assign(sayMode, kept);
      savedWordsMode.rows = keptRows;
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
      /* A forced tap lands where the button is: scrolled only until its foot shows, Unlock sat under the floating tab bar once Practice's boss card lost its two clock lines (#486), so it is centred first. */
      await page.$eval(".premium-wall", (el) => el.scrollIntoView({ block: "center" }));
      await page.click(".premium-wall", { force: true });
      if (!(await page.waitForSelector(slider, { timeout: 3000 }).catch(() => null))) {
        await page.$eval(".premium-wall", (el) => el.scrollIntoView({ block: "center" }));
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

  const rep = ["rep-idle", "rep-live", "rep-celebration", "rep-results", "rep-sheet"];
  if (rep.some(want)) {
    try {
      await page.goto(`${BASE}/rep?lesson=h4`);
      await page.waitForSelector('button[data-record="start"]', { timeout: 20000 });
      await sleep(600);
      if (want("rep-idle")) await check(page, "rep-idle", theme);
      // `force`: Record breathes, and Playwright waits for it to hold still (#242).
      await page.click('button[data-record="start"]', { force: true });
      await page.waitForSelector('button[aria-label="Stop and score this recording"]');
      await sleep(2500);
      if (want("rep-live")) await check(page, "rep-live", theme);
      await page.click('button[aria-label="Stop and score this recording"]', { force: true });
      /* The streak's moment no longer rises over the results: since #480
         it is a screen of its own on the way out, measured last, below. */
      await page.waitForSelector("main .arrive-x", { timeout: 15000 });
      await sleep(2400);
      if (want("rep-results")) await check(page, "rep-results", theme);
      /* #427: the results are one glance (rep-results) and its door's
         sheet, measured inside the sheet as the paywall is. */
      if (want("rep-sheet")) {
        await page.locator("main [data-glance-door]").click();
        await page.waitForSelector('[role="dialog"][aria-label="Every number"]', { timeout: 4000 });
        await sleep(900);
        await check(page, "rep-sheet", theme, { scope: '[role="dialog"] [data-whole-recording]' });
      }
      /* The streak's moment on the way out (#480), settled: since #496 its
         flame takes the free height, so it is held to 64 like every
         screen. Held for its one tap, its first screen, no scroll and its
         bands at three sizes by scripts/look-streak.mjs. */
      if (want("rep-celebration")) {
        const SHEET = '[role="dialog"][aria-label="Every number"]';
        if (await page.locator(SHEET).count()) {
          await page.keyboard.press("Escape");
          await page.waitForSelector(SHEET, { state: "detached", timeout: 3000 }).catch(() => {});
        }
        await page.locator("main [data-results-back]").click();
        const up = await page.waitForSelector("[data-streak-moment]", { timeout: 4000 }).catch(() => null);
        if (up) {
          await page.evaluate(() => {
            for (const a of document.getAnimations()) {
              try {
                a.finish();
              } catch {}
            }
          });
          await check(page, "rep-celebration", theme);
        } else lines.push(`note  rep-celebration (${theme}): no streak moment on the way out (today already spoken)`);
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
  /* Five questions since #501: the goal, the place and the beat went
     (scripts/look-welcome.mjs walks the same five). */
  const ANSWERS = [
    { id: "name", type: "text", value: "Tim" },
    { id: "ageBand", labels: ["18 to 24"] },
    { id: "pains", labels: ["I rush", "I ramble"] },
    { id: "level", labels: ["A bit, a class or a few talks"] },
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
    /* The walk opens on the room (#475): a full-bleed scene with no
       bands to measure. Not now is the way to the questions. */
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await sleep(500);
    let k = 0;
    for (const q of ANSWERS) {
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
    await kb.page.getByRole("button", { name: "Not now", exact: true }).click();
    await sleep(500);
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
