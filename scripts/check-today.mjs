/**
 * Today, checked in a real browser (S14: D14, D22, D24; #478).
 *
 * 1. Only the card glows (#478, docs/plan-next.md section 1). No tile
 *    under it stands an object or a light: no image, no drop shadow, no
 *    radial light, no box shadow on a tile, and nothing outside the card
 *    draws a drop shadow. Each of the five trait tiles carries one flat
 *    glyph before its name, in its own tone, every glyph its own
 *    drawing; at 320, 390 and 430, in both themes.
 * 2. The three things (#478, section 10). Hostile Q&A and this week's
 *    boss stand side by side straight under the card, equal in width
 *    and height, over the switch; each is one link (to /hostile and
 *    /boss, both `?from=today`), says what it is about now and one line
 *    (rounds left, or when the next opens; days left, or Done this
 *    week); at 390 and 430 both stand on the first screen, clear of the
 *    nav. The boss's back names Today and returns there.
 * 3. The tactic in two lines. At 320 every tactic label the card can
 *    show (lib/tip-labels.ts) holds two lines in the card's words. The
 *    card shows the tactic once the day is spoken ("One more", #431),
 *    so this runs on a day with a recording in it; an open day's card
 *    shows no tactic at all, which is checked too.
 * 4. Start never waits on a spin. Mid-roll, "Take this one" is live; a
 *    tap lands the reel on the topic it drew, on the snappy spring, and
 *    goes to that topic's recording, once. From both doors: "Another
 *    topic" under Start on a day not yet spoken (#431), the shuffle
 *    glyph on "One more"; an open day's take opens ready to record.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-today.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { readFileSync } from "node:fs";
import { seed, session, supabaseRoute, testerMode } from "./look-fixtures.mjs";

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
    const flat = await page.evaluate(() => {
      const main = document.querySelector("main");
      const tiles = [...main.querySelectorAll(".home-tile, .home-mode")];
      /* A light is a drop shadow, a radial glow, or an outer shadow with
         a blur; the dark tile's inset 1px rim is its edge, not a light. */
      const cast = (shadow) =>
        shadow !== "none" &&
        shadow.split(/,(?![^(]*\))/).some((s) => {
          if (/inset/.test(s)) return false;
          const px = [...s.replace(/rgba?\([^)]*\)/g, "").matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
          return (px[2] ?? 0) > 0;
        });
      const lit = (el) => {
        const cs = getComputedStyle(el);
        return /drop-shadow/.test(cs.filter) || /radial-gradient/.test(cs.backgroundImage) || cast(cs.boxShadow);
      };
      const glowing = [...main.querySelectorAll("*")]
        .filter((el) => !el.closest(".home-hero") && /drop-shadow/.test(getComputedStyle(el).filter))
        .map((el) => el.className.toString().split(" ")[0] || el.tagName);
      const traits = [...main.querySelectorAll(".home-tile[data-trait]")].map((tile) => {
        const glyphs = tile.querySelectorAll(".home-trait-glyph > svg");
        return {
          trait: tile.dataset.trait,
          glyphs: glyphs.length,
          drawing: glyphs[0]?.innerHTML ?? "",
        };
      });
      return {
        images: tiles.reduce((n, t) => n + t.querySelectorAll("img, picture, video").length, 0),
        litTiles: tiles.filter((t) => lit(t) || [...t.querySelectorAll("*")].some(lit)).length,
        glowing,
        traits,
      };
    });
    ok(
      `${theme} ${width}: no tile under the card stands an object or a light, and nothing outside the card glows`,
      flat.images === 0 && flat.litTiles === 0 && flat.glowing.length === 0,
      JSON.stringify({ images: flat.images, litTiles: flat.litTiles, glowing: flat.glowing })
    );
    /* The tone as the tile resolves it, against the glyph's drawn colour. */
    const toned = await page.evaluate(() =>
      [...document.querySelectorAll("main .home-tile[data-trait] .home-trait-glyph")].map((g) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--tone)";
        g.parentElement.appendChild(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(g).color === want;
      })
    );
    ok(
      `${theme} ${width}: five trait tiles, each one flat glyph in its own tone, five different drawings`,
      flat.traits.length === 5 &&
        flat.traits.every((t) => t.glyphs === 1) &&
        new Set(flat.traits.map((t) => t.drawing)).size === 5 &&
        toned.length === 5 && toned.every(Boolean),
      flat.traits.map((t) => `${t.trait}:${t.glyphs}`).join(", ") + ` toned ${JSON.stringify(toned)}`
    );

    const modes = await page.evaluate(() => {
      const card = document.querySelector(".home-hero").getBoundingClientRect();
      const seg = document.querySelector(".home-seg")?.getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Sections"] .nav-glass')?.getBoundingClientRect();
      return {
        card: { bottom: card.bottom },
        seg: seg ? { top: seg.top } : null,
        nav: nav ? { top: nav.top } : null,
        tiles: [...document.querySelectorAll("main a.home-mode")].map((a) => {
          const r = a.getBoundingClientRect();
          return {
            id: a.dataset.mode,
            href: a.getAttribute("href"),
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            width: r.width,
            height: r.height,
            subject: a.querySelector(".home-mode-subject")?.textContent.trim() ?? "",
            line: a.querySelector(".home-mode-line")?.textContent.trim() ?? "",
            label: a.getAttribute("aria-label") ?? "",
            links: a.querySelectorAll("a, button").length,
          };
        }),
      };
    });
    const [h, b] = modes.tiles;
    const pair =
      modes.tiles.length === 2 &&
      h.id === "hostile" && h.href === "/hostile?from=today" &&
      b.id === "boss" && b.href === "/boss?from=today" &&
      Math.abs(h.top - b.top) < 1 && Math.abs(h.width - b.width) < 1 && Math.abs(h.height - b.height) < 1 &&
      b.left > h.left &&
      h.top - modes.card.bottom >= 8 && h.top - modes.card.bottom <= 16 &&
      modes.seg !== null && h.bottom < modes.seg.top &&
      h.links === 0 && b.links === 0;
    ok(
      `${theme} ${width}: Hostile Q&A and the weekly boss, side by side and equal, straight under the card and over the switch, one link each`,
      pair,
      JSON.stringify(modes.tiles.map((t) => ({ id: t.id, href: t.href, top: Math.round(t.top), w: Math.round(t.width), h: Math.round(t.height) }))) +
        ` card foot ${Math.round(modes.card.bottom)}`
    );
    ok(
      `${theme} ${width}: each says what it is about now and one line worth coming back for`,
      modes.tiles.length === 2 &&
        h.subject.length > 4 && b.subject.length > 4 &&
        /^(\d free today|Next in .+)$/.test(h.line) &&
        /^(\d days left|Last day|Done this week)$/.test(b.line) &&
        h.label.startsWith("Hostile Q&A.") && h.label.includes(h.subject) &&
        b.label.startsWith("Weekly boss.") && b.label.includes(b.subject),
      `"${h?.subject}" / "${h?.line}"; "${b?.subject}" / "${b?.line}"`
    );
    if (width >= 390) {
      ok(
        `${theme} ${width}: both stand on the first screen, clear of the nav`,
        modes.nav !== null && h.bottom <= modes.nav.top && b.bottom <= modes.nav.top,
        `tiles end ${Math.round(Math.max(h.bottom, b.bottom))}, nav at ${Math.round(modes.nav?.top ?? 0)}`
      );
    }
    await context.close();
  }
}

