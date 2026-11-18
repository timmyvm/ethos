/**
 * Today, checked in a real browser (S14: D14, D22, D24; #478).
 *
 * 1. One card (#500; Timothy, 18 Nov: "I don't fuck with all the cards
 *    on the homepage"). Under the practice card nothing larger than a pip
 *    has a fill, an edge or a cast shadow; there is no switch and no
 *    trait tile; nothing outside the card draws a drop shadow; and the
 *    only pictures are the two games' 3D marks, 72px (56 under 360); at
 *    320, 390 and 430, in both themes.
 * 2. The games (#478, #500). Hostile Q&A over the weekly boss, 24 under
 *    the card, each one link (to /hostile and /boss, both `?from=today`)
 *    ending in the house Disclosure, the marks on one left edge, the
 *    names in their tones, what each is about now and one line (rounds
 *    left with as many pips lit, or when the next opens; Read it, explain
 *    it, or Done this week); at 390 and 430 both stand on the first
 *    screen, clear of the nav. The weekly boss's back names Today and
 *    returns there. Each row's name, subject and line hold together,
 *    nearer each other than the row above (#500 review). Nothing moves
 *    when they land (#478 review): the server's paint, which has no
 *    clock, stands the rows, their names, marks and chevrons where they
 *    land, its subject and line still blank, and every claim and every
 *    week's topic fits the two lines held, unclipped, at 320, 349 and 390.
 * 3. The tactic in two lines. At 320 every tactic label the card can
 *    show (lib/tip-labels.ts) holds two lines in the card's words. The
 *    card shows the tactic once the day is spoken ("One more", #431),
 *    so this runs on a day with a recording in it; an open day's card
 *    shows no tactic at all, which is checked too.
 * 3b. Three across, too. At 390 every label holds two lines in a
 *    recording screen tile, the promise TipStrip's recipe makes (#483).
 * 4. Start never waits on a spin. Mid-roll, "Take this one" is live; a
 *    tap lands the reel on the topic it drew, on the snappy spring, and
 *    goes to that topic's recording, once. From both doors: "Another
 *    topic" under Start on a day not yet spoken (#431), the shuffle
 *    glyph on "One more"; an open day's take opens ready to record.
 * 5. The foot against the tab bar (#500). On the first screen of six
 *    iPhones, each with its 34px home inset, on a day not yet spoken and
 *    a day spoken, the games end at 734 (the `--rows-end` the foot's CSS
 *    reads), over the bar from 390 wide, and the foot either clears the
 *    bar or starts under the screen's foot: never under the glass at rest.
 *    Again with each phone's status bar inset (#500 review): the games
 *    end that much lower and the foot still never stands under the glass.
 * 6. The foot says what it is: two figures, today's line and the longest
 *    stretch with no filler, each a number with what it counts and a
 *    line in plain words; a first-day account has no foot and no zero.
 * 7. Both of the card's taps, Start and Another topic, stand clear of
 *    the tab bar at 320x568, 375x667 and 320x692 (#500: Another topic
 *    stood under the bar at 320x568), and at 320x568 and 375x667 under
 *    an installed SE's 20px status bar, each by 4px at least.
 * 7b. Whatever the day's topic is (the final pass of 19 Nov: on a day
 *    whose topic ran three lines, Another topic ended at 500 under a bar
 *    at 490, on production too). At each of 7's phones every topic in
 *    lib/topics.ts, which every lesson's practice and every road's place
 *    draws from, is set in the card as HomeHero sets it (its size steps
 *    at LONG_TOPIC and LONGER_TOPIC, read from the source), and both
 *    taps stand clear of the bar for each, by 7's own 4px. And the
 *    roulette it opens: its way back, in Another topic's place, clear of
 *    the bar by the same 4px, with every topic inside the reel's window.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-today.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { readFileSync } from "node:fs";
import { TODAY_REP, extraReps, repsMode, seed, session, supabaseRoute, testerMode } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

/* Every label a tactic can wear on the card, read from its source. */
/* Every topic the card can show (lib/topics.ts; the lessons and the road
   draw theirs from it), and the lengths where its size steps down. */
