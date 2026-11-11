/**
 * The swipe between the tabs, checked with a finger (DECISIONS #435,
 * components/TabSwipe.tsx, lib/tab-swipe.ts).
 *
 * Drives real touch events through CDP and reads where the page, the
 * neighbour's pane and the bar's well actually are. What it holds:
 * the page follows the finger 1:1 with its neighbour beside it and the
 * well under the same thumb; nothing navigates until the motion lands;
 * a throw goes, a short pull comes home, a flick back cancels; the ends
 * of the bar give and return; up and down is still the page's scroll;
 * the screen's edges, a field, a sheet and a detail page are not the
 * swipe's; a landing can be caught and turned round; reduced motion
 * moves the app without moving the page; and at rest nothing is left
 * behind.
 *
 * Against a BUILD (a tab not opened yet slides in as its prerendered
 * first paint, which only a build has; lib/tab-stand-in.ts):
 *
 *   export NEXT_DIST_DIR=.next-swipe NEXT_PUBLIC_SUPABASE_URL=http://supabase.local \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
 *   npx next build && npx next start -p 3124
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *     node scripts/check-swipe.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { seed, session, supabaseRoute } from "./look-fixtures.mjs";

const BASE = process.env.LOOK_BASE ?? "http://localhost:3124";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const ok = (name, pass, detail = "") => {
  findings.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const near = (a, b, by = 1.5) => Math.abs(a - b) <= by;

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });

async function phone({ reduced = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: "en-AU", timezoneId: "Australia/Melbourne", colorScheme: "light", serviceWorkers: "block",
  });
  await context.route("http://supabase.local/**", supabaseRoute);
  await context.addInitScript(seed, { theme: "light", session });
  if (reduced) {
    await context.addInitScript(() => {
      try {
        const p = JSON.parse(localStorage.getItem("ethos.prefs") ?? "{}");
        localStorage.setItem("ethos.prefs", JSON.stringify({ ...p, reducedMotion: true }));
      } catch {}
    });
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", page.url(), e.message.slice(0, 140)));
  const cdp = await context.newCDPSession(page);
  const send = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const finger = {
    down: (x, y = 420) => send("touchStart", x, y),
    /** Straight moves a frame apart; `gap` ms between them sets the speed. */
    async move(from, to, { y = 420, y2 = y, steps = 8, gap = 16 } = {}) {
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", from + ((to - from) * i) / steps, y + ((y2 - y) * i) / steps);
        await sleep(gap);
      }
    },
    up: () => send("touchEnd", 0, 0),
  };
  /** Where everything is, read off the screen. */
  const where = () =>
    page.evaluate(() => {
      const x = (el) => (el ? new DOMMatrixReadOnly(getComputedStyle(el).transform).m41 || 0 : null);
      const pg = document.querySelector("[data-page]");
      const pane = document.querySelector(".swipe-pane");
      const clip = document.querySelector(".swipe-clip");
      const well = document.querySelector(".nav-well");
      return {
        path: location.pathname,
        page: x(pg),
        pageInline: pg?.getAttribute("style") ?? "",
        pageClass: pg?.className ?? "",
        pane: x(pane),
        paneShown: !!clip && !clip.hidden,
        paneKind: pane?.dataset.kind ?? null,
        paneText: (pane?.innerText ?? "").replace(/\s+/g, " ").slice(0, 200),
        paneKids: pane?.childElementCount ?? 0,
        well: x(well),
        step: well ? parseFloat(getComputedStyle(well).width) : 0,
        moving: [pg, pane, well].some((el) => el && el.getAnimations().some((a) => !(a instanceof CSSTransition))),
        swiping: !!document.querySelector(".swipe-root[data-swiping]"),
        // The tab the bar draws lit, and the one it names as the page.
        lit: [...document.querySelectorAll('nav[aria-label="Sections"] a')].findIndex((a) => a.classList.contains("text-ink")),
        named: [...document.querySelectorAll('nav[aria-label="Sections"] a')].findIndex((a) => a.getAttribute("aria-current") === "page"),
        scrollY: Math.round(window.scrollY),
      };
    });
  const open = async (path) => {
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector("main");
    await page.waitForFunction(() => !document.querySelector("main .skeleton"), null, { timeout: 60000 });
    // Past the idle moment the neighbours' first paints are asked for, and answered.
    await sleep(3200);
  };
  const landed = async (path, ms = 4000) => {
    await page.waitForFunction((p) => location.pathname === p, path, { timeout: ms }).catch(() => {});
    await sleep(1400);
    return where();
  };
  return { context, page, finger, where, open, landed };
}

