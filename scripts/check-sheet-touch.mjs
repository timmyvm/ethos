/**
 * A finger on a sheet, checked with real touches (handoff). Every case is
 * a CDP touch sequence in an iPhone-sized `isMobile` `hasTouch` context,
 * moved by the clock, on a fresh sheet. Synthetic PointerEvents are not
 * enough here: check-apple sends those, and it passed while a bug broke
 * every real swipe (the browser's pan took the touch and cancelled the
 * pointer, which a synthetic event never meets).
 *
 * What it holds:
 *  - the paywall with nothing scrolled (notes1, rounds 2 and 3): a swipe
 *    down from each region with room under it closes the sheet, a swipe
 *    up scrolls the body, a jittered tap on Start presses it, a slow
 *    short pull springs home, and the stair scrubs sideways, drifting or
 *    not;
 *  - the hand-off (Timothy: "Yea add that"): one swipe down on content
 *    scrolled part way scrolls it back to its top and then pulls the
 *    sheet, closing it when long enough and springing it home when not;
 *    finger travel equals scroll travelled plus sheet offset on every
 *    frame; back up inside the same touch, the sheet comes to rest and
 *    then the content scrolls again; let go before the top, the content
 *    glides, decays and stops, and the sheet stays; a press on the glide
 *    stops it and presses nothing; an upward first move is the browser's
 *    own scroll; a mouse there selects text and the wheel scrolls;
 *  - the hand-off on the manage sheet held sideways (upright, no sheet
 *    but the paywall scrolls), and a swipe off it and the trait sheet;
 *  - the review's findings (handoff review), each a touch that went wrong
 *    before: a tap on Start or Not yet while the content glides presses
 *    it; a second finger mid-pull never strands the sheet; a finger held
 *    still before it lifts throws nothing; a sheet caught springing home
 *    holds where it is caught, and a tap on it presses what is under the
 *    finger; a sheet still rising is the finger's from where it is, the
 *    content put; Escape mid-pull plays the whole exit; a first reading
 *    that is level, still or a pixel up, still hands off; so does a first
 *    move the stair held, the way iOS reads it, and a level first move on
 *    content at its top is held and driven both ways; the content follows
 *    the finger from where it crossed the slop, so a first move that lands
 *    30px in moves it 20px and a one-move flick scrolls and glides; a glide
 *    that meets the top with speed bounces, and a finger run past the
 *    content's end gives with resistance and springs back.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-sheet-touch.mjs
 *
 *   SECTIONS=2,6 node scripts/check-sheet-touch.mjs   # some of the six
 *
 * Frames are read in the page every animation frame: where the finger
 * is (the last touchmove), the scrolled content's scrollTop, and the
 * panel's translateY.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { billingApiRoute, json, resetPlan, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? process.env.BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const started = Date.now();
const SECTIONS = process.env.SECTIONS ? process.env.SECTIONS.split(",").map(Number) : [1, 2, 3, 4, 5, 6];
const section = (n) => SECTIONS.includes(n);
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

const PAYWALL = '[role="dialog"] .paywall-scroll';
const SLIDER = '[role="dialog"] [role="slider"]';

/** A phone: a context, its page, real touches, and the frame recorder. */
async function phone(W, H, { reduced = false, plan = "free" } = {}) {
  resetPlan(plan);
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: "light",
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/billing/*", billingApiRoute);
  await context.addInitScript(seed, { theme: "light", session });
  if (reduced) {
    await context.addInitScript(() => {
      const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
      localStorage.setItem("ethos.prefs", JSON.stringify({ ...prefs, reducedMotion: true }));
    });
  }
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    window.__ev = [];
    window.__fy = null;
    window.__touching = false;
    for (const t of ["pointercancel", "click"]) window.addEventListener(t, () => window.__ev.push(t), true);
    window.addEventListener("touchstart", (e) => { window.__fy = e.touches[0]?.clientY ?? null; window.__touching = true; }, { capture: true, passive: true });
    window.addEventListener("touchmove", (e) => { if (e.touches[0]) window.__fy = e.touches[0].clientY; }, { capture: true, passive: true });
    window.addEventListener("touchend", () => { window.__touching = false; }, { capture: true, passive: true });
    /** Every frame until stopped: finger, scrollTop of `sel`, the panel's offset. */
    window.__rec = (sel) => {
      const frames = [];
      let on = true;
      const panel = document.querySelector('[role="dialog"] > div');
      const sc = document.querySelector(sel);
      const tick = () => {
        if (!on) return;
        const ty = panel?.isConnected ? new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42 : null;
        frames.push({ t: performance.now(), fy: window.__fy, touching: window.__touching, st: sc?.isConnected ? sc.scrollTop : null, ty });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.__stopRec = () => { on = false; return frames; };
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
    });
  /**
   * One touch along `legs` ({ dx, dy, speed px/s }), each moved by the
   * clock: a move every ~12ms to where the finger is at that instant.
   * `hold` ms still before letting go (0 lets go on the last move's heels).
   */
  async function gesture(x, y, legs, { hold = 16 } = {}) {
    await touch("touchStart", x, y);
    for (const { dx = 0, dy = 0, speed = 800 } of legs) {
      const T = (Math.hypot(dx, dy) / speed) * 1000;
      const t0 = Date.now();
      const [x0, y0] = [x, y];
      for (;;) {
        await sleep(12);
        const u = Math.min(1, (Date.now() - t0) / T);
        x = x0 + dx * u;
        y = y0 + dy * u;
        await touch("touchMove", x, y);
        if (u >= 1) break;
      }
    }
    if (hold) await sleep(hold);
    await touch("touchEnd");
    return { x, y };
  }
  const swipe = (x, y, dx, dy, speed = 800, opts) => gesture(x, y, [{ dx, dy, speed }], opts);
  /** Every finger that is down, as [[x, y, id], ...]: for a second finger. */
  const fingers = (type, points = []) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
    });
  /** One finger moved straight to (x, y + dy) by the clock, still down at the end. */
  async function drag(x, y, dy, speed = 600) {
    const T = (Math.abs(dy) / speed) * 1000;
    const t0 = Date.now();
    for (;;) {
      await sleep(12);
      const u = Math.min(1, (Date.now() - t0) / T);
      await touch("touchMove", x, y + dy * u);
      if (u >= 1) return y + dy;
    }
  }
  return { context, page, touch, gesture, swipe, fingers, drag, W, H };
}

