/**
 * Idempotency keys on Upload, in a real browser (#436, lib/client-key.ts).
 *
 * An uploaded file is sent under a key made from the file itself, so a
 * second try of the same file stores nothing new. This checks the wire:
 * the key is on the request and is one the route accepts; the same file
 * picked twice carries the same key and a different file another; a
 * gateway 5xx is retried once under the same key and then scored; and a
 * send the server already stored (its first answer was lost) opens the
 * stored recording rather than filing a second.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npx next dev -p 3123
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-keys.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeBody, json, seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

/** A mono 16-bit WAV of `seconds` of silence. */
const silentWav = (seconds, rate = 8000) => {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
};
const dir = mkdtempSync(join(tmpdir(), "ethos-keys-"));
const fileA = join(dir, "team meeting 4 Nov.wav");
const fileB = join(dir, "standup.wav");
writeFileSync(fileA, silentWav(20));
writeFileSync(fileB, silentWav(21));
// A fixed date, so the file's key is the file's and not this run's.
utimesSync(fileA, new Date("2026-11-04T09:00:00Z"), new Date("2026-11-04T09:00:00Z"));
utimesSync(fileB, new Date("2026-11-05T09:00:00Z"), new Date("2026-11-05T09:00:00Z"));

const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--autoplay-policy=no-user-gesture-required"] });
const sent = [];
/** How /api/analyze answers each send, in order; the last one repeats. */
let script = ["ok"];

const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  locale: "en-AU", timezoneId: "Australia/Melbourne", serviceWorkers: "block",
});
await context.route("http://supabase.local/**", supabaseRoute);
await context.route("**/api/analyze", async (route) => {
  const body = route.request().postData() ?? "";
  const key = /name="clientId"\r?\n\r?\n([^\r\n]+)/.exec(body)?.[1] ?? null;
  const how = script[Math.min(sent.length, script.length - 1)];
  sent.push({ key, how });
  await sleep(150);
  if (how === "502") return route.fulfill(json({ error: null }, 502));
  if (how === "duplicate") return route.fulfill(json({ repId: "rep-22", duplicate: true }));
  return route.fulfill(json(analyzeBody));
});
await context.addInitScript(seed, { theme: "light", session });
await context.addInitScript(() => {
  const css = document.createElement("style");
  css.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));

const pick = async (path, answers) => {
  script = answers;
  sent.length = 0;
  await page.goto(`${BASE}/upload`);
  await page.waitForSelector("main h1");
  await sleep(400);
  await page.setInputFiles('input[type="file"]', path);
};

// ---- 1. the key is on the wire ----------------------------------------------
await pick(fileA, ["ok"]);
await page.waitForSelector("main h2", { timeout: 15000 }).catch(() => {});
await sleep(600);
const keyA = sent[0]?.key ?? "";
ok("an upload carries a key the route accepts", /^upload-[\w-]{1,190}$/.test(keyA) && /^[\w-]{1,200}$/.test(keyA), keyA);
ok("the key never carries the file's name", !/team|meeting|nov/i.test(keyA));
ok("one send for one file that lands", sent.length === 1);

// ---- 2. the same file again is the same recording; another file is another ---
await pick(fileA, ["ok"]);
await sleep(900);
ok("the same file picked again carries the same key", sent[0]?.key === keyA, `${sent[0]?.key}`);
await pick(fileB, ["ok"]);
await sleep(900);
ok("a different file carries another", !!sent[0]?.key && sent[0].key !== keyA, `${sent[0]?.key}`);

// ---- 3. a gateway 5xx is retried once, under the same key --------------------
await pick(fileA, ["502", "ok"]);
await sleep(3800);
ok("a 502 is sent again once, with the same key", sent.length === 2 && sent[0].key === keyA && sent[1].key === keyA, sent.map((s) => `${s.how}:${s.key === keyA}`).join(" "));
const scored = await page.evaluate(() => !document.querySelector("main [role='alert']") && /Upload another|recording/i.test(document.querySelector("main")?.textContent ?? ""));
ok("and the retry's answer is the result on screen", scored);

// ---- 4. two failures say so, and stop ---------------------------------------
await pick(fileA, ["502"]);
await sleep(3800);
const said = await page.evaluate(() => document.querySelector("main")?.textContent ?? "");
ok("two 502s end in the line and the picker, after two sends", sent.length === 2 && /Scoring timed out/.test(said), `${sent.length} sends`);

// ---- 5. already stored: open it, file nothing new ----------------------------
await pick(fileA, ["duplicate"]);
await page.waitForURL((u) => new URL(u).pathname === "/rep/rep-22", { timeout: 8000 }).catch(() => {});
ok("a file the server already stored opens that recording", new URL(page.url()).pathname === "/rep/rep-22" && sent.length === 1 && sent[0].key === keyA, page.url());

await browser.close();
const failed = findings.filter((f) => !f.pass);
console.log(`\n${findings.length - failed.length}/${findings.length} passed`);
process.exit(failed.length ? 1 : 0);
