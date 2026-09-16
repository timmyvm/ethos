/**
 * The look loop's camera for the INTRODUCTION (DECISIONS #249).
 *
 * `scripts/look.mjs` photographs the app as a returning user sees it,
 * which means its fixture has already finished the walk — so it cannot
 * photograph the walk. This one starts from a genuinely empty browser
 * and taps through all eleven screens, shooting each, and shooting the
 * answered state of every question that has one, because Demos's reply
 * only exists after a tap and a screen nobody photographed answered is
 * half a screen.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   node scripts/look-welcome.mjs after
 *   LOOK_BLUR=4 node scripts/look-welcome.mjs squint
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";

const [, , TAG = "after"] = process.argv;
const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = (
  process.env.LOOK_OUT ?? new URL("../docs/look/welcome/", import.meta.url).pathname
).replace(/\/?$/, "/");
mkdirSync(OUT, { recursive: true });
const BLUR = Number(process.env.LOOK_BLUR ?? 0) || 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

import { supabaseRoute } from "./look-fixtures.mjs";

/**
 * The answers this walk gives, one per question. `pains` is two taps so
 * the reply is the SECOND one: a reply is an answer to what you just
 * did, and the camera should catch it doing that.
 */
const ANSWERS = [
  { id: "name", type: "text", value: "Tim" },
  { id: "ageBand", type: "row", labels: ["18 to 24"] },
  { id: "goal", type: "row", labels: ["Think on my feet when asked"] },
  { id: "pains", type: "row", labels: ["I rush", "I ramble"] },
  { id: "level", type: "row", labels: ["A bit, a class or a few talks"] },
  { id: "context", type: "row", labels: ["Work"] },
  /* The beat (#288): one screen, no answer, shot once. */
  { id: "beat", type: "beat" },
  { id: "time", type: "row", labels: ["Evening, 18:00"] },
];

const browser = await chromium.launch();

async function shootTheme(theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  // An EMPTY browser, apart from the theme: this is the one screen in
  // the app whose whole subject is a person who has nothing stored.
  await context.addInitScript((t) => {
    localStorage.setItem(
      "ethos.prefs",
      JSON.stringify({ theme: t, reducedMotion: false, haptics: false })
    );
  }, theme);
  await context.addInitScript((blur) => {
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal{display:none!important}" +
      (blur ? ` html{filter:blur(${blur}px)}` : "");
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  }, BLUR);

  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 160));
  });

  const shot = async (name, settle = 700) => {
    // Park the pointer off-screen first: a shot taken with the cursor
    // still resting on the button it just pressed photographs the hover
    // state, and every after-shot came back with a darker CTA than the
    // app actually ships.
    await page.mouse.move(0, 0);
    await sleep(settle);
    await page.screenshot({ path: `${OUT}${name}-${TAG}-${theme}.png`, fullPage: true });
    console.log(`shot  ${name}-${TAG}-${theme}`);
  };
  const next = async () => {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await sleep(450);
  };

  await page.goto(`${BASE}/welcome`);
  await page.waitForSelector("main h1");

  for (let n = 1; n <= 3; n++) {
    await shot(`intro-${n}`);
    await next();
  }

  let k = 0;
  for (const q of ANSWERS) {
    if (q.type === "beat") {
      await shot("beat");
      await next();
      continue;
    }
    k += 1;
    // Unanswered first: the question as it is actually met.
    await shot(`q${k}-${q.id}`);
    if (q.type === "text") {
      await page.getByLabel("Your name").fill(q.value);
      await page.getByLabel("Your name").blur();
    } else {
      for (const label of q.labels) {
        await page.getByRole(/^I /.test(label) || label.startsWith("Um,") ? "checkbox" : "radio", {
          name: label,
          exact: true,
        }).click();
        await sleep(300);
      }
    }
    // Answered: his reply, and the nod that came with it.
    await shot(`q${k}-${q.id}-answered`, 600);
    await next();
  }

  await shot("plan", 1100);
  await context.close();
}

await shootTheme("light");
await shootTheme("dark");
await browser.close();
console.log(`done → ${OUT}`);