const isOpen = async (page, sel = '[role="dialog"]') => (await page.locator(sel).count()) > 0;
const record = (page, sel) => page.evaluate((sel) => { window.__ev = []; window.__rec(sel); }, sel);
const stopRecord = (page) => page.evaluate(() => window.__stopRec());
const events = (page) => page.evaluate(() => window.__ev);
const scrollOf = (page, sel = PAYWALL) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? { top: el.scrollTop, max: el.scrollHeight - el.clientHeight } : null;
  }, sel);
const panelY = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('[role="dialog"] > div');
    return p ? new DOMMatrixReadOnly(getComputedStyle(p).transform).m42 : null;
  });
const setScroll = (page, where, sel = PAYWALL) =>
  page.evaluate(
    ([where, sel]) => {
      const el = document.querySelector(sel);
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = where === "top" ? 0 : where === "end" ? max : where === "mid" ? Math.round(max / 2) : where;
    },
    [where, sel]
  );
/** The sheet's slop, px (lib/sheet-gesture.ts SHEET_SLOP_PX): the content follows the finger from there. */
const SLOP = 10;
/**
 * The body scrolled to `where`, or further down when that leaves less
 * than `room` px above it. Since the paywall's one-line benefits (E40)
 * the 375x667 body scrolls 61px, so its middle is 31px down: a case
 * whose finger must let go before the top, after a run that spends
 * `room` px of scroll, starts lower, where the body has that room. If
 * the body has less, it stops at its end and the case's own check of
 * where the finger let go fails it.
 */
async function scrollWithRoom(page, where, room, sel = PAYWALL) {
  await setScroll(page, where, sel);
  const s = await scrollOf(page, sel);
  if (s.top < room) await setScroll(page, Math.min(s.max, room), sel);
  return scrollOf(page, sel);
}
/** The last frame the finger was down: where the content and the sheet were at the let go. */
const letGo = (frames) => frames.filter((f) => f.touching).at(-1) ?? null;
const beforeTop = (f) => !!f && f.st > 0.5 && (f.ty ?? 0) < 0.5;

/** Where to put a finger on `sel`: inside its box, clear of the scroller's faded edges and the screen's. */
const pointOf = (page, sel, scroller = PAYWALL) =>
  page.evaluate(
    ([sel, scroller]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const sc = document.querySelector(scroller);
      let top = r.top;
      let bottom = r.bottom;
      if (sc && sc.contains(el)) {
        const s = sc.getBoundingClientRect();
        top = Math.max(top, s.top + 18);
        bottom = Math.min(bottom, s.bottom - 2);
      }
      top = Math.max(top, 2);
      bottom = Math.min(bottom, innerHeight - 2);
      if (bottom - top < 2) return null;
      return { x: Math.round(r.left + Math.min(40, r.width / 2)), y: Math.round((top + bottom) / 2) };
    },
    [sel, scroller]
  );

/**
 * Finger travel against scroll travelled plus sheet offset, frame by
 * frame while the finger is down and past the slop: `fy + st - ty` holds
 * one value from the move that took the touch to the let go. The worst
 * miss, px, and how many frames were read.
 */
function continuity(frames, y0) {
  const live = frames.filter((f) => f.touching && f.fy !== null && Math.abs(f.fy - y0) >= 10 && f.st !== null && f.ty !== null);
  if (live.length < 4) return { miss: Infinity, n: live.length };
  const c0 = live[0].fy + live[0].st - live[0].ty;
  const miss = Math.max(...live.map((f) => Math.abs(f.fy + f.st - f.ty - c0)));
  return { miss: Math.round(miss * 100) / 100, n: live.length };
}

/** The paywall over Practice, fresh, nothing scrolled. */
async function paywall(p) {
  const { page } = p;
  if (!p.loaded) {
    await page.goto(`${BASE}/games`);
    await page.waitForSelector(".premium-wall", { timeout: 60000 });
    await sleep(600);
    p.loaded = true;
  }
  if (await isOpen(page)) {
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 4000 }).catch(() => {});
    await sleep(150);
  }
  await page.locator(".premium-wall").click({ force: true });
  await page.waitForSelector(SLIDER, { timeout: 8000 });
  await sleep(1000);
}

/* Each region of the paywall, by selector (notes1, round 2). The caption
   sits below the fold at 375x667 until the body is scrolled, so it is
   swiped from in the hand-off cases instead, as the last thing in the
   scrolled body. Where the terms stand in the tap shelf instead (D40), the
   body ends on the stair's month labels, and those stand in for it. */
const REGIONS = [
  ["grabber", ".card-premium .h-1.w-10"],
  ["mark", ".card-premium .label-micro"],
  ["headline", ".card-premium h2"],
  ["benefits", ".card-premium ul li:nth-child(3)"],
  ["readout", '.card-premium section[aria-labelledby="paywall-ladder-head"] > div[aria-hidden]'],
  ["stair", ".card-premium .stair-col:nth-child(4)"],
  [
    "caption",
    '.card-premium section[aria-labelledby="paywall-ladder-head"] > p:last-child, ' +
      '.card-premium section[aria-labelledby="paywall-ladder-head"] > .stair-wrap:last-child .stair-labels',
  ],
  ["start", ".card-premium > div:last-child button"],
  ["notyet", ".card-premium > div:last-child > button:last-of-type"],
  ["money", ".card-premium > div:last-child > p:last-child"],
];
const READOUT = REGIONS[4][1];
const BENEFITS = REGIONS[3][1];
const CAPTION = REGIONS[6][1];
const STEP = (n) => `.card-premium .stair-col:nth-child(${n})`;
const valueNow = (page) => page.locator(SLIDER).getAttribute("aria-valuenow").catch(() => "gone");