const TOPIC_SRC = readFileSync(new URL("../lib/topics.ts", import.meta.url), "utf8");
const TOPICS = [...TOPIC_SRC.matchAll(/\{ id: "(t\d+)", prompt: "([^"]+)"/g)].map((m) => ({ id: m[1], prompt: m[2] }));
const LONG_AT = Number(/export const LONG_TOPIC = (\d+);/.exec(TOPIC_SRC)?.[1]);
const LONGER_AT = Number(/export const LONGER_TOPIC = (\d+);/.exec(TOPIC_SRC)?.[1]);
if (TOPICS.length < 300 || !LONG_AT || !LONGER_AT) throw new Error("lib/topics.ts changed shape: the walk cannot read it");
const labels = [
  ...readFileSync(new URL("../lib/tip-labels.ts", import.meta.url), "utf8").matchAll(
    /:\s*\[(?:"([^"]+)"|'([^']+)'),\s*"\w+"\]/g
  ),
].map((m) => m[1] ?? m[2]);
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
async function open(theme, width, landed = "main .home-foot") {
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
  await page.waitForSelector(landed, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).catch(() => {});
  await sleep(700);
  return { context, page };
}

// 1 and 2: one card, and the games as rows on the ground.
for (const theme of ["light", "dark"]) {
  for (const width of [320, 390, 430]) {
    const { context, page } = await open(theme, width);
    const under = await page.evaluate(() => {
      const main = document.querySelector("main");
      const card = document.querySelector(".home-hero").getBoundingClientRect();
      /* A box is a fill, an edge or a cast shadow on anything larger than
         a pip under the card: the card is the one (#500). */
      const cast = (shadow) =>
        shadow !== "none" &&
        shadow.split(/,(?![^(]*\))/).some((s) => {
          if (/inset/.test(s)) return false;
          const px = [...s.replace(/rgba?\([^)]*\)/g, "").matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
          return (px[2] ?? 0) > 0;
        });
      const filled = (cs) => {
        const bg = cs.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
        return (bg.length === 4 ? bg[3] > 0 : true) && cs.backgroundColor !== "transparent";
      };
      const boxes = [...main.querySelectorAll("*")]
        .filter((el) => !el.closest(".home-hero, .screen-bar, .large-title-row, .large-title-eyebrow, header"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= card.bottom - 1 && r.width * r.height > 200;
        })
        .filter((el) => {
          const cs = getComputedStyle(el);
          return filled(cs) || cs.backgroundImage !== "none" || cast(cs.boxShadow) || parseFloat(cs.borderTopWidth) > 0;
        })
        .map((el) => el.className.toString().split(" ")[0] || el.tagName);
      const glowing = [...main.querySelectorAll("*")]
        .filter((el) => !el.closest(".home-hero") && /drop-shadow/.test(getComputedStyle(el).filter))
        .map((el) => el.className.toString().split(" ")[0] || el.tagName);
      const images = [...main.querySelectorAll("img")]
        .filter((img) => !img.closest(".home-hero, header, .screen-bar, .large-title-row") && img.getBoundingClientRect().top >= card.bottom - 1)
        .map((img) => ({ src: img.getAttribute("src"), w: Math.round(img.getBoundingClientRect().width) }));
      return {
        boxes,
        glowing,
        images,
        switches: main.querySelectorAll('[role="radiogroup"], .segmented').length,
        tiles: main.querySelectorAll(".home-tile[data-trait], [data-wide], [data-four]").length,
      };
    });
    const mark = width < 360 ? 56 : 72;
    ok(
      `${theme} ${width}: the card is the one box: under it no fill, edge or shadow, no switch, no trait tiles, nothing glowing`,
      under.boxes.length === 0 && under.glowing.length === 0 && under.switches === 0 && under.tiles === 0,
      JSON.stringify({ boxes: under.boxes.slice(0, 6), glowing: under.glowing, switches: under.switches, tiles: under.tiles })
    );
    ok(
      `${theme} ${width}: the only pictures under the card are the two games' 3D marks, at ${mark}px`,
      under.images.length === 2 &&
        under.images[0].src === "/icons/3d/hostile.webp" &&
        under.images[1].src === "/icons/3d/boss.webp" &&
        under.images.every((i) => i.w === mark),
      JSON.stringify(under.images)
    );

    const modes = await page.evaluate(() => {
      const card = document.querySelector(".home-hero").getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Sections"] .nav-glass')?.getBoundingClientRect();
      return {
        card: { bottom: card.bottom },
        nav: nav ? { top: nav.top } : null,
        rows: [...document.querySelectorAll("main a.home-mode")].map((a) => {
          const r = a.getBoundingClientRect();
          const art = a.querySelector(".home-mode-art").getBoundingClientRect();
          const words = a.querySelector(".home-mode-words").getBoundingClientRect();
          const name = a.querySelector(".home-mode-name");
          const probe = document.createElement("span");
          probe.style.color = "var(--tone-ink)";
          a.appendChild(probe);
          const tone = getComputedStyle(probe).color;
          probe.remove();
          return {
            id: a.dataset.mode,
            href: a.getAttribute("href"),
            top: r.top,
            bottom: r.bottom,
            height: r.height,
            artLeft: art.left,
            wordsLeft: words.left,
            name: name?.textContent.trim() ?? "",
            toned: name ? getComputedStyle(name).color === tone : false,
            subject: a.querySelector(".home-mode-subject")?.textContent.trim() ?? "",
            line: a.querySelector(".home-mode-line")?.textContent.trim() ?? "",
            /* The words' inner gaps: name to subject, subject to line. */
            nameEnd: name?.getBoundingClientRect().bottom ?? 0,
            subjectTop: a.querySelector(".home-mode-subject > span")?.getBoundingClientRect().top ?? 0,
            subjectEnd: a.querySelector(".home-mode-subject > span")?.getBoundingClientRect().bottom ?? 0,
            lineTop: a.querySelector(".home-mode-line")?.getBoundingClientRect().top ?? 0,
            lineEnd: a.querySelector(".home-mode-line")?.getBoundingClientRect().bottom ?? 0,
            nameTop: name?.getBoundingClientRect().top ?? 0,
            pips: a.querySelectorAll(".home-pip").length,
            lit: a.querySelectorAll(".home-pip[data-on]").length,
            label: a.getAttribute("aria-label") ?? "",
            links: a.querySelectorAll("a, button").length,
            disclosure: !!a.querySelector(':scope > svg path[d="m1.5 1.5 5 5.5-5 5.5"]'),
          };
        }),
      };
    });
    const [h, b] = modes.rows;
    const pair =
      modes.rows.length === 2 &&
      h.id === "hostile" && h.href === "/hostile?from=today" &&
      b.id === "boss" && b.href === "/boss?from=today" &&
      b.top > h.bottom && Math.abs(h.artLeft - b.artLeft) < 1 && Math.abs(h.wordsLeft - b.wordsLeft) < 1 &&
      Math.abs(h.height - b.height) < 1 && h.height >= 44 &&
      h.top - modes.card.bottom >= 20 && h.top - modes.card.bottom <= 28 &&
      h.links === 0 && b.links === 0 && h.disclosure && b.disclosure;
    ok(
      `${theme} ${width}: Hostile Q&A over the weekly boss, 24 under the card, one link each, one left edge, each ending in the Disclosure`,
      pair,
      JSON.stringify(modes.rows.map((t) => ({ id: t.id, top: Math.round(t.top), h: Math.round(t.height), art: Math.round(t.artLeft), d: t.disclosure }))) +
        ` card foot ${Math.round(modes.card.bottom)}`
    );
    ok(
      `${theme} ${width}: each names itself in its tone, says what it is about now and one line; Hostile's rounds as pips`,
      modes.rows.length === 2 &&
        h.name === "Hostile Q&A" && b.name === "Weekly boss" && h.toned && b.toned &&
        h.subject.length > 4 && b.subject.length > 4 &&
        /^(\d free today|Next in .+)$/.test(h.line) && h.pips === 3 && (h.lit === Number(h.line.match(/^(\d) free/)?.[1] ?? 0)) &&
        /^(Read it, explain it|Done this week)$/.test(b.line) && b.pips === 0 &&
        h.label.startsWith("Hostile Q&A.") && h.label.includes(h.subject) &&
        b.label.startsWith("Weekly boss.") && b.label.includes(b.subject),
      `"${h?.name}" "${h?.subject}" / "${h?.line}" ${h?.lit}/${h?.pips}; "${b?.name}" "${b?.subject}" / "${b?.line}"`
    );
    /* Proximity (#500 review): a row's name sits on its subject and its
       line under it, nearer each other than the row above is, whatever
       the subject's length. A one-line topic centred in two held lines
       stood the name as far from its topic as from Hostile's line. */
    const inner = (t) => Math.max(t.subjectTop - t.nameEnd, t.lineTop - t.subjectEnd);
    ok(
      `${theme} ${width}: each row's name, subject and line hold together, closer than the row above`,
      modes.rows.length === 2 && inner(h) <= 4 && inner(b) <= 4 && b.nameTop - h.lineEnd >= inner(h) + 8,
      `inner ${inner(h).toFixed(1)} / ${inner(b).toFixed(1)}, between rows ${(b.nameTop - h.lineEnd).toFixed(1)}`
    );
    if (width >= 390) {
      ok(
        `${theme} ${width}: both stand on the first screen, clear of the nav`,
        modes.nav !== null && h.bottom <= modes.nav.top && b.bottom <= modes.nav.top,
        `rows end ${Math.round(Math.max(h.bottom, b.bottom))}, nav at ${Math.round(modes.nav?.top ?? 0)}`
      );
    }
    await context.close();
  }
}

// The weekly boss's row: one tap away, and its back names Today and returns there.
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
    "390: the weekly boss's row opens /boss, whose back says Today and returns to Today",
    back.text === "Today" && back.href === "/" && home === "/",
    JSON.stringify({ back, home })
  );
  await context.close();
}

