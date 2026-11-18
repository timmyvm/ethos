/**
 * The introduction, walked in a real browser (DECISIONS #232, #233,
 * #249, #475, #501): the room's door and its Not now (the scene itself is
 * scripts/check-room.mjs), then the five questions, one typed answer and
 * four tapped ones, each with Demos's guide line where it has one,
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
import { session } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
/* CHECK_OUT: somewhere outside the repo when the app is `next dev`, whose
   watcher rebuilds on every frame of a video written into the repo and
   serves a cut-off chunk meanwhile (scripts/check-motion.mjs). */
const OUT = `${(process.env.CHECK_OUT ?? new URL("../docs/devibe/motion-check/", import.meta.url).pathname).replace(/\/?$/, "/")}onboarding/`;
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
/*
 * The walk's sound (#501): every oscillator the page makes is counted,
 * so the gate can say a word blipped, a pick clicked, reduced motion
 * blipped once a line, and Sound off made none.
 */
await context.addInitScript(() => {
  window.__osc = 0;
  const AC = window.AudioContext;
  if (AC) {
    const make = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      window.__osc += 1;
      return make.call(this);
    };
  }
});
const osc = () => page.evaluate(() => window.__osc);
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
/* Says gives assistive tech each line once, whole, in a `.sr-only` copy
   beside the aria-hidden word spans (intro-a-25), so the heading is read
   from that copy when there is one. */
const heading = async () =>
  (await page.$eval("main h1", (h) => (h.querySelector(".sr-only") ?? h).textContent)).trim();
/* A line Demos says, found once: in the `.sr-only` copy Says keeps for
   screen readers, or, for a reply, in the bubble's live region (the
   visible reply is aria-hidden). A bare getByText would meet the copy
   AND the word spans, two elements, and strict mode refuses that. */
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const said = (t) => page.locator("main .sr-only", { hasText: new RegExp(`^${esc(t)}$`) });
/* The bubble's live region: what a screen reader hears when he replies. */
const announced = () => page.$eval('main p.sr-only[aria-live="polite"]', (el) => el.textContent.trim());
/* Where the one tap stands, per screen: the walk docks it in one shelf,
   so it must read the same on every question and the plan. */
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

// 1. A fresh browser lands on the introduction, which opens on the
// room (#475): the scene behind frosted glass, one hold, and the doors.
await page.goto(`${BASE}/`);
await page.waitForURL(/\/welcome/);
await page.waitForSelector("[data-room-hold]");
ok("a fresh browser is routed to the introduction, and it opens on the room", true);
ok(
  "the room's door is one hold, with Not now under it",
  (await page.locator("[data-room-hold]", { hasText: "Hold to step in" }).count()) === 1 &&
    (await page.getByRole("button", { name: "Not now" }).count()) === 1
);
ok(
  "and the doors the first screen always had: sign in, and the tester's",
  (await page.getByRole("link", { name: "Sign in" }).getAttribute("href")) === "/signin" &&
    (await page.getByRole("link", { name: "Tester code" }).getAttribute("href")) === "/tester?from=welcome"
);
await shot("01-room-door");

// 1a. A short phone (375x667, the review of the swipe-and-pop round):
// the one tap and the door under it stay above the fold.
// The resize waits out the push from / to /welcome: its 24px start lays
// the document out 414px wide for about 350ms (PageTransition, B10), and
// a mobile resize inside that keeps the page zoomed to 1.06 for the rest
// of the walk, where the age question's Next is then hit under the
// shelf (regression review, gates P1).
await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 5000 }).catch(() => {});
await page.setViewportSize({ width: 375, height: 667 });
await sleep(400);
const fold = await page.evaluate(() => {
  const bottom = (el) => (el ? Math.round(el.getBoundingClientRect().bottom) : 9999);
  const hold = document.querySelector("[data-room-hold]");
  const notNow = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Not now");
  return { hold: bottom(hold), notNow: bottom(notNow) };
});
ok("on a 667px phone the hold and Not now are above the fold", fold.hold <= 667 && fold.notNow <= 667, JSON.stringify(fold));
await page.setViewportSize({ width: 390, height: 844 });
await sleep(300);
// And whatever the resize did to the page's scale is undone, so the walk
// below is at 1, as a phone held still is.
await cdp.send("Emulation.resetPageScaleFactor");
ok(
  "after the fold check the walk is at a scale of 1",
  (await page.evaluate(() => window.visualViewport?.scale ?? 1)) === 1,
  String(await page.evaluate(() => window.visualViewport?.scale))
);

