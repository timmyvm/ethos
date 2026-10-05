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

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const OUT = new URL("../docs/devibe/motion-check/onboarding/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const findings = [];
const ok = (name, pass, detail = "") => { findings.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" };

const browser = await chromium.launch();
/*
 * `serviceWorkers: "block"`: the app registers its offline shell on every
 * page load, and once a worker controls the page Playwright's routes no
 * longer see the fetches it passes through, so the mocked host stops
 * answering on the second visit to a screen and Today never gets its
 * recordings. It took three timeouts on "Day one starts today." to find.
 * The walk tests the app, not the shell.
 */
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", recordVideo: { dir: OUT + "video", size: { width: 390, height: 844 } } });
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

/*
 * A real finger (the swipe-and-pop round): touch events through CDP, so
 * the page sees `pointerType: "touch"` and its `touch-action: pan-y`
 * is in force, which is what a phone does. `hold` stops before lifting
 * and returns what the sliding screen looked like under the finger.
 */
const cdp = await context.newCDPSession(page);
const touch = (type, x, y) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
async function swipe(dx, { y = 420, dy = 0, steps = 10, ms = 200, hold = false, settle = 650 } = {}) {
  const x0 = dx < 0 ? 340 : 50;
  await touch("touchStart", x0, y);
  for (let k = 1; k <= steps; k++) {
    await touch("touchMove", x0 + (dx * k) / steps, y + (dy * k) / steps);
    await sleep(ms / steps);
  }
  let held = null;
  if (hold) held = await page.$eval("main [class*='step-in-']", (el) => el.style.transform);
  await touch("touchEnd");
  await sleep(settle);
  return held;
}
const heading = async () => (await page.textContent("main h1")).trim();
/* Where the one tap stands, per screen: the walk docks it in one shelf,
   so it must read the same on every question, the beat and the plan. */
const tops = {};
const nextTop = async (name) => {
  tops[name] = await page.evaluate(() => {
    const b = [...document.querySelectorAll("main button, main a")].find((x) =>
      ["Next", "Start"].includes(x.textContent.trim())
    );
    return b ? Math.round(b.getBoundingClientRect().top) : null;
  });
};
const arrival = () =>
  page.$eval("main [class*='step-in-']", (el) => (/step-in-(next|back)/.exec(el.className) || [])[1]);

// 1. A fresh browser lands on the introduction.
await page.goto(`${BASE}/`);
await page.waitForURL(/\/welcome/);
await page.getByText("Hey. I know why you're here.").waitFor();
ok("a fresh browser is routed to the introduction", true);
const wave = await anim("main img.demos");
ok("the wave sways", wave === "sway", wave);
await shot("01-intro-1");

// 1a. A short phone (375x667, the review of the swipe-and-pop round):
// the stage gives up height, Demos shrinks to the room, and the one tap
// and the door under it stay above the fold.
await page.setViewportSize({ width: 375, height: 667 });
await sleep(400);
const fold = await page.evaluate(() => {
  const bottom = (el) => (el ? Math.round(el.getBoundingClientRect().bottom) : 9999);
  const next = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Next");
  const door = [...document.querySelectorAll("main a")].find((a) => a.textContent.includes("already have an account"));
  const demos = document.querySelector("main .demos-fit-room > div");
  return { next: bottom(next), door: bottom(door), demos: demos ? Math.round(demos.getBoundingClientRect().height) : 0 };
});
ok("on a 667px phone Next and the sign-in door are above the fold", fold.next <= 667 && fold.door <= 667, JSON.stringify(fold));
ok("and Demos fits the room at a size that still reads", fold.demos >= 150, String(fold.demos));
await page.setViewportSize({ width: 390, height: 844 });
await sleep(300);

// 1b. The introduction is a carousel (the swipe-and-pop round).
const held = await swipe(-60, { hold: true });
ok("the screen follows the finger", /translate3d\(-?\d/.test(held ?? "") && held !== "translate3d(0px, 0px, 0px)", held);
ok("a short drag springs back", (await heading()) === "Hey. I know why you're here.");
await swipe(90);
ok("the first screen rubber-bands a swipe back", (await heading()) === "Hey. I know why you're here.");
await swipe(-200);
ok("swipe left goes forward", (await heading()) === "A coach costs $5,000.");
ok("and the next screen arrives from the right", (await arrival()) === "next");
const said = await page.$eval("main [class*='step-in-']", (el) => ({
  arrival: el.dataset.arrival ?? null,
  delay: getComputedStyle(el.querySelector(".says-word")).animationDelay,
}));
ok("a swiped page brings its words with it", said.arrival === "gesture" && said.delay === "0s", JSON.stringify(said));
ok(
  "the pager follows the page",
  (await page.$eval("main .intro-dot[data-on]", (el) => el.parentElement.getAttribute("aria-label"))) === "Page 2"
);
await swipe(200);
ok("swipe right goes back", (await heading()) === "Hey. I know why you're here.");
ok("and the screen before arrives from the left", (await arrival()) === "back");
await swipe(8, { dy: -220, y: 640 });
ok("a vertical drag is left to the page", (await heading()) === "Hey. I know why you're here.");
await page.keyboard.press("ArrowRight");
await sleep(400);
ok("the right arrow key steps forward", (await heading()) === "A coach costs $5,000.");
await page.keyboard.press("ArrowLeft");
await sleep(400);
ok("and the left arrow steps back", (await heading()) === "Hey. I know why you're here.");
const grounded = await page.$$eval("main .demos-ground > span, main .demos-halo, main .demos-pop", (els) => els.length);
ok("Demos stands on a stage with a disc, a shadow and a spring", grounded === 3 && (await page.$$("main .intro-stage")).length === 1, String(grounded));
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(400);
ok(
  "a tapped Next keeps the said-then-moves order",
  (await page.$eval("main [class*='step-in-']", (el) => el.dataset.arrival ?? null)) === null
);
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
await nextTop("q1");
const at = async () => page.getByRole("progressbar").getAttribute("aria-valuenow");
ok("the walk opens on the name, one of seven", (await at()) === "1");
ok(
  "every question holds Next until answered, the name included (#288)",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === true
);
await swipe(-220);
ok("and a swipe past an unanswered question rubber-bands", (await heading()) === "What do I call you?");
const fieldBox = await page.getByLabel("Your name").boundingBox();
await swipe(-220, { y: fieldBox.y + fieldBox.height / 2 });
ok("a drag that starts in the name field is the field's", (await heading()) === "What do I call you?");
await page.getByLabel("Your name").fill("Tim");
await page.getByLabel("Your name").blur();
await sleep(350);
ok(
  "and Next lights when the name lands",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === false
);
ok("Demos says the name back", await page.getByText("Good to meet you, Tim.").isVisible());
const nodded = await page.$eval("main img.demos", (el) => el.parentElement.className);
ok("and he nods when he hears it", /demos-nod/.test(nodded), nodded);
await shot("04-q-name");
await swipe(-220);
ok("an answered question swipes forward like Next", (await heading()) === "How old are you?");
// intro-a-2: the keyboard's own Next key, on the name, is the screen's Next.
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByText("What do I call you?").waitFor();
await page.getByLabel("Your name").press("Enter");
await sleep(400);
ok("the keyboard's Next key on the name goes forward", (await heading()) === "How old are you?");
const rowBox = await page.getByRole("radio", { name: "25 to 34" }).boundingBox();
await swipe(-80, { y: rowBox.y + rowBox.height / 2 });
ok(
  "a drag across an answer does not pick it",
  (await page.getByRole("radio", { name: "25 to 34" }).getAttribute("aria-checked")) === "false"
);

// 3. Question 2: age. Next waits for an answer; Skip is beside the bar.
await page.getByText("How old are you?").waitFor();
const disabled = await page.getByRole("button", { name: "Next", exact: true }).isDisabled();
ok("an essential question holds Next until answered", disabled === true);
ok("the bar stands at 2 of 7", (await at()) === "2");
/* M20: Skip is the top row's, right of the bar; the shelf holds Next alone. */
const skipRow = await page.evaluate(() => {
  const mid = (el) => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
  const skip = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Skip");
  return skip ? { skip: mid(skip), bar: mid(document.querySelector("[role=progressbar]")) } : null;
});
ok("Skip sits in the top row beside the bar", skipRow !== null && Math.abs(skipRow.skip - skipRow.bar) <= 2, JSON.stringify(skipRow));
await nextTop("q2");
await shot("05-q-age");
// A refused swipe, then a quick real tap: the tap must land.
await swipe(-220, { settle: 60 });
await page.getByRole("radio", { name: "Under 18" }).tap();
ok("a tap right after a refused swipe is not swallowed", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
ok("a tap picks the answer", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
// Arrow keys inside a set of answers belong to the answers (intro-a-5,
// intro-b-7): one Tab stop, and the arrows move the choice with the focus.
const stops = await page.$$eval("main [role=radio]", (els) => els.filter((e) => e.tabIndex === 0).length);
ok("a set of answers is one Tab stop", stops === 1, String(stops));
await page.getByRole("radio", { name: "Under 18" }).focus();
await page.keyboard.press("ArrowRight");
await sleep(400);
ok("an arrow key on an answer does not change the screen", (await heading()) === "How old are you?");
ok(
  "and it moves the choice to the next answer",
  (await page.getByRole("radio", { name: "18 to 24" }).getAttribute("aria-checked")) === "true" &&
    (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "18 to 24"
);
await page.keyboard.press("ArrowLeft");
await sleep(250);
ok("the left arrow moves it back", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
ok(
  "the one age band that changes the prompt pool says so",
  await page.getByText("Your prompts will come from school and life.").isVisible()
);
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(300);

// 4. Question 3: goal. It changes only what the PLAN will say, so he
// nods and says nothing — the screen keeps its own line.
await page.getByText("What do you want this for?").waitFor();
await nextTop("q3");
await page.getByRole("radio", { name: "Hold a room when I present" }).click();
await sleep(250);
ok(
  "an answer that only changes the plan gets a nod and the question stays",
  await page.getByText("What do you want this for?").isVisible()
);
// Refresh in the middle: it resumes here with the answers kept.
await page.reload();
await page.getByText("What do you want this for?").waitFor({ timeout: 5000 });
ok("a refresh resumes on the same question", true);
ok("the answer survived the refresh", (await page.getByRole("radio", { name: "Hold a room when I present" }).getAttribute("aria-checked")) === "true");
await shot("06-q-goal");
// Back goes to age, with the answer still there.
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByText("How old are you?").waitFor();
ok("back returns to the previous question with its answer", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByText("What do you want this for?").waitFor();
await page.getByRole("button", { name: "Next", exact: true }).click();

// 5. Question 4: pains, up to three, and he answers the one just tapped.
await page.getByText("What do you notice when you talk?").waitFor();
await nextTop("q4");
for (const n of ["I rush", "Um, like, you know", "I freeze on the spot"]) {
  await page.getByRole("checkbox", { name: n }).click();
  await sleep(200);
}
/* Waited for rather than read at once: a tap on a busy dev server can
   take longer than the sleep to render. */
ok(
  "he replies about the pain just tapped, not the first one",
  await page
    .getByText("I separate the silences that work.")
    .waitFor({ timeout: 3000 })
    .then(() => true)
    .catch(() => false)
);
const fourth = await page.getByRole("checkbox", { name: "I ramble" }).isDisabled();
ok("a fourth pain is refused", fourth === true);
await shot("07-q-pains");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 6. Question 5: level, which moves two real settings and says which.
await page.getByText("How much have you practised?").waitFor();
await nextTop("q5");
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
await nextTop("q6");
ok(
  "an unanswered question holds Next, and Skip is the way past (#288)",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === true
);
await page.getByRole("button", { name: "Skip", exact: true }).click();

// 7c. The beat before the hour (#288): Demos alone with one line, no
// answer to give, and the bar does not move for it.
await page.getByText("Practice with a set time gets done.").waitFor();
await nextTop("beat");
ok("a beat breaks the run of questions before the hour is asked", (await page.getByRole("radio").count()) === 0);
ok("and the bar stays at 6 of 7 across it", (await at()) === "6");
await shot("08b-beat");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 8. Question 7: the hour. It writes a preference and asks for nothing.
await page.getByText("When do you want your minute?").waitFor();
await nextTop("q7");
ok("the bar stands at 7 of 7", (await at()) === "7");
/* The hour is said the device's way after mount (intro-b-19), so the
   row is found by its word. */
await page.getByRole("radio", { name: /^Evening/ }).click();
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
await nextTop("plan");
ok(
  "the plan opens on his line to them, by name",
  await page.getByText("Tim, you said rushing. Now it's a number.").isVisible()
);
/* Each step is a lead and a detail (intro-b-12). */
const steps = await page.$$eval("main ol li", (els) =>
  els.map((e) => [...e.querySelectorAll(":scope > span:last-child > span")].map((s) => s.textContent.trim()))
);
ok(
  "step 2 names the first pain's number",
  steps[1]?.[0] === "First number" && steps[1]?.[1] === "Words per minute against the 130 to 160 zone.",
  JSON.stringify(steps[1])
);
ok(
  "step 3 names the unit and the road's gate",
  steps[2]?.[0] === "Then Pace Control" && /^The unit for rushing\. It opens at \d+ stars\.$/.test(steps[2]?.[1] ?? ""),
  JSON.stringify(steps[2])
);
const numbersSet = await page.$$eval("main ol li span.tabular-nums.font-display", (els) => els.map((e) => e.textContent));
ok("the plan's numbers are set as numbers", numbersSet.includes("130 to 160") && numbersSet.includes("60"), numbersSet.join(","));
const shelf = Object.values(tops);
ok("Next stands at one height on every question, the beat and the plan", shelf.length === 9 && shelf.every((y) => y !== null && y === shelf[0]), JSON.stringify(tops));
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

// 7b. The account ask (#277). One screen, after the plan, gating nothing.
/* Next, not Start: it opens the account ask, a step in the walk
   (intro-b-10); Start is kept for the floor. */
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByText("Keep this").waitFor();
ok(
  "the plan hands over to the account ask, by name",
  (await page.textContent("main h1")).includes("Tim"),
  await page.textContent("main h1")
);
ok(
  "Google is the one tap and email is the second door",
  (await page.getByRole("button", { name: /Continue with Google/ }).count()) === 1 &&
    (await page.getByRole("link", { name: /Use an email instead/ }).count()) === 1
);
ok(
  "and it says where to read what the product is",
  (await page.getByRole("link", { name: "What Ethos is" }).getAttribute("href")) === "/about"
);
await shot("10b-account");
const floorHref = await page.getByRole("link", { name: "Not now" }).getAttribute("href");
ok("Take the floor skips the unit intro for an 'often' speaker", floorHref.startsWith("/rep"), floorHref);
/* Nothing here is a gate: the decline is a plain link to the floor, which
   is what keeps /about's "no signup until you've spoken" true. */
ok("Not now is a real door, not a dismissal", floorHref === (await page.getByRole("link", { name: "Not now" }).getAttribute("href")));

// 8. Home: the day-one note repeats the answer.
await page.getByRole("link", { name: "Not now" }).click();
await page.waitForURL(/\/rep/);
await page.goto(`${BASE}/`);
await page.getByText("Day one starts today.").waitFor();
/* Since 26 Sep the day-one card is a headline and a tap: the note that
   repeated the answers went with "reduce text" (Timothy's call). */
ok("the day-one card is a headline and a tap", (await page.getByText("The baseline sets the number to beat.").count()) === 0);
await shot("11-home");
// The lesson list marks the unit their answers chose. It moved off
// Today with the road (#267): the five traits are there now, and the
// whole set is a page of its own.
await page.goto(`${BASE}/lessons`);
/* The mark is set in an effect after mount; `isVisible()` read before
   it landed, which is the whole reason this check was red since before
   #284 (#294). Waiting is the check. */
const marked = await page
  .getByText("You said rushing")
  .waitFor({ timeout: 5000 })
  .then(() => true)
  .catch(() => false);
ok("the lesson list marks the unit for what they said, in their words", marked);
await shot("11b-lessons");
await page.goto(`${BASE}/`);
/* The second visit to Today recompiles on a shared dev server more
   often than not (B1's report), so it gets a longer wait. */
await page.getByText("Day one starts today.").waitFor({ timeout: 60000 });
// The roulette pool: under 18 never draws a job prompt.
await page.getByRole("button", { name: /Spin a new topic/ }).click();
const drawn = new Set();
for (let i = 0; i < 25; i++) { drawn.add(await page.$eval("main .font-display.text-title", (e) => e.textContent.trim())); await page.getByRole("button", { name: "Spin" }).click(); await sleep(560); }
const job = [...drawn].some((t) => /worst job|Explain your work|job you're not qualified/.test(t));
ok("the roulette never draws a job prompt for an under-18", !job, `${drawn.size} distinct`);

// 9. /you: the plan row, and reopening the plan to change an answer.
await page.goto(`${BASE}/you`);
await page.getByText("Your plan").waitFor();
ok(
  "/you shows the plan row with the unit and its gate",
  await page.getByText(/^Pace Control (opens in \d+ stars?|is open)$/).isVisible()
);
await shot("12-you");
await page.getByRole("link", { name: /Your plan/ }).click();
await page.waitForURL(/step=plan/);
await page.getByText("Hold the room.").waitFor();
ok("the plan row reopens the plan with a Done exit", await page.getByRole("link", { name: "Done" }).isVisible());
await page.getByRole("button", { name: "Back", exact: true }).click();
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
const stillHeld = await swipe(200, { hold: true });
ok("under reduced motion a drag does not move the screen", !stillHeld, String(stillHeld));
ok("but the swipe still steps", (await heading()) === "When do you want your minute?");

await page.close(); await context.close(); await browser.close();
writeFileSync(OUT + "findings.json", JSON.stringify(findings, null, 2));
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