// 2b: the rows hold their height before the clock is read (#478 review, #500).
{
  const subjects = {
    hostile: [...readFileSync(new URL("../lib/hostile.ts", import.meta.url), "utf8").matchAll(/claim: "([^"]+)"/g)].map((m) => m[1]),
    boss: [...readFileSync(new URL("../lib/cold-topics.ts", import.meta.url), "utf8").matchAll(/title: "([^"]+)"/g)].map((m) => m[1]),
  };
  /* What the server's paint shows: the row, its name, its mark and its
     chevron, which must stand where they land. Its subject and line are
     no-break spaces there (no clock), so they find their place unseen. */
  const measure = () => ({
    rows: [...document.querySelectorAll("main a.home-mode")].map((a) => {
      const r = a.getBoundingClientRect();
      const name = a.querySelector(".home-mode-name").getBoundingClientRect();
      const art = a.querySelector(".home-mode-art").getBoundingClientRect();
      const chevron = a.querySelector(":scope > svg:last-child").getBoundingClientRect();
      return [Math.round(r.top), Math.round(r.height), Math.round(name.top), Math.round(art.top), Math.round(chevron.top)];
    }),
    unseen: [...document.querySelectorAll("main a.home-mode")].every(
      (a) => a.querySelector(".home-mode-subject").textContent.trim() === "" && a.querySelector(".home-mode-line").textContent.trim() === ""
    ),
  });
  for (const width of [320, 349, 390]) {
    const paint = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 1,
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
      serviceWorkers: "block",
      javaScriptEnabled: false,
    });
    const first = await paint.newPage();
    await first.goto(`${BASE}/`);
    await sleep(400);
    const before = await first.evaluate(measure);
    await paint.close();
    const { context, page } = await open("light", width);
    const after = await page.evaluate(measure);
    const fits = await page.evaluate((subjects) => {
      const out = [];
      for (const a of document.querySelectorAll("main a.home-mode")) {
        const el = a.querySelector(".home-mode-subject > span");
        const held = Math.round(a.getBoundingClientRect().height);
        const was = el.textContent;
        for (const t of subjects[a.dataset.mode] ?? []) {
          el.textContent = t;
          const h = Math.round(a.getBoundingClientRect().height);
          if (h !== held || el.scrollHeight > el.clientHeight + 1) out.push(`${a.dataset.mode}: "${t}" ${h}px`);
        }
        el.textContent = was;
      }
      return out;
    }, subjects);
    const same = (x, y) => x.length === y.length && x.every((r, i) => r.every((v, j) => Math.abs(v - y[i][j]) <= 1));
    ok(
      `${width}: the rows, their names, marks and chevrons stand at the server's paint as they land, its subject and line unseen until then, and every claim and topic fits two lines`,
      before.rows.length === 2 && before.unseen && same(before.rows, after.rows) && fits.length === 0,
      `paint ${JSON.stringify(before.rows)}, landed ${JSON.stringify(after.rows)}${fits.length ? `, broke on ${fits.slice(0, 3).join("; ")}` : ""}`
    );
    await context.close();
  }
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

