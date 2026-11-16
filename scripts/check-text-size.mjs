/**
 * The phone's text size, followed, in a real browser (#451, lib/text-size.ts).
 *
 * Someone who has turned their iPhone's text up gets Ethos larger: the
 * page is laid out as a narrower phone and shown at the size the text
 * asks for, by the one viewport tag the head's boot script writes. No
 * browser on this machine has a text size setting, so the size iOS
 * reports (`font: -apple-system-body` on a probe) is stood in for here;
 * the arithmetic and the script run as they are. What this checks:
 *
 *   1. the server sends no viewport tag of Next's, and a plain one for
 *      a browser running no script;
 *   2. at the default size nothing changes: one plain tag, the phone's
 *      own width, on a browser with no text size and on an iPhone at
 *      its default;
 *   3. one step up on a 390pt iPhone lays out at 349, two steps and
 *      everything past them at 320, a 430pt one at 320 for three steps;
 *   4. the tag survives hydration and every client navigation: one tag,
 *      the same content, the same width;
 *   5. followed, no screen scrolls sideways, the tabs are tapped where
 *      they are drawn, and a recording starts;
 *   6. followed, the recorder keeps Record on the first screen under a
 *      Dynamic Island's inset: whole, with its caption and nothing to
 *      scroll, for a day's practice, a lesson and the boss, and whole
 *      for a game (two rows more); the topic is the size on the glass
 *      it is at the default text size, as Today's is;
 *   7. Settings offers "Larger text" exactly where the phone asks for
 *      it, the switch turns it off and on again, and the choice holds;
 *   8. no page error and no hydration trouble on the way.
 *
 * On a real iPhone, the thing to do: Settings, Display and Brightness,
 * Text Size, two steps up, then open Ethos again.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-text-size.mjs
 *   SHOTS=docs/look/hig node scripts/check-text-size.mjs   # the screens, for the eye
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { analyzeBody, json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ? process.env.SHOTS.replace(/\/?$/, "/") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const PLAIN = "width=device-width, initial-scale=1, viewport-fit=cover";

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

/**
 * A phone. `body` is the size iOS sets body text at (17 by default, 19,
 * 21 and 23 up the slider, 28 to 53 under Larger Accessibility Sizes);
 * null is a browser with no text size to follow, which is every browser
 * on this machine as it comes.
 */
async function open({ body = null, width = 390, height = 844, theme = "light", insets = null } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, screen: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    /* This machine's own zone, which is the server's: the dev server
       renders the recorder's topic of the day on its clock, and a phone
       on another day hydrates a different one there (a production build
       renders the recorder on the phone). Nothing here turns on the day. */
    permissions: ["microphone"], locale: "en-AU", timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/analyze", async (route) => {
    await sleep(300);
    return route.fulfill(json(analyzeBody));
  });
  /* The fixture's seed writes the preferences afresh on every load. The
     switch under test saves one and loads the page again, so what the
     app itself saved is kept across the seed. */
  await context.addInitScript(() => {
    try {
      window.__follow = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}").followTextSize;
    } catch {}
  });
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript((body) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    if (window.__follow !== undefined) {
      const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
      localStorage.setItem("ethos.prefs", JSON.stringify({ ...prefs, followTextSize: window.__follow }));
    }
    if (body === null) return;
    // An iPhone: the keyword means something, and the probe answers with the phone's body size.
    const supports = CSS.supports.bind(CSS);
    CSS.supports = (...a) => (a[0] === "font" && a[1] === "-apple-system-body") || supports(...a);
    const real = window.getComputedStyle.bind(window);
    window.getComputedStyle = (el, ...rest) => {
      const cs = real(el, ...rest);
      if (el && el.tagName === "SPAN" && el.parentElement === document.documentElement && el.style.visibility === "hidden") {
        return new Proxy(cs, { get: (t, k) => (k === "fontSize" ? `${body}px` : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
      }
      return cs;
    };
  }, body);
  const page = await context.newPage();
  /* An iPhone's notch and home bar. This browser gives the page the
     insets as they are, not divided by the page's scale, which is the
     larger of the two things WebKit could do: the tighter case. */
  if (insets) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: insets[0], bottom: insets[1], left: 0, right: 0 } });
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  // React says invalid nesting and hydration trouble on the console.
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|did not match|cannot be a descendant|cannot contain|validateDOMNesting|#418|#423|#425/i.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  return { context, page, errors };
}
const settle = async (page) => {
  await page.waitForSelector("main");
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(700);
};
/** What the page is laid out at, and the tag that says so. */
const read = (page) =>
  page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    zoom: document.documentElement.getAttribute("data-text-zoom"),
    tags: [...document.querySelectorAll('meta[name="viewport"]')].filter((m) => !m.closest("noscript")).map((m) => m.content),
    owned: document.querySelectorAll('meta[name="viewport"][data-text-size]').length,
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    narrow: matchMedia("(max-width: 359px)").matches,
  }));