// 1b. Not now goes straight to the questions (on a train, in a library).
const osc0 = await osc();
await page.getByRole("button", { name: "Not now" }).click();
await said("What do I call you?").waitFor();
ok("Not now goes straight to the questions, the name first", true);
/* #501: his line lands a word at a time while he talks, with a blip
   under each word, unlocked by the tap that brought him. */
const talking = await page.waitForFunction(() => !!document.querySelector("main [data-talking]"), null, { timeout: 1500 }).then(() => true, () => false);
ok("Demos talks while his line lands (#501)", talking);
const partway = await page.evaluate(() => {
  const w = [...document.querySelectorAll("main .talk-word")];
  return { on: w.filter((x) => x.hasAttribute("data-on")).length, all: w.length };
});
ok("his words land one at a time, not all at once", partway.on < partway.all, JSON.stringify(partway));
await page.waitForFunction(() => !document.querySelector("main [data-talking]"), null, { timeout: 4000 }).catch(() => {});
const blips = (await osc()) - osc0;
const said1 = await page.$$eval("main .talk-word", (w) => w.length);
ok("a blip under every word he says (#501)", blips >= said1, `${blips} blips for ${said1} words`);

// 2. Question 1: the name. The one answer you type, and the one he
// repeats straight back.
await said("What do I call you?").waitFor();
await nextTop("q1");
const at = async () => page.getByRole("progressbar").getAttribute("aria-valuenow");
ok("the walk opens on the name, the first of seven steps", (await at()) === "1");
ok("and Demos says the shape of the walk (#501)", await said("I'm Demos. A few quick questions, then you speak.").isVisible());
ok(
  "every question holds Next until answered, the name included (#288)",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === true
);
await swipe(-220);
ok("and a swipe past an unanswered question rubber-bands", (await heading()) === "What do I call you?");
const fieldBox = await page.getByLabel("Your name").boundingBox();
await swipe(-220, { y: fieldBox.y + fieldBox.height / 2 });
ok("a drag that starts in the name field is the field's", (await heading()) === "What do I call you?");
{
  /* #501 review: typed, his reply follows every key whole and silent.
     Re-said per key, it blanked to its first words and blipped under
     each letter. */
  await page.getByLabel("Your name").click();
  await sleep(200);
  const before = await osc();
  const whole = [];
  for (const ch of "Tim") {
    await page.keyboard.type(ch);
    await sleep(90);
    whole.push(
      await page.evaluate(() => {
        const w = [...document.querySelectorAll("main [data-speech] .talk-word")];
        /* There, and still: re-popped per key, the words shrank under the typing. */
        return w.length > 0 && w.every((x) => x.hasAttribute("data-on") && getComputedStyle(x).animationName === "none");
      })
    );
  }
  const typed = (await osc()) - before;
  ok("typing the name, his reply is whole and still at every key, with no blip per key", whole.every(Boolean) && typed === 0, `${whole.join(",")} / ${typed} blips`);
}
await page.getByLabel("Your name").fill("Tim");
await page.getByLabel("Your name").blur();
await sleep(350);
ok(
  "and Next lights when the name lands",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === false
);
ok(
  "Demos says the name back",
  await page.locator('main p[aria-hidden="true"]', { hasText: "Good to meet you, Tim." }).isVisible()
);
/* intro-a-4: the name is announced once it settles (the blur above),
   never per keystroke. */
