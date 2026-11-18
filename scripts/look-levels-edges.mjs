/**
 * You's trait levels at their edges, under trait XP (#498; first #482's
 * review): LEVEL_MIX and two takes built for the ends of a level's bar,
 * at 390x844 and 320x568, light and dark, and Increase Contrast
 * ("-more"). Prints each row's name as a screen reader is given it, its
 * height, whether the name is cut, the bar's fill in px and the centres
 * of name, value and bar, then shoots the section, clipped.
 *
 *   edges           one take: Filler control 69 (level 0 at 98%), Pace
 *                   70 (level 1, its bar empty), Variety 1 (level 0 at
 *                   1%), Restart control 0 ("Not yet"), Pausing 100
 *                   (level 1 at 21%)
 *   levelup-before  that take alone
 *   levelup-after   and one more paying Filler control 1: level 1, its
 *                   bar empty, the rest a little further in
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3872
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     LOOK_BASE=http://localhost:3872 node scripts/look-levels-edges.mjs review
 *   SETS=edges PLANS=free SIZES=390x844-dark SHEETS=repairs,Engagement ...
 *
 * SHEETS opens each named trait's sheet (a data-trait key, or the name
 * a row's label starts with) and prints its meter and XP line.
 * Shots: OUT, default docs/look/levels/, <tag>-<set>-<plan>-<size>.png.
 */
import { mkdirSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const F = await import("./look-fixtures.mjs");
const BASE = process.env.LOOK_BASE ?? "http://localhost:3872";
const OUT = (process.env.OUT ?? new URL("../docs/look/levels/", import.meta.url).pathname).replace(/\/?$/, "/");
const TAG = process.argv[2] ?? "review";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmpl = F.LEVEL_MIX[0];
const take = (id, n, tier1) => ({
  ...tmpl,
  id: `edge-${id}`,
  client_id: `look-edge-${id}`,
  created_at: new Date(Date.now() - n * 86400000).toISOString(),
  dimensions: { ...tmpl.dimensions, tier1 },
});
const E1 = take(1, 3, { pause: 100, fillers: 69, repairs: 0, pace: 70, range: 1 });
const E2 = take(2, 1, { pause: 10, fillers: 1, repairs: 0, pace: 10, range: 10 });
const SETS = {
  mix: F.LEVEL_MIX,
  edges: [E1],
  "levelup-before": [E1],
  "levelup-after": [E1, E2],
};
const want = (process.env.SETS ?? "mix,edges,levelup-before,levelup-after").split(",");
const SIZES = (process.env.SIZES ?? "390x844-light,390x844-dark,320x568-light,320x568-dark,390x844-light-more,390x844-dark-more").split(",");

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
for (const set of want) {
  for (const plan of (process.env.PLANS ?? "free,code").split(",")) {
    for (const s of SIZES) {
      const [wh, theme, more] = s.split("-");
      const [w, h] = wh.split("x").map(Number);
      F.resetPlan(plan);
      F.repsMode.rows = SETS[set];
      const context = await browser.newContext({
        viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
      });
      await context.route("http://supabase.local/**", F.supabaseRoute);
      await context.route("**/api/billing/*", F.billingApiRoute);
      await context.route("**/api/tester/collect", F.collectRoute);
      await context.addInitScript(F.seed, { theme, session: F.session, pose: F.POSE_PREF });
      const page = await context.newPage();
      if (more) await page.emulateMedia({ contrast: "more", colorScheme: theme });
      page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
      await page.goto(`${BASE}/you`);
      await page.waitForSelector("main h2.section-head", { timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => console.log("SKELETONS"));
      await sleep(1800);
      const sec = page.locator('main section:has(h2.section-head:text-matches("trait level", "i"))').first();
      await sec.scrollIntoViewIfNeeded();
      await sleep(400);
      const info = await sec.evaluate((section) => {
        const lum = (c) => {
          const m = c.match(/[\d.]+/g).map(Number);
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
        };
        return [...section.querySelectorAll("button[aria-haspopup='dialog']")].map((b) => {
          const r = b.getBoundingClientRect();
          const name = b.querySelector("span.truncate");
          const track = b.querySelector(".level-track");
          const fill = b.querySelector(".level-fill");
          const value = b.querySelector(".level-value");
          return {
            label: b.getAttribute("aria-label"),
            h: Math.round(r.height),
            right: Math.round(r.right),
            truncated: name ? name.scrollWidth > name.clientWidth : null,
            value: value?.textContent,
            valueColor: value ? getComputedStyle(value).color : null,
            track: track ? `${track.getBoundingClientRect().width}x${track.getBoundingClientRect().height} ${getComputedStyle(track).backgroundColor} shadow=${getComputedStyle(track).boxShadow}` : null,
            fill: fill ? `${fill.getBoundingClientRect().width.toFixed(1)}px ${getComputedStyle(fill).backgroundColor}` : null,
            centres: [name, value, track].filter(Boolean).map((e) => { const q = e.getBoundingClientRect(); return (q.top + q.height / 2 - r.top).toFixed(1); }).join("/"),
          };
        });
      });
      console.log(`== ${set} ${plan} ${s}`);
      for (const r of info) console.log(" ", JSON.stringify(r));
      const box = await sec.boundingBox();
      await page.screenshot({ path: `${OUT}${TAG}-${set}-${plan}-${s}.png`, clip: { x: 0, y: Math.max(0, box.y - 8), width: w, height: Math.min(box.height + 16, h - Math.max(0, box.y - 8)) } });
      if (process.env.SHEETS) {
        for (const key of process.env.SHEETS.split(",")) {
          const row = page.locator(`main button[data-trait="${key}"], main button[aria-label^="${key}, "]`).first();
          if ((await row.count()) === 0) continue;
          await row.click();
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
          await sleep(1000);
          const d = await page.evaluate(() => {
            const dlg = document.querySelector('[role="dialog"]');
            const pb = dlg?.querySelector('[role="progressbar"]');
            return {
              meter: pb ? `${pb.getAttribute("aria-label")} | ${pb.getAttribute("aria-valuetext")}` : dlg?.querySelector("[data-level]")?.textContent,
              xp: dlg?.querySelector("[data-xp]")?.textContent ?? null,
            };
          });
          console.log(`  sheet ${key}: ${JSON.stringify(d)}`);
          await page.screenshot({ path: `${OUT}${TAG}-${set}-sheet-${key}-${s}.png` });
          await page.keyboard.press("Escape");
          await sleep(700);
        }
      }
      await context.close();
    }
  }
}
await browser.close();
