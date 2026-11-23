import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/lessons";

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

  it("holds each lesson's one vector, and no 3D cut of any size", () => {
    for (const l of LESSONS) expect(shell, l.id).toContain(`/lessons/${l.id}.svg`);
    expect(shell.filter((u) => /^\/lessons\/(large|hero)\/|^\/icons\/3d\/|\/lessons\/.*\.webp$/.test(u))).toEqual([]);
  });

  it("names only files that exist", () => {
    for (const u of shell.filter((u) => /\.\w+$/.test(u))) expect(existsSync(path.join(root, "public", u)), u).toBe(true);
  });

  it("moved CACHE with the flat set, so a phone holding v21 lets its 3D copies go", () => {
    expect(Number(sw.match(/const CACHE = "ethos-v(\d+)";/)![1])).toBeGreaterThanOrEqual(22);
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

/*
 * A lesson opened in a tunnel still has its picture (#448). Since the flat
 * set each lesson's object is one small SVG every screen draws, and all
 * fifteen are shell, so there is no cut to stand in for another: the
 * worker answers the file from its cache. The worker itself is run here,
 * its fetch handler fed a tunnel.
 */
describe("a lesson in a tunnel", () => {
  const ORIGIN = "https://speakethos.test";
  type Handler = (e: unknown) => void;

  /** The worker in a sandbox: its caches a map by path, its network up or down. */
  function boot(online: boolean, held: Record<string, string>) {
    const store = new Map<string, Response>(Object.entries(held).map(([u, body]) => [u, new Response(body, { status: 200 })]));
    const key = (r: string | { url: string }) => new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname;
    const fetched: string[] = [];
    const handlers: Record<string, Handler> = {};
    const caches = {
      match: async (r: string | { url: string }) => store.get(key(r))?.clone(),
      open: async () => ({
        put: async (r: { url: string }, res: Response) => void store.set(key(r), res),
        add: async () => {},
      }),
      keys: async () => [],
      delete: async () => true,
    };
    const sandbox = {
      self: { addEventListener: (type: string, fn: Handler) => (handlers[type] = fn), location: { origin: ORIGIN } },
      caches,
      fetch: async (r: { url: string }) => {
        fetched.push(key(r));
        if (!online) throw new TypeError("Failed to fetch");
        return new Response(`network ${key(r)}`, { status: 200 });
      },
      URL,
      Response,
      Promise,
    };
    vm.runInNewContext(sw, sandbox);
    /** What the page gets for a GET of `path`: its body, or null where the request fails. */
    const get = async (path: string): Promise<string | null> => {
      let answer: Promise<Response> | undefined;
      handlers.fetch({ request: { url: ORIGIN + path, method: "GET" }, respondWith: (p: Promise<Response>) => (answer = p) });
      if (!answer) return "(not handled)";
      try {
        return await (await answer).text();
      } catch {
        return null;
      }
    };
    return { get, store, fetched };
  }

  it("a lesson's object is answered offline from the shell", async () => {
    const w = boot(false, { "/lessons/the-landing.svg": "<svg>the-landing</svg>" });
    expect(await w.get("/lessons/the-landing.svg")).toBe("<svg>the-landing</svg>");
    expect(w.fetched).toEqual([]);
  });

  it("never stands one lesson in for another, and anything else missing offline fails", async () => {
    const w = boot(false, { "/lessons/the-landing.svg": "<svg>the-landing</svg>" });
    expect(await w.get("/lessons/the-crutch.svg")).toBeNull();
    expect(await w.get("/lessons/large/the-landing.webp")).toBeNull();
    expect(await w.get("/demos-celebrate.webp")).toBeNull();
  });

  it("online, a file not yet held is fetched and kept under its own path", async () => {
    const w = boot(true, {});
    expect(await w.get("/lessons/the-landing.svg")).toBe("network /lessons/the-landing.svg");
    await new Promise((r) => setTimeout(r, 0));
    expect(await w.store.get("/lessons/the-landing.svg")?.clone().text()).toBe("network /lessons/the-landing.svg");
    w.fetched.length = 0;
    expect(await w.get("/lessons/the-landing.svg")).toBe("network /lessons/the-landing.svg");
    expect(w.fetched).toEqual([]);
  });

  it("keeps no stand-in rule: the worker names no cut of a lesson but its file", () => {
    expect(sw).not.toMatch(/lessonStandIn|LESSON_ART/);
  });
});