ok("and a screen reader hears it once the name settles", (await announced()) === "Good to meet you, Tim.", await announced());
const nodded = await page.$eval("main img.demos", (el) => el.parentElement.className);
ok("and he nods when he hears it", /demos-nod/.test(nodded), nodded);
await shot("04-q-name");

// 2a. The walk is a carousel (the swipe-and-pop round), from the name on.
const held = await swipe(-60, { hold: true });
ok("the screen follows the finger", /translate3d\(-?\d/.test(held ?? "") && held !== "translate3d(0px, 0px, 0px)", held);
ok("a short drag springs back", (await heading()) === "What do I call you?");
await swipe(-200);
ok("swipe left goes forward", (await heading()) === "How old are you?");
ok("and the next screen arrives from the right", (await arrival()) === "next");
const landed = await page.$eval("main [class*='step-in-']", (el) => ({
  arrival: el.dataset.arrival ?? null,
  delay: getComputedStyle(el.querySelector(".says-word")).animationDelay,
}));
ok("a swiped page brings its words with it", landed.arrival === "gesture" && landed.delay === "0s", JSON.stringify(landed));
await swipe(200);
ok("swipe right goes back", (await heading()) === "What do I call you?");
ok("and the screen before arrives from the left", (await arrival()) === "back");
await swipe(8, { dy: -220, y: 640 });
ok("a vertical drag is left to the page", (await heading()) === "What do I call you?");
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press("ArrowRight");
await sleep(400);
ok("the right arrow key steps forward", (await heading()) === "How old are you?");
await page.keyboard.press("ArrowLeft");
await sleep(400);
ok("and the left arrow steps back", (await heading()) === "What do I call you?");
// Back from the name is the room it came from (#475), and Not now again
// is the name, its answer kept.
await swipe(200);
ok("a swipe back from the name is the room's door", await page.locator("[data-room-hold]").isVisible().catch(() => false));
await page.getByRole("button", { name: "Not now" }).click();
await said("Good to meet you, Tim.").waitFor().catch(() => {});
ok("and Not now again is the name, as it was left", (await heading()) === "What do I call you?" && (await page.getByLabel("Your name").inputValue()) === "Tim");

await swipe(-220);
ok("an answered question swipes forward like Next", (await heading()) === "How old are you?");
// intro-a-2: the keyboard's own Next key, on the name, is the screen's Next.
await page.getByRole("button", { name: "Back", exact: true }).click();
await said("What do I call you?").waitFor();
await page.getByLabel("Your name").press("Enter");
await sleep(400);
ok("the keyboard's Next key on the name goes forward", (await heading()) === "How old are you?");
ok(
  "a step not made by a swipe keeps the said-then-moves order",
  (await page.$eval("main [class*='step-in-']", (el) => el.dataset.arrival ?? null)) === null
);
const rowBox = await page.getByRole("radio", { name: "25 to 34" }).boundingBox();
await swipe(-80, { y: rowBox.y + rowBox.height / 2 });
ok(
  "a drag across an answer does not pick it",
  (await page.getByRole("radio", { name: "25 to 34" }).getAttribute("aria-checked")) === "false"
);

// 3. Question 2: age. Next waits for an answer; Skip is beside the bar.
await said("How old are you?").waitFor();
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
{
  /* A pick clicks (#501): two notes, before his reply's blips. */
  const before = await osc();
  await page.getByRole("radio", { name: "18 to 24" }).click();
  await sleep(40);
  ok("a picked answer clicks", (await osc()) - before >= 2, String((await osc()) - before));
  await page.getByRole("radio", { name: "Under 18" }).click();
  await sleep(300);
}
{
  /* A tap anywhere finishes his line at once (#501). */
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await said("What do I call you?").waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await sleep(260);
  const mid = await page.evaluate(() => [...document.querySelectorAll("main .talk-word")].filter((x) => !x.hasAttribute("data-on")).length);
  await page.mouse.click(200, 640);
  await sleep(40);
  const left = await page.evaluate(() => [...document.querySelectorAll("main .talk-word")].filter((x) => !x.hasAttribute("data-on")).length);
  ok("a tap anywhere finishes his line at once (#501)", left === 0, `${mid} words to come, then ${left}`);
}
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
  await said("Your prompts will come from school and life.").isVisible()
);
/* intro-b-6, intro-a-25: in the accessibility tree the question stays the
   heading and the reply is read once (the live region), never twice and
   never a word at a time. */