/* ---- 1. The page follows the finger, its neighbour beside it ------------- */
{
  const p = await phone();
  await p.open("/");
  const rest = await p.where();
  ok("at rest nothing of the swipe is on the page", !rest.paneShown && rest.paneKids === 0 && rest.pageInline === "" && !rest.swiping, JSON.stringify({ shown: rest.paneShown, kids: rest.paneKids, inline: rest.pageInline }));
  await p.finger.down(300);
  await p.finger.move(300, 180);
  await sleep(120);
  const held = await p.where();
  // 120px of travel, less the 10 that decided it was a swipe.
  ok("the page is under the finger, 1:1", near(held.page, -110), `page at ${held.page}`);
  ok("its neighbour is beside it, a page's width to the right", held.paneShown && near(held.pane, held.page + 390), `pane at ${held.pane}`);
  ok("the neighbour is a picture of Lessons as it first paints", held.paneKind === "first" && /Lessons/.test(held.paneText), `${held.paneKind}: ${held.paneText.slice(0, 40)}`);
  ok("the bar's well is under the same thumb", near(held.well, (110 / 390) * held.step, 0.8), `well at ${held.well?.toFixed(1)} of a ${held.step.toFixed(1)} step`);
  ok("nothing has navigated while the finger is down", held.path === "/");
  ok("the button under the finger is not held down by a swipe", held.swiping);
  ok("the bar still lights the tab the finger has not left", held.lit === 0 && held.named === 0, `lit ${held.lit}`);
  await p.finger.move(180, 60);
  await p.finger.up();
  const there = await p.landed("/lessons");
  ok("let go past a quarter of the way, it lands on the next tab", there.path === "/lessons");
  ok("and leaves nothing behind", !there.paneShown && there.paneKids === 0 && there.pageInline === "" && !there.moving && !there.swiping, JSON.stringify({ shown: there.paneShown, kids: there.paneKids, inline: there.pageInline, moving: there.moving }));
  ok("the page it carried in plays no second push", !/push-(left|right)/.test(there.pageClass), there.pageClass);
  ok("the well is on Lessons", near(there.well, there.step), `well at ${there.well}`);
  ok("and Lessons is the tab lit and named", there.lit === 1 && there.named === 1, `lit ${there.lit}, named ${there.named}`);

  /* ---- 2. Back toward a tab already seen: its own picture ----------------- */
  await p.finger.down(90);
  await p.finger.move(90, 200);
  await sleep(120);
  const back = await p.where();
  ok("a tab left a moment ago slides in as it was left", back.paneKind === "seen" && /Hi, Timothy/.test(back.paneText), `${back.paneKind}: ${back.paneText.slice(0, 50)}`);
  ok("from the left, a page's width behind", near(back.pane, back.page - 390), `page ${back.page}, pane ${back.pane}`);
  /* ---- 3. A short pull comes home ----------------------------------------- */
  await p.finger.move(200, 150, { gap: 40 });
  await sleep(200);
  await p.finger.up();
  await sleep(1200);
  const home = await p.where();
  ok("a pull that stops short of a quarter comes home", home.path === "/lessons" && home.page === 0 && !home.paneShown && home.pageInline === "", JSON.stringify({ path: home.path, page: home.page, shown: home.paneShown }));
  ok("with the well back on its tab", near(home.well, home.step), `well at ${home.well}`);

  /* ---- 4. A tap on the bar afterwards is an ordinary tab change ----------- */
  await p.page.locator('nav[aria-label="Sections"] a[href="/"]').tap();
  await p.page.waitForFunction(() => location.pathname === "/");
  const tapped = await p.page.evaluate(() => document.querySelector("[data-page]")?.className ?? "");
  ok("a tab tapped after a swipe still pushes in", /push-left/.test(tapped), tapped);
  await p.context.close();
}

