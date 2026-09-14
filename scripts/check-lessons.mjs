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
await page.waitForSelector("main .label-data");
await page.evaluate(async () => {
  const h = document.body.scrollHeight;
  for (let y = 0; y < h; y += window.innerHeight) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
});
await sleep(600);
const art = await page.evaluate(() =>
  [...document.images].filter((i) => i.src.includes("/lessons/")).map((i) => i.naturalWidth)
);
ok("every lesson card has its picture", art.length === 15 && art.every((w) => w > 0), `${art.filter((w) => w > 0).length}/${art.length}`);

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
await page.getByRole("link", { name: /Start the lesson/ }).click();
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

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
