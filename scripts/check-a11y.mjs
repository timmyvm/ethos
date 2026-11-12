/**
 * What a screen reader, a voice and a high-contrast setting get (#448).
 *
 * Read from the accessibility tree and computed style of a real browser:
 *
 *   1. A result that lands is announced: the focus goes to the results'
 *      name, and the name carries the score.
 *   2. Record is named by the word on it, so "Tap Record" finds it; Stop's
 *      name starts with the word shown.
 *   3. A change is "Up 3" or "Down 3", never the triangle's own name.
 *   4. A swap says which half is which: "Instead of … say …".
 *   5. A Log row says every number it shows.
 *   6. A badge says whether it is earned.
 *   7. Increase Contrast makes every hairline and caption firmer, in
 *      both themes.
 *   8. The transcript's three marks are three shapes (#453): a bar, a
 *      wave and a row of dots, in the words and in the key, so none is
 *      told from another by its colour alone.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-a11y.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { analyzeBody, json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
async function open(theme = "light") {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    permissions: ["microphone"], locale: "en-AU", timezoneId: "Australia/Melbourne",
    colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.route("**/api/analyze", async (route) => {
    await sleep(500);
    return route.fulfill(json(analyzeBody));
  });
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
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
/** What assistive tech is given for an element: its text without anything aria-hidden. */
const heard = (el) => {
  const walk = (n) => {
    if (n.nodeType === 3) return n.nodeValue ?? "";
    if (n.nodeType !== 1) return "";
    if (n.getAttribute("aria-hidden") === "true") return "";
    const text = [...n.childNodes].map(walk).join("");
    // A box of its own (a block, a flex item) is its own stop: a pause, not a run-on.
    const own = getComputedStyle(n).display !== "inline" || getComputedStyle(n.parentElement).display.includes("flex");
    return own ? ` ${text} ` : text;
  };
  return walk(el).replace(/\s+/g, " ").trim();
};

// ---- 1 and 2. the recorder --------------------------------------------------
{
  const { context, page, errors } = await open();
  await page.goto(`${BASE}/rep?lesson=h4`);
  const record = page.locator('button[data-record="start"]');
  await record.waitFor({ timeout: 20000 });
  await sleep(600);
  ok("Record is named by the word on it", (await page.getByRole("button", { name: "Record", exact: true }).count()) === 1 && (await record.getAttribute("aria-label")) === null);
  await record.click({ force: true });
  const stop = page.locator('button[data-record="stop"]');
  await stop.waitFor({ timeout: 15000 });
  const stopName = await stop.getAttribute("aria-label");
  const stopWord = (await stop.textContent()).trim();
  ok("Stop's name starts with the word shown", stopWord === "Stop" && (stopName ?? "").startsWith("Stop"), `${stopWord} / ${stopName}`);
  await sleep(2800);
  await stop.click({ force: true });
  await page.waitForSelector("main [data-glance-door]", { timeout: 20000 });
  await sleep(900);
  const landed = await page.evaluate(() => {
    const h = document.querySelector("main [data-results-head]");
    return { focused: document.activeElement === h, text: h?.textContent.replace(/\s+/g, " ").trim() ?? null, level: h?.tagName };
  });
  ok("a result that lands takes the focus to its name", landed.focused && landed.level === "H1", JSON.stringify(landed));
  ok("and the name carries the score", /\. Your Ethos, \d+ of 1000\.$/.test(landed.text ?? ""), String(landed.text));

  // 3 and 4, in the sheet that holds them.
  await page.locator("main [data-glance-door]").click();
  await page.waitForSelector("[data-whole-recording]", { timeout: 4000 });
  await sleep(700);
  const swap = await page.evaluate((heardSrc) => {
    const heard = new Function(`return (${heardSrc})`)();
    const head = [...document.querySelectorAll("[data-whole-recording] h2, [data-whole-recording] h3")].find((h) => h.textContent.trim() === "Say this instead");
    const row = head?.nextElementSibling;
    return row ? { heard: heard(row), seen: row.innerText.replace(/\s+/g, " ").trim() } : null;
  }, heard.toString());
  ok("a swap says which half is which", !!swap && /^Instead of .+ say .+$/.test(swap.heard), JSON.stringify(swap));

  // 8. The transcript's marks, as the browser draws them.
  const shapes = await page.evaluate(() => {
    const word = (mark) => {
      const w = document.querySelector(`[data-whole-recording] .tw[data-word-mark="${mark}"]`);
      return w ? getComputedStyle(w).textDecorationStyle : null;
    };
    const scrap = (mark) => {
      const k = document.querySelector(`[data-whole-recording] .tw-key[data-word-mark="${mark}"]`);
      if (!k) return null;
      const cs = getComputedStyle(k);
      const masked = (cs.maskImage && cs.maskImage !== "none") || (cs.webkitMaskImage && cs.webkitMaskImage !== "none");
      return masked ? "wave" : cs.backgroundImage !== "none" ? "dots" : "bar";
    };
    const plain = document.querySelector("[data-whole-recording] .tw:not([data-word-mark])");
    return {
      words: { filler: word("filler"), vague: word("vague"), repeat: word("repeat") },
      key: { filler: scrap("filler"), vague: scrap("vague"), repeat: scrap("repeat") },
      plain: plain ? getComputedStyle(plain).textDecorationStyle : null,
    };
  });
  ok(
    "a filler, a vague word and a repeat are underlined in three shapes",
    shapes.words.filler === "solid" && shapes.words.vague === "wavy" && shapes.words.repeat === "dotted",
    JSON.stringify(shapes.words)
  );
  ok("the key draws a scrap of each shape", shapes.key.filler === "bar" && shapes.key.vague === "wave" && shapes.key.repeat === "dots", JSON.stringify(shapes.key));
  ok("the recorder threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 3. a change is Up or Down ------------------------------------------------
{
  const { context, page } = await open();
  await page.goto(`${BASE}/history`);
  await settle(page);
  const change = await page.evaluate((heardSrc) => {
    const heard = new Function(`return (${heardSrc})`)();
    const out = [];
    const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!/[▲▼]/.test(walker.currentNode.nodeValue ?? "")) continue;
      const el = walker.currentNode.parentElement;
      const line = el.closest("p, div, span.tabular-nums, td") ?? el;
      out.push({ shown: line.textContent.replace(/\s+/g, " ").trim().slice(0, 40), hidden: !!el.closest('[aria-hidden="true"]'), heard: heard(line).slice(0, 40) });
    }
    return out;
  }, heard.toString());
  const loud = change.filter((c) => !c.hidden);
  ok("no triangle reaches a screen reader on the Log", change.length > 0 && loud.length === 0, JSON.stringify(loud.length ? loud : change.slice(0, 2)));
  ok("the hero's change is heard as a word", change.some((c) => /^(Up|Down) \+?\d+/.test(c.heard)), JSON.stringify(change.map((c) => c.heard)));

  // ---- 5. a Log row says every number it shows --------------------------------
  const row = await page.evaluate(() => {
    const a = document.querySelector('main a[href^="/rep/"]');
    if (!a) return null;
    const cells = [...a.querySelectorAll(".tabular-nums")].map((c) => c.textContent.trim());
    return { label: a.getAttribute("aria-label"), cells };
  });
  const says = (n) => new RegExp(`\\b${n}\\b`).test(row?.label ?? "");
  ok(
    "a Log row's name carries its Ethos, stars, fillers, pace and pauses",
    !!row && /Ethos \d+, \d of 3 stars, \d+ fillers?, \d+ words a minute, \d+ held pauses?$/.test(row.label) && row.cells.slice(1).every(says),
    JSON.stringify(row)
  );
  await context.close();
}

