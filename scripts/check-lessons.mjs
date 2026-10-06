/**
 * The lesson flow, end to end, in a real browser (DECISIONS #269, #273).
 *
 * A lesson is only a lesson if its three practices join up. This walks
 * the join: Lessons → a lesson → its first practice → a recording →
 * the debrief, and checks the two things that make it a lesson rather
 * than three unrelated recordings.
 *
 *   1. The recording is FILED against the practice it came from
 *      (`lesson:<id>:<n>`), because lib/lesson-progress.ts reads
 *      progress back out of the log and nothing else records it.
 *   2. The debrief's loudest button is the NEXT PRACTICE of the same
 *      lesson, not the road's next unit. A lesson ends as a lesson,
 *      the way a game ends as a game (#194).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next build && npx next start -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-lessons.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { analyzeBody, json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const LESSON = process.env.CHECK_LESSON ?? "the-cold-open";
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
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
});
await context.route("http://supabase.local/**", supabaseRoute);
/* What the recording was filed as. The debrief's own behaviour is
   downstream of this one string, so read it off the wire rather than
   trusting the screen. */
let filedAs = null;
await context.route("**/api/analyze", async (route) => {
  const body = route.request().postData() ?? "";
  const hit = /name="lessonId"\r?\n\r?\n([^\r\n]+)/.exec(body);
  filedAs = hit ? hit[1] : (route.request().postDataJSON?.()?.lessonId ?? null);
  await sleep(300);
  await route.fulfill(json(analyzeBody));
});
await context.addInitScript(seed, { theme: "light", session });
await context.addInitScript(() => {
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 90)));

// ---- 1. Lessons lists them, grouped, with their art ----------------------
await page.goto(`${BASE}/lessons`);
await page.waitForSelector("main [data-trait] h2");
await page.evaluate(async () => {
  const h = document.body.scrollHeight;
  for (let y = 0; y < h; y += window.innerHeight) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
});
await sleep(600);
const art = await page.evaluate(() =>
  [...document.images].filter((i) => i.src.includes("/lessons/")).map((i) => i.naturalWidth)
);
/* Fifteen rows plus the up-next card, which shows one of them again. */
ok("every lesson row has its picture", art.length >= 15 && art.every((w) => w > 0), `${art.filter((w) => w > 0).length}/${art.length}`);
/* The feedback round after #296: the gallery read as a paid store. The
   list is rows, one tap on top, and nothing paid anywhere near it. The
   tap is the Up next card's terracotta square (M03): one fill on the
   page, inside the one link that starts the next practice. */
const list = await page.evaluate(() => ({
  rows: document.querySelectorAll("main a[data-lesson]").length,
  taps: document.querySelectorAll('main [class*="bg-terracotta-500"]').length,
  tapIsUpNext: !!document.querySelector('main a[data-up-next][href*="lesson="] [class*="bg-terracotta-500"]'),
  upNext: document.querySelector("main [data-up-next]")?.getAttribute("data-up-next") ?? null,
  paid: /premium/i.test(document.querySelector("main")?.textContent ?? "") ||
    !!document.querySelector('main [class*="plum-"]'),
}));
ok("fifteen rows, one tap, on the lesson that is next", list.rows === 15 && list.taps === 1 && list.tapIsUpNext && !!list.upNext, JSON.stringify(list));
ok("nothing on the list says paid", !list.paid);

// ---- 2. A lesson opens, and its last practice is the harder one ----------
await page.goto(`${BASE}/lessons/${LESSON}`);
await page.waitForSelector("main h1");
const practices = await page.$$eval("main ol li", (els) => els.map((e) => e.textContent ?? ""));
ok("the lesson has three practices", practices.length === 3, String(practices.length));
ok(
  "the last one is the harder one, and says how",
  /No notes/i.test(practices[2] ?? "") && !/No notes/i.test(practices[0] ?? ""),
  (practices[2] ?? "").slice(-60)
);
ok("the tier is never on the screen", !/tier/i.test(await page.textContent("main")));

// ---- 3. Into the first practice -----------------------------------------
await page.getByRole("link", { name: "Start", exact: true }).click();
await page.waitForSelector('button[aria-label="Start recording"]');
const url = new URL(page.url());
ok(
  "the practice number travels with the lesson",
  url.searchParams.get("lesson") === LESSON && url.searchParams.get("q") === "1",
  url.search
);
const prompt = (await page.textContent("main")) ?? "";
ok(
  "the prompt is the practice's own",
  /overrated piece of advice/i.test(prompt),
  prompt.replace(/\s+/g, " ").slice(0, 70)
);

// ---- 4. Record it --------------------------------------------------------
await page.click('button[aria-label="Start recording"]', { force: true });
await page.waitForSelector('button[aria-label="Stop and score this recording"]');
await sleep(1200);
await page.click('button[aria-label="Stop and score this recording"]', { force: true });
await page.waitForSelector('[role="status"], main .arrive-x', { timeout: 20000 });
await sleep(2500);
ok("the recording is filed against the practice", filedAs === `lesson:${LESSON}:1`, String(filedAs));

// ---- 5. The debrief ends the lesson inside the lesson --------------------
const dialog = await page.$('[role="dialog"]');
if (dialog) await page.keyboard.press("Escape").catch(() => {});
for (let i = 0; i < 6; i++) {
  const next = page.locator("main button").filter({ hasText: /The numbers|Your words|What moved|Next/ }).first();
  if ((await next.count()) === 0) break;
  await next.click({ force: true }).catch(() => {});
  await sleep(500);
}
await sleep(600);
const buttons = await page.$$eval("main button", (els) =>
  els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean)
);
/* The loudest button is the one wearing the accent fill (lib/ui.ts's
   ACTION_CLASS), not the first one in the document — the debrief's
   first button is the transcript's play control. */
