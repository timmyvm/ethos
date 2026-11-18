import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The worker's install after the first screen, and lighter (#508, the
 * speed audit's fix 3): on a first open it pre-cached 61 files (1.27 MB)
 * from the page's `load`, on the same link as Today's reads.
 */
const root = path.resolve(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const sw = src("public/sw.js");
const shell = [...sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).matchAll(/^\s*"([^"]+)",/gm)].map((m) => m[1]);

describe("the offline shell", () => {
  it("is read (the list is where it was)", () => {
    expect(shell).toContain("/");
    expect(shell).toContain("/splash-demos.webp");
    expect(shell.length).toBeGreaterThan(30);
  });

  it("never pre-caches the manifest's icons: the phone fetches those itself, the app never draws them", () => {
    expect(shell).not.toContain("/icon-192.png");
    expect(shell).not.toContain("/icon-512.png");
    expect(shell).not.toContain("/icon-maskable-512.png");
  });

  it("leaves the lesson art's large cuts to the first view", () => {
    expect(shell.filter((u) => u.startsWith("/lessons/large/"))).toEqual([]);
  });

  it("names only files that exist", () => {
    for (const u of shell.filter((u) => /\.\w+$/.test(u))) expect(existsSync(path.join(root, "public", u)), u).toBe(true);
  });

  it("moved CACHE with the change, so a phone holding v20 lets its copies go", () => {
    expect(Number(sw.match(/const CACHE = "ethos-v(\d+)";/)![1])).toBeGreaterThanOrEqual(21);
  });
});

describe("the worker registers after the first screen is drawn", () => {
  const reg = src("components/ServiceWorker.tsx");

  it("waits for the screen's numbers, then for idle, never only for load", () => {
    expect(reg).toMatch(/onDrawn\(register\)/);
    expect(reg).toMatch(/whenIdle\(\(\) => \{\s*navigator\.serviceWorker\.register\("\/sw\.js"\)/);
    expect(reg).toMatch(/if \(!drawExpected\(\)\) return register\(\);/);
  });

  it("still installs when the screen is left before its numbers land", () => {
    expect(reg).toMatch(/latest = window\.setTimeout\(register, LATEST_MS\);/);
    expect(reg).toMatch(/if \(asked\) return;/);
  });
});
