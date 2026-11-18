/**
 * Trait XP, photographed (DECISIONS #498): You's trait rows and a trait's
 * sheet on one account, and the result's level-up moment after a take,
 * at 390x844 and 320x568, light and dark. The same recordings on any
 * build, so a before and an after compare the rule and nothing else.
 *
 *   you      fourteen recordings (about the p90 account), drawn once from
 *            the production percentiles with a fixed seed: the rows, free
 *            and Premium, and the sheets of Filler control, Pace and
 *            Restart control
 *   first    the very first recording: the take crosses Pace and Pausing
 *            to level 1
 *   one      four recordings before it: the take crosses Pace to level 3
 *   two      Pace to level 3 and Pausing to level 2
 *   more     five cross: two named and "3 more"
 *   none     four recordings before it, and the take crosses nothing
 *
 * The take is look-fixtures' live recording (Pausing 72, Filler control
 * 55, Restart control 66, Pace 93, Variety 66), stored as it is sent, so
 * the read after it holds it as a save would.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3953
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     LOOK_BASE=http://localhost:3953 node scripts/look-trait-xp.mjs after
 *   ... look-trait-xp.mjs after you one    # only these scenes
 *
 * Prints each row's name as a screen reader is given it, each sheet's
 * meter and line, and the glance's earned line. Shots: LOOK_OUT, default
 * docs/look/trait-xp/, <tag>-<scene>-<size>.png. Sizes: LOOK_SIZES,
 * default "390x844-light,390x844-dark,320x568-light,320x568-dark".
 */
import { mkdirSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const F = await import("./look-fixtures.mjs");

const TAG = process.argv[2] ?? "after";
const ONLY = process.argv.slice(3);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const BASE = process.env.LOOK_BASE ?? "http://localhost:3953";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/trait-xp/", import.meta.url).pathname).replace(/\/?$/, "/");
const SIZES = (process.env.LOOK_SIZES ?? "390x844-light,390x844-dark,320x568-light,320x568-dark").split(",").map((s) => {
  const [wh, theme] = s.split("-");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, theme, name: s };
});
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- the recordings ------------------------------------------------------ */
const tmpl = F.LEVEL_MIX[0];
const T2 = (s) => ({
  structure: { ...tmpl.dimensions.tier2.structure, score: s.structure },
  credibility: { ...tmpl.dimensions.tier2.credibility, score: s.credibility },
  engagement: { ...tmpl.dimensions.tier2.credibility, score: s.engagement },
  confidence: { ...tmpl.dimensions.tier2.confidence, score: s.confidence },
});
const take = (id, daysAgo, s) => ({
  ...tmpl,
  id: `xp-${id}`,
  client_id: `look-xp-${id}`,
  created_at: new Date(Date.now() - daysAgo * 86400000 - 3600000).toISOString(),
  dimensions: {
    tier1: { pause: s.pause, fillers: s.fillers, repairs: s.repairs, pace: s.pace, range: s.range },
    anchors: { hedgeCount: 2, restartCount: 1 },
    tier2: T2({ structure: 60, credibility: 58, engagement: 61, confidence: 62, ...s }),
  },
});

/* The production percentiles (p25/p50/p75/p90 per recording, 42 accounts),
   the same table lib/traits.test.ts draws its synthetic accounts from. */
