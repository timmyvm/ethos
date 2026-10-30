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
 *    but the paywall scrolls), and a swipe off it and the trait sheet.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-sheet-touch.mjs
 *
 *   SECTIONS=2,3 node scripts/check-sheet-touch.mjs   # some of the five
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
const SECTIONS = process.env.SECTIONS ? process.env.SECTIONS.split(",").map(Number) : [1, 2, 3, 4, 5];
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
  return { context, page, touch, gesture, swipe, W, H };
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
   swiped from in the hand-off cases instead. */
const REGIONS = [
  ["grabber", ".card-premium .h-1.w-10"],
  ["mark", ".card-premium .label-micro"],
  ["headline", ".card-premium h2"],
  ["benefits", ".card-premium ul li:nth-child(3)"],
  ["readout", '.card-premium section[aria-labelledby="paywall-ladder-head"] > div[aria-hidden]'],
  ["stair", ".card-premium .stair-col:nth-child(4)"],
  ["caption", '.card-premium section[aria-labelledby="paywall-ladder-head"] > p:last-of-type'],
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

  // A fast flick on mid-scroll content: it glides to the top and stops there.
  await paywall(p);
  {
    await setScroll(page, "mid");
    await sleep(200);
    const pt = await pointOf(page, BENEFITS);
    await record(page, PAYWALL);
    await swipe(pt.x, pt.y, 0, 60, 1500, { hold: 0 });
    await sleep(1200);
    const frames = await stopRecord(page);
    const s1 = await scrollOf(page);
    const most = Math.max(...frames.map((f) => f.ty ?? 0));
    ok("hand-off: a flick that glides to the top stops there, and the sheet stays", (await isOpen(page)) && s1.top <= 0.5 && most < 0.5, `scrollTop ${Math.round(s1.top)}, sheet max ${most}px`);
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

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failed ? 1 : 0);
