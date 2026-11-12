/**
 * The progress card goes out through the phone's share sheet (#447).
 *
 * A picture made to be posted was a download link. This makes the card
 * on You four ways and checks what its tap does:
 *
 *   1. a browser that shares files: "Share the card" hands the sheet one
 *      PNG, in the tap, with no words beside it;
 *   2. the sheet closed without sending: nothing changes, the tap stays;
 *   3. the browser refuses the share: the tap becomes the download link,
 *      so the card can still be kept;
 *   4. a browser with no file sharing: the download link from the start.
 *
 * `navigator.share` is stood in for (headless Chromium has none): the
 * stub records what it was handed and answers as the scene says.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-share.mjs
 *   SHOTS=docs/look/hig node scripts/check-share.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS ? process.env.SHOTS.replace(/\/?$/, "/") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

/** `scene`: "shares" | "closed" | "refused" | "none". */
async function open(scene, theme = "light") {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: theme, serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.route("**/api/push", (route) => route.fulfill(json({ ok: true })));
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript((scene) => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
    window.__shared = [];
    const put = (name, value) => Object.defineProperty(Navigator.prototype, name, { configurable: true, writable: true, value });
    if (scene === "none") {
      put("share", undefined);
      put("canShare", undefined);
      return;
    }
    put("canShare", (data) => Array.isArray(data?.files) && data.files.every((f) => f instanceof File));
    put("share", async (data) => {
      window.__shared.push({
        keys: Object.keys(data),
        files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
        // A share sheet only rises inside the tap that asked for it.
        inTap: navigator.userActivation ? navigator.userActivation.isActive : null,
      });
      if (scene === "closed") throw Object.assign(new Error("Share canceled"), { name: "AbortError" });
      if (scene === "refused") throw Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    });
  }, scene);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(`${BASE}/you`);
  await page.waitForSelector("main");
  await page.waitForFunction(() => document.querySelectorAll("main .skeleton").length === 0, null, { timeout: 12000 }).catch(() => {});
  await sleep(600);
  const make = page.getByRole("button", { name: "Make the card" });
  await make.scrollIntoViewIfNeeded();
  await make.click();
  await page.locator('main img[alt="Your progress card"]').waitFor({ timeout: 8000 });
  await sleep(500);
  return { context, page, errors };
}

const state = (page) =>
  page.evaluate(() => {
    const img = document.querySelector('main img[alt="Your progress card"]');
    const card = img.closest("section");
    const share = [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Share the card");
    const save = [...card.querySelectorAll("a")].find((a) => a.textContent.trim() === "Save the card");
    return {
      share: !!share,
      save: save ? { download: save.getAttribute("download"), png: (save.getAttribute("href") ?? "").startsWith("data:image/png") } : null,
      keeps: img.hasAttribute("data-keeps"),
      callout: getComputedStyle(img).webkitTouchCallout ?? null,
      shared: window.__shared,
    };
  });

// ---- 1. a browser that shares files ------------------------------------------
{
  const { context, page, errors } = await open("shares");
  let s = await state(page);
  ok("where files can be shared, the card's tap is Share the card, and there is no download link", s.share && s.save === null, JSON.stringify({ share: s.share, save: s.save }));
  ok("the picture is still one a held thumb can keep", s.keeps);
  if (SHOTS) {
    await page.getByRole("button", { name: "Share the card" }).scrollIntoViewIfNeeded();
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}share-card-after-light.png` });
  }
  await page.getByRole("button", { name: "Share the card" }).click();
  await sleep(300);
  s = await state(page);
  const sent = s.shared[0];
  ok(
    "the tap hands the sheet one PNG and nothing else",
    s.shared.length === 1 && sent.keys.join() === "files" && sent.files.length === 1 && sent.files[0].name === "ethos-progress.png" && sent.files[0].type === "image/png" && sent.files[0].size > 10_000,
    JSON.stringify(sent)
  );
  ok("and it asks inside the tap, where a sheet is allowed to rise", sent?.inTap !== false, String(sent?.inTap));
  ok("shared, the tap is still there to share it again", s.share && s.save === null);
  ok("sharing threw nothing", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---- 2. the sheet closed without sending -------------------------------------
{
  const { context, page, errors } = await open("closed");
  await page.getByRole("button", { name: "Share the card" }).click();
  await sleep(300);
  const s = await state(page);
  ok("a closed sheet changes nothing: the tap stays, no error, no link", s.shared.length === 1 && s.share && s.save === null && errors.length === 0, JSON.stringify({ share: s.share, save: s.save, errors }));
  await context.close();
}

// ---- 3. the browser refuses ---------------------------------------------------
{
  const { context, page, errors } = await open("refused");
  await page.getByRole("button", { name: "Share the card" }).click();
  await sleep(400);
  const s = await state(page);
  ok("a refused share falls back to the download, so the card can still be kept", !s.share && !!s.save && s.save.download === "ethos-progress.png" && s.save.png && errors.length === 0, JSON.stringify({ share: s.share, save: s.save, errors }));
  await context.close();
}

// ---- 4. no file sharing at all -------------------------------------------------
{
  const { context, page, errors } = await open("none");
  const s = await state(page);
  ok("with no file sharing, Save the card is the download it always was", !s.share && !!s.save && s.save.download === "ethos-progress.png" && s.save.png && errors.length === 0, JSON.stringify({ share: s.share, save: s.save, errors }));
  await context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