const PCT = {
  fillers: [7, 61, 100, 100], pace: [42, 75, 90, 100], pause: [11, 20, 45, 85], range: [74, 90, 100, 100], repairs: [0, 0, 52, 100],
  structure: [40, 60, 75, 85], credibility: [40, 60, 75, 85], engagement: [40, 60, 75, 85], confidence: [40, 60, 75, 85],
};
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function quantile(p, q) {
  const xs = [0, 0.25, 0.5, 0.75, 0.9, 1];
  const ys = [0, ...p, 100];
  for (let i = 1; i < xs.length; i++) if (q <= xs[i]) return ys[i - 1] + ((q - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  return 100;
}
const rnd = mulberry32(498);
const YOU = Array.from({ length: 14 }, (_, i) => {
  const s = Object.fromEntries(Object.entries(PCT).map(([k, p]) => [k, Math.round(quantile(p, rnd()))]));
  return take(`you-${i + 1}`, 14 - i, s);
});

/* Before the live take: the XP each history leaves, and what the take's
   own scores (Pace 93, Pausing 72, Filler control 55, Restart control 66,
   Variety 66) then cross at 70, 210, 420 (lib/traits.ts xpFor). */
const flat = (n, s) => Array.from({ length: n }, (_, i) => take(`h-${i + 1}`, n - i, s));
const HISTORY = {
  first: [],
  /* Pace 380 + 93 crosses 420; Pausing 220, Filler control 300, Restart
     control 100 and Variety 232 cross nothing. */
  one: flat(4, { pace: 95, pause: 55, fillers: 75, repairs: 25, range: 58 }),
  /* ... and Pausing 160 + 72 crosses 210. */
  two: flat(4, { pace: 95, pause: 40, fillers: 75, repairs: 25, range: 58 }),
  /* Pace, Variety 360 + 66 past 420, Pausing, Filler control 160 + 55
     past 210, Restart control 20 + 66 past 70. */
  more: flat(4, { pace: 95, pause: 40, fillers: 40, repairs: 5, range: 90 }),
  /* Pace 220, Pausing 220, Filler control 300, Restart control 100,
     Variety 232: every one stays under its next level. */
  none: flat(4, { pace: 55, pause: 55, fillers: 75, repairs: 25, range: 58 }),
};

/* ---- the browser --------------------------------------------------------- */
const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

async function open(size, plan, rows) {
  F.resetPlan(plan);
  F.repsMode.rows = rows;
  F.extraReps.length = 0;
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: size.theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.addInitScript(F.seed, { theme: size.theme, session: F.session, pose: F.POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    const d = new Date();
    localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { context, page };
}

/* You: the rows, free and Premium, and three sheets. */
if (want("you")) {
  for (const plan of ["free", "code"]) {
    for (const size of SIZES) {
      const { context, page } = await open(size, plan, YOU);
      await page.goto(`${BASE}/you`);
      await page.waitForSelector("main h2.section-head", { timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => console.log("SKELETONS"));
      await sleep(1800);
      const head = page.locator('main h2.section-head:text-matches("trait level", "i")').first();
      await head.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 72));
      await sleep(500);
      if (size === SIZES[0]) {
        const said = await page.evaluate(() =>
          [...document.querySelectorAll("main button[aria-haspopup='dialog']")]
            .filter((b) => b.closest("section")?.querySelector("h2")?.textContent?.match(/trait level/i))
            .map((b) => b.getAttribute("aria-label"))
        );
        for (const line of said) console.log(`  ${plan} row  ${line}`);
      }
      await page.screenshot({ path: `${OUT}${TAG}-you-${plan === "code" ? "rows-nine" : "rows"}-${size.name}.png` });
      console.log(`shot  you ${plan} ${size.name}`);
      if (plan === "free") {
        for (const key of ["fillers", "pace", "repairs"]) {
          const row = page.locator(`main button[data-trait="${key}"]`).first();
          if ((await row.count()) === 0) continue;
          await row.click();
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
          await sleep(1000);
          if (size === SIZES[0]) {
            const d = await page.evaluate(() => {
              const dlg = document.querySelector('[role="dialog"]');
              const pb = dlg?.querySelector('[role="progressbar"]');
              return {
                meter: pb ? pb.getAttribute("aria-valuetext") : dlg?.querySelector("[data-level]")?.textContent,
                line: dlg?.querySelector("[data-xp], [data-closest]")?.textContent ?? null,
                rule: dlg?.querySelector("[data-rule]")?.textContent ?? null,
              };
            });
            console.log(`  sheet ${key}: ${JSON.stringify(d)}`);
          }
          await page.screenshot({ path: `${OUT}${TAG}-you-sheet-${key}-${size.name}.png` });
          await page.keyboard.press("Escape");
          await sleep(700);
        }
      }
      await context.close();
    }
  }
}

/* The result: Today, Start, five seconds, Stop, and the glance. */
for (const scene of ["first", "one", "two", "more", "none"]) {
  if (!want(scene)) continue;
  for (const size of SIZES) {
    const { context, page } = await open(size, "free", HISTORY[scene]);
    const last = HISTORY[scene].at(-1);
    await context.route("**/api/analyze", async (route) => {
      await sleep(1200);
      const body = { ...F.analyzeBody, previousIndex: last ? last.ethos_index : null };
      /* Stored as the route would store it, so the read after the take holds it. */
      F.extraReps.push({
        ...tmpl,
        id: body.repId,
        client_id: "look-xp-live",
        created_at: new Date().toISOString(),
        transcript: body.transcript,
        ethos_index: body.ethosIndex,
        dimensions: { tier1: body.tier1, anchors: body.anchors, tier2: body.coach.dimensions },
      });
      await route.fulfill(F.json(body));
    });
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main .arrive", { timeout: 30000 });
    await sleep(800);
    await page.locator('main a[href^="/rep"], main button:has-text("Start")').first().click();
    await page.waitForSelector('button[data-record="start"]', { timeout: 30000 });
    await sleep(900);
    await page.click('button[data-record="start"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
    await sleep(5000);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("[data-step-action]", { timeout: 30000 });
    await sleep(3200);
    /* The earned line, Demos's cue under his line (the #498 review: a
       level-up must not push the cue off the glance where a shorter form
       of it fits), and the glance's visible words as look-glance counts
       them. */
    const m = await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        return s.visibility !== "hidden" && s.display !== "none" && !el.closest("[aria-hidden='true'], .sr-only, [role='dialog']");
      };
      let words = 0;
      const walk = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const p = walk.currentNode.parentElement;
        if (!p || !visible(p) || p.closest("select, script, style")) continue;
        words += (walk.currentNode.nodeValue ?? "").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
      }
      return {
        earned: document.querySelector("main [data-earned]")?.textContent ?? null,
        cue: document.querySelector("main [data-glance-cue]")?.textContent ?? null,
        words,
        scroll: document.scrollingElement.scrollHeight - innerHeight,
      };
    });
    console.log(`  ${scene} ${size.name}: earned ${JSON.stringify(m.earned)}, cue ${JSON.stringify(m.cue)}, ${m.words} words, scroll ${m.scroll}`);
    await page.screenshot({ path: `${OUT}${TAG}-result-${scene}-${size.name}.png` });
    console.log(`shot  result ${scene} ${size.name}`);
    await context.close();
  }
}
await browser.close();
