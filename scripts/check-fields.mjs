/**
 * Typing, and the settings a phone can keep, in a real browser (#441, #446).
 *
 *   1. The keyboard never covers the one tap. On an iPhone the keyboard
 *      lies over the page: the layout keeps its height and only the
 *      visual viewport shrinks, so the name question's Next stood at the
 *      foot of the page, under the keys. It follows the field now.
 *   2. A field is set up for what goes in it: a name is capitalised and
 *      never corrected, a search's Return puts the keyboard away.
 *   3. A setting shows the value it holds. The reminder's hour is a Time
 *      row over the phone's own picker with every hour the results
 *      glance offers, so an hour chosen there is the hour shown here.
 *   4. No row for what this phone cannot do: no Haptics switch without a
 *      vibration to ask for, no camera bench where no take is Video.
 *   5. Privacy and Terms are a tap from both account asks, and their
 *      back is the ask that was left.
 *
 * The keyboard is stood in for: the visual viewport's height is replaced
 * and its resize event sent, which is all the page ever hears of one.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-fields.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" };
const noOverlay = () => {
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

/** A browser nobody has used: the introduction's walk. */
async function fresh({ width = 390, height = 844 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", (r) =>
    r.fulfill({ status: r.request().method() === "OPTIONS" ? 204 : 200, headers: cors, body: "[]" })
  );
  await context.addInitScript(noOverlay);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { context, page, errors };
}

/** The fixture's account, with what this phone is and what it kept. */
async function account({ prefs = {}, iphone = false, vibrate = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
    ...(iphone ? { userAgent: IPHONE } : {}),
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme: "light", session });
  await context.addInitScript(noOverlay);
  await context.addInitScript(({ prefs, vibrate }) => {
    const kept = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
    localStorage.setItem("ethos.prefs", JSON.stringify({ ...kept, ...prefs }));
    if (!vibrate) {
      try {
        delete Navigator.prototype.vibrate;
      } catch {}
    }
  }, { prefs, vibrate });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { context, page, errors };
}

const settle = async (page) => {
  await page.waitForSelector("main");
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(600);
};

/** The keyboard comes up `px` tall, or goes away (0): only the visual viewport hears. */
const keyboard = (page, px) =>
  page.evaluate((px) => {
    const vv = window.visualViewport;
    const h = window.innerHeight - px;
    Object.defineProperty(vv, "height", { configurable: true, get: () => h });
    vv.dispatchEvent(new Event("resize"));
  }, px);