const near = (a, b) => Math.abs(a - b) <= 1;
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}${name}.png` });
};

/* ---- 1. What the server sends ---- */
{
  const html = await (await fetch(`${BASE}/history`)).text();
  const head = html.slice(0, html.indexOf("</head>"));
  // Tags as the parser meets them: what a script holds as a string is not one, and nor is what a noscript holds.
  const tags = head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "").replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
  ok("the server sends no viewport tag of its own", !/<meta[^>]+name="viewport"/.test(tags));
  ok("a browser running no script is sent the plain tag", new RegExp(`<noscript><meta name="viewport" content="${PLAIN}"/?></noscript>`).test(head));
  /* React lifts the stylesheet and the chunks' async tags to the top of
     the head. None of those runs before the parser reaches the first
     script written in the page, and nothing is laid out before the
     head is read: that script is where the tag has to come from. */
  const inline = /<script>([\s\S]*?)<\/script>/.exec(head)?.[1] ?? "";
  ok("the head's first script of its own is the one that reads the text size", inline.includes("-apple-system-body") && inline.includes('name="viewport"'), inline.slice(0, 60).replace(/\s+/g, " "));
  ok("it is in the head, before anything is drawn", html.indexOf("-apple-system-body") < html.indexOf("<body"));
}

/* ---- 2. The default size: nothing changes ---- */
for (const [what, body] of [["a browser with no text size", null], ["an iPhone at its default size", 17], ["an iPhone with its text turned down", 15]]) {
  const { context, page, errors } = await open({ body });
  await page.goto(`${BASE}/history`);
  await settle(page);
  const a = await read(page);
  ok(`${what}: one plain viewport tag, the phone's own width`, a.tags.length === 1 && a.owned === 1 && a.tags[0] === PLAIN && a.width === 390 && a.zoom === null && a.sideways === 0, JSON.stringify(a));
  await page.locator('nav a[href="/you"]').click();
  await page.waitForURL(/\/you/);
  await settle(page);
  const b = await read(page);
  ok(`${what}: still one plain tag after moving between tabs`, b.tags.length === 1 && b.tags[0] === PLAIN && b.width === 390, JSON.stringify(b.tags));
  await page.goto(`${BASE}/settings`);
  await settle(page);
  ok(`${what}: Settings offers no Larger text switch`, (await page.getByRole("switch", { name: /Larger text/ }).count()) === 0);
  ok(`${what}: no page error, no hydration trouble`, errors.length === 0, errors.join(" | "));
  await context.close();
}

