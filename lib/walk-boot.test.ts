import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { firstRunBootScript, ONBOARDING_KEY } from "./walk-boot";
import { isFirstRun, WELCOMED_KEY } from "./onboarding";

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

describe("the page", () => {
  const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");

  it("runs the first-run script before the splash's", () => {
    const a = layout.indexOf("__html: firstRunBootScript");
    const b = layout.indexOf("__html: splashBootScript");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
  });
});