/* 3b: the same labels three across (#483). TipStrip's recipe promises
   every face two lines in a tile at 390 (components/rep/TipStrip.tsx),
   and nothing held it: the two-second rewrite's first faces ran 25 of
   them to three. Read on the recording screen's own strip. */
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: "light",
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme: "light", session });
  const page = await context.newPage();
  await page.goto(`${BASE}/rep?topic=t41&item=range-1-3&trait=range`, { waitUntil: "networkidle" }).catch(() => {});
  const strip = await page.waitForSelector(".tip-tile", { timeout: 20000 }).then(() => true, () => false);
  await sleep(500);
  const tiles = strip
    ? await page.evaluate((labels) => {
        const span = document.querySelector(".tip-tile > span:last-child");
        const lh = parseFloat(getComputedStyle(span).lineHeight);
        return labels.map((label) => {
          /* TipStrip's `unbroken`: a hyphenated word never ends a line. */
          span.textContent = label.replace(/-/g, "⁠-⁠");
          return [label, Math.round(span.getBoundingClientRect().height / lh)];
        });
      }, labels)
    : null;
  const over = (tiles ?? []).filter(([, n]) => n > 2);
  ok(
    `390: all ${labels.length} tactic labels hold two lines in a tile three across`,
    tiles !== null && over.length === 0,
    over.length ? JSON.stringify(over) : `${labels.length} labels`
  );
  await context.close();
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

