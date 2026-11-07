/**
 * The look loop's camera for the Pause row's moments (#424): the live
 * results walk's numbers step with two, three and four pauses judged
 * filled, a stored recording with its audio (and without it, and with a
 * file that will not decode), and the probes behind the review of
 * #424: the chips' 44px targets never overlap, the row says "had a
 * sound in" once, the chip's glyph wears Hear it back's colour, and one
 * sound plays at a time when the numbers step also holds a video.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   LOOK_WAV=/path/to/62s.wav node scripts/look-pause-moments.mjs after            # every scene
 *   LOOK_WIDTH=320 LOOK_HEIGHT=568 node scripts/look-pause-moments.mjs after three  # a subset
 *
 * Scenes: two, three, four (the live numbers step, the Pause row open),
 * focus (two, the first chip focused by key), long (an 88s take with 34
 * gaps: the map draws the pause the row names), video (the one-sound probe,
 * no shot), stored, stored-playing, stored-silent, stored-broken.
 * Hear it back's track on the words step, marked by verdict as the map
 * is: words-two (two filled, one before a sentence), words-clean,
 * words-stored, words-upload (needs LOOK_WAV) and words-round (a Q&A
 * round, its cut-in on the track); its shots are tagged hear-, as in
 *   LOOK_WAV=/path/to/62s.wav node scripts/look-pause-moments.mjs hear-after words-two words-clean words-stored words-round
 * Each words- scene also saves its card's head and track as a 2x crop
 * (-track) and reads the bands' contrast off that crop's pixels: a
 * landed band holds 3:1 on the track's sand, a searching band 1.4:1 to
 * 2.2:1 and under the landed one, each key's swatch is its band's
 * colour, and no band is under 4px (DECISIONS #425). With LOOK_WAV,
 * words-stored also stops the playhead inside the landing and crops it
 * (-playhead), so the playhead is read over a sage band.
 * LOOK_THEMES=light,dark picks the themes. Every probe prints a line
 * that starts PROBE; a broken promise prints FAIL.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { supabaseRoute as supabase, analyzeBody, json, session, seed, POSE_PREF, reps, resetPlan } from "./look-fixtures.mjs";

const [, , TAG = "after", ...ONLY] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/pause-moments/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const WIDTH = Number(process.env.LOOK_WIDTH ?? 390) || 390;
const HEIGHT = Number(process.env.LOOK_HEIGHT ?? 844) || 844;
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",");
const WAV = process.env.LOOK_WAV ? readFileSync(process.env.LOOK_WAV) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* WCAG contrast between two [r, g, b] pixels. */
const lum = (c) => {
  const [r, g, b] = c.map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL  ${msg}`);
};

/* The take's pauses: an opening, a mid-sentence hesitation, a landing,
   and two, three or four the take judged filled. */
const P = {
  opening: { t: 2.1, len: 1.2, kind: "pre", verdict: "opening" },
  a: { t: 15.3, len: 1.1, kind: "pre", verdict: "filled" },
  hes: { t: 20, len: 0.9, kind: "mid", verdict: "hesitation" },
  b: { t: 27.4, len: 1.0, kind: "pre", verdict: "filled" },
  c: { t: 40.2, len: 1.3, kind: "pre", verdict: "filled" },
  land: { t: 47, len: 1.5, kind: "pre", verdict: "landing" },
  d: { t: 52.6, len: 1.1, kind: "pre", verdict: "filled" },
};
const SETS = {
  two: [P.opening, P.a, P.hes, P.c, P.land],
  three: [P.opening, P.a, P.hes, P.b, P.c, P.land],
  four: [P.opening, P.a, P.hes, P.b, P.c, P.land, P.d],
};
/** What lib/pause-quality.ts headline() says for filled pauses and no dead air. */
const filledHeadline = (n) => `${n} of your "pauses" had a sound in them. Silence INSTEAD of the "um", not either side of it.`;
const bodyFor = (pauses, over = {}) => {
  const filled = pauses.filter((p) => p.verdict === "filled").length;
  const held = pauses.filter((p) => p.kind !== "beat");
  return {
    ...analyzeBody,
    metrics: {
      ...analyzeBody.metrics,
      pauses,
      heldPauses: held.length,
      composedPauses: held.filter((p) => p.kind === "pre").length,
      midSentencePauses: held.filter((p) => p.kind === "mid").length,
      ...over,
    },
    pauseHeadline: filledHeadline(filled),
  };
};
/** The video probe's take: a few seconds the fake mic can fill, its two filled pauses inside them. */
const SHORT = [
  { t: 1.2, len: 1.0, kind: "pre", verdict: "filled" },
  { t: 3.4, len: 0.9, kind: "pre", verdict: "filled" },
];
/* A long take (the review's map finding): 175 words at 2.5 a second, a
   0.45s beat every 5 words, a 1.2s held pause every 30, and a filler
   beside the last held pause, so 34 gaps and the filled one at 1:16,
   judged as lib/pause-map.test.ts judges the same take. */
const LONG = (() => {
  const out = [];
  let t = 0.4;
  let held = 0;
  for (let i = 0; i < 175; i++) {
    const end = Math.round((t + 0.35) * 100) / 100;
    t += 0.4;
    if (i === 174) break;
    if ((i + 1) % 30 === 0) {
      held++;
      out.push({ t: end, len: 1.25, kind: "pre", verdict: held === 5 ? "filled" : "landing" });
      t += 1.2;
    } else if ((i + 1) % 5 === 0) {
      out.push({ t: end, len: 0.5, kind: "beat", verdict: "beat" });
      t += 0.45;
    }
  }
  return { pauses: out, durationS: Math.round(t + 0.5) };
})();
const live = { body: bodyFor(SETS.two) };

/* Hear it back's track on the words step (DECISIONS #424, its last
   line): two pauses the take judged filled, one before a sentence (the
   kind the track used to draw sage; the mic heard it, so no filler tick
   stands on it) and one mid-sentence; a clean take,
   whose track draws as it always did; the same two on a stored
   recording; and a Q&A round, whose cut-in still stands on the track. */
const HEAR = {
  two: [P.opening, P.hes, P.b, { t: 36.8, len: 1.0, kind: "mid", verdict: "filled" }, P.land],
  clean: [P.opening, P.hes, { t: 30.2, len: 1.3, kind: "pre", verdict: "landing" }, P.land],
};
const cleanBody = () => ({ ...bodyFor(HEAR.clean), pauseHeadline: "Three silences landed a point; one was searching." });
const roundBody = () => ({
  ...bodyFor(HEAR.two),
  mode: "game",
  round: {
    game: "qa", v: 1, level: 1, cap: 90, durationS: 62, stoppedBy: "you", lastWord: 61.4, stars: 2, scorable: true, counted: true, best: 22,
    cutIns: [{ at: 24.2, line: "Says who?", gap: 1.1, gapFrom: 24.4, gapTo: 25.5, verdict: "held", fillerAt: null, fillerWord: null, cleanAfter: 22, spokeAfter: 30 }],
  },
});

/* A stored recording with its audio: rep-22 keeps its row, with these
   pauses and an audio path the audio route answers. */
const stored = reps.find((r) => r.id === "rep-22");
const audio = { mode: "ok" };
async function audioRoute(route) {
  if (audio.mode === "broken") return route.fulfill(json({ url: `${BASE}/__look/broken.wav` }));
  return route.fulfill(json({ url: `${BASE}/__look/take.wav` }));
}

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabase);
  await context.route("**/api/analyze", async (route) => { await sleep(600); await route.fulfill(json(live.body)); });
  await context.route("**/api/words", (route) => route.fulfill(json({ alternatives: [], source: "model" })));
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/audio**", audioRoute);
  /* Served with byte ranges, as storage serves a take, so the player can
     seek into it (the playhead probe stops it inside the landing). */
  await context.route("**/__look/take.wav", (route) => {
    if (!WAV) return route.fulfill({ status: 404, body: "" });
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()["range"] ?? "");
    if (!range) return route.fulfill({ status: 200, contentType: "audio/wav", headers: { "accept-ranges": "bytes" }, body: WAV });
    const from = Number(range[1]);
    const to = range[2] ? Math.min(Number(range[2]), WAV.length - 1) : WAV.length - 1;
    return route.fulfill({
      status: 206, contentType: "audio/wav",
      headers: { "accept-ranges": "bytes", "content-range": `bytes ${from}-${to}/${WAV.length}`, "content-length": String(to - from + 1) },
      body: WAV.subarray(from, to + 1),
    });
  });
  await context.route("**/__look/broken.wav", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: "not a wav" }));
  await context.addInitScript(seed, { theme, session, pose: POSE_PREF });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));

  const name = (scene, extra = "") => `${TAG}-${scene}-${WIDTH}x${HEIGHT}-${theme}${extra}.png`;
  const shot = async (scene, opts = {}) => {
    await sleep(opts.settle ?? 600);
    const file = name(scene, opts.extra);
    await page.screenshot({ path: `${OUT}${file}`, clip: opts.clip });
    console.log(`shot  ${file}`);
  };
  const step = async (fn) => { try { await fn(); } catch (e) { fail(`${theme} ${String(e.message ?? e).split("\n")[0]}`); } };

  /** The Pause row opened, the map's foot over it, as a thumb meets it. */
  const openPauseRow = async () => {
    const summary = page.locator("details summary:has-text('Pausing')").first();
    await summary.scrollIntoViewIfNeeded();
    if (!(await page.locator("details:has(summary:has-text('Pausing'))[open]").count())) await summary.click();
    await page.waitForSelector("details[open] [data-pause-moment]", { timeout: 5000 });
    await page.evaluate(() => {
      const map = [...document.querySelectorAll("main .eyebrow")].find((e) => e.textContent === "Pauses");
      const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
      const top = (map ?? row)?.getBoundingClientRect().top ?? 0;
      window.scrollBy(0, top - 72);
      const r = row?.getBoundingClientRect();
      // Keep the row's moments in view on a short phone.
      if (r && r.bottom > window.innerHeight - 120) window.scrollBy(0, r.bottom - window.innerHeight + 120);
    });
    await sleep(400);
  };

  /** The probes behind the review: targets, words and colour. */
  const probe = async (scene) => {
    const p = await page.evaluate(() => {
      const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
      const buttons = [...(row?.querySelectorAll("button[data-pause-moment]") ?? [])];
      const rects = buttons.map((b) => b.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      const pills = buttons.map((b) => b.querySelector(".moment-pill").getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      const overlaps = [];
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push([i, j]);
        }
      /* Down the middle of each pill: whose target is under the finger? */
      const stolen = [];
      buttons.forEach((b, i) => {
        const r = b.querySelector(".moment-pill").getBoundingClientRect();
        for (let y = Math.ceil(r.top); y < r.bottom; y++) {
          const hit = document.elementFromPoint(r.left + r.width / 2, y)?.closest("button[data-pause-moment]");
          if (hit && hit !== b) stolen.push({ pill: i, y: y - r.top, hit: buttons.indexOf(hit) });
        }
      });
      const detail = row?.querySelector(".reveal")?.textContent ?? "";
      const said = (detail.match(/had a sound in/g) ?? []).length;
      const glyph = buttons[0] ? getComputedStyle(buttons[0].querySelector("svg")).color : null;
      const scrubKey = document.querySelector('button[aria-label="Play"], button[aria-label="Pause"]');
      const fillerGlyph = [...document.querySelectorAll('button[aria-label^="Play "]')].find((b) => !b.hasAttribute("data-pause-moment"))?.querySelector("svg");
      const lineWidth = row?.querySelector(".reveal")?.getBoundingClientRect().width ?? 0;
      return {
        n: buttons.length, rects, pills, overlaps, stolen, detail, said, lineWidth,
        glyph, keyGlyph: scrubKey ? getComputedStyle(scrubKey).color : null, fillerGlyph: fillerGlyph ? getComputedStyle(fillerGlyph).color : null,
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log(`PROBE ${scene} ${WIDTH}x${HEIGHT} ${theme}: ${p.n} chips, pills ${JSON.stringify(p.pills.map((r) => [Math.round(r.x), +r.y.toFixed(1)]))}, line ${Math.round(p.lineWidth)}px`);
    console.log(`PROBE   detail: ${JSON.stringify(p.detail)}`);
    console.log(`PROBE   glyph ${p.glyph}, Hear it back's key ${p.keyGlyph}, a filler chip ${p.fillerGlyph}`);
    if (p.overlaps.length) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: targets overlap ${JSON.stringify(p.overlaps)}; a tap on one plays another: ${JSON.stringify(p.stolen.slice(0, 3))}`);
    if (p.stolen.length) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: ${p.stolen.length} rows of a pill hit another chip`);
    if (p.said !== 1) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: the row says "had a sound in" ${p.said} times`);
    if (p.hScroll) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: the page scrolls sideways`);
    if (p.keyGlyph && p.glyph !== p.keyGlyph) fail(`${scene} ${theme}: the chip's glyph ${p.glyph} is not Hear it back's ${p.keyGlyph}`);
    return p;
  };

  /** A live take, walked to the numbers step. */
  const walk = async (body, holdMs = 2600) => {
    live.body = body;
    await page.goto(`${BASE}/rep?lesson=h4`);
    await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
    await sleep(800);
    await page.click('button[aria-label="Start recording"]', { force: true });
    await page.waitForSelector('button[aria-label="Stop and score this recording"]');
    await sleep(holdMs);
    await page.click('button[aria-label="Stop and score this recording"]', { force: true });
    await page.waitForSelector("main .arrive-x", { timeout: 30000 });
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
    await sleep(1200);
    await page.getByRole("button", { name: /The numbers/ }).first().click();
    await page.waitForSelector("details summary:has-text('Pausing')", { timeout: 8000 });
    await sleep(600);
  };

  /**
   * Hear it back's track, read off the page: each pause band's second
   * and colour, the cut-in rules, the legend's words. A band the take
   * judged filled drawn sage, or one that landed drawn without it, is a
   * FAIL; so is a round whose cut-in left the track.
   */
  const probeTrack = async (scene, pauses, durationS, cutIns = 0) => {
    const t = await page.evaluate(() => {
      const card = [...document.querySelectorAll("main .eyebrow")].find((e) => e.textContent === "Hear it back")?.closest(".card");
      const bar = card?.querySelector(".relative.h-8");
      const spans = [...(bar?.children ?? [])].map((s) => ({ cls: String(s.className), left: parseFloat(s.style.left), width: parseFloat(s.style.width) }));
      const legend = [...(card?.querySelector(".eyebrow")?.nextElementSibling?.children ?? [])].map((k) => k.textContent.trim());
      const chips = [...(card?.querySelectorAll("button[aria-label]") ?? [])].map((b) => b.getAttribute("aria-label"));
      const head = card?.querySelector(".eyebrow")?.parentElement?.getBoundingClientRect();
      const keys = [...(card?.querySelector(".eyebrow")?.nextElementSibling?.children ?? [])].map((k) => k.getBoundingClientRect());
      const keysW = keys.length ? Math.max(...keys.map((r) => r.right)) - Math.min(...keys.map((r) => r.left)) : 0;
      return { found: !!card, spans, legend, chips, headH: head?.height ?? 0, headW: head?.width ?? 0, keysW, hScroll: document.documentElement.scrollWidth > window.innerWidth };
    });
    if (!t.found) return fail(`${scene} ${theme}: no Hear it back card`);
    const bands = t.spans.filter((s) => Number.isFinite(s.width));
    const drawn = bands.map((b) => ({ at: +((b.left * durationS) / 100).toFixed(1), sage: /sage/.test(b.cls), cls: b.cls.replace(/absolute top-0 h-full ?/, "") }));
    const rules = t.spans.filter((s) => /bg-ink\/70/.test(s.cls)).length;
    console.log(`PROBE ${scene} ${WIDTH}x${HEIGHT} ${theme}: legend ${JSON.stringify(t.legend)} ${Math.round(t.keysW)} of ${Math.round(t.headW)}px, header ${Math.round(t.headH)}px tall, ${rules} cut-in rule(s)`);
    console.log(`PROBE   bands ${JSON.stringify(drawn.map((d) => [d.at, d.cls]))}`);
    for (const p of pauses.filter((x) => x.kind !== "beat")) {
      const band = drawn.find((d) => Math.abs(d.at - p.t) < 0.2);
      if (!band) { fail(`${scene} ${theme}: no band at ${p.t}s`); continue; }
      const landed = p.verdict ? p.verdict === "landing" || p.verdict === "opening" : p.kind === "pre";
      if (band.sage !== landed) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: ${p.t}s (${p.kind}, ${p.verdict ?? "no verdict"}) is ${band.sage ? "sage" : "not sage"} on the track`);
    }
    if (rules !== cutIns) fail(`${scene} ${theme}: ${rules} cut-in rules on the track, ${cutIns} expected`);
    if (cutIns && !t.chips.some((c) => /^Says who\?/.test(c ?? ""))) fail(`${scene} ${theme}: no cut-in chip`);
    if (t.hScroll) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: the page scrolls sideways`);
  };

  /**
   * Hear it back's head and track as a 2x crop, its marks read off the
   * crop's own pixels (DECISIONS #425): each band's colour where nothing
   * else stands on it, the sand beside it, and each key's swatch. A
   * landed band under 3:1 on the sand, a searching band outside 1.4 to
   * 2.2:1 or not under the landed one, a swatch that is not its band's
   * colour, or a band narrower than 4px prints FAIL. `extra` names the
   * crop (-track, -playhead); the playhead's own contrast against the
   * pixels either side of it is printed too.
   */
  const measureTrack = async (scene, extra = "-track") => {
    /* Settle as a shot does, and wait out anything still fading over the
       card, so the pixels are the track's own. */
    await sleep(600);
    await page
      .waitForFunction(() => {
        const card = [...document.querySelectorAll("main .eyebrow")].find((e) => e.textContent === "Hear it back")?.closest(".card");
        const bar = card?.querySelector(".relative.h-8");
        if (!bar) return false;
        for (let el = card; el; el = el.parentElement) if (getComputedStyle(el).opacity !== "1") return false;
        const r = bar.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".relative.flex-1") === bar.parentElement;
      }, null, { timeout: 5000 })
      .catch(() => console.log(`PROBE ${scene}${extra} ${theme}: something still stands over the track`));
    const m = await page.evaluate(() => {
      const card = [...document.querySelectorAll("main .eyebrow")].find((e) => e.textContent === "Hear it back")?.closest(".card");
      const bar = card?.querySelector(".relative.h-8");
      if (!card || !bar) return null;
      const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
      const c = card.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      const marks = [...bar.children].map((s, i, all) => ({
        kind: s.dataset.pauseMark ?? (/var\(--tone\)/.test(s.className) ? "filler" : /bg-ink\/70/.test(s.className) ? "cut-in" : i === all.length - 1 ? "playhead" : "other"),
        ...box(s.getBoundingClientRect()),
      }));
      const keys = [...(card.querySelector(".eyebrow")?.nextElementSibling?.children ?? [])].map((k) => ({
        word: k.textContent.trim(),
        ...box(k.firstElementChild.getBoundingClientRect()),
      }));
      return { clip: { x: c.left, y: c.top, width: c.width, height: b.bottom - c.top + 14 }, bar: box(b), marks, keys };
    });
    if (!m) return fail(`${scene} ${theme}: no track to measure`);
    const clip = { x: Math.round(m.clip.x), y: Math.round(m.clip.y), width: Math.round(m.clip.width), height: Math.round(m.clip.height) };
    const file = name(scene, extra);
    const buf = await page.screenshot({ path: `${OUT}${file}`, clip });
    console.log(`shot  ${file}`);
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const scale = info.width / clip.width;
    const px = (x, y) => {
      const i = (Math.round((y - clip.y) * scale) * info.width + Math.round((x - clip.x) * scale)) * 3;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const mid = m.bar.y + m.bar.h / 2;
    const others = (self) => m.marks.filter((o) => o !== self);
    const clear = (x, pad, self) => others(self).every((o) => x + pad < o.x || x - pad > o.x + o.w);
    let sandX = null;
    for (let x = m.bar.x + 2; x < m.bar.x + m.bar.w - 2 && sandX === null; x += 0.5) if (clear(x, 5, null)) sandX = x;
    const sand = px(sandX, mid);
    const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    const read = { landed: [], searching: [], filler: [], narrow: [] };
    for (const mark of m.marks.filter((x) => x.kind === "landed" || x.kind === "searching" || x.kind === "filler")) {
      if (mark.kind !== "filler" && mark.w < 3.95) read.narrow.push(`${mark.kind} ${mark.w.toFixed(1)}px`);
      // The band's own pixel: its middle third, clear of every other mark.
      let at = null;
      for (let x = mark.x + mark.w * 0.34; x <= mark.x + mark.w * 0.66 && at === null; x += 0.25) if (clear(x, 0.6, mark)) at = x;
      if (at === null) continue;
      const colour = px(at, mid);
      read[mark.kind].push({ hex: hex(colour), ratio: contrast(colour, sand), w: mark.w });
    }
    const worst = (list) => (list.length ? Math.min(...list.map((r) => r.ratio)) : null);
    const best = (list) => (list.length ? Math.max(...list.map((r) => r.ratio)) : null);
    const fmt = (list) => list.map((r) => `${r.hex} ${r.ratio.toFixed(2)}:1 ${r.w.toFixed(1)}px`).join(", ");
    console.log(`PROBE ${scene}${extra} ${WIDTH}x${HEIGHT} ${theme}: sand ${hex(sand)}; landed [${fmt(read.landed)}]; searching [${fmt(read.searching)}]; filler [${fmt(read.filler)}]`);
    const landed = worst(read.landed);
    const quietTop = best(read.searching);
    const quietLow = worst(read.searching);
    if (landed !== null && landed < 3) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: a landed band is ${landed.toFixed(2)}:1 on the sand, under 3:1`);
    if (quietLow !== null && (quietLow < 1.4 || quietTop > 2.2)) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: a searching band is ${quietLow.toFixed(2)} to ${quietTop.toFixed(2)}:1, outside 1.4 to 2.2`);
    if (landed !== null && quietTop !== null && landed < quietTop * 1.5) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: landed ${landed.toFixed(2)}:1 is not clearly over searching ${quietTop.toFixed(2)}:1`);
    if (read.narrow.length) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: bands under 4px: ${read.narrow.join(", ")}`);
    // Each key's swatch is its band: the swatch's middle against the band's pixel.
    for (const key of m.keys) {
      const kind = key.word === "landed a point" ? "landed" : key.word === "searching" ? "searching" : null;
      if (!kind || !read[kind].length) continue;
      const swatch = hex(px(key.x + key.w / 2, key.y + key.h / 2));
      const band = read[kind][0].hex;
      const off = Math.max(...[1, 3, 5].map((i) => Math.abs(parseInt(swatch.slice(i, i + 2), 16) - parseInt(band.slice(i, i + 2), 16))));
      console.log(`PROBE   key "${key.word}" ${swatch}, its band ${band}`);
      if (off > 3) fail(`${scene} ${theme}: the "${key.word}" key ${swatch} is not its band's ${band}`);
    }
    // The playhead against what is either side of it.
    const head = m.marks.find((x) => x.kind === "playhead");
    // At 0:00 the playhead stands on the track's edge, with the card beside it.
    if (head && head.x - m.bar.x > 2) {
      const ink = px(head.x + head.w / 2, mid);
      const sides = [px(head.x - 0.5, mid), px(head.x + head.w + 0.5, mid)];
      const under = m.marks.find((x) => (x.kind === "landed" || x.kind === "searching") && head.x + head.w / 2 > x.x && head.x + head.w / 2 < x.x + x.w);
      console.log(`PROBE   playhead ${hex(ink)} at ${(head.x - m.bar.x).toFixed(1)}px${under ? ` inside a ${under.kind} band` : ""}, either side ${sides.map(hex).join(" ")}: ${sides.map((s) => contrast(ink, s).toFixed(2)).join(" and ")}:1`);
      return { under: under?.kind ?? null, sides: sides.map((s) => contrast(ink, s)) };
    }
    return null;
  };

  /**
   * The playhead stopped inside the take's landing (needs LOOK_WAV, so
   * the take is long enough to seek there): read where it crosses sage.
   */
  const playheadOverLanding = async (scene, at) => {
    const ok = await page.evaluate(async (to) => {
      const a = document.querySelector("audio[data-take]");
      if (!a || !Number.isFinite(a.duration) || a.duration < to) return false;
      a.pause();
      a.currentTime = to;
      await new Promise((r) => a.addEventListener("seeked", r, { once: true }));
      return a.currentTime;
    }, at);
    if (!ok) return console.log(`PROBE ${scene} ${theme}: no audio long enough to seek to ${at}s, playhead not read`);
    console.log(`PROBE ${scene} ${theme}: the take sought to ${ok.toFixed(2)}s`);
    await sleep(300);
    const r = await measureTrack(scene, "-playhead");
    if (!r || r.under !== "landed") return fail(`${scene} ${theme}: the playhead did not stop inside the landing`);
    if (Math.min(...r.sides) < 3) fail(`${scene} ${WIDTH}x${HEIGHT} ${theme}: the playhead is ${Math.min(...r.sides).toFixed(2)}:1 beside the sage band`);
  };
  /** Hear it back near the top of the screen, the transcript under it. */
  const showHear = async () => {
    await page.waitForSelector('input[aria-label="Playback position"]', { timeout: 8000 });
    await page.evaluate(() => {
      const card = [...document.querySelectorAll("main .eyebrow")].find((e) => e.textContent === "Hear it back")?.closest(".card");
      window.scrollBy(0, (card?.getBoundingClientRect().top ?? 0) - 120);
    });
    await sleep(400);
  };
  const toWords = async () => {
    await page.getByRole("button", { name: /Your words/ }).first().click();
    await showHear();
  };
  for (const [scene, body, pauses] of [
    ["words-two", () => bodyFor(HEAR.two), HEAR.two],
    ["words-clean", cleanBody, HEAR.clean],
  ]) {
    if (!want(scene)) continue;
    await step(async () => {
      await walk(body());
      await toWords();
      await probeTrack(scene, pauses, 62);
      await shot(scene);
      await measureTrack(scene);
    });
  }
  if (want("words-stored")) {
    await step(async () => {
      stored.pauses = HEAR.two.map((p) => ({ ...p }));
      stored.audio_path = "look/rep-22.webm";
      audio.mode = "ok";
      await page.goto(`${BASE}/rep/rep-22`);
      await showHear();
      await probeTrack("words-stored", HEAR.two, stored.duration_s);
      await shot("words-stored");
      await measureTrack("words-stored");
      await playheadOverLanding("words-stored", P.land.t + P.land.len / 3);
    });
  }
  /* An upload: the file goes in as it is, the same take comes back. */
  if (want("words-upload") && WAV) {
    await step(async () => {
      live.body = bodyFor(HEAR.two);
      await page.goto(`${BASE}/upload`);
      await page.setInputFiles("#upload-file", { name: "take.wav", mimeType: "audio/wav", buffer: WAV });
      await showHear();
      await probeTrack("words-upload", HEAR.two, 62);
      await shot("words-upload");
      await measureTrack("words-upload");
    });
  }
  /* A Q&A round (Premium, so the plan is an invite code's for it). */
  if (want("words-round")) {
    await step(async () => {
      resetPlan("code");
      try {
        live.body = roundBody();
        await page.goto(`${BASE}/rep?game=qa&q=qa2`);
        await page.waitForSelector('button[aria-label="Start recording"]', { timeout: 30000 });
        await sleep(800);
        await page.click('button[aria-label="Start recording"]', { force: true });
        await page.waitForSelector('button[aria-label="Stop and score this recording"]');
        await sleep(2600);
        await page.click('button[aria-label="Stop and score this recording"]', { force: true });
        await page.waitForSelector("main .arrive-x", { timeout: 30000 });
        await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 8000 }).catch(() => {});
        await sleep(4000);
        await page.getByRole("button", { name: /The numbers/ }).first().click();
        await page.waitForSelector("details summary:has-text('Pausing')", { timeout: 8000 });
        await sleep(600);
        await toWords();
        await probeTrack("words-round", HEAR.two, 62, 1);
        await shot("words-round");
        await measureTrack("words-round");
      } finally {
        resetPlan();
      }
    });
  }

  for (const n of ["two", "three", "four"]) {
    if (!want(n) && !(n === "two" && want("focus"))) continue;
    await step(async () => {
      await walk(bodyFor(SETS[n]));
      await openPauseRow();
      await probe(n);
      if (want(n)) await shot(n);
      if (n === "two" && want("focus") && theme === "light") {
        await page.locator("button[data-pause-moment]").first().focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const box = await page.locator("details[open] .reveal").first().boundingBox();
        await shot("two", { extra: "-focus", clip: { x: 0, y: Math.max(0, box.y - 24), width: WIDTH, height: box.height + 48 } });
      }
    });
  }

  /* The long take: the map draws the filled pause the row names. */
  if (want("long")) {
    await step(async () => {
      await walk(bodyFor(LONG.pauses, { durationS: LONG.durationS, heldPauses: 5 }));
      await openPauseRow();
      const map = await page.evaluate(() => {
        const bar = document.querySelector('[role="img"][aria-label*="held pause"]');
        const spans = [...(bar?.children ?? [])].map((s) => s.className);
        return {
          marks: spans.length,
          hollow: spans.filter((c) => c.includes("border-[1.5px]")).length,
          landed: spans.filter((c) => c.includes("bg-sage-600")).length,
          beats: spans.filter((c) => c.includes("min-w-[3px]")).length,
          overflow: bar ? bar.scrollWidth > bar.clientWidth + 1 : false,
        };
      });
      console.log(`PROBE long ${WIDTH}x${HEIGHT} ${theme}: ${JSON.stringify(map)}`);
      if (map.hollow < 1) fail(`long ${theme}: the row names 1:16 and the map draws no hollow mark`);
      if (map.landed + map.hollow !== 5) fail(`long ${theme}: the map draws ${map.landed + map.hollow} of 5 held pauses`);
      if (map.overflow) fail(`long ${theme}: the map overflows its card`);
      await shot("long");
    });
  }

  /* One sound at a time (review 1): the numbers step of a Premium
     Voice + Video take also holds the clip's <video controls>, which has
     sound. The camera cannot record a scorable body in a headless
     browser, so the Playback card's element is stood in here: a
     <video controls> on the same step playing the same take. */
  if (want("video")) {
    await step(async () => {
      await walk(bodyFor(SHORT, { durationS: 6 }), 6000);
      await openPauseRow();
      const result = await page.evaluate(async () => {
        const take = document.querySelector("audio[data-take]");
        const v = document.createElement("video");
        v.controls = true;
        v.src = take.src;
        v.id = "look-playback";
        document.querySelector("main").appendChild(v);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const state = () => ({ take: take.paused ? "paused" : "playing", video: v.paused ? "paused" : "playing" });
        await v.play().catch(() => {});
        await wait(300);
        const a = state();
        document.querySelector("button[data-pause-moment]").click();
        await wait(500);
        const b = state();
        await v.play().catch(() => {});
        await wait(500);
        const c = state();
        v.pause();
        take.pause();
        return { videoThenChip: { before: a, after: b }, chipThenVideo: c };
      });
      console.log(`PROBE video: the video plays ${JSON.stringify(result.videoThenChip.before)}; a chip is tapped ${JSON.stringify(result.videoThenChip.after)}; the video is played again ${JSON.stringify(result.chipThenVideo)}`);
      if (result.videoThenChip.after.video !== "paused" || result.videoThenChip.after.take !== "playing")
        fail(`video ${theme}: a chip tapped over a playing video leaves ${JSON.stringify(result.videoThenChip.after)}`);
      if (result.chipThenVideo.take !== "paused" || result.chipThenVideo.video !== "playing")
        fail(`video ${theme}: the video played over a chip leaves ${JSON.stringify(result.chipThenVideo)}`);
    });
  }

  /* A stored recording: the whole result on one page, Hear it back and
     the Pause row together. */
  const openStored = async (pathMode) => {
    stored.pauses = SETS.two.map((p) => ({ ...p }));
    stored.audio_path = pathMode === "silent" ? null : "look/rep-22.webm";
    audio.mode = pathMode === "broken" ? "broken" : "ok";
    await page.goto(`${BASE}/rep/rep-22`);
    await page.waitForSelector("details summary:has-text('Pausing')", { timeout: 30000 });
    await sleep(pathMode === "broken" ? 1500 : 800);
  };
  if (want("stored") || want("stored-playing")) {
    await step(async () => {
      await openStored("ok");
      const summary = page.locator("details summary:has-text('Pausing')").first();
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      await page.waitForSelector("details[open] [data-pause-moment]");
      await probe("stored");
      await page.evaluate(() => {
        const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
        window.scrollBy(0, (row?.getBoundingClientRect().top ?? 0) - 260);
      });
      if (want("stored")) await shot("stored");
      if (want("stored-playing")) {
        await page.locator("button[data-pause-moment]").first().click();
        await sleep(500);
        const pressed = await page.locator("button[data-pause-moment]").first().getAttribute("aria-pressed");
        console.log(`PROBE stored-playing: aria-pressed ${pressed}`);
        const box = await page.locator("details[open] .reveal").first().boundingBox();
        await shot("stored", { extra: "-playing", settle: 100, clip: { x: 0, y: Math.max(0, box.y - 24), width: WIDTH, height: box.height + 48 } });
        await page.evaluate(() => document.querySelector("audio[data-take]")?.pause());
      }
    });
  }
  for (const mode of ["silent", "broken"]) {
    if (!want(`stored-${mode}`) || theme !== "light") continue;
    await step(async () => {
      await openStored(mode);
      if (mode === "broken") {
        // A file that will not decode says so on its first play.
        await page.locator('button[aria-label="Play"]').first().click().catch(() => {});
        await sleep(800);
      }
      const summary = page.locator("details summary:has-text('Pausing')").first();
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      await page.waitForSelector("details[open] [data-pause-moment]");
      const buttons = await page.locator("details[open] button[data-pause-moment]").count();
      console.log(`PROBE stored-${mode}: ${buttons} buttons`);
      if (buttons) fail(`stored-${mode}: ${buttons} live chips with nothing to play`);
      await page.evaluate(() => {
        const row = document.querySelector("details[open] [data-pause-moment]")?.closest("details");
        window.scrollBy(0, (row?.getBoundingClientRect().top ?? 0) - 260);
      });
      await shot(`stored-${mode}`);
    });
  }

  await context.close();
}

for (const theme of THEMES) await shootTheme(theme);
await browser.close();
console.log(failed ? `${failed} FAIL` : "all probes held");
console.log(`done → ${OUT}`);