/* ---- 3. Each size on each phone ---- */
for (const { body, width, height, layout, zoom, name } of [
  { body: 19, width: 390, height: 844, layout: 349, zoom: "1.11748", name: "one step up on a 390pt iPhone" },
  { body: 21, width: 390, height: 844, layout: 320, zoom: "1.21875", name: "two steps up on a 390pt iPhone" },
  { body: 40, width: 390, height: 844, layout: 320, zoom: "1.21875", name: "an accessibility size on a 390pt iPhone" },
  { body: 23, width: 430, height: 932, layout: 320, zoom: "1.34375", name: "three steps up on a 430pt iPhone" },
  { body: 21, width: 375, height: 667, layout: 320, zoom: "1.17188", name: "two steps up on a 375pt iPhone" },
]) {
  const { context, page, errors } = await open({ body, width, height });
  await page.goto(`${BASE}/`);
  await settle(page);
  const a = await read(page);
  ok(`${name}: laid out ${layout} wide, shown ${zoom} times the size`, a.tags.length === 1 && a.tags[0] === `initial-scale=${zoom}, viewport-fit=cover` && near(a.width, layout) && a.zoom === zoom, JSON.stringify(a));
  ok(`${name}: the height follows too, so the screen is filled and no more`, near(a.height, height / Number(zoom)), `${a.height} of ${Math.round(height / Number(zoom))}`);
  ok(`${name}: nothing scrolls sideways`, a.sideways === 0, `${a.sideways}px`);
  ok(`${name}: no page error, no hydration trouble`, errors.length === 0, errors.join(" | "));
  await context.close();
}

/* ---- 4 and 5. Two steps up on a 390pt iPhone, used ---- */
{
  const { context, page, errors } = await open({ body: 21 });
  const TAG = "initial-scale=1.21875, viewport-fit=cover";
  await page.goto(`${BASE}/`);
  await settle(page);
  ok("followed: the app's own narrow-phone rules are the ones in force", (await read(page)).narrow);
  await shot(page, "text-size-today-21");

  // Every tab, by tapping it where it is drawn.
  const widths = [];
  for (const [href, url] of [["/history", /\/history/], ["/you", /\/you/], ["/", /\/$/]]) {
    const tab = page.locator(`nav a[href="${href}"]`);
    const box = await tab.boundingBox();
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href") ?? null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForURL(url, { timeout: 8000 }).catch(() => {});
    await settle(page);
    const r = await read(page);
    widths.push({ href, hit, at: new URL(page.url()).pathname, ...r });
    if (href === "/history") await shot(page, "text-size-log-21");
    if (href === "/you") await shot(page, "text-size-you-21");
  }
  ok("followed: each tab is tapped where it is drawn and opens", widths.every((w) => w.hit === w.href && w.at === w.href), widths.map((w) => `${w.href}>${w.at}`).join(" "));
  ok("followed: one tag, the same content, after every client navigation", widths.every((w) => w.tags.length === 1 && w.tags[0] === TAG && w.owned === 1), JSON.stringify(widths.map((w) => w.tags)));
  ok("followed: the layout stays 320 wide on every tab", widths.every((w) => w.width === 320), widths.map((w) => w.width).join(" "));
  ok("followed: no tab scrolls sideways", widths.every((w) => w.sideways === 0), widths.map((w) => w.sideways).join(" "));

  // The screens off the tab bar.
  for (const path of ["/settings", "/shop", "/lessons", "/rep?mode=daily", "/privacy"]) {
    await page.goto(`${BASE}${path}`);
    await settle(page);
    const r = await read(page);
    ok(`followed: ${path} is 320 wide with nothing sideways`, r.width === 320 && r.sideways === 0 && r.tags.length === 1 && r.tags[0] === TAG, JSON.stringify(r));
  }

  // The bar's own tap: everything on screen is where a finger finds it.
  await page.goto(`${BASE}/rep?mode=daily`);
  await settle(page);
  const record = page.locator('button[data-record="start"]');
  await record.waitFor({ timeout: 10000 });
  const rb = await record.boundingBox();
  ok("followed: Record is on screen at its full size", rb.width >= 44 && rb.height >= 44 && rb.x >= 0 && rb.x + rb.width <= 320 && rb.y + rb.height <= (await read(page)).height + 1, `${Math.round(rb.width)}x${Math.round(rb.height)} at ${Math.round(rb.x)},${Math.round(rb.y)}`);
  await shot(page, "text-size-record-21");
  await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height / 2);
  const stopped = await page.locator('button[data-record="stop"]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  ok("followed: a tap on Record starts a recording", stopped);
  ok("followed: no page error, no hydration trouble", errors.length === 0, errors.join(" | "));
  await context.close();
}