/* ---- 4b. The picture lets go of a page that has already arrived ------------ */
{
  /* There and back: Today returns as it was left, and its own page
     mounts under that picture. The picture is the tab whole, so the page
     under it must have nothing still arriving when the picture fades, or
     the screen is half of each for a moment (a washed frame the look
     loop caught 240ms after the lift). */
  const p = await phone();
  await p.open("/");
  await p.finger.down(300);
  await p.finger.move(300, 60);
  await p.finger.up();
  await p.landed("/lessons");
  await p.page.evaluate(() => {
    window.__handoff = null;
    const tick = () => {
      const pane = document.querySelector(".swipe-pane");
      const pg = document.querySelector("[data-page]");
      if (pane?.hasAttribute("data-leaving") && pg) {
        const arriving = pg
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
        window.__handoff = {
          kind: pane.dataset.kind,
          path: pg.getAttribute("data-page"),
          arriving: arriving.length,
          placeholders: pg.querySelectorAll(".skeleton").length,
        };
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.finger.down(90);
  await p.finger.move(90, 330);
  await p.finger.up();
  const home = await p.landed("/");
  const handoff = await p.page.evaluate(() => window.__handoff);
  ok(
    "a tab's own picture lets go only of a page that has arrived",
    home.path === "/" && handoff?.kind === "seen" && handoff.path === "/" && handoff.arriving === 0 && handoff.placeholders === 0,
    JSON.stringify(handoff)
  );
  await p.context.close();
}

/* ---- 5. A flick goes, a flick back cancels -------------------------------- */
{
  const p = await phone();
  await p.open("/lessons");
  await p.finger.down(300);
  await p.finger.move(300, 230, { steps: 3, gap: 14 });
  await p.finger.up();
  const flicked = await p.landed("/games");
  ok("a quick flick of 70px carries to the next tab", flicked.path === "/games", flicked.path);

  await p.open("/lessons");
  await p.finger.down(300);
  await p.finger.move(300, 120, { steps: 8, gap: 16 });
  await p.finger.move(120, 190, { steps: 3, gap: 14 });
  await p.finger.up();
  await sleep(1500);
  const turned = await p.where();
  ok("a flick back the other way cancels, whatever the distance", turned.path === "/lessons" && turned.page === 0 && !turned.paneShown, JSON.stringify({ path: turned.path, page: turned.page }));
  await p.context.close();
}

/* ---- 6. The ends of the bar give and return ------------------------------- */
{
  const p = await phone();
  await p.open("/");
  await p.finger.down(90);
  await p.finger.move(90, 290);
  await sleep(120);
  const first = await p.where();
  ok("before the first tab the page gives, less than the finger", first.page > 20 && first.page < 100 && !first.paneShown, `page at ${first.page?.toFixed(1)} for 190px of finger`);
  ok("and the well leans off its end with it", first.well < 0, `well at ${first.well?.toFixed(1)}`);
  await p.finger.up();
  await sleep(1200);
  const stays = await p.where();
  ok("and comes home, on the same tab", stays.path === "/" && stays.page === 0 && stays.pageInline === "" && near(stays.well, 0), JSON.stringify({ path: stays.path, page: stays.page, well: stays.well }));

  await p.open("/you");
  await p.finger.down(300);
  await p.finger.move(300, 100);
  await sleep(120);
  const last = await p.where();
  ok("past the last tab it gives the other way", last.page < -20 && last.page > -100 && !last.paneShown, `page at ${last.page?.toFixed(1)}`);
  await p.finger.up();
  await sleep(1200);
  ok("and stays on You", (await p.where()).path === "/you");
  await p.context.close();
}

/* ---- 7. Up and down is still the page's --------------------------------- */
{
  const p = await phone();
  await p.open("/lessons");
  await p.finger.down(200, 600);
  await p.finger.move(200, 205, { y: 600, y2: 300, steps: 10 });
  await p.finger.up();
  await sleep(700);
  const scrolled = await p.where();
  ok("a drag up scrolls the page and moves nothing sideways", scrolled.scrollY > 100 && scrolled.page === 0 && !scrolled.paneShown && scrolled.path === "/lessons", `scrollY ${scrolled.scrollY}`);

  /* A swipe from a scrolled page lands the next tab at its top. */
  await p.finger.down(300, 420);
  await p.finger.move(300, 80);
  const mid = await p.where();
  ok("a scrolled page is pulled aside where it is", mid.scrollY === scrolled.scrollY && near(mid.page, -210), `scrollY ${mid.scrollY}, page ${mid.page}`);
  await p.finger.up();
  const top = await p.landed("/games");
  ok("and the tab it lands on opens at its top", top.path === "/games" && top.scrollY === 0, `scrollY ${top.scrollY}`);

  await p.open("/lessons");
  await p.finger.down(200, 500);
  await p.finger.move(200, 240, { y: 500, y2: 420, steps: 8 });
  await sleep(100);
  const slant = await p.where();
  await p.finger.up();
  ok("a slant more down than across is not a swipe", slant.page === 0 && !slant.paneShown, `page at ${slant.page}`);
  await sleep(600);
  await p.context.close();
}

/* ---- 8. What is not the swipe's ------------------------------------------- */
{
  const p = await phone();
  await p.open("/lessons");
  await p.finger.down(8);
  await p.finger.move(8, 200);
  await sleep(100);
  const edge = await p.where();
  await p.finger.up();
  ok("a touch that starts at the screen's edge is the system's", edge.page === 0 && !edge.paneShown, `page at ${edge.page}`);
  await sleep(500);

  // One lesson is a step in from its tab: its way out is its back link.
  await p.page.goto(`${BASE}/lessons/the-cold-open`);
  await p.page.waitForSelector("main");
  await sleep(1500);
  await p.finger.down(300);
  await p.finger.move(300, 100);
  await sleep(100);
  const detail = await p.where();
  await p.finger.up();
  ok("a detail page does not swipe", detail.page === 0 && !detail.paneShown && detail.path === "/lessons/the-cold-open", `page at ${detail.page}`);
  await sleep(400);

  // A sheet is up: the finger is the sheet's.
  await p.open("/you");
  await p.page.locator("main button", { hasText: "Pace" }).first().tap();
  await p.page.waitForSelector("[role='dialog'][aria-modal='true']", { timeout: 8000 });
  await sleep(700);
  await p.finger.down(300, 500);
  await p.finger.move(300, 100, { y: 500 });
  await sleep(100);
  const sheet = await p.where();
  await p.finger.up();
  ok("with a sheet up, a sideways drag moves no page", sheet.page === 0 && !sheet.paneShown && sheet.path === "/you", `page at ${sheet.page}`);
  await p.context.close();
}

/* ---- 9. A landing can be caught and turned round -------------------------- */
{
  const p = await phone();
  await p.open("/");
  await p.finger.down(300);
  await p.finger.move(300, 150, { steps: 6, gap: 16 });
  await p.finger.up();
  await sleep(90);
  const flying = await p.where();
  await p.finger.down(120);
  await p.finger.move(120, 220, { steps: 6, gap: 16 });
  const caught = await p.where();
  ok("mid-landing nothing has navigated yet", flying.path === "/" && flying.moving, `moving ${flying.moving}`);
  ok("the bar lights where it is going from the lift, and names the page it is still on", flying.lit === 1 && flying.named === 0, `lit ${flying.lit}, named ${flying.named}`);
  ok("caught, the bar lights the tab under the finger again", caught.lit === 0, `lit ${caught.lit}`);
  ok("a finger catches the page where it is and takes it back", caught.path === "/" && !caught.moving && caught.page > flying.page, `from ${flying.page?.toFixed(0)} to ${caught.page?.toFixed(0)}`);
  // On back the way it came, and let go while still moving: a flick back.
  await p.finger.move(220, 380, { steps: 8, gap: 16 });
  await p.finger.up();
  await sleep(1400);
  const kept = await p.where();
  ok("and it comes home to the tab it never left", kept.path === "/" && kept.page === 0 && !kept.paneShown && kept.pageInline === "" && kept.lit === 0, JSON.stringify({ path: kept.path, page: kept.page, lit: kept.lit }));
  await p.context.close();
}

/* ---- 9b. The bar's own slide takes the well mid-landing -------------------- */
{
  /* A thumb sliding the bar's lens cancels whatever is moving the well
     (Nav.tsx). The page's landing must not be counted as interrupted by
     that: it used to stop there, the page parked off-screen under a
     picture and the app never told to move. */
  const p = await phone();
  await p.open("/");
  await p.finger.down(300);
  await p.finger.move(300, 150, { steps: 6, gap: 16 });
  await p.finger.up();
  await sleep(60);
  const bar = await p.page.evaluate(() => {
    const r = document.querySelector('nav[aria-label="Sections"] a[href="/games"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await p.finger.down(bar.x, bar.y);
  await p.finger.move(bar.x, bar.x + 24, { y: bar.y, steps: 3, gap: 16 });
  await sleep(900);
  const during = await p.where();
  ok(
    "a thumb sliding the bar mid-landing does not strand the page",
    during.path === "/lessons" && during.page === 0 && !during.paneShown && during.pageInline === "",
    JSON.stringify({ path: during.path, page: during.page, shown: during.paneShown })
  );
  await p.finger.up();
  await sleep(1400);
  const after = await p.where();
  ok(
    "and the bar, the well and the page agree when the thumb lets go",
    after.lit === after.named && near(after.well, after.named * after.step) && after.page === 0 && !after.paneShown,
    JSON.stringify({ path: after.path, lit: after.lit, named: after.named, well: after.well?.toFixed(1) })
  );
  // And the swipe still works afterwards: nothing was left holding it.
  const from = after.named;
  await p.finger.down(from >= 4 ? 90 : 300);
  await p.finger.move(from >= 4 ? 90 : 300, from >= 4 ? 330 : 60);
  await p.finger.up();
  await sleep(1800);
  const next = await p.where();
  ok("and the next swipe is heard", next.named === (from >= 4 ? from - 1 : from + 1) && next.page === 0, `from tab ${from} to tab ${next.named}`);
  await p.context.close();
}

/* ---- 10. Reduced motion: the app moves, the page does not ---------------- */
{
  const p = await phone({ reduced: true });
  await p.open("/");
  await p.finger.down(300);
  await p.finger.move(300, 100);
  await sleep(100);
  const still = await p.where();
  ok("with reduced motion nothing follows the finger", still.page === 0 && !still.paneShown && still.pageInline === "", `page at ${still.page}`);
  await p.finger.up();
  const moved = await p.landed("/lessons");
  ok("and the swipe still changes the tab", moved.path === "/lessons", moved.path);
  await p.context.close();
}

await browser.close();
const failed = findings.filter((f) => !f.pass).length;
console.log(`\n${findings.length - failed}/${findings.length} passed`);
process.exit(failed ? 1 : 0);
