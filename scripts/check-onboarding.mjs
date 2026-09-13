/**
 * The introduction, walked in a real browser (DECISIONS #232, #233,
 * #249): eleven screens, one typed answer and six tapped ones,
 * persistence across a refresh, back, skip, Demos replying where an
 * answer changes something and only nodding where it does not, the plan
 * built from the answers, and what the answers change afterwards (the
 * floor's day-one note, the roulette pool, /you's plan row, the intro
 * gate, the road's focus mark), then reduced motion.
 *
 * Same harness as scripts/check-motion.mjs: a build with
 * NEXT_PUBLIC_SUPABASE_URL=http://supabase.local, served on :3123, the
 * host answered in-page. Writes screenshots, a video and findings.json
 * under docs/devibe/motion-check/onboarding/.
 *
 *   node scripts/check-onboarding.mjs            # playwright resolvable, or
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-onboarding.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3123";
const OUT = new URL("../docs/devibe/motion-check/onboarding/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const findings = [];
const ok = (name, pass, detail = "") => { findings.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: OUT + "video", size: { width: 390, height: 844 } } });
await context.route("http://supabase.local/**", (r) => r.fulfill({ status: r.request().method() === "OPTIONS" ? 204 : 200, headers: cors, body: "[]" }));
/*
 * The dev overlay ships a button labelled "Next", which makes every
 * `getByRole("button", {name: "Next"})` in this walk a strict-mode
 * violation, and its portal swallows pointer events whenever a route
 * fails to compile. Same fix as the other harnesses (#242).
 */
await context.addInitScript(() => {
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});

/*
 * The seventh question picks an hour and must ask for NOTHING. A
 * notification prompt in the first thirty seconds is how an app loses
 * it permanently, so the walk is watched for one rather than trusted.
 */
await context.addInitScript(() => {
  window.__askedPermission = false;
  if (typeof Notification !== "undefined" && Notification.requestPermission) {
    const orig = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = (...a) => {
      window.__askedPermission = true;
      return orig(...a);
    };
  }
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 120)));
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });
const anim = (sel) => page.$eval(sel, (el) => getComputedStyle(el).animationName);

// 1. A fresh browser lands on the introduction.
await page.goto(`${BASE}/`);
await page.waitForURL(/\/welcome/);
await page.getByText("Hey. I know why you're here.").waitFor();
ok("a fresh browser is routed to the introduction", true);
const wave = await anim("main img.demos");
ok("the wave sways", wave === "sway", wave);
await shot("01-intro-1");
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(400);
const arcs = await page.$$eval("main svg .arc", (els) => els.map((e) => getComputedStyle(e).animationName));
ok("the speaking pose draws its arcs in code, animated", arcs.length === 3 && arcs.every((a) => a === "arc-in"), arcs.join(","));
await shot("02-intro-2");
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(400);
const sparks = await page.$$eval("main svg .spark", (els) => els.length);
ok("the celebrate pose has three sparkles", sparks === 3, String(sparks));
await shot("03-intro-3");
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(400);

// 2. Question 1: the name. The one answer you type, and the one he
// repeats straight back.
await page.getByText("What do I call you?").waitFor();
ok("the walk opens on the name, one of seven", await page.getByText("1 of 7").isVisible());
ok(
  "an optional question doesn't hold Next",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === false
);
await page.getByLabel("Your name").fill("Tim");
await page.getByLabel("Your name").blur();
await sleep(350);
ok("Demos says the name back", await page.getByText("Good to meet you, Tim.").isVisible());
const nodded = await page.$eval("main img.demos", (el) => el.parentElement.className);
ok("and he nods when he hears it", /demos-nod/.test(nodded), nodded);
await shot("04-q-name");
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(300);