/* ---- 6. The recorder holds Record on the first screen ---- */
{
  /** Where Record and the line under it end, against the bottom of the screen. */
  const fit = (page) =>
    page.evaluate(() => {
      const record = document.querySelector('button[data-record="start"]');
      const r = record.getBoundingClientRect();
      const caption = record.parentElement.parentElement.querySelector(":scope > p");
      const topic = document.querySelector('section[aria-label="Your topic"] h1');
      return {
        record: Math.round(r.bottom - innerHeight),
        caption: caption ? Math.round(caption.getBoundingClientRect().bottom - innerHeight) : null,
        /* The page against the layout it was given. Not against the
           window: at a scale that does not divide the screen evenly the
           part in view comes out a pixel or two short of the layout
           (852 / 1.11648), which is the browser's rounding and nothing
           a page can scroll to. Record and its caption are held to the
           part in view, the stricter of the two. The layout's height is
           rarely a whole pixel either (852 / 1.22813 = 693.75), so the
           page may round up over it by one. */
        scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        topic: parseFloat(getComputedStyle(topic).fontSize),
        width: innerWidth,
      };
    });
  const idle = async (page, path) => {
    await page.goto(`${BASE}${path}`);
    await settle(page);
    await page.locator('button[data-record="start"]').waitFor({ timeout: 10000 });
    await sleep(600);
    return fit(page);
  };
  // 393x852 with a Dynamic Island (59 over, 34 under): the phone most people hold.
  for (const { body, name, zoom } of [
    { body: 17, name: "the default size", zoom: 1 },
    { body: 19, name: "one step up", zoom: 1.11648 },
    { body: 21, name: "two steps up", zoom: 1.22813 },
  ]) {
    const { context, page, errors } = await open({ body, width: 393, height: 852, insets: [59, 34] });
    for (const [path, what] of [["/rep?mode=daily", "a day's practice"], ["/rep?lesson=fillers-1", "a lesson"], ["/rep?boss=1", "the boss"]]) {
      const m = await idle(page, path);
      ok(`${name}, ${what}: Record, its caption and the whole screen without a scroll`, m.record <= 0 && m.caption !== null && m.caption <= 0 && m.scroll <= 1, JSON.stringify(m));
      // 26px on a 390pt phone and wider; the same share of the glass on a narrower layout.
      const shown = m.topic * zoom;
      ok(`${name}, ${what}: the topic is 26pt on the glass`, Math.abs(shown - 26) < 0.6, `${m.topic}px laid out, ${shown.toFixed(1)}pt shown`);
      if (path === "/rep?mode=daily" && body !== 19) await shot(page, `text-size-recorder-${body}`);
    }
    for (const game of ["qa", "rush", "interview"]) {
      const m = await idle(page, `/rep?game=${game}&level=1`);
      ok(`${name}, the ${game} game: Record is whole on the first screen`, m.record <= 0, JSON.stringify(m));
      if (game === "qa" && body === 21) await shot(page, "text-size-recorder-game-21");
    }
    ok(`${name}, the recorder: no page error, no hydration trouble`, errors.length === 0, errors.join(" | "));
    await context.close();
  }
  // While the clock runs: Stop and the way out stay on the first screen.
  {
    const { context, page } = await open({ body: 21, width: 393, height: 852, insets: [59, 34] });
    await idle(page, "/rep?mode=daily");
    await page.locator('button[data-record="start"]').click({ force: true });
    const stop = page.locator('button[data-record="stop"]');
    const live = await stop.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    await sleep(1800);
    const m = live
      ? await page.evaluate(() => {
          const r = document.querySelector('button[data-record="stop"]').getBoundingClientRect();
          const over = [...document.querySelectorAll("button")].find((b) => /Start over/.test(b.textContent ?? ""));
          const ring = document.querySelector(".rec-ring");
          return {
            stop: Math.round(r.bottom - innerHeight),
            ring: ring ? Math.round(ring.getBoundingClientRect().bottom - innerHeight) : null,
            startOver: over ? Math.round(over.getBoundingClientRect().bottom - innerHeight) : null,
            sideways: document.documentElement.scrollWidth - innerWidth,
          };
        })
      : null;
    ok("two steps up, recording: Stop, its ring and Start over are on the first screen", !!m && m.stop <= 0 && m.ring !== null && m.ring <= 0 && m.startOver !== null && m.startOver <= 0 && m.sideways === 0, JSON.stringify(m));
    await shot(page, "text-size-recording-21");
    await context.close();
  }
}