// 5: the foot against the tab bar, on six iPhones' first screens (#500).
/* Each phone's status bar inset where the page is given one (#500
   review): the header starts under it, so everything under it ends that
   much lower, and the foot has to know. 0 is the camera's own view. */
const NOTCH = { 375: 50, 390: 47, 393: 59, 402: 62, 430: 59, 440: 62 };
for (const [spoke, notched] of [[false, false], [true, false], [false, true]]) {
  extraReps.length = 0;
  if (spoke) extraReps.push({ ...TODAY_REP });
  const out = [];
  for (const [width, height] of [[375, 812], [390, 844], [393, 852], [402, 874], [430, 932], [440, 956]]) {
    const top = notched ? NOTCH[width] : 0;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
      serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", supabaseRoute);
    await context.addInitScript(seed, { theme: "light", session });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top, bottom: 34, left: 0, right: 0 } });
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main .home-foot", { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll(".skeleton").length === 0, null, { timeout: 15000 }).catch(() => {});
    await sleep(500);
    const at = await page.evaluate(() => {
      const foot = document.querySelector("main .home-foot").getBoundingClientRect();
      const bar = document.querySelector("nav .nav-glass").getBoundingClientRect();
      const rows = [...document.querySelectorAll("main a.home-mode")].map((a) => a.getBoundingClientRect().bottom);
      return { top: foot.top, bottom: foot.bottom, barTop: bar.top, rowsEnd: Math.max(...rows), screen: innerHeight };
    });
    const clear = at.bottom <= at.barTop;
    const below = at.top >= at.screen - 0.5;
    out.push({ phone: `${width}x${height}`, top, clear, below, rowsEnd: Math.round(at.rowsEnd), rowsClear: at.rowsEnd <= at.barTop, at });
  }
  const day = `${spoke ? "spoken" : "open"} day${notched ? ", status bar inset" : ""}`;
  ok(
    `${day}: on six iPhones the games end at 734 under the inset and the foot clears the tab bar or starts under the screen's foot, never under the glass`,
    out.every((o) => (o.clear || o.below) && Math.abs(o.rowsEnd - 734 - o.top) <= 1),
    out.map((o) => `${o.phone}+${o.top} ${o.clear ? "clear" : o.below ? "below" : "UNDER GLASS"} rows ${o.rowsEnd}`).join(", ")
  );
  /* With the status bar's inset the rows end 47 to 62 lower, and from
     390 to 402 the weekly boss's row then stands under the bar at rest:
     printed, and open in the #500 review. */
  if (notched) {
    console.log(`  (with the inset: ${out.map((o) => `${o.phone} rows ${o.rowsEnd} bar ${Math.round(o.at.barTop)}`).join(", ")})`);
    continue;
  }
  /* From 390 wide the whole job is on the first screen, clear of the
     bar. 375x812 (the minis) stands its bar at 714, so the weekly boss's
     last line runs under it like any list: printed, and open in #500. */
  ok(
    `${day}: from 390 wide both games end over the tab bar`,
    out.filter((o) => !o.phone.startsWith("375")).every((o) => o.rowsClear),
    out.map((o) => `${o.phone} rows ${o.rowsEnd} bar ${Math.round(o.at.barTop)}`).join(", ")
  );
}
extraReps.length = 0;

