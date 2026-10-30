/**
 * Tester collection, asserted in a browser (consent version 3, migration
 * 0022, lib/tester-collect.ts, docs/testers.md): what a tester's phone
 * sends, and that nobody else's sends anything.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-tester-collect.mjs        # BASE or LOOK_BASE for another server
 *
 * Five phones, against the mocked Supabase of scripts/look-fixtures.mjs:
 *   1. a non-tester: the open reads no testers row and sends nothing;
 *   2. a device that once held a tester but whose account is not one:
 *      one read, the hint goes, nothing sent;
 *   3. a tester on consent version 2: asked once on the open, Not now
 *      goes back, never asked again on this device, nothing sent;
 *   4. a tester on version 3: the device on open, screens with their
 *      time, taps by name, shown and hidden, an error with what was on
 *      screen, sent by timer and by beacon, and never what was typed;
 *   5. a version 2 tester who agrees again: collection starts;
 *   6. a version 3 tester whose first screen crashes as it opens (its page
 *      chunk patched to throw): the error boundary's report, held until
 *      the collector starts, arrives under that screen (review F1). It
 *      patches a production chunk's module wrappers, so run this gate
 *      against `next start` (BASE); on a dev server it says it skipped.
 *
 * Phone 3 also reads the Log page's "Testing is paused." (review D1).
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { analyzeBody, collectRoute, json, seed, session, supabaseRoute, testerMode, POSE_PREF } from "./look-fixtures.mjs";

const BASE = process.env.BASE ?? process.env.LOOK_BASE ?? "http://localhost:3123";
const ID = "0b5e7a21-6c3d-4f8e-8a1b-2d9c4e6f7a10";
const SECRET = "SECRET-TYPED-NOTE";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
/* Every body the browser sent to the collect route, read off the wire as
   well as from the route's handler: a beacon sent as a page unloads can
   leave before Playwright's handler sees it, though the phone sent it. */
const wire = [];

async function phone({ tester = false, version = 3, hint = false } = {}) {
  testerMode.tester = tester;
  testerMode.consentVersion = version;
  testerMode.collected.length = 0;
  testerMode.collect = "ok";
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  const reads = [];
  wire.length = 0;
  ctx.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/tester/collect") wire.push(r.postData() ?? "");
  });
  await ctx.route("http://supabase.local/**", (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/rest/v1/testers")) reads.push(route.request().url());
    return supabaseRoute(route);
  });
  await ctx.route("**/api/analyze", (route) => route.fulfill(json(analyzeBody)));
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("**/api/tester/collect", collectRoute);
  await ctx.route("**/api/tester", async (route) => {
    const body = route.request().postDataJSON() ?? {};
    if (body.code === undefined && body.agree !== undefined && testerMode.tester) {
      testerMode.consentVersion = body.agree;
      return route.fulfill(json({ ok: true, tester: { consent_version: body.agree, consented_at: new Date().toISOString() } }));
    }
    return route.fulfill(json({ error: "That code doesn't match. Check it and try again." }, 403));
  });
  await ctx.addInitScript(seed, { theme: "light", session: { ...session, user: { ...session.user, id: ID } }, pose: POSE_PREF, tester: hint });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { if (!/probe/.test(e.message)) console.log("PAGEERROR", e.message.slice(0, 160)); });
  return { ctx, page, reads };
}