// ---- 1. The paywall with nothing scrolled, 375x667 -----------------------
if (section(1)) {
  const p = await phone(375, 667);
  const { page, swipe, touch, H } = p;
  for (const [region, sel] of REGIONS) {
    if (region === "caption") continue;
    await paywall(p);
    const pt = await pointOf(page, sel);
    if (!pt) {
      ok(`not scrolled: a swipe down from the ${region} closes the paywall`, false, "off screen");
      continue;
    }
    await swipe(pt.x, pt.y, 0, H - 4 - pt.y);
    await sleep(800);
    ok(`not scrolled: a swipe down from the ${region} closes the paywall`, !(await isOpen(page)), `from y ${pt.y}`);
  }

  // Up from the top scrolls the body, the browser's own scroll.
  await paywall(p);
  {
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, -160);
    await sleep(600);
    await stopRecord(page);
    const s = await scrollOf(page);
    const ev = await events(page);
    ok("not scrolled: a swipe up scrolls the body, natively", s.top > 40 && (await isOpen(page)) && ev.includes("pointercancel"), `scrollTop 0 -> ${Math.round(s.top)}`);
  }

  // A jittered tap on Start presses it.
  await paywall(p);
  {
    const pt = await pointOf(page, REGIONS[7][1]);
    await touch("touchStart", pt.x, pt.y);
    await sleep(30);
    await touch("touchMove", pt.x + 1, pt.y + 2);
    await sleep(30);
    await touch("touchEnd");
    await sleep(600);
    ok("a tap on Start with 2px of jitter presses it", (await page.locator("#premium-code").count()) > 0);
  }

  // A press on a field is the field's: the invite code, then a swipe down from it.
  {
    const pt = await page.locator("#premium-code").boundingBox();
    if (pt) {
      await swipe(pt.x + 20, pt.y + pt.height / 2, 0, 120, 600);
      await sleep(700);
      ok("a swipe from the invite code field leaves the sheet where it is", (await isOpen(page)) && Math.abs(await panelY(page)) < 1);
    } else ok("a swipe from the invite code field leaves the sheet where it is", false, "no field");
  }

  // A slow short pull on Start springs home and presses nothing.
  await paywall(p);
  {
    const pt = await pointOf(page, REGIONS[7][1]);
    await swipe(pt.x, pt.y, 0, 30, 300);
    await sleep(800);
    const code = (await page.locator("#premium-code").count()) > 0;
    ok("a slow 30px pull on Start springs home and presses nothing", (await isOpen(page)) && !code && Math.abs(await panelY(page)) < 1);
  }

  // The stair scrubs sideways, and through a drift up or down.
  for (const drift of [0, 24, -24]) {
    await paywall(p);
    const a = await pointOf(page, STEP(1));
    const b = await pointOf(page, STEP(6));
    await swipe(a.x, a.y, b.x - a.x, drift, 500);
    await sleep(400);
    const v = await valueNow(page);
    ok(`the stair scrubs from month 1 to 6${drift ? `, drifting ${drift > 0 ? "down" : "up"} ${Math.abs(drift)}px` : ""}`, v === "6" && (await isOpen(page)), `now ${v}`);
  }
  await p.context.close();
}

// ---- 2. The hand-off, 375x667 --------------------------------------------
if (section(2)) {
  const p = await phone(375, 667);
  const { page, swipe, gesture, touch, H } = p;

  // One swipe from the readout with the body at its end: the content to
  // its top, then the sheet, closed.
  await paywall(p);
  {
    await setScroll(page, "end");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, READOUT);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, H - 4 - pt.y);
    await sleep(800);
    const frames = await stopRecord(page);
    const closed = !(await isOpen(page));
    const firstSheet = frames.find((f) => f.touching && f.ty > 0.5);
    const c = continuity(frames, pt.y);
    ok("hand-off: one swipe from the end of the body reaches the top, then closes the paywall", closed && !!firstSheet, `scrollTop ${Math.round(s0.top)}, swipe ${H - 4 - pt.y}px`);
    ok("hand-off: the sheet starts to move only once the content is at its top", !!firstSheet && firstSheet.st <= 0.5, firstSheet ? `scrollTop ${firstSheet.st} when the sheet first moved` : "the sheet never moved");
    ok("hand-off: finger travel = scroll + sheet within 1px on every frame", c.miss <= 1, `worst ${c.miss}px over ${c.n} frames`);
    ok("hand-off: the content never scrolls past where the finger has taken it", frames.every((f) => f.st === null || f.st <= s0.top + 0.5));
  }

  // Mid-scroll, a short swipe scrolls the content back and leaves the sheet.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, BENEFITS);
    await swipe(pt.x, pt.y, 0, 40, 300, { hold: 120 });
    await sleep(600);
    const s1 = await scrollOf(page);
    ok("hand-off: a short swipe on mid-scroll content scrolls it back and leaves the sheet", (await isOpen(page)) && s1.top < s0.top - 10 && Math.abs(await panelY(page)) < 1, `scrollTop ${Math.round(s0.top)} -> ${Math.round(s1.top)}`);
  }

  // A swipe that only just passes the top springs the sheet home, the content at 0.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, s0.top + 90, 300, { hold: 150 });
    await sleep(900);
    const frames = await stopRecord(page);
    const most = Math.max(...frames.map((f) => f.ty ?? 0));
    const s1 = await scrollOf(page);
    const y1 = await panelY(page);
    ok("hand-off: a short pull past the top springs the sheet home, the content at 0", (await isOpen(page)) && most > 20 && Math.abs(y1) < 1 && s1.top <= 0.5, `sheet reached ${Math.round(most)}px, now ${Math.round(y1)}; scrollTop ${Math.round(s1.top)}`);
  }

  // Back up inside the same touch: the sheet to rest, then the content scrolls again.
  await paywall(p);
  {
    await setScroll(page, "end");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, READOUT);
    await record(page, PAYWALL);
    await gesture(pt.x, pt.y, [{ dy: s0.top + 110, speed: 600 }, { dy: -170, speed: 600 }], { hold: 150 });
    const frames = await stopRecord(page);
    await sleep(700);
    const live = frames.filter((f) => f.touching);
    const most = Math.max(...live.map((f) => f.ty ?? 0));
    const last = live[live.length - 1];
    const both = live.filter((f) => f.ty > 0.5 && f.st > 0.5).length;
    const c = continuity(frames, pt.y);
    ok("hand-off: reversed in one touch, the sheet comes back to rest and the content scrolls again", most > 20 && last.ty < 0.5 && last.st > 20 && (await isOpen(page)), `sheet reached ${Math.round(most)}px, then scrollTop ${Math.round(last.st)}`);
    ok("hand-off: never both at once, and finger = scroll + sheet through the reversal", both === 0 && c.miss <= 1, `${both} frames moved both; worst ${c.miss}px over ${c.n} frames`);
  }

  // A fast flick on mid-scroll content: it glides to the top and stops
  // there. The finger lets go before the top, so the glide reaches it:
  // the flick spends 50px of scroll past the slop, and the body starts
  // with 8px more than that (since E40 its middle, 31px, is less; a
  // finger that runs past the top hands the rest to the sheet, and a
  // throw that fast closes it, as the hand-off should).
  await paywall(p);
  {
    const s0 = await scrollWithRoom(page, "mid", 60 - SLOP + 8);
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, 60, 1500, { hold: 0 });
    await sleep(1200);
    const frames = await stopRecord(page);
    const s1 = await scrollOf(page);
    const most = Math.max(...frames.map((f) => f.ty ?? 0));
    const at = letGo(frames);
    ok("hand-off: a flick that glides to the top stops there, and the sheet stays", beforeTop(at) && (await isOpen(page)) && s1.top <= 0.5 && most < 0.5, `from scrollTop ${Math.round(s0.top)}, let go at ${at ? Math.round(at.st) : "?"}; scrollTop ${s1 ? Math.round(s1.top) : "closed"}, sheet max ${most}px`);
  }

  // Up first is the browser's own scroll, from mid-scroll.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, -110);
    await sleep(600);
    await stopRecord(page);
    const s1 = await scrollOf(page);
    const ev = await events(page);
    ok("an upward first move on scrolled content is the browser's scroll", s1.top > s0.top + 20 && ev.includes("pointercancel") && (await isOpen(page)), `scrollTop ${Math.round(s0.top)} -> ${Math.round(s1.top)}`);
  }

  // A jittered tap on a step in scrolled content still presses it.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, STEP(4));
    await touch("touchStart", pt.x, pt.y);
    await sleep(30);
    await touch("touchMove", pt.x + 1, pt.y + 2);
    await sleep(30);
    await touch("touchEnd");
    await sleep(500);
    const s1 = await scrollOf(page);
    ok("a tap with 2px of jitter on a step in scrolled content presses it", (await valueNow(page)) === "4" && Math.abs(s1.top - s0.top) < 1, `month ${await valueNow(page)}`);
  }

  // Sideways on the stair in scrolled content is still the stair's.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const a = await pointOf(page, STEP(1));
    const b = await pointOf(page, STEP(6));
    await swipe(a.x, a.y, b.x - a.x, 12, 500);
    await sleep(400);
    const s1 = await scrollOf(page);
    ok("a sideways swipe on the stair in scrolled content scrubs it", (await valueNow(page)) === "6" && Math.abs(s1.top - s0.top) < 1 && (await isOpen(page)), `month ${await valueNow(page)}`);
  }

  // A mouse is never the hand-off's: a drag selects, the wheel scrolls.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, BENEFITS);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(pt.x + 30, pt.y + i * 12);
      await sleep(16);
    }
    const y = await panelY(page);
    await page.mouse.up();
    const picked = await page.evaluate(() => window.getSelection()?.toString().length ?? 0);
    await sleep(300);
    ok("a mouse drag on scrolled content selects its text and never moves the sheet", Math.abs(y) < 0.5 && picked > 0 && (await isOpen(page)), `${picked} characters selected`);
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await setScroll(page, s0.top);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.wheel(0, -50);
    await sleep(500);
    const s1 = await scrollOf(page);
    ok("the wheel on scrolled content scrolls it", s1.top < s0.top - 10 && Math.abs(await panelY(page)) < 0.5, `scrollTop ${Math.round(s0.top)} -> ${Math.round(s1.top)}`);
  }
  await p.context.close();
}

