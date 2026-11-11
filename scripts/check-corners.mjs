/**
 * Continuous corners, audited in a real browser (#437, the block at the
 * end of app/globals.css).
 *
 * A surface drawn with a continuous corner must not sit on, under or
 * around something that still draws a round one at the same place: the
 * round corner pokes out past the continuous one (a grey sliver behind
 * Today's card was how this was found). On every screen, in both themes,
 * this finds every pair of boxes that share a corner point and both
 * round it, and fails where their corner shapes differ. It also holds
 * the two rules a person would notice broken: a pill is still a pill and
 * a circle still a circle.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-corners.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const SCREENS = [
  ["Today", "/"], ["Lessons", "/lessons"], ["a lesson", "/lessons/the-cold-open"], ["Practice", "/games"],
  ["Log", "/history"], ["a recording", "/rep/rep-22"], ["You", "/you"], ["Settings", "/settings"],
  ["Shop", "/shop"], ["Your words", "/words"], ["the recorder", "/rep?lesson=h4"], ["Boss", "/boss"],
  ["Hostile", "/hostile"], ["Upload", "/upload"], ["Calibrate", "/calibrate"], ["a trait", "/practice/pause"],
  ["Sign in", "/signin"], ["About", "/about"],
];

const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const supported = await (async () => {
  const p = await browser.newPage();
  const yes = await p.evaluate(() => CSS.supports("corner-shape", "superellipse(1.5)"));
  await p.close();
  return yes;
})();
if (!supported) {
  console.log("This browser does not draw corner-shape: nothing to audit, and the app keeps its round corners.");
  await browser.close();
  process.exit(0);
}

/** In the page: every pair of rounded boxes meeting at a corner with different corner shapes, and any pill or circle that lost its round. */
const audit = () => {
  const boxes = [];
  const push = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo ?? undefined);
    if (pseudo && (cs.content === "none" || cs.content === "normal")) return;
    if (cs.display === "none" || cs.visibility === "hidden") return;
    let r;
    if (pseudo) {
      // A pseudo-element has no rect of its own: an inset: 0 layer fills its parent's padding box.
      if (cs.position !== "absolute" || !["0px"].includes(cs.top) || cs.left !== "0px" || cs.right !== "0px" || cs.bottom !== "0px") return;
      r = el.getBoundingClientRect();
    } else r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => parseFloat(v) || 0);
    if (radii.every((v) => v === 0)) return;
    // The browser reports a round corner as superellipse(1): one name for it here.
    const shapes = [cs.cornerTopLeftShape, cs.cornerTopRightShape, cs.cornerBottomRightShape, cs.cornerBottomLeftShape].map((v) =>
      v === "superellipse(1)" || !v ? "round" : v
    );
    const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}${pseudo ?? ""}`;
    boxes.push({ name, r, radii, shapes, pill: Math.min(...radii.filter((v) => v > 0)) >= Math.min(r.width, r.height) / 2 - 0.5 });
  };
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("nextjs-portal")) continue;
    push(el, null);
    push(el, "::before");
    push(el, "::after");
  }
  const corner = (b, i) => [[b.r.left, b.r.top], [b.r.right, b.r.top], [b.r.right, b.r.bottom], [b.r.left, b.r.bottom]][i];
  const clashes = [];
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      for (let i = 0; i < 4; i++) {
        const A = boxes[a], B = boxes[b];
        if (A.radii[i] === 0 || B.radii[i] === 0) continue;
        const [ax, ay] = corner(A, i), [bx, by] = corner(B, i);
        if (Math.abs(ax - bx) > 1.5 || Math.abs(ay - by) > 1.5) continue;
        if (A.shapes[i] !== B.shapes[i]) clashes.push(`${A.name} (${A.shapes[i]}) vs ${B.name} (${B.shapes[i]})`);
      }
    }
  }
  const pills = boxes.filter((b) => b.pill && b.shapes.some((s, i) => b.radii[i] > 0 && s !== "round")).map((b) => b.name);
  const drawn = boxes.filter((b) => b.shapes.some((s) => s !== "round")).length;
  return { clashes: [...new Set(clashes)], pills: [...new Set(pills)], drawn, boxes: boxes.length };
};

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 120)));
  let surfaces = 0;
  for (const [name, path] of SCREENS) {
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector("main", { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
    await sleep(500);
    const res = await page.evaluate(audit);
    surfaces += res.drawn;
    ok(`${name}, ${theme}: no round corner meets a continuous one`, res.clashes.length === 0, res.clashes.slice(0, 3).join(" | "));
    ok(`${name}, ${theme}: every pill and circle is still round`, res.pills.length === 0, res.pills.slice(0, 4).join(" | "));
  }
  // A sheet, open: the paywall from Practice.
  await page.goto(`${BASE}/games?paywall=1`);
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {});
  await sleep(900);
  const sheet = await page.evaluate(audit);
  ok(`the paywall sheet, ${theme}: no round corner meets a continuous one`, sheet.clashes.length === 0, sheet.clashes.slice(0, 3).join(" | "));
  ok(`the paywall sheet, ${theme}: every pill and circle is still round`, sheet.pills.length === 0, sheet.pills.slice(0, 4).join(" | "));
  ok(`${theme}: the surfaces are drawn continuous`, surfaces > 40, `${surfaces} boxes`);
  await context.close();
}

// The introduction, from an empty browser: its stage and its answer rows.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  const page = await context.newPage();
  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("main .intro-stage", { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  const res = await page.evaluate(audit);
  ok("the introduction: no round corner meets a continuous one", res.clashes.length === 0, res.clashes.slice(0, 3).join(" | "));
  ok("the introduction: every pill and circle is still round", res.pills.length === 0, res.pills.slice(0, 4).join(" | "));
  ok("the introduction's stage is drawn continuous", await page.evaluate(() => getComputedStyle(document.querySelector(".intro-stage")).cornerTopLeftShape !== "superellipse(1)"));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