const hide = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
const show = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
const parsed = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
/** Every event sent, once each, from the handler and the wire together. */
const events = () => {
  const seen = new Set();
  return [...testerMode.collected.map((c) => c.body), ...wire.map(parsed)]
    .flatMap((b) => b?.events ?? [])
    .filter((e) => {
      const k = JSON.stringify(e);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
};
/** Batches that left the phone, by either count. */
const sentCount = () => Math.max(testerMode.collected.length, wire.length);

// 1. A non-tester.
{
  const { ctx, page, reads } = await phone();
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await sleep(1500);
  check("a non-tester's open reads no testers row", reads.length === 0, `${reads.length} reads`);
  await page.getByRole("link", { name: "Log" }).first().click().catch(() => {});
  await sleep(1200);
  await hide(page);
  await sleep(800);
  check("a non-tester's phone sends nothing", sentCount() === 0, `${sentCount()} batches`);
  const loaded = await page.evaluate(() => performance.getEntriesByType("resource").some((r) => /tester-collect/.test(r.name)));
  check("a non-tester's phone never loads the collector", !loaded);
  await ctx.close();
}

// 2. A device that once held a tester, whose account is not one.
{
  const { ctx, page, reads } = await phone({ tester: false, hint: true });
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await sleep(2000);
  await hide(page);
  await sleep(600);
  check("a stale hint reads the row once", reads.length === 1, `${reads.length} reads`);
  check("…then lets the hint go", (await page.evaluate(() => localStorage.getItem("ethos.tester"))) === null);
  check("…and sends nothing", sentCount() === 0);
  await ctx.close();
}

// 3. A tester on consent version 2.
{
  const { ctx, page } = await phone({ tester: true, version: 2, hint: true });
  await page.goto(`${BASE}/history`);
  await page.waitForURL(/\/tester\?from=open/, { timeout: 30000 }).catch(() => {});
  check("a version 2 tester is asked on the open", /\/tester\?from=open/.test(page.url()), page.url());
  await page.getByRole("button", { name: "I agree" }).waitFor({ timeout: 10000 }).catch(() => {});
  const line = await page.getByText(/Testing now also keeps/).count();
  const code = await page.getByLabel("Tester code").count();
  check("…with the line that says what changed, and no code", line >= 1 && code === 0, `line ${line}, code field ${code}`);
  await page.getByRole("link", { name: "Not now" }).click();
  await page.waitForURL(/\/history$/, { timeout: 10000 }).catch(() => {});
  check("Not now goes back to the screen it opened over", new URL(page.url()).pathname === "/history", page.url());
  await page.reload();
  await page.waitForSelector("main h1", { timeout: 30000 });
  await sleep(2500);
  check("…and the ask never comes again on this device", !/\/tester/.test(page.url()), page.url());
  await hide(page);
  await sleep(600);
  // Where the question would be, testing reads as paused (review D1).
  await page.goto(`${BASE}/rep/rep-3`);
  const paused = page.getByText("Testing is paused.");
  await paused.waitFor({ timeout: 30000 }).catch(() => {});
  const agree = page.getByRole("link", { name: "Agree again" });
  const href = (await agree.count()) ? await agree.first().getAttribute("href") : null;
  check("…and the Log says testing is paused, with Agree again", (await paused.count()) === 1 && /from=open/.test(href ?? ""), href ?? "no link");
  check("…and asks nothing there", (await page.getByText(/feel right\?/).count()) === 0);
  await hide(page);
  await sleep(600);
  check("a version 2 tester's phone sends nothing", sentCount() === 0, `${sentCount()} batches`);
  await ctx.close();
}

// 4. A tester on version 3.
{
  const { ctx, page } = await phone({ tester: true, version: 3, hint: true });
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main h1", { timeout: 30000 });
  await sleep(2500);
  await page.getByRole("link", { name: "Lessons" }).first().click();
  await page.waitForURL(/\/lessons$/, { timeout: 15000 });
  await sleep(1500);
  // A typed note: the field is the tester's, never collected.
  await page.goto(`${BASE}/rep/rep-3?from=check`);
  const note = page.getByText(/feel right\?/);
  await note.waitFor({ timeout: 30000 });
  await page.getByRole("radio", { name: "Too high", exact: true }).click();
  const field = page.getByLabel("What felt off?");
  await field.click();
  await field.fill(SECRET);
  await page.keyboard.type(" more");
  await sleep(400);
  await page.evaluate(() => setTimeout(() => { throw new Error("probe: a window error"); }, 0));
  await sleep(600);
  await hide(page);
  await sleep(1000);
  await show(page);
  await sleep(500);
  const beacons = testerMode.collected.filter((c) => c.auth === null);
  check("the batch as the page hides goes by beacon, its token in the body", beacons.length >= 1 && beacons.every((b) => typeof b.body?.token === "string"), `${beacons.length} beacons`);
  // The timer's batch, with the token in its header.
  await sleep(21000);
  const timed = testerMode.collected.filter((c) => c.auth?.startsWith("Bearer "));
  check("the timer sends what waits, the session in its header", timed.length >= 1, `${timed.length} timed`);

  const all = events();
  const device = all.find((e) => e.kind === "device");
  check("a device snapshot on the open", !!device && typeof device.data?.ua === "string" && device.data?.screen_w > 0 && typeof device.data?.tz === "string" && typeof device.data?.home_screen === "boolean", JSON.stringify(device?.data ?? {}).slice(0, 160));
  const screens = all.filter((e) => e.name === "screen");
  check("time on each screen, by path", screens.some((e) => e.screen === "/" && e.ms > 1000) && screens.some((e) => e.screen === "/lessons" && e.ms > 500), screens.map((e) => `${e.screen}:${e.ms}`).join(" "));
  check("no screen keeps its query", all.every((e) => !e.screen || !e.screen.includes("?")));
  const taps = all.filter((e) => e.name === "tap");
  check("taps by the control's name", taps.some((t) => t.label === "Lessons") && taps.some((t) => t.label === "Too high"), taps.map((t) => t.label).join(" | "));
  check("shown and hidden", all.some((e) => e.name === "hidden") && all.some((e) => e.name === "shown"));
  const err = all.find((e) => e.kind === "error");
  check("an error with its screen and what was on screen", !!err && /probe/.test(err.data?.message ?? "") && err.screen?.startsWith("/rep/") && (err.data?.before ?? []).some((b) => b.label === "Too high"), JSON.stringify(err ?? {}).slice(0, 200));
  const raw = JSON.stringify(testerMode.collected) + wire.join("\n");
  check("never what was typed", !raw.includes(SECRET) && !raw.includes(" more"));
  check("never the tester code", !raw.includes('"1234"'));
  await ctx.close();
}

// 5. A version 2 tester agrees again: collection starts.
{
  const { ctx, page } = await phone({ tester: true, version: 2, hint: true });
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/tester\?from=open/, { timeout: 30000 }).catch(() => {});
  await page.getByRole("button", { name: "I agree" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {});
  check("agreeing again goes back where it was", new URL(page.url()).pathname === "/", page.url());
  await sleep(2500);
  await hide(page);
  await sleep(800);
  check("…and collection starts", events().some((e) => e.kind === "device"), `${events().length} events`);
  await ctx.close();
}

// 6. A version 3 tester whose first screen crashes as the app opens.
{
  const { ctx, page } = await phone({ tester: true, version: 3, hint: true });
  let patched = 0;
  await ctx.route("**/_next/static/chunks/app/games/page*.js", async (route) => {
    const res = await route.fetch();
    const text = await res.text();
    const body = text.replace(/\(e,t,([a-z])\)=>\{/g, (m) => {
      patched++;
      return `${m}throw new Error("probe: the first screen crashed");`;
    });
    await route.fulfill({ response: res, body });
  });
  await page.goto(`${BASE}/games`);
  await page.getByText("That screen didn").first().waitFor({ timeout: 20000 }).catch(() => {});
  if (!patched || !(await page.getByText("That screen didn").count())) {
    console.log(`skip a crash on the first screen (needs a production build: BASE pointing at next start; ${patched} wrappers patched, boundary ${await page.getByText("That screen didn").count()})`);
  } else {
    await sleep(3000);
    await hide(page);
    await sleep(1200);
    // The patched chunk throws as it runs, or (when the patch races the
    // load) fails to load at all: either is the first screen crashing.
    const crash = events().find((e) => e.kind === "error" && e.name === "boundary");
    check("a crash on the first screen of an open is reported, under that screen", !!crash && crash.screen === "/games" && /first screen crashed|ChunkLoadError/.test(crash.data?.message ?? ""), JSON.stringify(crash ?? events().map((e) => `${e.kind}:${e.name}`)).slice(0, 200));
  }
  await ctx.close();
}

await browser.close();
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