// ---- 3. The hand-off with a long body, 320x568 ---------------------------
if (section(3)) {
  const p = await phone(320, 568);
  const { page, swipe, touch, H } = p;

  for (const [where, region, sel] of [["mid", "benefits", BENEFITS], ["end", "readout", READOUT]]) {
    await paywall(p);
    await setScroll(page, where);
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, sel);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, H - 4 - pt.y);
    await sleep(800);
    const frames = await stopRecord(page);
    const c = continuity(frames, pt.y);
    ok(`320x568 hand-off: one swipe from the ${region}, body ${where === "mid" ? "half" : "all the way"} down, closes the paywall`, !(await isOpen(page)) && c.miss <= 1, `scrollTop ${Math.round(s0.top)}, swipe ${H - 4 - pt.y}px; worst ${c.miss}px over ${c.n} frames`);
  }

  // Let go before the top: it glides on, slows the way a UIScrollView does, and stops; the sheet stays.
  await paywall(p);
  {
    await setScroll(page, "end");
    await sleep(200);
    const pt = await pointOf(page, CAPTION);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, 110, 400, { hold: 0 });
    await sleep(1800);
    const frames = await stopRecord(page);
    const lastDown = frames.findLastIndex((f) => f.touching);
    const after = lastDown >= 0 ? frames.slice(lastDown + 1) : [];
    const atLetGo = after[0]?.st ?? 0;
    const end = after[after.length - 1]?.st ?? 0;
    // Its speed over the first 120ms after the let go, and 200ms later.
    const speed = (from, to) => {
      const t0 = after[0].t;
      const a = after.find((f) => f.t - t0 >= from);
      const b = after.find((f) => f.t - t0 >= to);
      return a && b ? ((a.st - b.st) / (b.t - a.t)) * 1000 : 0;
    };
    const v1 = speed(0, 120);
    const v2 = speed(200, 320);
    const rested = after.filter((f) => f.t > after[after.length - 1].t - 300).every((f) => Math.abs(f.st - end) < 0.5);
    const sheetStill = frames.every((f) => (f.ty ?? 0) < 0.5);
    ok("glide: let go before the top, the content glides on and stops; the sheet stays", atLetGo - end > 20 && end > 0.5 && rested && sheetStill && (await isOpen(page)), `scrollTop ${Math.round(atLetGo)} at the let go, rests at ${Math.round(end)}`);
    // 0.998 a millisecond keeps 67% of the speed over 200ms.
    const kept = v1 > 0 ? v2 / v1 : 0;
    ok("glide: it decays at about 0.998 a millisecond", kept > 0.5 && kept < 0.85, `${Math.round(v1)} px/s, then ${Math.round(v2)} px/s 200ms on (${Math.round(kept * 100)}% kept)`);
  }

  // A touch on the glide stops it where it is, and presses nothing under it.
  await paywall(p);
  {
    await setScroll(page, "end");
    await sleep(200);
    const pt = await pointOf(page, CAPTION);
    await swipe(pt.x, pt.y, 0, 110, 400, { hold: 0 });
    await sleep(90);
    const step = await pointOf(page, STEP(3));
    await touch("touchStart", step.x, step.y);
    const caught = (await scrollOf(page)).top;
    await sleep(40);
    await touch("touchEnd");
    await sleep(500);
    const later = (await scrollOf(page)).top;
    const month = await valueNow(page);
    ok("glide: a touch on it stops it where it is and presses nothing", Math.abs(later - caught) < 2 && month === "1" && (await isOpen(page)), `caught at ${Math.round(caught)}, ${Math.round(later)} after; month ${month}`);
  }
  await p.context.close();
}