const tree = await page.locator("main").ariaSnapshot();
const replyTimes = tree.split("Your prompts will come from school and life.").length - 1;
ok(
  "a screen reader hears the question as the heading and the reply once",
  /heading "How old are you\?" \[level=1\]/.test(tree) && replyTimes === 1 &&
    (await announced()) === "Your prompts will come from school and life.",
  `${replyTimes}x reply; ${tree.split("\n").filter((l) => /heading|prompts/.test(l)).join(" | ")}`
);
await page.getByRole("button", { name: "Next", exact: true }).click();
await sleep(300);

// 4. Question 3: what you notice, up to three, and he answers the one
// just tapped. The goal that stood here went with #501 (Jonathan: "we
// just want to get better at it"); its line says Skip is fine here.
await said("What do you notice when you talk?").waitFor();
ok("the question that asks you to know yourself says Skip is fine (#501)", await said("Pick up to three, or Skip if you're not sure.").isVisible());
await nextTop("q3");
for (const n of ["I rush", "Um, like, you know", "I freeze on the spot"]) {
  await page.getByRole("checkbox", { name: n }).click();
  await sleep(200);
}
/* Waited for rather than read at once: a tap on a busy dev server can
   take longer than the sleep to render. */
ok(
  "he replies about the pain just tapped, not the first one",
  await said("I'll count where you pause.")
    .waitFor({ timeout: 3000 })
    .then(() => true)
    .catch(() => false)
);
const fourth = await page.getByRole("checkbox", { name: "I ramble" }).isDisabled();
ok("a fourth pain is refused", fourth === true);
await shot("07-q-pains");
// Refresh in the middle: it resumes here with the answers kept.
await page.reload();
await said("What do you notice when you talk?").waitFor({ timeout: 5000 });
ok("a refresh resumes on the same question", true);
ok("the answers survived the refresh", (await page.getByRole("checkbox", { name: "I rush" }).getAttribute("aria-checked")) === "true");
// Back goes to age, with the answer still there.
await page.getByRole("button", { name: "Back", exact: true }).click();
await said("How old are you?").waitFor();
ok("back returns to the previous question with its answer", (await page.getByRole("radio", { name: "Under 18" }).getAttribute("aria-checked")) === "true");
await page.getByRole("button", { name: "Next", exact: true }).click();
await said("What do you notice when you talk?").waitFor();
await page.getByRole("button", { name: "Next", exact: true }).click();

// 5. Question 4: level, which moves two real settings and says which.
await said("How much have you practised?").waitFor();
await nextTop("q4");
await page.getByRole("radio", { name: "Often, I present most weeks" }).click();
await sleep(250);
ok(
  "the level names the setting it just changed",
  await said("Units skip the teaching. You start on the floor.").isVisible()
);
await shot("08-q-level");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 6. Question 5, the last: the hour. The place and the beat that stood
// before it went with #501; the beat's line is the hour's own now.
await said("When do you want your minute?").waitFor();
await nextTop("q5");
ok("the beat's line is the hour's (#501)", await said("It takes 60 seconds. Pick an hour you'd keep.").isVisible());
ok("there is no question about the place, nor a beat, any more", (await page.getByText("Where does it matter most?").count()) === 0 && (await page.getByText("Practice with a set time gets done.").count()) === 0);
ok("the bar stands at 5 of 7", (await at()) === "5");
ok(
  "an unanswered question holds Next, and Skip is the way past (#288)",
  (await page.getByRole("button", { name: "Next", exact: true }).isDisabled()) === true
);
await page.getByRole("button", { name: "Skip", exact: true }).click();
await said("Tim, you said rushing. Now it's a number.").waitFor();
ok("Skip on the last question is the plan", true);
await page.getByRole("button", { name: "Back", exact: true }).click();
await said("When do you want your minute?").waitFor();
// A short phone: the hour's five rows and its Next still stand on the screen.
await page.setViewportSize({ width: 375, height: 667 });
await sleep(400);
const hourFold = await page.evaluate(() => {
  const next = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Next");
  return { next: next ? Math.round(next.getBoundingClientRect().bottom) : 9999 };
});
ok("on a 667px phone the hour's Next is above the fold", hourFold.next <= 667, JSON.stringify(hourFold));
await page.setViewportSize({ width: 390, height: 844 });
await sleep(300);
await cdp.send("Emulation.resetPageScaleFactor");
/* The hour is said the device's way after mount (intro-b-19), so the
   row is found by its word. */
