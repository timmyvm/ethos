/**
 * Tap targets, tabular digits and touch-and-hold, swept across the app
 * (#439, #444).
 *
 * Three of the things a finger and an eye notice without knowing why:
 *
 *  - every control can be hit: its target is at least 44 by 44, counting
 *    the invisible reach a small mark is given (a `::before` or
 *    `::after` laid past its edges, the way `.text-link` and the toast's
 *    Undo do it). A link set inside a sentence is the one exception, as
 *    it is in the platform's own rule.
 *  - every number that stands as a number (Outfit: a score, a count, a
 *    clock, a price, a table's column) sets its digits at one width, so
 *    a changing value never shifts what sits beside it.
 *  - a held thumb selects no control's label (the browser's Copy bar on
 *    a button), while the transcript's words, which are taps too, stay
 *    text a person can select.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-targets.mjs
 *   WIDTH=320 node scripts/check-targets.mjs      # the narrowest phone
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { json, seed, session, supabaseRoute, SAVED_ROWS, savedWordsMode } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const WIDTH = Number(process.env.WIDTH ?? 390) || 390;
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
  ["Sign in", "/signin"], ["Sign up", "/signup"], ["About", "/about"],
];

const sweep = () => {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const name = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} “${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28)}”`;

  // ---- targets ----
  const small = [];
  const controls = document.querySelectorAll(
    'a[href], button, [role="button"], [role="radio"], [role="switch"], [role="tab"], [role="option"], [role="slider"], input:not([type="hidden"]), select, textarea, summary'
  );
  for (const el of controls) {
    if (el.closest("nextjs-portal") || el.closest("[aria-hidden='true']") || el.disabled) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    // A link, or a word that can be tapped (the transcript's), set inside
    // a sentence: the platform's own exception. It still has to be 44 tall.
    if (cs.display.startsWith("inline") && el.parentElement && /^(P|LI|SPAN|EM|STRONG|DD|DIV)$/.test(el.parentElement.tagName)) {
      const own = (el.textContent ?? "").trim().length;
      const around = (el.parentElement.textContent ?? "").trim().length;
      const tall = el.tagName === "A" || el.getBoundingClientRect().height >= 43.5;
      if (around > own + 12 && tall) continue;
    }
    // A field covered by its own label is hit through the label.
    if (el.tagName === "INPUT" && el.labels?.length && [...el.labels].some((l) => { const lr = l.getBoundingClientRect(); return lr.width >= 44 && lr.height >= 44; })) continue;
    let { left, top, right, bottom } = el.getBoundingClientRect();
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.content === "normal" || ps.position !== "absolute" || ps.pointerEvents === "none") continue;
      const px = (v) => (v.endsWith("px") ? parseFloat(v) : 0);
      if (px(ps.top) < 0) top += px(ps.top);
      if (px(ps.left) < 0) left += px(ps.left);
      if (px(ps.right) < 0) right -= px(ps.right);
      if (px(ps.bottom) < 0) bottom -= px(ps.bottom);
    }
    // A control that fills a larger pressable parent (a row that is one link) is hit through it.
    const w = right - left, h = bottom - top;
    if (w >= 43.5 && h >= 43.5) continue;
    small.push(`${name(el)} ${Math.round(w)}x${Math.round(h)}`);
  }

  // ---- digits ----
  const loose = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const text = walker.currentNode.nodeValue ?? "";
    if (!/\d/.test(text)) continue;
    // A number standing as a number: digits with at most a short unit
    // ("155", "1.8", "0:42", "99/150", "62 wpm"). A sentence or a title
    // that holds a figure ("Day 1 vs now") is prose, and sets as prose.
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el) || el.closest("nextjs-portal, script, style, .sr-only, [aria-hidden='true'] svg")) continue;
    // Read across the element's own text: a figure dropped into a sentence is its own text node.
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue ?? "").join("");
    if ((own.match(/[A-Za-z]/g) ?? []).length > 4) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    // Outfit is the face numbers stand in; Figtree is prose, where a figure sits in a sentence.
    if (!/outfit|display-face/i.test(cs.fontFamily) && !/__Outfit|Outfit/i.test(cs.fontFamily)) continue;
    if (/tabular-nums/.test(cs.fontVariantNumeric)) continue;
    loose.push(`${name(el)}`);
  }
  // ---- touch and hold (#444): a control's label is not text to select; what was said is ----
  const selectable = [];
  for (const el of controls) {
    if (el.closest("nextjs-portal") || !visible(el)) continue;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.classList.contains("tw") || el.closest("p")) continue;
    if (getComputedStyle(el).userSelect !== "none") selectable.push(name(el));
  }
  const said = [...document.querySelectorAll(".tw")].slice(0, 5).filter((el) => getComputedStyle(el).userSelect === "none").length;
  return { small: [...new Set(small)], loose: [...new Set(loose)], selectable: [...new Set(selectable)], said, controls: controls.length };
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
});
await context.route("http://supabase.local/**", supabaseRoute);
await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
await context.addInitScript(seed, { theme: "light", session });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 120)));
savedWordsMode.rows = SAVED_ROWS.map((r) => ({ ...r }));

let checked = 0;
for (const [name, path] of SCREENS) {
  await page.goto(`${BASE}${path}`);
  await page.waitForSelector("main", { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(500);
  const res = await page.evaluate(sweep);
  checked += res.controls;
  ok(`${name}: every control is a 44px target`, res.small.length === 0, res.small.slice(0, 6).join(" | "));
  ok(`${name}: every standing number sets tabular digits`, res.loose.length === 0, res.loose.slice(0, 6).join(" | "));
  ok(`${name}: no control's label can be selected, and what was said still can`, res.selectable.length === 0 && res.said === 0, res.selectable.slice(0, 6).join(" | ") + (res.said ? ` (${res.said} transcript words unselectable)` : ""));
}
// A sheet, open: the paywall from Practice.
await page.goto(`${BASE}/games?paywall=1`);
await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {});
await sleep(900);
{
  const res = await page.evaluate(sweep);
  ok("the paywall sheet: every control is a 44px target", res.small.length === 0, res.small.slice(0, 6).join(" | "));
  ok("the paywall sheet: every standing number sets tabular digits", res.loose.length === 0, res.loose.slice(0, 6).join(" | "));
}
ok(`controls measured at ${WIDTH}px`, checked > 150, String(checked));

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