// The boss's tile: one tap away, and its back names Today and returns there.
{
  const { context, page } = await open("light", 390);
  await page.click("main a.home-mode[data-mode='boss']");
  await page.waitForURL(/\/boss\?from=today/, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector("main h1", { timeout: 20000 }).catch(() => {});
  await sleep(600);
  const back = await page.evaluate(() => {
    const a = document.querySelector("main .screen-bar-back");
    return { text: a?.textContent.trim() ?? "", href: a?.getAttribute("href") ?? "" };
  });
  await page.click("main .screen-bar-back");
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {});
  const home = new URL(page.url()).pathname;
  ok(
    "390: the boss's tile opens /boss, whose back says Today and returns to Today",
    back.text === "Today" && back.href === "/" && home === "/",
    JSON.stringify({ back, home })
  );
  await context.close();
}

// 3: the tactic at 320, on a day already spoken ("One more", #431).
{
  const { context: openCtx, page: openPage } = await open("light", 320);
  const openDay = await openPage.evaluate(() => ({
    lead: document.querySelector(".home-hero-lead")?.textContent ?? "",
    tactic: document.querySelector(".home-hero .stage-ink.font-display") !== null,
  }));
  ok(
    "320: a day not yet spoken shows no tactic on the card",
    /Today's practice/.test(openDay.lead) && !openDay.tactic,
    JSON.stringify(openDay)
  );
  await openCtx.close();
  testerMode.today = true;
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
  testerMode.today = false;
}

// 4: a tap mid-roll, from an open day's link and from One more's glyph.
for (const [theme, spoken] of [
  ["light", false],
  ["dark", false],
  ["light", true],
]) {
  testerMode.today = spoken;
  const { context, page } = await open(theme, 390);
  const pushes = [];
  page.on("framenavigated", (f) => f === page.mainFrame() && pushes.push(f.url()));
  await page.click(spoken ? 'button[aria-label="Spin a new topic"]' : 'button.home-another:has-text("Another topic")');
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
  const reps = pushes.filter((u) => u.includes("/rep?topic="));
  const ready = reps.length === 1 && new URL(reps[0]).searchParams.get("ready") === "1";
  ok(
    `${theme} ${spoken ? "One more" : "open day"}: Take this one is live mid-roll and a tap goes to the drawn topic once${spoken ? "" : ", ready"}`,
    live && reps.length === 1 && landing.length > 0 && ready === !spoken,
    `live ${live}, ${reps.length} navigation(s) to /rep, chip "${landing}", ready ${ready}`
  );
  await context.close();
}
testerMode.today = false;

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