// ---- 1. the name question, with the keyboard up ------------------------------
for (const [name, width, height, kbd] of [["390x844", 390, 844, 336], ["375x667", 375, 667, 260]]) {
  const { context, page, errors } = await fresh({ width, height });
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/welcome/);
  await sleep(900);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await sleep(450);
  }
  const field = page.getByLabel("Your name");
  await field.waitFor();
  await sleep(500);
  const where = () =>
    page.evaluate(() => {
      const next = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Next");
      const f = document.querySelector('main input[name="given-name"]');
      const shelf = next.closest("[data-footer-shelf]");
      return {
        field: Math.round(f.getBoundingClientRect().bottom),
        top: Math.round(next.getBoundingClientRect().top),
        bottom: Math.round(next.getBoundingClientRect().bottom),
        // A rule is a width and a colour: none of the first, or none of the second.
        rule: shelf
          ? parseFloat(getComputedStyle(shelf).borderTopWidth) === 0 || /, 0\)$|transparent/.test(getComputedStyle(shelf).borderTopColor)
            ? "none"
            : getComputedStyle(shelf).borderTopColor
          : null,
      };
    });
  const rest = await where();
  ok(`${name}: with no keyboard, Next stands at the foot of the screen`, rest.bottom > height - 80, JSON.stringify(rest));
  await keyboard(page, kbd);
  await field.fill("Tim");
  await sleep(500);
  const up = await where();
  const visible = height - kbd;
  ok(`${name}: with the keyboard up, Next is above the keys`, up.bottom <= visible, `Next ends at ${up.bottom}, the keys start at ${visible}`);
  ok(`${name}: and it follows the field, one reach`, up.top - up.field >= 16 && up.top - up.field <= 56, `${up.top - up.field}px under the field`);
  ok(`${name}: following the field, the shelf draws no rule between them`, up.rule === "none" && rest.rule !== "none", `${rest.rule} at rest, ${up.rule} following`);
  await keyboard(page, 0);
  await sleep(400);
  const down = await where();
  ok(`${name}: the keyboard gone, Next is back where it stood`, down.top === rest.top, `${rest.top} → ${down.top}`);
  if (name === "390x844") {
    const attrs = await field.evaluate((el) => ({
      autocorrect: el.getAttribute("autocorrect"), autocapitalize: el.getAttribute("autocapitalize"),
      autocomplete: el.getAttribute("autocomplete"), hint: el.getAttribute("enterkeyhint"),
    }));
    ok("the name is capitalised, never corrected, and its Return is Next", attrs.autocorrect === "off" && attrs.autocapitalize === "words" && attrs.autocomplete === "given-name" && attrs.hint === "next", JSON.stringify(attrs));
  }
  ok(`${name}: the walk threw nothing`, errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 3. the reminder's hour is the hour shown --------------------------------
{
  const { context, page, errors } = await account({ prefs: { reminderHour: 9 } });
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const picker = page.locator("main select[data-reminder-hour]");
  const row = async () =>
    page.evaluate(() => {
      const s = document.querySelector("main select[data-reminder-hour]");
      const r = s?.closest(".group-row");
      return s && r
        ? {
            value: s.value,
            shown: r.textContent.replace(s.textContent, "").replace(/\s+/g, " ").trim(),
            options: [...s.options].map((o) => Number(o.value)),
            name: s.getAttribute("aria-label"),
            h: Math.round(r.getBoundingClientRect().height),
            covers: Math.round(s.getBoundingClientRect().height) === Math.round(r.getBoundingClientRect().height),
            font: parseFloat(getComputedStyle(s).fontSize),
          }
        : null;
    });
  let r = await row();
  ok("an hour chosen on the glance (9 am) is the hour Settings shows", !!r && r.value === "9" && /Time\s*9 am/i.test(r.shown), JSON.stringify(r && { value: r.value, shown: r.shown }));
  ok("the picker offers every hour outside quiet hours, the glance's own list", !!r && r.options.join() === [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].join(), r?.options.join());
  ok("the whole row is the picker: 44pt or more, named, and no zoom on focus", !!r && r.h >= 44 && r.covers && r.name === "Reminder time" && r.font >= 16, JSON.stringify(r && { h: r.h, covers: r.covers, name: r.name, font: r.font }));
  ok("the six-hour grid is gone", (await page.locator('main [role="radiogroup"][aria-label="Reminder hour"]').count()) === 0);
  await picker.selectOption("18");
  await sleep(400);
  r = await row();
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}").reminderHour);
  ok("choosing an hour keeps it and shows it", kept === 18 && !!r && /Time\s*6 pm/i.test(r.shown), `${kept}, ${r?.shown}`);
  await page.getByRole("switch", { name: "Daily reminder" }).click();
  await sleep(300);
  ok("switched off, the Time row goes with it", (await picker.count()) === 0);
  ok("Settings threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}
{
  // An hour kept from before quiet hours covered it is still the hour shown.
  const { context, page } = await account({ prefs: { reminderHour: 23 } });
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const r = await page.evaluate(() => {
    const s = document.querySelector("main select[data-reminder-hour]");
    return s ? { value: s.value, options: [...s.options].map((o) => Number(o.value)) } : null;
  });
  ok("an hour inside quiet hours, kept from before, is listed and shown", !!r && r.value === "23" && r.options.includes(23) && r.options.length === 16, JSON.stringify(r));
  await context.close();
}

// ---- 4. no row for what this phone cannot do ---------------------------------
for (const [name, opts, want] of [
  ["a phone that vibrates and takes Video", { vibrate: true }, { haptics: true, bench: true, head: "Sound and haptics" }],
  ["an iPhone", { vibrate: false, iphone: true }, { haptics: false, bench: false, head: "Sound" }],
]) {
  const { context, page } = await account(opts);
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const got = await page.evaluate(() => ({
    haptics: [...document.querySelectorAll('main [role="switch"]')].some((s) => /^Haptics/.test(s.textContent.trim())),
    bench: !!document.querySelector('main a[href="/calibrate"]'),
    head: [...document.querySelectorAll("main .group-head")].map((h) => h.textContent.trim()).find((t) => /^Sound/.test(t)) ?? null,
  }));
  ok(`${name}: Haptics ${want.haptics ? "shown" : "not offered"}, the camera bench ${want.bench ? "shown" : "not offered"}`, got.haptics === want.haptics && got.bench === want.bench && got.head === want.head, JSON.stringify(got));
  await context.close();
}

// ---- 2. the other fields ------------------------------------------------------
{
  const { context, page } = await account();
  await page.goto(`${BASE}/you`);
  await settle(page);
  const edit = page.getByRole("button", { name: /edit.*name|change.*name|name/i }).first();
  if (await edit.count()) {
    await edit.click().catch(() => {});
    await sleep(400);
  }
  const name = page.locator('main input[name="displayName"]');
  if (await name.count()) {
    const attrs = await name.evaluate((el) => ({ autocorrect: el.getAttribute("autocorrect"), autocapitalize: el.getAttribute("autocapitalize") }));
    ok("You: the display name is capitalised and never corrected", attrs.autocorrect === "off" && attrs.autocapitalize === "words", JSON.stringify(attrs));
  } else ok("You: the display name's field opens", false, "no field found");

  await page.goto(`${BASE}/boss`);
  await settle(page);
  const search = page.locator("#boss-search");
  if (await search.count()) {
    await search.fill("clim");
    await search.press("Enter");
    await sleep(200);
    const still = await page.evaluate(() => document.activeElement?.id === "boss-search");
    ok("Boss: the keyboard's Search key puts the keyboard away, and the search stands", !still && (await search.inputValue()) === "clim");
  } else console.log("SKIP  Boss search (not offered to this fixture's plan)");
  await context.close();
}

// ---- 5. Privacy and Terms, from both account asks -----------------------------
{
  const { context, page, errors } = await fresh();
  await page.goto(`${BASE}/signup?next=%2Fshop`);
  await page.getByRole("link", { name: "Privacy" }).waitFor({ timeout: 20000 });
  await sleep(600);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("main a")]
      .filter((a) => /^(Privacy|Terms)$/.test(a.textContent.trim()))
      .map((a) => {
        const after = getComputedStyle(a, "::after");
        const r = a.getBoundingClientRect();
        return { text: a.textContent.trim(), href: a.getAttribute("href"), h: Math.round(Math.max(r.height, parseFloat(after.height) || 0)) };
      })
  );
  ok(
    "/signup links Privacy and Terms, each a 44pt reach, carrying the form's way back",
    links.length === 2 && links.every((l) => l.h >= 44) && links[0].href === "/privacy?from=signup&next=%2Fshop" && links[1].href === "/terms?from=signup&next=%2Fshop",
    JSON.stringify(links)
  );
  await page.getByRole("link", { name: "Privacy" }).click();
  await page.waitForURL(/\/privacy/);
  await sleep(700);
  const back = page.locator("main .screen-bar-back").first();
  const said = await back.evaluate((a) => ({ href: a.getAttribute("href"), word: a.textContent.trim(), hidden: a.querySelector("span")?.className ?? "" }));
  ok("Privacy's back is the form, a chevron with no word", said.href === "/signup?next=%2Fshop" && said.word === "Back" && /sr-only/.test(said.hidden), JSON.stringify(said));
  await back.click();
  await page.waitForURL(/\/signup/, { timeout: 8000 }).catch(() => {});
  ok("and it lands on the form, its way on intact", page.url().endsWith("/signup?next=%2Fshop"), page.url());

  await page.goto(`${BASE}/terms?from=welcome`);
  await sleep(900);
  const walk = await page.locator("main .screen-bar-back").first().evaluate((a) => a.getAttribute("href"));
  ok("from the introduction's ask, back is the introduction", walk === "/welcome", String(walk));
  await page.goto(`${BASE}/privacy`);
  await sleep(900);
  const stranger = await page.locator("main .screen-bar-back").first().evaluate((a) => ({ href: a.getAttribute("href"), word: a.textContent.trim() }));
  ok("a stranger's back is still the landing page", stranger.href === "/about" && stranger.word === "Ethos", JSON.stringify(stranger));
  ok("the account screens threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