// 3. Question 2: age. Next waits for an answer; Skip is under it.
await page.getByText("How old are you?").waitFor();
const disabled = await page.getByRole("button", { name: "Next", exact: true }).isDisabled();
ok("an essential question holds Next until answered", disabled === true);
ok("progress reads 2 of 7", await page.getByText("2 of 7").isVisible());
await shot("05-q-age");
await page.getByRole("radio", { name: "Under 18" }).click();
ok("a tap picks the answer", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
await sleep(250);
ok(
  "the one age band that changes the prompt pool says so",
  await page.getByText("Then your prompts come from school and life, not work.").isVisible()
);
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(300);

// 4. Question 3: goal. It changes only what the PLAN will say, so he
// nods and says nothing — the screen keeps its own line.
await page.getByText("What do you want this for?").waitFor();
await page.getByRole("radio", { name: "Hold a room when I present" }).click();
await sleep(250);
ok(
  "an answer that only changes the plan gets a nod and no line",
  await page.getByText("Pick the closest.").isVisible()
);
// Refresh in the middle: it resumes here with the answers kept.
await page.reload();
await page.getByText("What do you want this for?").waitFor({ timeout: 5000 });
ok("a refresh resumes on the same question", true);
ok("the answer survived the refresh", (await page.getByRole("radio", { name: "Hold a room when I present" }).getAttribute("aria-checked")) === "true");
await shot("06-q-goal");
// Back goes to age, with the answer still there.
await page.getByRole("button", { name: "← back" }).click();
await page.getByText("How old are you?").waitFor();
ok("back returns to the previous question with its answer", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByText("What do you want this for?").waitFor();
await page.getByRole("button", { name: "Next", exact: true }).click();

// 5. Question 4: pains, up to three, and he answers the one just tapped.
await page.getByText("What do you notice when you talk?").waitFor();
for (const n of ["I rush", "Um, like, you know", "I freeze on the spot"]) {
  await page.getByRole("checkbox", { name: n }).click();
  await sleep(200);
}
ok(
  "he replies about the pain just tapped, not the first one",
  await page.getByText("Freezing. I separate the silences that work.").isVisible()
);
const fourth = await page.getByRole("checkbox", { name: "I ramble" }).isDisabled();
ok("a fourth pain is refused", fourth === true);
await shot("07-q-pains");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 6. Question 5: level, which moves two real settings and says which.
await page.getByText("How much have you practised?").waitFor();
await page.getByRole("radio", { name: "Often, I present most weeks" }).click();
await sleep(250);
ok(
  "the level names the setting it just changed",
  await page.getByText("Units skip the teaching. You start on the floor.").isVisible()
);
await shot("08-q-level");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 7. Question 6: optional, skipped.
await page.getByText("Where does it matter most?").waitFor();
const optionalEnabled = !(await page.getByRole("button", { name: "Next", exact: true }).isDisabled());
ok("the optional question doesn't hold Next", optionalEnabled);
await page.getByRole("button", { name: "Skip" }).click();

// 8. Question 7: the hour. It writes a preference and asks for nothing.
await page.getByText("When do you want your minute?").waitFor();
ok("progress reads 7 of 7", await page.getByText("7 of 7").isVisible());
await page.getByRole("radio", { name: "Evening, 18:00" }).click();
await sleep(250);
const hour = await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.prefs") || "{}").reminderHour);
ok("picking an hour writes it straight to prefs", hour === 18, String(hour));
ok(
  "and the introduction never asks for notification permission",
  (await page.evaluate(() => window.__askedPermission)) === false
);
await shot("09-q-time");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 9. The plan, from the answers, opening in their name and their words.
await page.getByText("Hold the room.").waitFor();
ok(
  "the plan opens on his line to them, by name",
  await page.getByText("Tim. You said rushing. Now it's a number.").isVisible()
);
const lines = await page.$$eval("main ol li", (els) => els.map((e) => e.textContent.replace(/^\d/, "").trim()));
ok("line 2 names the first pain's number", lines[1] === "First number: words per minute against the 130 to 160 zone.", lines[1]);
ok("line 3 names the unit and the road's gate", /^Then Pace Control, the unit for rushing\. Opens at \d+ stars\.$/.test(lines[2]), lines[2]);
const laddered = await page.$eval("main ol", (el) => el.className);
ok("the plan's lines land one at a time", /stagger/.test(laddered), laddered);
ok("the boss is the fine print", await page.getByText("Your boss, when you're ready: Cold Topic.").isVisible());
const clip = await anim("main img.demos");
ok("the plan's Demos breathes", clip === "breath", clip);
await shot("10-plan");
const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.prefs") || "{}"));
ok("'often' turned unit intros off and left the frame step off", prefs.skipIntros === true && prefs.frameStep === false, JSON.stringify(prefs));
const state = await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.onboarding")));
ok("the walk is stored as done, unsynced", state.done === true && state.synced === false && state.answers.pains.length === 3);
ok("the name and the hour are stored with the answers", state.answers.name === "Tim" && state.answers.time === "evening", JSON.stringify(state.answers));
const floorHref = await page.getByRole("link", { name: "Take the floor" }).getAttribute("href");
ok("Take the floor skips the unit intro for an 'often' speaker", floorHref.startsWith("/rep"), floorHref);

// 8. Home: the day-one note repeats the answer.
await page.getByRole("link", { name: "Take the floor" }).click();
await page.waitForURL(/\/rep/);
await page.goto(`${BASE}/`);
await page.getByText("Day one starts today.").waitFor();
ok("the floor repeats what they said, in their words", await page.getByText("You said: rushing, fillers, freezing. The baseline sets the number to beat.").isVisible());
ok(
  "the road marks the unit that trains what they said, in their words",
  await page.getByText("You said rushing").isVisible()
);
await shot("11-home");
// The roulette pool: under 18 never draws a job prompt.
await page.getByRole("button", { name: /Spin a new topic/ }).click();
const drawn = new Set();
for (let i = 0; i < 25; i++) { drawn.add(await page.$eval("main .font-display.text-title", (e) => e.textContent.trim())); await page.getByRole("button", { name: "Spin" }).click(); await sleep(560); }
const job = [...drawn].some((t) => /worst job|Explain your work|job you're not qualified/.test(t));
ok("the roulette never draws a job prompt for an under-18", !job, `${drawn.size} distinct`);

// 9. /you: the plan row, and reopening the plan to change an answer.
await page.goto(`${BASE}/you`);
await page.getByText("Your plan").waitFor();
ok("/you shows the plan row with the unit and its gate", await page.getByText(/Pace Control · \d+★ to go/).isVisible());
await shot("12-you");
await page.getByRole("link", { name: /Your plan/ }).click();
await page.waitForURL(/step=plan/);
await page.getByText("Hold the room.").waitFor();
ok("the plan row reopens the plan with a Done exit", await page.getByRole("link", { name: "Done" }).isVisible());
await page.getByRole("button", { name: "← back" }).click();
await page.getByText("When do you want your minute?").waitFor();
ok("back from the plan reaches the last question", true);

// 10. Reduced motion stills every loop.
await page.evaluate(() => localStorage.setItem("ethos.prefs", JSON.stringify({ reducedMotion: true })));
await page.goto(`${BASE}/welcome?step=plan`);
await page.getByText("Hold the room.").waitFor();
const still = await anim("main img.demos");
ok("under reduced motion the art is still", still === "none", still);
const nodStilled = await page.evaluate(() => {
  const el = document.createElement("div");
  el.className = "demos-nod";
  document.body.appendChild(el);
  const name = getComputedStyle(el).animationName;
  el.remove();
  return name;
});
ok("and the nod is stilled with it", nodStilled === "none", nodStilled);

await page.close(); await context.close(); await browser.close();
writeFileSync(OUT + "findings.json", JSON.stringify(findings, null, 2));
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