// ---- 4. Reduce Motion keeps the glide and the hand-off --------------------
if (section(4)) {
  const p = await phone(320, 568, { reduced: true });
  const { page, swipe, H } = p;
  await paywall(p);
  {
    await setScroll(page, "end");
    await sleep(200);
    const pt = await pointOf(page, CAPTION);
    await swipe(pt.x, pt.y, 0, 110, 400, { hold: 0 });
    const atLetGo = (await scrollOf(page)).top;
    await sleep(1500);
    const end = (await scrollOf(page)).top;
    ok("Reduce Motion: let go mid-scroll, the content still glides", atLetGo - end > 20 && (await isOpen(page)), `${Math.round(atLetGo)} -> ${Math.round(end)}`);
  }
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    await swipe(pt.x, pt.y, 0, H - 4 - pt.y);
    await sleep(900);
    ok("Reduce Motion: one swipe from mid-scroll content still closes the paywall", !(await isOpen(page)));
  }
  await p.context.close();
}

// ---- 5. The other sheets: the manage sheet and the trait sheet ----------
/*
 * Neither scrolls on a phone held upright: the manage sheet is 458px
 * (484 asking to cancel) and the trait sheet less, under the 552 a
 * 320x568 screen gives a sheet. Held sideways (568x320) the manage sheet
 * scrolls, so the hand-off is checked there; upright, a swipe closes both.
 */
if (section(5)) {
  const openManage = async (page) => {
    await page.goto(`${BASE}/you`);
    await page.waitForSelector('[data-look="plan-card"]', { timeout: 60000 });
    await sleep(600);
    await page.locator('[data-look="plan-card"]').first().click();
    await page.waitForSelector('[role="dialog"]');
    await sleep(1100);
  };
  const MANAGE = '[role="dialog"] > div > div';
  {
    const p = await phone(568, 320, { plan: "active3" });
    const { page, swipe, H } = p;
    await openManage(page);
    const room = await scrollOf(page, MANAGE);
    if (room && room.max > 30) {
      await setScroll(page, "mid", MANAGE);
      await sleep(200);
      const s0 = await scrollOf(page, MANAGE);
      const pt = await page.evaluate((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { x: Math.round(r.left + 40), y: Math.round(r.top + 30) };
      }, MANAGE);
      await record(page, MANAGE);
      await swipe(pt.x, pt.y, 0, H - 4 - pt.y);
      await sleep(900);
      const frames = await stopRecord(page);
      const c = continuity(frames, pt.y);
      const firstSheet = frames.find((f) => f.touching && f.ty > 0.5);
      ok("manage sheet, held sideways: one swipe from its scrolled body reaches the top, then closes it", !(await isOpen(page)) && !!firstSheet && firstSheet.st <= 0.5, `scrollTop ${Math.round(s0.top)} of ${room.max}, swipe ${H - 4 - pt.y}px`);
      ok("manage sheet, held sideways: finger = scroll + sheet within 1px on every frame", c.miss <= 1, `worst ${c.miss}px over ${c.n} frames`);
    } else {
      ok("manage sheet, held sideways: one swipe from its scrolled body reaches the top, then closes it", false, `it does not scroll (${room?.max}px)`);
    }
    await p.context.close();
  }
  {
    const p = await phone(320, 568, { plan: "active3" });
    const { page, swipe, H } = p;
    await openManage(page);
    const pt = await page.evaluate(() => {
      const r = document.querySelector('[role="dialog"] .stair')?.getBoundingClientRect();
      return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + r.height / 2, innerHeight - 40)) } : null;
    });
    await swipe(pt.x, pt.y, 0, H - 4 - pt.y);
    await sleep(900);
    ok("manage sheet, 320x568: a swipe down from its stair closes it", !(await isOpen(page)));
    await page.goto(`${BASE}/you`);
    await page.waitForSelector('main button[aria-haspopup="dialog"]', { timeout: 60000 });
    await sleep(600);
    await page.locator('main button[aria-haspopup="dialog"]').first().click();
    await page.waitForSelector('[role="dialog"]');
    await sleep(1000);
    const at = await page.evaluate(() => {
      const r = document.querySelector('[role="dialog"] p')?.getBoundingClientRect();
      return r ? { x: Math.round(r.left + 30), y: Math.round(r.top + Math.min(12, r.height / 2)) } : null;
    });
    await swipe(at.x, at.y, 0, H - 4 - at.y);
    await sleep(900);
    ok("trait sheet, 320x568: a swipe down from its text closes it", !(await isOpen(page)));
    await p.context.close();
  }
}

// ---- 6. The review's findings (handoff review) ---------------------------
/*
 * Each case here went wrong on the first hand-off build, measured by the
 * review with real touches; each check is what a UIKit sheet does.
 */