// ---- 6. a badge says whether it is earned --------------------------------------
{
  const { context, page } = await open();
  await page.goto(`${BASE}/you`);
  await settle(page);
  const badges = await page.evaluate((heardSrc) => {
    const heard = new Function(`return (${heardSrc})`)();
    const head = [...document.querySelectorAll("main h2")].find((h) => /^Badges|^Achievements|^Earned/i.test(h.textContent.trim()));
    const list = head?.nextElementSibling;
    return list ? [...list.querySelectorAll("a")].map((a) => heard(a)) : [];
  }, heard.toString());
  const stated = badges.filter((b) => /\. (Earned\.|Not earned yet(, \d+% of the way)?\.)$/.test(b));
  ok("every badge says earned or not, in words", badges.length > 0 && stated.length === badges.length, `${stated.length}/${badges.length}: ${badges.slice(0, 2).join(" | ")}`);
  ok("and both kinds are on the page", badges.some((b) => /\. Earned\.$/.test(b)) && badges.some((b) => /Not earned yet/.test(b)));
  await context.close();
}

// ---- 7. Increase Contrast -------------------------------------------------------
for (const theme of ["light", "dark"]) {
  const { context, page } = await open(theme);
  await page.goto(`${BASE}/settings`);
  await settle(page);
  const read = () =>
    page.evaluate(() => {
      /* The token as the browser resolves it, never as it is written: a
         build rewrites `rgba(32, 30, 29, 0.08)` to a hex with alpha, and
         a check that parsed the text read every strength as 1. */
      const probe = document.createElement("i");
      document.body.appendChild(probe);
      const a = (token) => {
        probe.style.color = `var(${token})`;
        const m = getComputedStyle(probe).color.match(/rgba?\(([^)]+)\)/);
        const parts = m ? m[1].split(/[,\s/]+/).filter(Boolean) : [];
        return parts.length > 3 ? Number(parts[3]) : 1;
      };
      const out = { hairline: a("--color-hairline"), edge: a("--color-edge"), muted: a("--color-stone-400") };
      probe.remove();
      const caption = document.querySelector("main .group-foot");
      return { ...out, caption: caption ? getComputedStyle(caption).color : null };
    });
  const normal = await read();
  await page.emulateMedia({ contrast: "more", colorScheme: theme });
  await sleep(300);
  const more = await read();
  ok(
    `${theme}: Increase Contrast firms every hairline, edge and caption`,
    more.hairline >= normal.hairline * 2 && more.edge >= normal.edge * 2 && more.muted > normal.muted && more.caption !== normal.caption,
    `${JSON.stringify(normal)} → ${JSON.stringify(more)}`
  );
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
