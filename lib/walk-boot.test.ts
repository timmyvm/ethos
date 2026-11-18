import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstRunBootScript, walkBootScript, ONBOARDING_KEY } from "./walk-boot";
import { readOnboarding } from "./answers";
import { isFirstRun, roomDue, WELCOMED_KEY } from "./onboarding";
import { ALIVE_KEY } from "./graphics";

/*
 * The first minute before any JavaScript (#508): the home-screen icon
 * goes straight to the room for a first run (fix 14), and the room's
 * server-drawn door is shown only to a walk it is certainly for, never
 * flashed at one that resumes (fix 13, #497).
 */
const root = path.resolve(__dirname, "..");

function page(pathname: string, search = "", store: Record<string, string> = {}, splash: string | null = null) {
  const attrs = new Map<string, string>();
  if (splash !== null) attrs.set("data-splash", splash);
  const disk = new Map(Object.entries(store));
  const replaced: string[] = [];
  const g = {
    location: { pathname, search, replace: (u: string) => replaced.push(u) },
    localStorage: {
      get length() {
        return disk.size;
      },
      key: (i: number) => [...disk.keys()][i] ?? null,
      getItem: (k: string) => (disk.has(k) ? disk.get(k)! : null),
      removeItem: (k: string) => void disk.delete(k),
    },
    document: {
      documentElement: {
        getAttribute: (n: string) => (attrs.has(n) ? attrs.get(n)! : null),
        setAttribute: (n: string, v: string) => void attrs.set(n, v),
        removeAttribute: (n: string) => void attrs.delete(n),
      },
      fonts: { ready: Promise.resolve() },
    },
    performance: { now: () => 0 },
    setTimeout,
    Promise,
  };
  const run = (script: string) =>
    new Function(...Object.keys(g), script)(...Object.values(g));
  return { run, attrs, replaced, keys: () => [...disk.keys()] };
}

const SESSION = "sb-abcd-auth-token";
const account = JSON.stringify({ access_token: "t", user: { id: "u", is_anonymous: false } });
const guest = JSON.stringify({ access_token: "t", user: { id: "g", is_anonymous: true } });

describe("the home-screen icon on a first run (fix 14)", () => {
  it("goes to the room before Today's code loads", () => {
    const p = page("/");
    p.run(firstRunBootScript);
    expect(p.replaced).toEqual(["/welcome"]);
  });

  it("takes down the alive mark the graphics boot put up for `/`, so the room never reads a crash", () => {
    // lib/graphics.ts's boot runs first and marks the page alive; a page
    // sent on before its code loads never takes the mark down itself, and
    // the room's boot would read it as a crash: lite graphics, reduced
    // motion, a crash report, for every new phone (#508).
    const p = page("/", "", { [ALIVE_KEY]: JSON.stringify({ path: "/", at: 1 }) });
    p.run(firstRunBootScript);
    expect(p.replaced).toEqual(["/welcome"]);
    expect(p.keys()).not.toContain(ALIVE_KEY);
    // A page that stays keeps its mark.
    const stays = page("/", "", { [WELCOMED_KEY]: "x", [ALIVE_KEY]: "{}" });
    stays.run(firstRunBootScript);
    expect(stays.keys()).toContain(ALIVE_KEY);
  });

  it("runs after the graphics boot in the layout's head", () => {
    const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
    expect(layout.indexOf("__html: graphicsBootScript")).toBeGreaterThan(0);
    expect(layout.indexOf("__html: firstRunBootScript")).toBeGreaterThan(layout.indexOf("__html: graphicsBootScript"));
  });

  it("carries a camera's ?splash along", () => {
    const p = page("/", "?splash");
    p.run(firstRunBootScript);
    expect(p.replaced).toEqual(["/welcome?splash"]);
  });

  it("never moves a phone that has been here, or any other page", () => {
    for (const p of [
      page("/", "", { [WELCOMED_KEY]: "x" }),
      page("/", "", { [SESSION]: guest }),
      page("/you"),
      page("/welcome"),
    ]) {
      p.run(firstRunBootScript);
      expect(p.replaced).toEqual([]);
    }
  });

  it("decides exactly as Today's own fallback does (lib/onboarding.ts isFirstRun)", () => {
    const stores: Record<string, string>[] = [
      {},
      { [WELCOMED_KEY]: "1" },
      { [SESSION]: account },
      { [SESSION]: "" },
      { "sb-x-auth-token-code-verifier": "v" },
      { [ONBOARDING_KEY]: "{}" },
      { "ethos.theme": "dark" },
    ];
    for (const store of stores) {
      const p = page("/", "", store);
      p.run(firstRunBootScript);
      expect(p.replaced.length > 0, JSON.stringify(store)).toBe(isFirstRun(Object.keys(store)));
    }
  });
});