// 6: the foot's two figures say what they are, and a first-day account has none (#500).
{
  const { context, page } = await open("light", 390);
  const figs = await page.evaluate(() =>
    [...document.querySelectorAll("main .home-fig")].map((f) => ({
      value: f.querySelector(".home-fig-value")?.textContent.trim() ?? "",
      rate: f.querySelector(".home-fig-rate")?.textContent.trim() ?? "",
      label: f.querySelector(".home-fig-label")?.textContent.trim() ?? "",
      said: f.querySelector(".sr-only")?.textContent.trim() ?? "",
    }))
  );
  const [line, run] = figs;
  ok(
    "390: the foot is two figures, today's line and the longest stretch with no filler, each a number and plain words",
    figs.length === 2 &&
      /^[\d.]+( to \d+)?$/.test(line.value) && line.rate.length > 0 && /^Today's line[:,] /.test(line.label) && line.said.endsWith(".") &&
      /^\d+$/.test(run.value) && run.rate === "s" && /^Longest with no filler/.test(run.label) && /seconds\.$/.test(run.said),
    JSON.stringify(figs)
  );
  await context.close();
  repsMode.rows = [];
  const fresh = await open("light", 390, "main a.home-mode");
  const zero = await fresh.page.evaluate(() => ({
    foot: document.querySelectorAll("main .home-foot").length,
    zeros: [...document.querySelectorAll("main .home-fig-value")].filter((v) => /^0(\.0)?$/.test(v.textContent.trim())).length,
  }));
  ok("a first-day account has no foot and no zero standing for a number", zero.foot === 0 && zero.zeros === 0, JSON.stringify(zero));
  await fresh.context.close();
  repsMode.rows = null;
}

