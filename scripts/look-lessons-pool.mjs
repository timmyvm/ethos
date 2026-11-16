/**
 * The school pool on the lessons (#492): the six lesson practices that
 * named a prompt about a job (t10, t11, t18, which lib/topics.ts drops
 * from the school pool), on the lesson's own page and on the recorder its
 * Start opens, for someone under 18 beside a grown-up.
 *
 *   LOOK_BASE=http://localhost:3933 node scripts/look-lessons-pool.mjs <before|after>
 *
 * Before #492 both people were handed the job prompt. After, the person
 * under 18 gets the lesson's own stand-in of the same shape
 * (content/lessons.ts `STAND_INS`), and the grown-up's page is unchanged.
 * Each page is opened cold (the server's page, then hydration), so the
 * shot is what a refresh or a shared link draws; `ssrJob` in the report
 * says whether the server's own markup carried a job prompt, and the
 * page with scripts off (`server`, closed-mouth's shot) is what shows
 * before the phone's answers are read: the six practices' lines held.
 *
 * Shots at 390x844, light, deviceScaleFactor 2, into
 * docs/look/lessons-pool/<phase>/; what each page and each recorder
 * named into topics.json there. The committed set keeps the under-18
 * pages and the server page; the recorder and the grown-up are in the
 * sheets beside them (scripts/sheet.mjs).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : createRequire(import.meta.url)("playwright");
import { supabaseRoute as supabase, json, session, seed, POSE_PREF, resetPlan, testerMode } from "./look-fixtures.mjs";

const PHASE = process.argv[2] ?? "after";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3933";
const OUT = `${process.env.LOOK_OUT ?? "docs/look/lessons-pool"}/${PHASE}/`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
resetPlan("free");
testerMode.tester = false;

/* The six lesson practices that named a job prompt, and which practice. */
const SIX = [
  { id: "closed-mouth", q: 3 },
  { id: "finish-it", q: 2 },
  { id: "or-rather", q: 2 },
  { id: "change-gear", q: 2 },
  { id: "short-and-concrete", q: 1 },
  { id: "second-pass", q: 1 },
];
/* The apostrophe as typed or as the server escapes it (&#x27;). */
const JOB = /worst job you(?:'|&#x27;|&#39;)ve ever done|Explain your work to a ten-year-old|job you(?:'|&#x27;|&#39;)re not qualified for/i;

const PEOPLE = [
  { tag: "under-18", ageBand: "u18" },
  { tag: "adult", ageBand: "18_24" },
];
const V = { w: 390, h: 844, theme: "light" };

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function open(person) {
  const ctx = await browser.newContext({
    viewport: { width: V.w, height: V.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: V.theme,
    serviceWorkers: "block",
  });
  await ctx.route("http://supabase.local/**", supabase);
  await ctx.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await ctx.route("http://supabase.local/auth/v1/token**", (route) => route.fulfill(json(session)));
  await ctx.addInitScript(seed, { theme: V.theme, session, pose: POSE_PREF });
  await ctx.addInitScript((ageBand) => {
    const o = JSON.parse(localStorage.getItem("ethos.onboarding") ?? "{}");
    o.answers = { ...o.answers, ageBand, goal: "sharper", context: null };
    localStorage.setItem("ethos.onboarding", JSON.stringify(o));
  }, person.ageBand);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
}

const report = { phase: PHASE, lessons: [] };
let jobsToMinor = 0;
for (const person of PEOPLE) {
  const { ctx, page } = await open(person);
  for (const l of SIX) {
    /* The server's own markup, before any script runs. */
    const ssr = await page.request.get(`${BASE}/lessons/${l.id}`).then((r) => r.text());
    await page.goto(`${BASE}/lessons/${l.id}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForSelector("ol li", { timeout: 20000 }).catch(() => {});
    await sleep(1200);
    const items = await page.$$eval("ol li p.text-read", (ps) => ps.map((p) => p.textContent.trim()));
    const listed = items[l.q - 1] ?? null;
    await page.screenshot({ path: `${OUT}lesson-${l.id}-${person.tag}.png` });

    await page.goto(`${BASE}/rep?lesson=${l.id}&q=${l.q}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForSelector("[data-record]", { timeout: 20000 }).catch(() => {});
    await sleep(1200);
    const topic = await page.$eval("h1 .vt-shared", (e) => e.textContent.trim()).catch(() => null);
    await page.screenshot({ path: `${OUT}rep-${l.id}-${person.tag}.png` });

    const row = { person: person.tag, lesson: l.id, practice: l.q, listed, recorder: topic, ssrJob: JOB.test(ssr) };
    if (person.tag === "under-18" && (JOB.test(listed ?? "") || JOB.test(topic ?? "") || row.ssrJob)) jobsToMinor++;
    report.lessons.push(row);
    console.log(`${person.tag} ${l.id} ${l.q}: page "${listed}"  recorder "${topic}"  ssr job ${row.ssrJob}`);
  }
  await ctx.close();
}
/* The server's page with scripts off: what anyone sees before the
   phone's answers are read. A held line has no words ("Ag" is the
   invisible measure), so it reads as null here. */
{
  const ctx = await browser.newContext({
    viewport: { width: V.w, height: V.h },
    deviceScaleFactor: 2,
    javaScriptEnabled: false,
    colorScheme: V.theme,
  });
  const page = await ctx.newPage();
  for (const l of SIX) {
    await page.goto(`${BASE}/lessons/${l.id}`, { waitUntil: "load" }).catch(() => {});
    await sleep(800);
    const items = await page.$$eval("ol li p.text-read", (ps) => ps.map((p) => p.textContent.trim()));
    const listed = items[l.q - 1] === "Ag" ? null : (items[l.q - 1] ?? null);
    if (l.id === "closed-mouth") await page.screenshot({ path: `${OUT}lesson-${l.id}-server-page.png` });
    if (JOB.test(listed ?? "")) jobsToMinor++;
    report.lessons.push({ person: "server", lesson: l.id, practice: l.q, listed });
    console.log(`server ${l.id} ${l.q}: page ${listed === null ? "held" : `"${listed}"`}`);
  }
  await ctx.close();
}

report.jobsToMinor = jobsToMinor;
console.log(`job prompts shown to the under-18: ${jobsToMinor}`);
writeFileSync(`${OUT}topics.json`, JSON.stringify(report, null, 2) + "\n");
await browser.close();