/* ---- 7. Settings' switch ---- */
{
  const { context, page, errors } = await open({ body: 21 });
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const row = page.getByRole("switch", { name: /Larger text/ });
  ok("Settings offers Larger text where the phone asks for it", (await row.count()) === 1);
  ok("the switch is on: the app follows unless told not to", (await row.getAttribute("aria-checked")) === "true");
  ok("its note says what it follows", /Follows your phone's text size\./.test((await row.textContent()) ?? ""), (await row.textContent()) ?? "");
  await row.scrollIntoViewIfNeeded();
  await sleep(300);
  await shot(page, "text-size-settings-21");

  await Promise.all([page.waitForEvent("load"), row.click()]);
  await settle(page);
  const off = await read(page);
  ok("switched off, the page comes back at the phone's own width", off.width === 390 && off.tags.length === 1 && off.tags[0] === PLAIN && off.zoom === null, JSON.stringify(off));
  ok("switched off, the choice is saved", (await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.prefs")).followTextSize)) === false);
  ok("switched off, the switch is still offered, and reads off", (await row.count()) === 1 && (await row.getAttribute("aria-checked")) === "false");
  ok("switched off, the page is still Settings", new URL(page.url()).pathname === "/settings");
  await page.goto(`${BASE}/history`);
  await settle(page);
  ok("switched off, it stays off on the next screen opened", (await read(page)).width === 390);

  await page.goto(`${BASE}/settings`);
  await settle(page);
  await Promise.all([page.waitForEvent("load"), row.click()]);
  await settle(page);
  const on = await read(page);
  ok("switched on again, the page comes back followed", on.width === 320 && on.tags[0] === "initial-scale=1.21875, viewport-fit=cover" && on.zoom === "1.21875", JSON.stringify(on));
  ok("switched on again, the switch reads on", (await row.getAttribute("aria-checked")) === "true");
  ok("the switch: no page error, no hydration trouble", errors.length === 0, errors.join(" | "));
  await context.close();
}

/* ---- For the eye: the same phone at its default size, and dark ---- */
if (SHOTS) {
  for (const [body, theme] of [[17, "light"], [21, "dark"], [17, "dark"]]) {
    const { context, page } = await open({ body, theme });
    for (const [path, name] of [["/", "today"], ["/history", "log"], ["/you", "you"], ["/settings", "settings"]]) {
      await page.goto(`${BASE}${path}`);
      await settle(page);
      if (name === "settings") await page.getByRole("switch", { name: /Reduced motion/ }).scrollIntoViewIfNeeded().catch(() => {});
      await sleep(200);
      await shot(page, `text-size-${name}-${body}${theme === "dark" ? "-dark" : ""}`);
    }
    await context.close();
  }
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} checks pass`);
process.exit(failed.length ? 1 : 0);
