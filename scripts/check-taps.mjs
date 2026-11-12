/**
 * The tap, checked in a real browser (#437; Timothy, 12 Nov: "the orange
 * button is ugly", then "8 for home and 10 for feedback").
 *
 * A tap has no colour of its own: ink on the page, cut from the card on
 * a coloured card, an arrow where it moves you on. This holds that on
 * the screens themselves, in both themes:
 *
 *  1. On every screen it visits no element is filled with the terracotta
 *     the tap used to be, every ink tap's word holds 4.5:1 on its fill
 *     and its fill 3:1 on what is behind it, and a tab keeps one tap.
 *  2. The paywall's taps are cut from the plum, never ink on it.
 *  3. Record is ink and round, the take in progress is still red, and
 *     the results' way on is 48px with its words at the left and a 36px
 *     arrow disc 6px from its right end, at 390 and at 320. The tap under
 *     Lessons' Up next wears the same arrow (#438).
 *
 * Today's Start on each family's card is `scripts/check-colour.mjs`.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-taps.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const F = await import("./look-fixtures.mjs");

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const near = (a, b, by = 1) => Math.abs(a - b) <= by;

/** Runs in the page: every tap on screen, measured. */
const measure = () => {
  const parse = (css) => {
    const n = (css.match(/-?\d*\.?\d+(e-?\d+)?/g) ?? []).map(Number);
    if (css.startsWith("color(")) return { c: n.slice(0, 3).map((v) => Math.round(v * 255)), a: n[3] ?? 1 };
    return { c: n.slice(0, 3), a: n[3] ?? 1 };
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  /** The first filled thing behind `el`: what its fill has to stand out on. */
  const behind = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg.a > 0.5) return bg.c;
    }
    return parse(getComputedStyle(document.body).backgroundColor).c;
  };
  const taps = [...document.querySelectorAll(".tap, .tap-tonal, .home-start")].filter(shown).map((el) => {
    const s = getComputedStyle(el);
    const fill = parse(s.backgroundColor).c;
    const word = parse(s.color).c;
    const r = el.getBoundingClientRect();
    return {
      kind: el.classList.contains("tap") ? "ink" : "tonal",
      text: el.innerText.trim().slice(0, 40),
      fill,
      word,
      wordOnFill: ratio(word, fill),
      fillOnBehind: ratio(fill, behind(el)),
      h: Math.round(r.height),
      radius: parseFloat(s.borderTopLeftRadius),
      inPlum: !!el.closest(".card-premium"),
    };
  });
  // Anything still wearing the fill the tap used to be.
  const orange = [...document.querySelectorAll("body *")].filter((el) => {
    if (!shown(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) return false;
    const bg = parse(getComputedStyle(el).backgroundColor);
    return bg.a > 0.5 && Math.abs(bg.c[0] - 198) <= 2 && Math.abs(bg.c[1] - 113) <= 2 && Math.abs(bg.c[2] - 57) <= 2;
  }).length;
  return { taps, orange };
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function open(theme, signedIn = true) {
  F.resetPlan("free");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    permissions: ["microphone", "camera", "notifications"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block", reducedMotion: "reduce",
  });
  await context.route("http://supabase.local/**", F.supabaseRoute);
  await context.route("**/api/analyze", async (route) => {
    await sleep(600);
    await route.fulfill(F.json(F.analyzeBody));
  });
  await context.route("**/api/push", (r) => r.fulfill(F.json({ ok: true })));
  await context.route("**/api/words", (r) => r.fulfill(F.json({ alternatives: ["point", "idea", "claim"], source: "model" })));
  await context.route("**/api/billing/*", F.billingApiRoute);
  await context.route("**/api/tester/collect", F.collectRoute);
  if (signedIn) await context.addInitScript(F.seed, { theme, session: F.session, pose: F.POSE_PREF });
  else await context.addInitScript((t) => localStorage.setItem("ethos.prefs", JSON.stringify({ theme: t })), theme);
  await context.addInitScript(() => {
    const d = new Date();
    localStorage.setItem("ethos.reminder.asked", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 200)));
  const go = async (path, ready = "main") => {
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector(ready, { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector("main .skeleton"), null, { timeout: 30000 }).catch(() => {});
    await sleep(900);
  };
  return { context, page, go };
}

/** What every screen holds: no orange fill, and each ink tap legible where it stands. */
function hold(theme, name, m, { taps }) {
  ok(`${theme} ${name}: nothing wears the old terracotta fill`, m.orange === 0, `${m.orange} found`);
  const ink = m.taps.filter((t) => t.kind === "ink");
  const worstWord = Math.min(...m.taps.map((t) => t.wordOnFill), 99);
  const worstFill = Math.min(...ink.map((t) => t.fillOnBehind), 99);
  ok(`${theme} ${name}: each tap's word holds 4.5:1 on its fill`, worstWord >= 4.5, m.taps.length ? worstWord.toFixed(1) : "no tap");
  ok(`${theme} ${name}: each ink tap holds 3:1 on what is behind it`, worstFill >= 3, ink.length ? worstFill.toFixed(1) : "no ink tap");
  if (taps !== undefined) {
    ok(`${theme} ${name}: ${taps.ink} ink and ${taps.tonal} tonal`, ink.length === taps.ink && m.taps.length - ink.length === taps.tonal, m.taps.map((t) => `${t.kind} "${t.text}"`).join(", "));
  }
}

for (const theme of ["light", "dark"]) {
  /* ---- 1. The screens a person with an account sees ------------------------ */
  const { context, page, go } = await open(theme);
  const SCREENS = [
    ["Today", "/", "main .home-start", { ink: 0, tonal: 1 }],
    ["Lessons", "/lessons", "main .tap", { ink: 1, tonal: 0 }],
    ["one lesson", "/lessons/the-cold-open", "main h1", { ink: 1, tonal: 0 }],
    ["Practice", "/games", "main .tap", { ink: 1, tonal: 0 }],
    ["You", "/you", "main .tap", { ink: 1, tonal: 0 }],
    ["Upload", "/upload", "main h1", undefined],
    ["Boss", "/boss", "main h1", undefined],
    ["Hostile", "/hostile", "main h1", undefined],
  ];
  for (const [name, path, ready, taps] of SCREENS) {
    await go(path, ready);
    hold(theme, name, await page.evaluate(measure), { taps });
  }

  /* ---- 2. The paywall: cut from the plum ----------------------------------- */
  await go("/games", "main .premium-wall");
  await page.click(".premium-wall", { force: true });
  await page.waitForSelector('[role="dialog"] .card-premium .tap-tonal', { timeout: 10000 });
  await sleep(1200);
  const wall = (await page.evaluate(measure)).taps.filter((t) => t.inPlum);
  ok(`${theme} paywall: its tap is cut from the plum, never ink on it`, wall.length >= 1 && wall.every((t) => t.kind === "tonal"), wall.map((t) => `${t.kind} "${t.text}"`).join(", "));
  ok(`${theme} paywall: a pale pill, its word 4.5:1 on it, the pill 3:1 on the plum`, wall.every((t) => Math.min(...t.fill) > 200 && t.wordOnFill >= 4.5 && t.fillOnBehind >= 3), wall.map((t) => `${t.wordOnFill.toFixed(1)} and ${t.fillOnBehind.toFixed(1)}`).join(", "));
  await page.keyboard.press("Escape");
  await sleep(500);

  /* ---- 3. Record, the take, and the way on --------------------------------- */
  await go("/", "main .home-start");
  await page.locator("main .home-start").first().click();
  await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 60000 });
  await sleep(1200);
  const tokens = await page.evaluate(() => {
    const probe = document.createElement("i");
    document.body.append(probe);
    const read = (v) => {
      probe.style.color = `var(${v})`;
      return getComputedStyle(probe).color;
    };
    const out = { ink: read("--color-ink"), ground: read("--color-ground"), stop: read("--color-terracotta-600") };
    probe.remove();
    return out;
  });
  const record = await page.evaluate(() => {
    const el = document.querySelector('button[aria-label="Start recording"]');
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { fill: s.backgroundColor, word: s.color, w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(s.borderTopLeftRadius), tap: el.classList.contains("tap") };
  });
  ok(`${theme} Record: ink, the ground's colour for its word`, record.tap && record.fill === tokens.ink && record.word === tokens.ground, `${record.fill} with ${record.word}`);
  ok(`${theme} Record: still the only circle, 96px`, record.w === 96 && record.h === 96 && record.radius >= 48, `${record.w} by ${record.h}`);
  await page.click('button[aria-label="Start recording"]', { force: true });
  await page.waitForSelector('button[aria-label="Stop and score this recording"]', { timeout: 20000 });
  await sleep(900);
  const stop = await page.evaluate(() => getComputedStyle(document.querySelector('button[aria-label="Stop and score this recording"]')).backgroundColor);
  ok(`${theme} Stop: the take in progress keeps its red`, stop === tokens.stop, stop);
  await sleep(3200);
  await page.click('button[aria-label="Stop and score this recording"]', { force: true });
  await page.waitForSelector("main [data-step-action]", { state: "visible", timeout: 45000 });
  await sleep(2600);
  const wayOn = (selector = "main [data-step-action]") =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const disc = el.querySelector(".tap-arrow-disc");
      const label = el.querySelector("span:not(.tap-arrow-disc)");
      const [b, d, l] = [el, disc, label].map((n) => n.getBoundingClientRect());
      const s = getComputedStyle(el);
      // The first glyph's left edge, which is where the words start.
      const range = document.createRange();
      range.selectNodeContents(label);
      const words = range.getBoundingClientRect();
      return {
        h: b.height,
        discW: d.width,
        discH: d.height,
        discFromRight: b.right - d.right,
        discFromTop: d.top - b.top,
        wordsFromLeft: words.left - b.left,
        wordsEndBeforeDisc: d.left - words.right,
        lines: Math.round(l.height / parseFloat(s.lineHeight)),
        fill: s.backgroundColor,
        word: s.color,
        discFill: getComputedStyle(disc).backgroundColor,
        arrow: getComputedStyle(disc.querySelector("svg")).color,
        tap: el.classList.contains("tap"),
        hidden: disc.getAttribute("aria-hidden"),
        name: el.getAttribute("aria-label") ?? el.innerText.trim(),
      };
    }, selector);
  const on = await wayOn();
  hold(theme, "results", await page.evaluate(measure), { taps: { ink: 1, tonal: 0 } });
  ok(`${theme} way on: an ink tap, 48px`, on.tap && near(on.h, 48, 0.5) && on.fill === tokens.ink, `${on.h}px`);
  ok(`${theme} way on: a 36px disc, 6px from its right end and its top`, near(on.discW, 36, 0.5) && near(on.discH, 36, 0.5) && near(on.discFromRight, 6) && near(on.discFromTop, 6), `${on.discW} by ${on.discH}, ${on.discFromRight.toFixed(1)} from the right`);
  ok(`${theme} way on: its words start 22px from the left and stop short of the disc`, near(on.wordsFromLeft, 22, 1.5) && on.wordsEndBeforeDisc >= 12, `${on.wordsFromLeft.toFixed(1)} in, ${on.wordsEndBeforeDisc.toFixed(1)} clear`);
  ok(`${theme} way on: the disc is the word's colour and the arrow the fill's`, on.discFill === on.word && on.arrow === on.fill && on.hidden !== null, `${on.discFill} with ${on.arrow}`);
  await page.setViewportSize({ width: 320, height: 700 });
  await sleep(500);
  const narrow = await wayOn();
  ok(`${theme} way on at 320: two lines at most, the disc still 6px from the end`, narrow.lines <= 2 && near(narrow.discFromRight, 6) && narrow.wordsEndBeforeDisc >= 12 && narrow.h <= 60, `${narrow.lines} line(s), ${narrow.h}px`);

  /* ---- 3b. Lessons' Up next wears the same arrow (#438) -------------------- */
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await go("/lessons", "main a[data-up-next]");
    const up = await wayOn("main a[data-up-next]");
    ok(
      `${theme} Lessons at ${width}: its tap is the results' way on, 48px, words 22px in, a 36px disc 6px from the end`,
      up.tap && near(up.h, 48, 0.5) && near(up.wordsFromLeft, 22, 1.5) && near(up.discW, 36, 0.5) && near(up.discFromRight, 6) && near(up.discFromTop, 6) && up.lines === 1,
      `${up.h}px, ${up.wordsFromLeft.toFixed(1)} in, ${up.discFromRight.toFixed(1)} from the end`
    );
    ok(`${theme} Lessons at ${width}: the disc is the word's colour, the arrow the fill's, and the link keeps its whole name`, up.discFill === up.word && up.arrow === up.fill && up.hidden !== null && /^(Carry on|Start) .+, practice \d of \d$/.test(up.name), up.name);
  }
  await context.close();

  /* ---- 4. The doors a stranger sees ----------------------------------------- */
  const out = await open(theme, false);
  for (const [name, path] of [["Sign in", "/signin"], ["Sign up", "/signup"], ["Forgot", "/auth/forgot"], ["About", "/about"]]) {
    await out.go(path, "main");
    hold(theme, name, await out.page.evaluate(measure), {});
  }
  await out.context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
