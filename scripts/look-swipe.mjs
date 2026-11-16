/**
 * The swipe between the tabs, photographed (Timothy, 11 Nov: "swipe
 * between screens add").
 *
 * Puts a finger down in the middle of a tab, drags it sideways in small
 * moves and shoots the page with the finger still down, then lets go and
 * shoots the landing as a strip (0, 80, 160, 240, 400ms): the look loop's
 * motion step for a change no still can show. Before the swipe existed
 * this photographs a drag that moves nothing.
 *
 * Against a BUILD, not `next dev`: a tab not opened yet slides in as its
 * prerendered first paint, which only a build has to give
 * (lib/tab-stand-in.ts).
 *
 *   export NEXT_DIST_DIR=.next-swipe NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
 *   npx next build && npx next start -p 3124
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/look-swipe.mjs after
 *
 * Shots: LOOK_OUT, default docs/look/swipe/, one sheet a walk, its
 * frames four to a row under their names: <tag>-<theme>-<walk>.jpg.
 * LOOK_THEMES and LOOK_WALKS (comma lists) narrow a run.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync } from "node:fs";
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const TAG = process.argv[2] ?? "after";
const BASE = process.env.LOOK_BASE ?? "http://localhost:3124";
const OUT = (process.env.LOOK_OUT ?? new URL("../docs/look/swipe/", import.meta.url).pathname).replace(/\/?$/, "/");
const THEMES = (process.env.LOOK_THEMES ?? "light,dark").split(",");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

/** A finger: down, moved in steps a frame apart, up. */
function finger(cdp) {
  const send = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  return {
    down: (x, y) => send("touchStart", x, y),
    async drag(from, to, y, steps = 8, gap = 16) {
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", from + ((to - from) * i) / steps, y);
        await sleep(gap);
      }
    },
    up: () => send("touchEnd", 0, 0),
  };
}

/** Lay the frames of one walk out in one image, four to a row so it reads on a phone, each under its name. */
const sheets = await browser.newContext({ viewport: { width: 1300, height: 1500 }, deviceScaleFactor: 1 });
async function strip(files, name) {
  const page = await sheets.newPage();
  const { readFileSync, rmSync } = await import("node:fs");
  const cell = (f) => {
    const label = f.replace(/^.*-(\d-[a-z0-9-]+)\.png$/, "$1").replace(/^\d-/, "").replaceAll("-", " ");
    return `<div><div style="font:600 15px ui-sans-serif,system-ui,sans-serif;color:#333;margin-bottom:6px">${label}</div><img src="data:image/png;base64,${readFileSync(f).toString("base64")}" style="display:block;width:300px;border-radius:14px"></div>`;
  };
  await page.setContent(`<body style="margin:0"><div id="s" style="display:grid;grid-template-columns:repeat(4,300px);gap:14px 10px;background:#dcdcdc;padding:12px;width:max-content">${files.map(cell).join("")}</div></body>`);
  await page.locator("#s").screenshot({ path: `${OUT}${name}`, type: "jpeg", quality: 84 });
  await page.close();
  // The single frames are what the strip was laid out from.
  for (const f of files) rmSync(f, { force: true });
}

for (const theme of THEMES) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme, session });
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 160)));
  const cdp = await context.newCDPSession(page);
  const f = finger(cdp);
  const shot = async (walk, frame) => {
    const path = `${OUT}${TAG}-${theme}-${walk}-${frame}.png`;
    await page.screenshot({ path });
    return path;
  };

  /* Each walk: where it starts, how far the finger goes (negative pulls
     the next tab in), and whether it lets go there or comes back first. */
  const walks = [
    { name: "today-to-lessons", start: "/", from: 300, to: 60 },
    { name: "lessons-to-today", start: "/lessons", from: 90, to: 330 },
    // There and back: Today slides in as it was left, not as it first paints.
    { name: "back-to-today-as-left", start: "/", first: { from: 300, to: 60 }, from: 90, to: 330 },
    { name: "practice-to-log", start: "/games", from: 300, to: 60 },
    { name: "log-to-you", start: "/history", from: 300, to: 60 },
    { name: "lessons-held-back", start: "/lessons", from: 300, to: 230 },
    { name: "today-past-the-end", start: "/", from: 90, to: 330 },
    { name: "you-past-the-end", start: "/you", from: 300, to: 60 },
  ];
  const only = process.env.LOOK_WALKS?.split(",");
  for (const w of walks) {
    if (only && !only.includes(w.name)) continue;
    await page.goto(`${BASE}${w.start}`);
    await page.waitForSelector("main");
    /* Up and loaded: a page still on its server-drawn placeholders has
       not been hydrated, and hears no finger (a dev server compiling
       the route can take seconds). */
    await page.waitForFunction(() => !document.querySelector("main .skeleton"), null, { timeout: 60000 });
    await sleep(1500);
    if (w.first) {
      // A swipe nobody photographs, so the walk starts one tab along.
      await f.down(w.first.from, 420);
      await f.drag(w.first.from, w.first.to, 420, 8);
      await f.up();
      await sleep(1800);
    }
    const files = [await shot(w.name, "0-rest")];
    await f.down(w.from, 420);
    await f.drag(w.from, w.from + (w.to - w.from) * 0.35, 420, 5);
    files.push(await shot(w.name, "1-a-third"));
    await f.drag(w.from + (w.to - w.from) * 0.35, w.to, 420, 6);
    files.push(await shot(w.name, "2-held"));
    await f.up();
    for (const ms of [80, 160, 240, 400]) {
      await sleep(ms === 80 ? 60 : ms === 400 ? 150 : 70);
      files.push(await shot(w.name, `3-let-go-${ms}`));
    }
    await sleep(900);
    files.push(await shot(w.name, "4-settled"));
    console.log(`${theme} ${w.name}: ended on ${new URL(page.url()).pathname}`);
    await strip(files, `${TAG}-${theme}-${w.name}.jpg`);
  }
  await context.close();
}
await browser.close();