await page.getByRole("radio", { name: /^Evening/ }).click();
await sleep(250);
ok("an answer that changes nothing he says gets a nod and the question stays", await said("When do you want your minute?").isVisible());
const hour = await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.prefs") || "{}").reminderHour);
ok("picking an hour writes it straight to prefs", hour === 18, String(hour));
ok(
  "and the introduction never asks for notification permission",
  (await page.evaluate(() => window.__askedPermission)) === false
);
await shot("09-q-time");
await page.getByRole("button", { name: "Next", exact: true }).click();

// 9. The plan, from the answers, opening in their name and their words,
// and saying what Next does (#501).
await said("Tim, you said rushing. Now it's a number.").waitFor();
await nextTop("plan");
ok("the plan opens on his line to them, by name", true);
ok("and says what comes next", await said("Save it next, then you speak for 60 seconds.").isVisible());
ok("the bar runs on to the plan: 6 of 7", (await at()) === "6");
/* Each step is a lead and a detail (intro-b-12). */
const steps = await page.$$eval("main ol li", (els) =>
  els.map((e) => [...e.querySelectorAll(":scope > span:last-child > span")].map((s) => s.textContent.trim()))
);
ok(
  "step 2 names the first pain's number",
  steps[1]?.[0] === "First number" && steps[1]?.[1] === "Your words a minute against the 130 to 160 zone.",
  JSON.stringify(steps[1])
);
ok(
  "step 3 names the unit and where it stands on the road (#490: no count of stars)",
  steps[2]?.[0] === "Then Pace control" && /^Unit \d+ of \d+, the one for rushing\.$/.test(steps[2]?.[1] ?? ""),
  JSON.stringify(steps[2])
);
const numbersSet = await page.$$eval("main ol li span.tabular-nums.font-display", (els) => els.map((e) => e.textContent));
ok("the plan's numbers are set as numbers", numbersSet.includes("130 to 160") && numbersSet.includes("60"), numbersSet.join(","));
const shelf = Object.values(tops);
ok("Next stands at one height on every question and the plan", shelf.length === 6 && shelf.every((y) => y !== null && y === shelf[0]), JSON.stringify(tops));
const laddered = await page.$eval("main ol", (el) => el.className);
ok("the plan's lines land one at a time", /stagger/.test(laddered), laddered);
ok("no boss in the fine print: the goal that picked one is not asked (#501)", (await page.getByText(/Your boss/).count()) === 0);
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
/* An account comes before the first recording (#410): no decline, and
   the email door carries the floor as where to come back to. */
ok("there is no Not now: the account comes first", (await page.getByRole("link", { name: "Not now" }).count()) === 0);
const emailHref = await page.getByRole("link", { name: /Use an email instead/ }).getAttribute("href");
const floorHref = new URL(emailHref, BASE).searchParams.get("next") ?? "";
ok("Take the floor skips the unit intro for an 'often' speaker", floorHref.startsWith("/rep"), floorHref);

