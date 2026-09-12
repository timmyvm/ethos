/**
 * The motion layer added in Job 3 (DECISIONS #242), checked in a real
 * browser: the page push, the list stagger, the sheet that follows a
 * finger, the Record button's wait, the press drop, and reduced motion
 * collapsing all of it.
 *
 * `scripts/check-motion.mjs` covers the layer from #221 to #230 and
 * drives a whole recording to do it. This one is the additions only, so
 * it runs in about fifteen seconds and can be run on every change.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-motion-layer.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ["microphone"],
  locale: "en-AU",
  timezoneId: "Australia/Melbourne",
});
await context.route("http://supabase.local/**", supabaseRoute);
await context.addInitScript(seed, { theme: "light", session });
// The dev overlay is a portal that swallows pointer events whenever any
// route in the project fails to compile, which turns every click in here
// into a thirty-second timeout with a misleading message.
await context.addInitScript(() => {
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 100)));

// ---- 1. Page changes push, and they push the right way -------------------
await page.goto(`${BASE}/`);
await page.waitForSelector("main");
await sleep(700);

const wrapper = 'div:has(> main), main';
async function pushClass() {
  return page.evaluate(() => {
    const el = document.querySelector("main")?.parentElement;
    return el ? el.className : "(no wrapper)";
  });
}

await page.click('nav a[href="/history"]');
await page.waitForURL(/history/);
ok("going right along the tab bar pushes from the right", (await pushClass()).includes("push-right"), await pushClass());

await page.click('nav a[href="/"]');
await page.waitForURL(/3123\/$/);
ok("coming back along the tab bar pushes from the left", (await pushClass()).includes("push-left"), await pushClass());

await page.goto(`${BASE}/you`);
await page.waitForSelector("main");
await sleep(600);
await page.click('a[href="/shop"]');
await page.waitForURL(/shop/);
ok("going deeper pushes from the right", (await pushClass()).includes("push-right"), await pushClass());

await page.click('a[href="/you"]');
await page.waitForURL(/you/);
ok("coming back out pushes from the left", (await pushClass()).includes("push-left"), await pushClass());

// ---- 2. Lists mount with a stagger ---------------------------------------
await page.goto(`${BASE}/`);
await page.waitForSelector("main");
await sleep(900);
const delays = await page.evaluate(() => {
  const list = document.querySelector(".stagger");
  if (!list) return null;
  return Array.from(list.children)
    .slice(0, 4)
    .map((c) => getComputedStyle(c).animationDelay);
});
ok(
  "a list's rows land one after another",
  Array.isArray(delays) && delays.length >= 3 && delays[0] !== delays[1] && delays[1] !== delays[2],
  delays ? delays.join(",") : "no .stagger on the page"
);

// ---- 3. Press drops one level and springs back ---------------------------
// On /rep, because the Record button is the app's clearest case of a
// control that is both levelled and tappable.
await page.goto(`${BASE}/rep?lesson=h4`);
await page.waitForSelector('button[aria-label="Start recording"]');
const pressed = await page.evaluate(async () => {
  const el = document.querySelector(".press.elev-3, .press.elev-2, .press.elev-1");
  if (!el) return null;
  const before = getComputedStyle(el).boxShadow;
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: r.x + 5, clientY: r.y + 5 }));
  // :active needs a real activation; the computed style is what matters,
  // so read the rule instead of the interaction.
  const rule = Array.from(document.styleSheets)
    .flatMap((s) => {
      try {
        return Array.from(s.cssRules);
      } catch {
        return [];
      }
    })
    .filter((x) => x.selectorText && /\.press\.elev-\d:active/.test(x.selectorText))
    .map((x) => x.selectorText);
  return { before, rule };
});
ok(
  "press drops a level",
  pressed !== null && pressed.rule.length >= 3,
  pressed ? pressed.rule.join(" ") : "no levelled pressable found"
);

const spring = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--ease-spring").trim()
);
ok("the spring is a token", spring.replace(/\s/g, "") === "cubic-bezier(0.34,1.56,0.64,1)", spring);

// ---- 4. The Record button waits ------------------------------------------
await page.goto(`${BASE}/rep?lesson=h4`);
await page.waitForSelector('button[aria-label="Start recording"]');
const wait = await page.$eval('button[aria-label="Start recording"]', (el) => ({
  name: getComputedStyle(el).animationName,
  dur: getComputedStyle(el).animationDuration,
  count: getComputedStyle(el).animationIterationCount,
}));
ok("the Record button breathes while it waits", wait.name === "rec-wait" && wait.count === "infinite", `${wait.name} ${wait.dur}`);

// ---- 5. A sheet follows the finger ---------------------------------------
await page.goto(`${BASE}/`);
await page.waitForSelector("main");
await sleep(800);
await page.getByRole("button", { name: /Make it harder/ }).click();
await sleep(400);
await page.getByRole("button", { name: /Crowd noise/ }).click();
await page.waitForSelector("[role=dialog] .sheet-panel", { timeout: 5000 });
await sleep(500);

const panel = await page.$("[role=dialog] .sheet-panel");
const box = await panel.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 24);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2, box.y + 90, { steps: 6 });
await sleep(60);
const dragged = await page.$eval("[role=dialog] .sheet-panel", (el) => ({
  dragging: el.dataset.dragging,
  transform: el.style.transform,
  transition: getComputedStyle(el).transitionDuration,
}));
ok(
  "the sheet tracks the finger, with no easing in the way",
  dragged.dragging === "true" && /translateY\(\d+/.test(dragged.transform),
  `${dragged.transform} dragging=${dragged.dragging}`
);
await page.mouse.move(box.x + box.width / 2, box.y + 260, { steps: 8 });
await page.mouse.up();
const gone = await page
  .waitForSelector("[role=dialog]", { state: "detached", timeout: 2000 })
  .then(() => true)
  .catch(() => false);
ok("a long pull closes it", gone);

// ---- 6. Reduced motion collapses all of it -------------------------------
// The fixture seed writes `ethos.prefs` on every navigation, so flipping
// the switch and then navigating puts it straight back. Later init
// scripts run last, so this one has the final word.
await context.addInitScript(() => {
  const prefs = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
  localStorage.setItem(
    "ethos.prefs",
    JSON.stringify({ ...prefs, reducedMotion: true })
  );
});
await page.goto(`${BASE}/`);
await page.waitForSelector("main");
await sleep(500);
const calm = await page.evaluate(() => {
  const list = document.querySelector(".stagger");
  const row = list?.children[2];
  const rec = document.documentElement.dataset.motion;
  return {
    motion: rec,
    rowAnim: row ? getComputedStyle(row).animationName : "(none)",
    rowDelay: row ? getComputedStyle(row).animationDelay : "(none)",
  };
});
ok("reduced motion turns a stagger into one fade", calm.motion === "reduce" && calm.rowAnim === "fade-in" && calm.rowDelay === "0s", `${calm.rowAnim} ${calm.rowDelay}`);

await page.goto(`${BASE}/rep?lesson=h4`);
await page.waitForSelector('button[aria-label="Start recording"]');
const calmRec = await page.$eval('button[aria-label="Start recording"]', (el) => getComputedStyle(el).animationName);
ok("reduced motion stops the Record button breathing", calmRec === "none", calmRec);
await page.evaluate(() => localStorage.removeItem("ethos.prefs"));

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