if (section(6)) {
  const START = REGIONS[7][1];
  const NOTYET = REGIONS[8][1];
  const centre = async (page, sel) => {
    const b = await page.locator(sel).first().boundingBox();
    return b ? { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } : null;
  };
  const tap = async ({ touch }, { x, y }) => {
    await touch("touchStart", x, y);
    await sleep(40);
    await touch("touchEnd");
  };
  const dragMark = (page) =>
    page.evaluate(() => document.querySelector('[role="dialog"] > div')?.getAttribute("data-dragging") ?? null);
  const codeShown = async (page) => (await page.locator("#premium-code").count()) > 0;

  // Start and Not yet sit outside the content a glide moves: a tap there
  // presses them, glide or not. Only a press on the content is the glide's.
  {
    const p = await phone(320, 568);
    const { page, swipe } = p;
    for (const [name, sel] of [["Not yet", NOTYET], ["Start", START]]) {
      await paywall(p);
      await setScroll(page, "end");
      await sleep(200);
      const pt = await pointOf(page, CAPTION);
      await swipe(pt.x, pt.y, 0, 110, 400, { hold: 0 });
      await sleep(110);
      const a = (await scrollOf(page)).top;
      await sleep(30);
      const b = (await scrollOf(page)).top;
      await tap(p, await centre(page, sel));
      await sleep(700);
      const pressed = name === "Not yet" ? !(await isOpen(page)) : await codeShown(page);
      ok(`glide: a tap on ${name}, outside the gliding content, presses it`, Math.abs(a - b) > 0.5 && pressed, `gliding ${Math.round(a)} -> ${Math.round(b)} at the tap`);
    }
    await p.context.close();
  }

  const p = await phone(375, 667);
  const { page, touch, fingers, drag, swipe, gesture, H } = p;

  // A second finger on a sheet the first is pulling is nobody's: the first
  // keeps it, and its let go settles it. Before, the sheet was stranded
  // mid-screen, still marked as dragged.
  for (const order of ["the second lifts first", "the first lifts first"]) {
    await paywall(p);
    await setScroll(page, "end");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, READOUT);
    await touch("touchStart", pt.x, pt.y);
    const y1 = await drag(pt.x, pt.y, s0.top + 120, 600);
    await sleep(60);
    const mid = await panelY(page);
    await fingers("touchStart", [[pt.x, y1, 1], [200, 200, 2]]);
    await sleep(60);
    // touchEnd names the fingers still down.
    await fingers("touchEnd", order === "the second lifts first" ? [[pt.x, y1, 1]] : [[200, 200, 2]]);
    await sleep(60);
    await fingers("touchEnd", []);
    await sleep(1200);
    const open = await isOpen(page);
    const y = open ? await panelY(page) : 0;
    const mark = open ? await dragMark(page) : null;
    ok(`a second finger mid-pull (${order}) never strands the sheet`, mid > 40 && Math.abs(y) < 1 && mark === null, `pulled ${Math.round(mid)}px, then ${open ? `open at ${Math.round(y)}px, dragging ${mark}` : "closed"}`);
  }

  // A finger that stops and holds still before it lifts throws nothing.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    // 40px: the content still well short of its top when the finger stops.
    await swipe(pt.x, pt.y, 0, 40, 600, { hold: 400 });
    const atLetGo = (await scrollOf(page)).top;
    await sleep(800);
    const later = (await scrollOf(page)).top;
    ok("held still 400ms, then let go: the content stays where the finger left it", Math.abs(later - atLetGo) < 1 && (await isOpen(page)), `scrollTop ${Math.round(atLetGo)} at the let go, ${Math.round(later)} after`);
  }
  // A pull of about 150px: under half the sheet and short of three
  // quarters of its room, so only the speed it had before the hold, read
  // as if it were still moving, would close it.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = await scrollOf(page);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, s0.top + 150, 800, { hold: 500 });
    await sleep(1000);
    const frames = await stopRecord(page);
    const most = Math.max(...frames.map((f) => f.ty ?? 0));
    ok("a pull held still 500ms, then let go, springs home", (await isOpen(page)) && most > 90 && Math.abs(await panelY(page)) < 1, `the sheet reached ${Math.round(most)}px`);
  }

  // Caught springing home, the sheet holds where the finger caught it: no
  // flash to its rest under the grab, and a tap presses what is under it.
  await paywall(p);
  {
    const pt = await pointOf(page, BENEFITS);
    await swipe(pt.x, pt.y, 0, 130, 300, { hold: 120 });
    await sleep(60);
    await record(page, PAYWALL);
    await gesture(pt.x, pt.y + 20, [{ dy: 60, speed: 250 }], { hold: 60 });
    const frames = await stopRecord(page);
    const live = frames.filter((f) => f.touching && f.ty !== null);
    const atDown = live[0]?.ty ?? 0;
    const lowest = Math.min(...live.map((f) => f.ty));
    ok("caught springing home, the sheet holds where it was caught, with no flash to its rest", atDown > 5 && lowest >= atDown - 1, `caught at ${Math.round(atDown)}px, lowest ${Math.round(lowest)}px while held`);
    await sleep(900);
  }
  for (const wait of [60, 120]) {
    await paywall(p);
    const pt = await pointOf(page, BENEFITS);
    await swipe(pt.x, pt.y, 0, 120, 400, { hold: 120 });
    await sleep(wait);
    const y = await panelY(page);
    await tap(p, await centre(page, START));
    await sleep(600);
    ok(`a tap on Start ${wait}ms into a spring home presses Start`, y > 5 && (await isOpen(page)) && (await codeShown(page)), `the sheet at ${Math.round(y)}px at the tap`);
  }

  // Grabbed while it is still rising, the content scrolled: the sheet is
  // the finger's from where it is, and the content stays put. The body
  // must have room to take the finger's whole run (72px, read from 12px
  // in), so a scroll of it would show in `moved` in full. It used to ask
  // for 90px, the 100 it was set to on a body that scrolled 103; since
  // the one-line benefits (E40) it scrolls 61 at 375x667, its end.
  const RUN = 72 - 12;
  {
    let result = null;
    for (let tries = 0; tries < 3 && !result; tries++) {
      if (await isOpen(page)) {
        await page.keyboard.press("Escape");
        await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 4000 }).catch(() => {});
        await sleep(300);
      }
      await page.locator(".premium-wall").click({ force: true });
      await page.waitForSelector(PAYWALL);
      await sleep(100);
      await setScroll(page, 100);
      const st0 = (await scrollOf(page)).top;
      // Wherever the rising body is on screen, with room under it.
      const pt = await page.evaluate((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { x: Math.round(r.left + 40), y: Math.round(Math.min(Math.max(r.top + 40, 20), innerHeight - 100)) };
      }, PAYWALL);
      await record(page, PAYWALL);
      await gesture(pt.x, pt.y, [{ dy: 72, speed: 200 }], { hold: 60 });
      const frames = await stopRecord(page);
      const live = frames.filter((f) => f.touching && f.fy !== null && f.fy - pt.y >= 12 && f.ty !== null);
      if (live.length < 4 || live[0].ty < 5) continue; // landed after the rise: try again
      const follow = Math.max(...live.map((f) => Math.abs(f.fy - f.ty - (live[0].fy - live[0].ty))));
      // From before the touch: the old grab spent the scroll on its first move.
      const moved = Math.max(...frames.filter((f) => f.st !== null).map((f) => Math.abs(f.st - st0)));
      result = { follow, moved, at: live[0].ty, st: st0 };
    }
    ok(
      "caught still rising over scrolled content, the sheet follows the finger and the content stays put",
      !!result && result.st >= RUN && result.follow <= 1 && result.moved <= 0.5,
      result ? `caught at ${Math.round(result.at)}px over scrollTop ${Math.round(result.st)}; sheet off the finger by ${result.follow.toFixed(1)}px, content moved ${result.moved.toFixed(1)}px` : "never caught it rising"
    );
  }

  // Escape mid-pull, then the finger lets go: the exit plays to the edge.
  await paywall(p);
  {
    await setScroll(page, "end");
    await sleep(200);
    const s0 = await scrollOf(page);
    const target = await page.evaluate(() => document.querySelector('[role="dialog"] > div').offsetHeight + 24);
    const pt = await pointOf(page, READOUT);
    await record(page, PAYWALL);
    await touch("touchStart", pt.x, pt.y);
    await drag(pt.x, pt.y, s0.top + 90, 600);
    await page.keyboard.press("Escape");
    await sleep(80);
    await touch("touchEnd");
    await sleep(900);
    const frames = await stopRecord(page);
    const shown = frames.filter((f) => f.ty !== null);
    const last = shown[shown.length - 1]?.ty ?? 0;
    ok("Escape mid-pull, then let go: the sheet leaves all the way to the edge", !(await isOpen(page)) && last >= target - 30, `last seen at ${Math.round(last)}px of ${target}`);
  }

  // A first reading with no direction is still a swipe down: one swipe
  // from scrolled content closes the paywall. iOS reads a touch in whole
  // pixels and settles the browser's scroll on its first touchmove, which
  // can read level, so that one is sent straight at the content, as iOS
  // would send it; Chromium shows it as the pointer's first reading.
  const firstMove = (pt, dx, dy) =>
    page.evaluate(({ x, y, dx, dy }) => {
      const target = document.elementFromPoint(x, y);
      const t = new Touch({ identifier: 1, target, clientX: x + dx, clientY: y + dy });
      const e = new TouchEvent("touchmove", { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e.defaultPrevented;
    }, { ...pt, dx, dy });
  for (const [dx, dy, how] of [[1, 0, "touchmove"], [-1, 0, "touchmove"], [0, 0, "touchmove"], [1, 0, "pointer"], [1, -1, "pointer"]]) {
    await paywall(p);
    await setScroll(page, "mid");
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    await touch("touchStart", pt.x, pt.y);
    await sleep(16);
    const held = how === "touchmove" ? await firstMove(pt, dx, dy) : null;
    await touch("touchMove", pt.x + dx, pt.y + dy);
    await drag(pt.x + dx, pt.y + dy, H - 6 - (pt.y + dy), 800);
    await sleep(16);
    await touch("touchEnd");
    await sleep(900);
    ok(`a first ${how === "touchmove" ? "touchmove, as iOS reads it," : "pointer reading"} of (${dx}, ${dy}), then a swipe down from scrolled content, closes the paywall`, !(await isOpen(page)) && held !== false);
  }

  // On the stair the first move may lean sideways by a pixel and then go
  // down. Chromium shows it as the pointer's first reading; iOS as the
  // first touchmove, which the stair holds from the browser, so here one
  // is sent straight at it (as iOS would) before the real swipe.
  for (const ios of [false, true]) {
    await paywall(p);
    await setScroll(page, "mid");
    await sleep(200);
    const pt = await pointOf(page, STEP(4));
    await touch("touchStart", pt.x, pt.y);
    await sleep(16);
    // The stair holds a sideways first touchmove itself (its scrub).
    const held = ios ? await firstMove(pt, 1, 0) : null;
    await touch("touchMove", pt.x + 1, pt.y);
    await drag(pt.x + 1, pt.y, H - 6 - pt.y, 800);
    await sleep(16);
    await touch("touchEnd");
    await sleep(900);
    ok(`on the stair in scrolled content, a first ${ios ? "touchmove, as iOS reads it," : "pointer reading"} 1px sideways, then a swipe down, closes the paywall`, !(await isOpen(page)) && held !== false, ios ? `the stair ${held ? "held" : "did not hold"} it` : "");
  }

  // From the slop (handoff review): the content follows the finger from
  // where it crossed the slop, not from the move that crossed it. Chromium
  // sends its first touchmove 12 to 48px in, and that move used to move
  // nothing; a flick that reached the page as one move scrolled nothing.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const s0 = (await scrollOf(page)).top;
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await touch("touchStart", pt.x, pt.y);
    await sleep(30);
    await touch("touchMove", pt.x, pt.y + 30);
    await sleep(50);
    const first = (await scrollOf(page)).top;
    await drag(pt.x, pt.y + 30, s0 + 40, 500);
    await sleep(40);
    await touch("touchEnd");
    await sleep(900);
    const frames = await stopRecord(page);
    // Finger travel since the slop = scroll travelled + sheet, every frame.
    const live = frames.filter((f) => f.touching && f.fy !== null && f.fy - pt.y >= 10 && f.st !== null && f.ty !== null);
    const miss = Math.max(...live.map((f) => Math.abs(f.fy - pt.y - 10 - (s0 - f.st + f.ty))));
    ok(
      "from the slop: a first move that lands 30px in moves the content 20px, and finger since the slop = scroll + sheet",
      Math.abs(s0 - first - 20) <= 1 && live.length >= 4 && miss <= 1,
      `scrollTop ${Math.round(s0)} -> ${Math.round(first)} on that move; worst ${miss.toFixed(1)}px over ${live.length} frames`
    );
  }
  // The one move spends 40px of scroll, and the glide needs room past it
  // (16px) to show it glides on: since E40 the body's middle (31px) has
  // neither, so it starts lower; a move that ran past the top would hand
  // the rest to the sheet, and a flick closes it.
  await paywall(p);
  {
    const s0 = (await scrollWithRoom(page, "mid", 50 - SLOP + 16)).top;
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await touch("touchStart", pt.x, pt.y);
    await sleep(20);
    await touch("touchMove", pt.x, pt.y + 50);
    await sleep(20);
    const moved = (await scrollOf(page))?.top ?? NaN;
    await touch("touchEnd");
    await sleep(1000);
    const frames = await stopRecord(page);
    const end = (await scrollOf(page))?.top ?? NaN;
    ok(
      "from the slop: a flick that reaches the page as one 50px move scrolls the content 40px and glides on; the sheet stays",
      Math.abs(s0 - moved - 40) <= 1 && end < moved - 5 && Math.max(...frames.map((f) => f.ty ?? 0)) < 0.5 && (await isOpen(page)),
      `scrollTop ${Math.round(s0)} -> ${Math.round(moved)} on the move, ${Number.isNaN(end) ? "closed" : Math.round(end)} after the glide`
    );
  }

  // Content at its top with more below, a first touchmove read level (as
  // iOS can read a swipe that arcs): held, and the hand-off's from scroll
  // 0. Down closes the sheet; up scrolls the content, nothing cancelled.
  for (const dir of ["down", "up"]) {
    await paywall(p);
    await setScroll(page, "top");
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await touch("touchStart", pt.x, pt.y);
    await sleep(16);
    const held = await firstMove(pt, 1, 0);
    await touch("touchMove", pt.x + 1, pt.y);
    const to = dir === "down" ? H - 6 : pt.y - 140;
    await drag(pt.x + 1, pt.y, to - pt.y, dir === "down" ? 800 : 500);
    await sleep(16);
    await touch("touchEnd");
    await sleep(900);
    await stopRecord(page);
    const ev = await events(page);
    if (dir === "down") {
      ok("content at its top: a first touchmove read level is held, and a swipe down closes the paywall", held === true && !(await isOpen(page)));
    } else {
      const st = (await scrollOf(page)).top;
      ok("content at its top: a first touchmove read level is held, and a swipe up scrolls the content", held === true && st > 60 && !ev.includes("pointercancel") && Math.abs(await panelY(page)) < 1 && (await isOpen(page)), `scrollTop 0 -> ${Math.round(st)}`);
    }
  }

  // The edges give, as a scroll view's do: a glide that meets the top
  // with speed goes past it and comes back, and a finger that runs up
  // past the content's end takes it there with resistance, which springs
  // back on the let go. The content only: the sheet never moves.
  const shownEdge = () =>
    page.evaluate((sel) => {
      const tr = getComputedStyle(document.querySelector(sel).firstElementChild).translate;
      return tr === "none" ? 0 : parseFloat(tr.split(" ")[1] ?? "0");
    }, PAYWALL);
  const recordEdge = () =>
    page.evaluate((sel) => {
      const frames = [];
      let on = true;
      const sc = document.querySelector(sel);
      const panel = document.querySelector('[role="dialog"] > div');
      const tick = () => {
        if (!on) return;
        const tr = getComputedStyle(sc.firstElementChild).translate;
        frames.push({ fy: window.__fy, touching: window.__touching, st: sc.scrollTop, ty: new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42, tr: tr === "none" ? 0 : parseFloat(tr.split(" ")[1] ?? "0") });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.__stopEdge = () => {
        on = false;
        return frames;
      };
    }, PAYWALL);
  const stopEdge = () => page.evaluate(() => window.__stopEdge());
  // The finger lets go 8px or more before the top, so it is the glide
  // that meets it: the body set to 120 stops at its end, 61px since the
  // one-line benefits (E40), and a 70px run would reach the top 1px from
  // the let go; the run is that end, past the slop, less 8.
  await paywall(p);
  {
    await setScroll(page, 120);
    await sleep(200);
    const s0 = await scrollOf(page);
    const run = Math.min(70, s0.top + SLOP - 8);
    const pt = await pointOf(page, READOUT);
    await recordEdge();
    await swipe(pt.x, pt.y, 0, run, 2500, { hold: 0 });
    await sleep(1000);
    const frames = await stopEdge();
    const released = letGo(frames);
    const after = frames.filter((f) => !f.touching);
    const peak = Math.max(...after.map((f) => f.tr));
    const atTop = after.findIndex((f) => f.st <= 0.5);
    const bounced = atTop >= 0 && after.slice(atTop).some((f) => f.tr > 3);
    const steps = after.slice(atTop >= 0 ? atTop : 0).map((f, i, a) => (i ? Math.abs(f.tr - a[i - 1].tr) : 0));
    ok(
      "glide: meeting the top with speed, the content goes past it and comes back; the sheet stays",
      beforeTop(released) && bounced && after.every((f) => f.tr >= -0.01) && (await shownEdge()) === 0 && Math.max(...frames.map((f) => f.ty ?? 0)) < 0.5 && (await isOpen(page)) && Math.max(...steps) < 12,
      `a ${Math.round(run)}px run from scrollTop ${Math.round(s0.top)}, let go at ${released ? Math.round(released.st) : "?"}; ${Math.round(peak)}px past the top at most, ${Math.max(...steps).toFixed(1)}px in a frame at most`
    );
  }
  await paywall(p);
  {
    const s = await scrollOf(page);
    await setScroll(page, s.max - 10);
    await sleep(200);
    const pt = await pointOf(page, READOUT);
    await recordEdge();
    await gesture(pt.x, pt.y, [{ dy: 32, speed: 500 }, { dy: -190, speed: 500 }], { hold: 60 });
    await sleep(900);
    const frames = await stopEdge();
    const live = frames.filter((f) => f.touching && f.fy !== null);
    const deepest = Math.min(...frames.map((f) => f.tr));
    // Resistance: the content shows less than the finger ran past the end.
    const lowest = Math.min(...live.map((f) => f.fy));
    const pastEnd = live.filter((f) => f.st >= s.max - 0.5);
    const finger = pastEnd.length ? pastEnd[0].fy - lowest : 0;
    ok(
      "hand-off: pushed up past the content's end, it gives with resistance and comes back on the let go",
      deepest < -15 && -deepest < finger && (await shownEdge()) === 0 && Math.abs((await scrollOf(page)).top - s.max) < 1 && Math.max(...frames.map((f) => f.ty ?? 0)) < 0.5 && (await isOpen(page)),
      `${Math.round(-deepest)}px shown for about ${Math.round(finger)}px of finger past the end`
    );
  }
  await p.context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failed ? 1 : 0);
