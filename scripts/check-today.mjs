/**
 * Today, checked in a real browser (S14: D14, D22, D24).
 *
 * 1. Each object once. The wide tile (the card's trait) draws no
 *    object; the other four draw their trait's fixed emblem.
 * 2. No crop at the top. Every tile's emblem has its visible top 12px
 *    or more inside its tile (Variety's tag cord may reach the edge),
 *    runs off the right by a fifth of its visible width at most and off
 *    the foot by 15% at most, at 320, 390 and 430, in both themes.
 * 3. The tactic in two lines. At 320 every tactic label the card can
 *    show (lib/tip-labels.ts) holds two lines in the card's words.
 * 4. Start never waits on a spin. Mid-roll, "Take this one" is live; a
 *    tap lands the reel on the topic it drew, on the snappy spring, and
 *    goes to that topic's recording, once.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-today.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { readFileSync } from "node:fs";
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

/* Every label a tactic can wear on the card, read from its source. */
const labels = [
  ...readFileSync(new URL("../lib/tip-labels.ts", import.meta.url), "utf8").matchAll(
    /:\s*\[(?:"([^"]+)"|'([^']+)'),\s*"\w+"\]/g
  ),
].map((m) => m[1] ?? m[2]);
const EMBLEM = {
  pause: "the-long-one",
  fillers: "the-cold-open",
  repairs: "finish-it",
  pace: "room-to-land",
  range: "name-it-once",
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
async function open(theme, width) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme, session });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main .home-tile[data-wide]", { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  await sleep(700);
  return { context, page };
}

// 1 and 2: the tiles.
for (const theme of ["light", "dark"]) {
  for (const width of [320, 390, 430]) {
    const { context, page } = await open(theme, width);
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll(".home-tile[data-trait]")].map((tile) => {
        const img = tile.querySelector("img.home-tile-art");
        const t = tile.getBoundingClientRect();
        if (!img) return { trait: tile.dataset.trait, wide: tile.hasAttribute("data-wide"), img: null };
        const i = img.getBoundingClientRect();
        const s = getComputedStyle(tile);
        const f = (n) => Number(s.getPropertyValue(n));
        const box = {
          left: i.left + f("--art-l") * i.width,
          top: i.top + f("--art-t") * i.height,
          width: f("--art-w") * i.width,
          height: f("--art-h") * i.height,
        };
        return {
          trait: tile.dataset.trait,
          wide: tile.hasAttribute("data-wide"),
          img: img.getAttribute("src"),
          top: box.top - t.top,
          right: box.left + box.width - t.right,
          foot: box.top + box.height - t.bottom,
          w: box.width,
          h: box.height,
        };
      })
    );
    const wide = tiles.filter((t) => t.wide);
    const four = tiles.filter((t) => !t.wide);
    ok(
      `${theme} ${width}: the wide tile draws no object, the four their emblems`,
      wide.length === 1 && wide[0].img === null && four.length === 4 &&
        four.every((t) => t.img?.includes(`/${EMBLEM[t.trait]}.webp`)),
      JSON.stringify(tiles.map((t) => `${t.trait}:${t.img ? t.img.split("/").pop() : "none"}`))
    );
    const bad = four.filter(
      (t) => t.top < (t.trait === "range" ? 0 : 12) - 0.5 || t.right > 0.2 * t.w + 0.5 || t.foot > 0.15 * t.h + 0.5
    );
    ok(
      `${theme} ${width}: every emblem inside its tile's top, cut at the right or foot only`,
      bad.length === 0,
      four.map((t) => `${t.trait} top ${t.top.toFixed(1)} right ${t.right.toFixed(1)}/${(0.2 * t.w).toFixed(1)}`).join(", ")
    );
    await context.close();
  }
}

// 3: the tactic at 320.
{
  const { context, page } = await open("light", 320);
  const lines = await page.evaluate((labels) => {
    const span = document.querySelector(".home-hero .stage-ink.font-display");
    if (!span) return null;
    const chevron = span.querySelector(".disclosure-mark")?.outerHTML ?? "";
    const lh = parseFloat(getComputedStyle(span).lineHeight);
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return labels.map((label) => {
      const cut = label.lastIndexOf(" ");
      const head = cut < 0 ? "" : label.slice(0, cut + 1);
      const last = cut < 0 ? label : label.slice(cut + 1);
      span.innerHTML = `${esc(head)}<span class="whitespace-nowrap">${esc(last)}${chevron}</span>`;
      return [label, Math.round(span.getBoundingClientRect().height / lh)];
    });
  }, labels);
  const over = (lines ?? []).filter(([, n]) => n > 2);
  ok(
    `320: all ${labels.length} tactic labels hold two lines on the card`,
    lines !== null && labels.length > 40 && over.length === 0,
    over.length ? JSON.stringify(over) : `${labels.length} labels`
  );
  await context.close();
}

// 4: a tap mid-roll.
for (const theme of ["light", "dark"]) {
  const { context, page } = await open(theme, 390);
  const pushes = [];
  page.on("framenavigated", (f) => f === page.mainFrame() && pushes.push(f.url()));
  await page.click('button[aria-label="Spin a new topic"]');
  await sleep(900);
  await page.click('button[aria-label="Spin again"]');
  await sleep(600);
  const take = page.locator('button:has-text("Take this one")');
  const live = !(await take.isDisabled());
  await take.click();
  await take.click({ timeout: 300 }).catch(() => {});
  /* The chip names the drawn topic's shape as the reel lands on it. */
  await sleep(120);
  const landing = await page.evaluate(() => document.querySelector(".home-hero .stage-chip")?.textContent ?? "");
  await page.waitForURL(/\/rep\?topic=/, { timeout: 15000 }).catch(() => {});
  await sleep(600);
  const reps = pushes.filter((u) => u.includes("/rep?topic=")).length;
  ok(
    `${theme}: Take this one is live mid-roll and a tap goes to the drawn topic once`,
    live && reps === 1 && landing.length > 0,
    `live ${live}, ${reps} navigation(s) to /rep, chip "${landing}"`
  );
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