// 7: on a short screen both of the card's taps stand clear of the tab bar (#500).
{
  /* [width, height, bottom inset, top inset]: an SE installed gives the
     page its 20px status bar (#500 review). */
  for (const [width, height, inset, top] of [[320, 568, 0, 0], [375, 667, 0, 0], [320, 692, 34, 0], [320, 568, 0, 20], [375, 667, 0, 20]]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
      serviceWorkers: "block",
    });
    await context.route("http://supabase.local/**", supabaseRoute);
    await context.addInitScript(seed, { theme: "light", session });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top, bottom: inset, left: 0, right: 0 } });
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main .home-another", { timeout: 20000 });
    await sleep(600);
    const at = await page.evaluate(() => ({
      start: document.querySelector("main .home-start").getBoundingClientRect().bottom,
      another: document.querySelector("main .home-another").getBoundingClientRect().bottom,
      bar: document.querySelector("nav .nav-glass").getBoundingClientRect().top,
    }));
    ok(
      `${width}x${height}${top ? ` under a ${top}px status bar` : ""}: Start and Another topic both stand clear of the tab bar`,
      /* 4 clear at least: the card's sum aims at 8, and a tap flush on
         the glass's edge reads as under it. Under an installed SE's
         status bar too since the final pass of 19 Nov, which closed
         #500's review: on a short phone the topic is a step down and the
         object 100px tall, so the card fits there with every topic (7b). */
      at.start <= at.bar - 4 && at.another <= at.bar - 4,
      `Start ends ${Math.round(at.start)}, Another topic ${Math.round(at.another)}, bar ${Math.round(at.bar)}`
    );
    // 7b: every topic the card can show, not only today's.
    await page.waitForSelector(".home-hero:not([data-family='none']) #home-topic", { timeout: 15000 });
    const walk = await page.evaluate(
      ({ topics, longAt, longerAt, margin }) => {
        const h2 = document.querySelector("#home-topic");
        const span = h2.querySelector("span");
        const was = { text: span.textContent, long: h2.getAttribute("data-long"), longer: h2.getAttribute("data-longer") };
        const out = [];
        for (const t of topics) {
          span.textContent = t.prompt;
          if (t.prompt.length > longAt) h2.setAttribute("data-long", "true");
          else h2.removeAttribute("data-long");
          if (t.prompt.length > longerAt) h2.setAttribute("data-longer", "true");
          else h2.removeAttribute("data-longer");
          const bar = document.querySelector("nav .nav-glass").getBoundingClientRect().top;
          const start = document.querySelector("main .home-start").getBoundingClientRect().bottom;
          const another = document.querySelector("main .home-another").getBoundingClientRect().bottom;
          const lines = Math.round(span.getBoundingClientRect().height / parseFloat(getComputedStyle(h2).lineHeight));
          out.push({ id: t.id, another: Math.round(another), clear: start <= bar - margin && another <= bar - margin, lines, bar: Math.round(bar) });
        }
        span.textContent = was.text;
        for (const [k, v] of [["data-long", was.long], ["data-longer", was.longer]]) {
          if (v === null) h2.removeAttribute(k);
          else h2.setAttribute(k, v);
        }
        return out;
      },
      { topics: TOPICS, longAt: LONG_AT, longerAt: LONGER_AT, margin: 4 }
    );
    const under = walk.filter((w) => !w.clear);
    const lowest = walk.reduce((a, b) => (b.another > a.another ? b : a));
    ok(
      `${width}x${height}${top ? ` under a ${top}px status bar` : ""}: with each of the ${walk.length} topics in the card, Start and Another topic stand clear of the tab bar`,
      walk.length === TOPICS.length && under.length === 0,
      under.length
        ? `${under.length} under it: ${under.slice(0, 6).map((u) => `${u.id} (${u.lines} lines) ends ${u.another}`).join(", ")}; bar ${lowest.bar}`
        : `the lowest, ${lowest.id} in ${lowest.lines} lines, ends ${lowest.another}; bar ${lowest.bar}`
    );
    /* The roulette in the same card: its way back stands where Another
       topic stood, and the reel's window holds every topic. */
    await page.click("main .home-another");
    await page.waitForSelector("main .home-reel span.block", { timeout: 10000 });
    await sleep(1800);
    const reel = await page.evaluate((topics) => {
      const win = document.querySelector("main .home-reel");
      const cell = win.querySelector("span.block");
      const was = cell.textContent;
      const over = topics.filter((t) => {
        cell.textContent = t.prompt;
        return cell.getBoundingClientRect().height > win.getBoundingClientRect().height + 1;
      });
      cell.textContent = was;
      return {
        back: document.querySelector("main .home-another")?.getBoundingClientRect().bottom ?? Infinity,
        bar: document.querySelector("nav .nav-glass").getBoundingClientRect().top,
        over: over.map((t) => t.id),
      };
    }, TOPICS);
    ok(
      `${width}x${height}${top ? ` under a ${top}px status bar` : ""}: the roulette's way back stands clear of the tab bar, and every topic fits the reel`,
      reel.back <= reel.bar - 4 && reel.over.length === 0,
      `the way back ends ${Math.round(reel.back)}, bar ${Math.round(reel.bar)}${reel.over.length ? `; over the window: ${reel.over.slice(0, 6).join(", ")}` : ""}`
    );
    await context.close();
  }
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