// 7b. Without an account, the app sends them to sign up and back.
await page.goto(`${BASE}/`);
const sentToSignup = await page.waitForURL(/\/signup\?next=/, { timeout: 15000 }).then(() => true).catch(() => false);
ok("a device without an account opening Today is sent to sign up, then back", sentToSignup && new URL(page.url()).searchParams.get("next") === "/", page.url());

// 8. Home, once the account exists: the day-one note repeats the answer.
await page.evaluate((s) => {
  localStorage.setItem("sb-supabase-auth-token", JSON.stringify(s));
  localStorage.setItem("sb-supabase.local-auth-token", JSON.stringify(s));
}, session);
await page.goto(`${BASE}${floorHref}`);
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
// The roulette pool: under 18 never draws a job prompt. Since #393's fix
// round the roulette spins inside Today's card: the prompt is the card's
// reel and Spin again is its shuffle glyph.
await page.getByRole("button", { name: /Spin a new topic/ }).click();
const drawn = new Set();
for (let i = 0; i < 25; i++) { drawn.add(await page.$eval("main .home-reel", (e) => e.textContent.trim())); await page.getByRole("button", { name: "Spin again" }).click(); await sleep(560); }
const job = [...drawn].some((t) => /worst job|Explain your work|job you're not qualified/.test(t));
ok("the roulette never draws a job prompt for an under-18", !job, `${drawn.size} distinct`);

// 9. /you: the plan row, and reopening the plan to change an answer.
await page.goto(`${BASE}/you`);
await page.getByText("The road", { exact: true }).waitFor();
/* The caption names the trait as Lessons heads its section (#493: it
   named the road's unit, "Pace Control", which no tab lists), and no
   count of stars to its gate: that total left every screen in #486. */
ok(
  "/you shows the road card with the trait Lessons names",
  await page
    .getByRole("link", { name: /The road/ })
    .getByText(/^Pace$/)
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false)
);
await shot("12-you");
await page.getByRole("link", { name: /The road/ }).click();
await page.waitForURL(/step=plan/);
await said("Tim, you said rushing. Now it's a number.").waitFor();
ok("the plan row reopens the plan with a Done exit", await page.getByRole("link", { name: "Done" }).isVisible());
await page.getByRole("button", { name: "Back", exact: true }).click();
await said("When do you want your minute?").waitFor();
ok("back from the plan reaches the last question", true);

// 10. Reduced motion stills every loop.
await page.evaluate(() => localStorage.setItem("ethos.prefs", JSON.stringify({ reducedMotion: true })));
await page.goto(`${BASE}/welcome?step=plan`);
await said("Tim, you said rushing. Now it's a number.").waitFor();
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
{
  /* Under reduced motion his line lands whole, and its sound with it:
     one blip, not one a word (#501). A tap first, to unlock the sound. */
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await said("How much have you practised?").waitFor();
  await sleep(500);
  const before = await osc();
  const words = await page.$$eval("main .talk-word", (w) => ({ all: w.length, on: w.filter((x) => x.hasAttribute("data-on")).length }));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await said("What do you notice when you talk?").waitFor();
  await sleep(600);
  ok("under reduced motion every word is there at once", words.on === words.all, JSON.stringify(words));
  ok("and the line sounds once", (await osc()) - before === 1, String((await osc()) - before));
}
{
  /* Sound off in Settings: not one blip, not one click (#501). */
  await page.evaluate(() => localStorage.setItem("ethos.prefs", JSON.stringify({ sound: false })));
  await page.goto(`${BASE}/welcome?step=ageBand`);
  await said("How old are you?").waitFor();
  const before = await osc();
  await page.getByRole("radio", { name: "25 to 34" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await said("What do you notice when you talk?").waitFor();
  await sleep(1500);
  ok("with Sound off the walk makes no sound", (await osc()) - before === 0, String((await osc()) - before));
}

await page.close(); await context.close(); await browser.close();
writeFileSync(OUT + "findings.json", JSON.stringify(findings, null, 2));
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
process.exit(failed ? 1 : 0);