const primary = await page.$$eval("main button", (els) => {
  const hit = els.find(
    (e) =>
      e.className.includes("bg-terracotta-500") &&
      e.className.includes("w-full") &&
      e.className.includes("min-h-12")
  );
  return (hit?.textContent ?? "").replace(/\s+/g, " ").trim();
});
ok("the debrief's loudest button is the next practice", /Practice 2 of 3/.test(primary), primary);
ok(
  "and the road's next unit is not offered at all",
  !buttons.some((b) => /Next lesson/.test(b)),
  buttons.join(" | ").slice(0, 120)
);
ok(
  "the quiet exit is back to the lesson",
  buttons.some((b) => /Back to the lesson/.test(b)),
  buttons.join(" | ").slice(0, 120)
);

// ---- 6. Unknown is not zero ---------------------------------------------
/* The review after the list shipped. A failed read of the log used to
   land as "nothing done": Up next said Start on a lesson they may have
   finished. And the lesson page started at zero, so for a returning user
   its button said "Start" until the log arrived, and a tap in
   that window filed practice 1 again. */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabaseRoute);
  let failReps = true;
  let holdReps = 0;
  /* Registered second, so it runs first; anything it passes on reaches
     the fixture above. */
  await ctx.route("http://supabase.local/rest/v1/reps**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (holdReps) await sleep(holdReps);
    if (failReps) return route.fulfill(json({ message: "upstream", code: "500" }, 500));
    return route.fallback();
  });
  await ctx.addInitScript(seed, { theme: "light", session });
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/lessons`);
  await p.waitForSelector('main [role="alert"]');
  const failedRead = await p.evaluate(() => ({
    upNext: !!document.querySelector("main [data-up-next]"),
    progress: [...document.querySelectorAll("main a[data-lesson] [data-progress]")].filter(
      (e) => getComputedStyle(e).visibility !== "hidden"
    ).length,
    retry: !!document.querySelector('main [role="alert"] button'),
  }));
  ok(
    "a failed read draws no up-next card and no progress, and offers a retry",
    !failedRead.upNext && failedRead.progress === 0 && failedRead.retry,
    JSON.stringify(failedRead)
  );
  failReps = false;
  await p.click('main [role="alert"] button');
  const back = await p.waitForSelector("main [data-up-next]", { timeout: 10000 }).then(() => true, () => false);
  ok("the retry brings the card back", back);

  /* Round 2: the count under the title (M26). While the log is in
     flight its line is held at its height with no number in it, never
     "0 of 45"; when it lands it is the earned count and the card under
     it has not moved. */
  holdReps = 2500;
  await p.goto(`${BASE}/lessons`);
  await p.waitForSelector("main h1");
  await sleep(400);
  const countLine = () =>
    p.evaluate(() => {
      const line = document.querySelector("main .large-title-subtitle");
      const first = document.querySelector("main > .mt-5");
      return {
        text: (line?.textContent ?? "").trim(),
        h: line ? Math.round(line.getBoundingClientRect().height) : 0,
        top: first ? Math.round(first.getBoundingClientRect().top) : -1,
      };
    });
  const held = await countLine();
  ok("while the log is in flight the count's line is held, with no number in it", held.h === 20 && !/\d/.test(held.text), JSON.stringify(held));
  await p.waitForFunction(() => /of \d+ practices/.test(document.querySelector("main .large-title-subtitle")?.textContent ?? ""), null, { timeout: 10000 }).catch(() => {});
  const count = await countLine();
  ok(
    "and lands as the earned count without moving the card",
    /^\d+ of 45 practices$/.test(count.text) && count.h === 20 && count.top === held.top,
    JSON.stringify(count)
  );

  await p.goto(`${BASE}/lessons/${LESSON}`);
  await p.waitForSelector("main h1");
  await sleep(400);
  const inFlight = await p.evaluate(() => ({
    labelled: [...document.querySelectorAll("main a, main button")]
      .map((e) => (e.textContent ?? "").trim())
      .filter((t) => /^(Start|Practice \d of \d|Run it again)$/.test(t)),
    held: !!document.querySelector("main button[disabled][aria-busy]"),
  }));
  ok(
    "while the log is in flight the lesson's button names no practice and cannot be pressed",
    inFlight.labelled.length === 0 && inFlight.held,
    JSON.stringify(inFlight)
  );
  const landed = await p
    .waitForSelector('main a[href*="lesson="]', { timeout: 10000 })
    .then((a) => a.textContent(), () => null);
  ok("and names it once the log is in", /^Start$/.test((landed ?? "").trim()), String(landed));
  holdReps = 0;

  /* 320px, the narrowest phone: "3 PRACTICES" once wrapped to two lines
     in every row and in the up-next card. The labels print only when
     they are news now (M10): "2 of 3", "Done", and the row's "Carry on". */
  await p.setViewportSize({ width: 320, height: 700 });
  await p.goto(`${BASE}/lessons`);
  await p.waitForSelector("main [data-up-next]");
  const wrapped = await p.$$eval("main [data-progress-label]", (els) =>
    els
      .filter((e) => e.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(e).lineHeight))
      .map((e) => e.textContent)
  );
  ok("at 320px every progress label holds one line", wrapped.length === 0, JSON.stringify(wrapped));
  await ctx.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