describe("the room's door before React (fix 13)", () => {
  afterEach(() => vi.useRealTimers());

  it("is shown to a first run", () => {
    const p = page("/welcome");
    p.run(walkBootScript);
    expect(p.attrs.get("data-walk")).toBe("room");
  });

  it("is hidden from a deep link, a walk part way through and a finished one", () => {
    for (const p of [
      page("/welcome", "?step=plan"),
      page("/welcome", "?step=ageBand"),
      page("/welcome", "", { [ONBOARDING_KEY]: JSON.stringify({ step: 2, done: false }) }),
      page("/welcome", "", { [ONBOARDING_KEY]: JSON.stringify({ step: 0, done: true }) }),
    ]) {
      p.run(walkBootScript);
      expect(p.attrs.get("data-walk")).toBe("resume");
    }
  });

  it("never shows the door to a walk the room is not for (no flash, #497)", () => {
    const walks: unknown[] = [
      null,
      {},
      { step: 0 },
      { step: 0, done: false, walk: 3 },
      { step: 0, done: false, walk: 2 },
      { step: 1, walk: 2 },
      { step: 2, walk: 1 },
      { step: 3 },
      { step: 0, done: true },
      { step: -1 },
      { step: "0" },
      { step: 1.5 },
      { done: "yes" },
      [],
      "x",
      7,
    ];
    for (const w of walks) {
      for (const search of ["", "?step=plan"]) {
        const store: Record<string, string> = w === null ? {} : { [ONBOARDING_KEY]: JSON.stringify(w) };
        const p = page("/welcome", search, store);
        p.run(walkBootScript);
        if (p.attrs.get("data-walk") !== "room") continue;
        // Shown: the walk itself must open on the room.
        vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null });
        try {
          const saved = readOnboarding();
          expect(roomDue({ asked: search ? "plan" : null, done: saved.done, step: saved.step }), JSON.stringify(w)).toBe(true);
        } finally {
          vi.unstubAllGlobals();
        }
      }
    }
  });

  it("hides Sign in and Tester code from an account's door, never a guest's", () => {
    const a = page("/welcome", "", { [SESSION]: account });
    a.run(walkBootScript);
    expect(a.attrs.has("data-room-account")).toBe(true);
    const g = page("/welcome", "", { [SESSION]: guest });
    g.run(walkBootScript);
    expect(g.attrs.has("data-room-account")).toBe(false);
  });

  it("lifts the splash off a door it drew, the way SplashLift does", async () => {
    vi.useFakeTimers();
    const p = page("/welcome", "", {}, "on");
    p.run(walkBootScript);
    await vi.advanceTimersByTimeAsync(599);
    expect(p.attrs.get("data-splash")).toBe("on");
    await vi.advanceTimersByTimeAsync(2);
    expect(p.attrs.get("data-splash")).toBe("out");
    await vi.advanceTimersByTimeAsync(360);
    expect(p.attrs.has("data-splash")).toBe(false);
  });

  it("leaves the splash to React on a walk that resumes", async () => {
    vi.useFakeTimers();
    const p = page("/welcome", "?step=plan", {}, "on");
    p.run(walkBootScript);
    await vi.advanceTimersByTimeAsync(2000);
    expect(p.attrs.get("data-splash")).toBe("on");
  });

  it("does nothing off /welcome", () => {
    const p = page("/");
    p.run(walkBootScript);
    expect(p.attrs.size).toBe(0);
  });
});

describe("the page", () => {
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const walk = readFileSync(path.join(root, "app/welcome/page.tsx"), "utf8");
  const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");

  it("draws the door in the server's frame, with no search-param hook to keep it out", () => {
    expect(walk).toMatch(/if \(!ready\) return <Room signedIn=\{false\} onDone=\{notYet\} onSkip=\{notYet\} \/>;/);
    expect(walk).not.toMatch(/useSearchParams\(/);
    expect(walk).toMatch(/useLayoutEffect\(\(\) => \{\s*const asked = new URLSearchParams\(window\.location\.search\)\.get\("step"\);/);
  });

  it("hides the door from a resuming walk and an account's links from its door", () => {
    expect(css).toMatch(/:root\[data-walk="resume"\] main\.room \{\s*visibility: hidden;/);
    expect(css).toMatch(/:root\[data-room-account\] \.room-door-layer \.room-top > \.room-link \{\s*display: none;/);
  });

  it("runs the first-run script before the splash's and the walk's after it", () => {
    const a = layout.indexOf("__html: firstRunBootScript");
    const b = layout.indexOf("__html: splashBootScript");
    const c = layout.indexOf("__html: walkBootScript");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});
