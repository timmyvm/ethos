/**
 * The apple-design pass, checked in a real browser (DECISIONS #321):
 * the large title handing over to the bar, the nav lens a thumb can
 * slide, the sheet that keeps a flick's momentum and resists past its
 * top, the segmented thumb, and reduced transparency going solid.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-apple.mjs
 *
 * Shots land in docs/look/apple/ (APPLE_OUT to move them).
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.APPLE_OUT ?? new URL("../docs/look/apple/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch();
async function open(theme, extra = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
    ...extra,
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  return { context, page: await context.newPage() };
}

/** A pointer drag in steps, `ms` long, so velocity is real. */
async function drag(page, [x0, y0], [x1, y1], ms, steps = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(ms / steps);
  }
}
/**
 * A gesture at a phone's event rate: pointer events dispatched in the
 * page 8ms apart. Playwright's mouse waits on a round trip per move,
 * 100ms and more on a busy page, which turns every flick into a haul.
 */
async function gesture(page, sel, points, { release = true } = {}) {
  return page.evaluate(
    async ({ sel, points, release }) => {
      const el = document.querySelector(sel);
      const fire = (type, [x, y]) =>
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1 }));
      fire("pointerdown", points[0]);
      for (const p of points.slice(1)) {
        await new Promise((r) => setTimeout(r, 8));
        fire("pointermove", p);
      }
      const at = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      if (release) fire("pointerup", points[points.length - 1]);
      return { x: at.m41, y: at.m42 };
    },
    { sel, points, release }
  );
}
const line = ([x0, y0], [x1, y1], n) =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);

const translateY = (page, sel) =>
  page.$eval(sel, (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);

for (const theme of ["light", "dark"]) {
  const { context, page } = await open(theme);

  // 1. The large title hands over to the bar.
  await page.goto(`${BASE}/you`);
  await page.waitForSelector("main h1.large-title");
  await sleep(800);
  let bar = await page.$eval(".screen-bar", (el) => ({ edge: el.hasAttribute("data-edge"), collapsed: el.hasAttribute("data-collapsed") }));
  ok(`${theme}: at rest the bar is clear and the large title is the header`, !bar.edge && !bar.collapsed);
  await page.evaluate(() => window.scrollTo(0, 420));
  await sleep(500);
  bar = await page.$eval(".screen-bar", (el) => ({ edge: el.hasAttribute("data-edge"), collapsed: el.hasAttribute("data-collapsed") }));
  ok(`${theme}: scrolled, the bar is material and carries the small title`, bar.edge && bar.collapsed);
  await page.screenshot({ path: `${OUT}you-scrolled-${theme}.png`, clip: { x: 0, y: 0, width: 390, height: 320 } });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);

  // 2. The sheet: a slow short pull springs home; a flick dismisses;
  //    pushing up resists.
  if (theme === "light") {
    const trait = page.locator("main button", { hasText: "Pace" }).first();
    if (await trait.count()) {
      await trait.click();
      await page.waitForSelector("[role=dialog] .sheet-panel");
      await sleep(900);
      const box = await page.$eval("[role=dialog] .sheet-panel", (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 24, h: r.height }; });
      await page.screenshot({ path: `${OUT}sheet-open-${theme}.png` });

      await drag(page, [box.x, box.y], [box.x, box.y - 160], 300);
      const up = await translateY(page, "[role=dialog] .sheet-panel");
      ok("up past the top resists (rubber band)", up < 0 && up > -110, `${Math.round(up)}px for 150px of finger`);
      await page.mouse.up();
      await sleep(900);
      ok("and springs back to rest", Math.abs(await translateY(page, "[role=dialog] .sheet-panel")) < 1);

      await drag(page, [box.x, box.y], [box.x, box.y + 70], 700);
      await page.mouse.move(box.x, box.y + 70);
      await sleep(160);
      await page.mouse.up();
      await sleep(900);
      const stayed = await page.$("[role=dialog] .sheet-panel");
      ok("a slow short pull springs home", !!stayed && Math.abs(await translateY(page, "[role=dialog] .sheet-panel")) < 1);

      // A flick: 90px in 64ms. It must leave from where the finger let
      // go, not jump to the top first, and it must go.
      const released = (await gesture(page, "[role=dialog] .sheet-panel", line([box.x, box.y], [box.x, box.y + 90], 8))).y;
      await sleep(16);
      const next = await translateY(page, "[role=dialog] .sheet-panel").catch(() => Infinity);
      ok("a flick leaves from where it was let go", next >= released - 1, `${Math.round(released)} → ${Math.round(next)}px`);
      await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 1500 }).then(
        () => ok("and the flick dismisses", true),
        () => ok("and the flick dismisses", false)
      );
    } else {
      ok("the trait sheet opens from You", false, "no Pace row");
    }

    // 3. The nav lens: slide from You to Log and let go.
    const glass = await page.$eval(".nav-glass", (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width }; });
    const tabX = (i) => glass.x + 6 + ((glass.w - 12) / 5) * (i + 0.5);
    await gesture(page, ".nav-glass", line([tabX(4), glass.y], [tabX(3) - 6, glass.y], 16), { release: false });
    const pressed = await page.$eval(".nav-glass", (el) => el.hasAttribute("data-dragging"));
    ok("sliding along the bar takes the well", pressed);
    await page.screenshot({ path: `${OUT}nav-drag-${theme}.png`, clip: { x: 0, y: 740, width: 390, height: 104 } });
    await page.$eval(".nav-glass", (el) => el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true })));
    await page.waitForURL(/\/history/, { timeout: 3000 }).then(
      () => ok("letting go on Log goes to Log", true),
      () => ok("letting go on Log goes to Log", false, page.url())
    );
    await sleep(900);
    const wellX = await page.$eval(".nav-well", (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
    const step = await page.$eval(".nav-well", (el) => el.offsetWidth);
    ok("and the well rests on it", Math.abs(wellX - step * 3) < 1, `${Math.round(wellX)} vs ${step * 3}`);
  }

  // 4. Settings: the segmented thumb slides on the spring.
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector(".segmented");
  await sleep(600);
  const target = theme === "light" ? "dark" : "light";
  await page.getByRole("radio", { name: target }).click();
  await sleep(40);
  const easing = await page.$eval(".segmented-thumb", (el) => getComputedStyle(el).transitionTimingFunction);
  ok(`${theme}: segmented thumb moves on a spring`, easing.startsWith("linear("));
  await sleep(700);
  await page.getByRole("radio", { name: theme }).click();
  await sleep(700);
  await context.close();
}

// 5. Reduced transparency: the glass goes solid.
{
  const { context, page } = await open("light", { reducedMotion: "no-preference" });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await page.goto(`${BASE}/you`);
  await page.waitForSelector(".nav-glass");
  const filter = await page.$eval(".nav-glass", (el) => getComputedStyle(el).backdropFilter);
  ok("reduced transparency: the nav drops its blur", filter === "none", filter);
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
