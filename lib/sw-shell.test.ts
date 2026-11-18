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

/*
 * A lesson opened in a tunnel still has its picture (#448), kept at no
 * install cost (the final pass of 18 Nov): v21 left the large cuts to the
 * first view, and a 3x phone draws Today's object from /lessons/hero/, so
 * a lesson page offline asked for a 560 this phone never fetched. The
 * worker itself is run here, its fetch handler fed a tunnel.
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

  it("a 560 never drawn here is answered offline by the thumbnail the shell holds", async () => {
    const w = boot(false, { "/lessons/the-landing.webp": "360 the-landing" });
    expect(await w.get("/lessons/large/the-landing.webp")).toBe("360 the-landing");
  });

  it("the best cut held wins: Today's 720 stands in for the lesson page's 560, and the 560 for a 3x phone's 720", async () => {
    const w = boot(false, {
      "/lessons/the-landing.webp": "360 the-landing",
      "/lessons/hero/the-landing.webp": "720 the-landing",
      "/lessons/second-pass.webp": "360 second-pass",
      "/lessons/large/second-pass.webp": "560 second-pass",
    });
    expect(await w.get("/lessons/large/the-landing.webp")).toBe("720 the-landing");
    expect(await w.get("/lessons/hero/second-pass.webp")).toBe("560 second-pass");
    // Say it better's stage art (#507) is the same file, so it is kept the same way.
    expect(await w.get("/lessons/large/second-pass.webp")).toBe("560 second-pass");
  });

  it("never stands one lesson in for another, and anything else missing offline fails as before", async () => {
    const w = boot(false, { "/lessons/the-landing.webp": "360 the-landing" });
    expect(await w.get("/lessons/large/the-crutch.webp")).toBeNull();
    expect(await w.get("/demos-celebrate.webp")).toBeNull();
    expect(await w.get("/icons/3d/streak.webp")).toBeNull();
  });

  it("online, the cut asked for is fetched and kept under its own path: no stand-in", async () => {
    const w = boot(true, { "/lessons/the-landing.webp": "360 the-landing" });
    expect(await w.get("/lessons/large/the-landing.webp")).toBe("network /lessons/large/the-landing.webp");
    await new Promise((r) => setTimeout(r, 0));
    expect(await w.store.get("/lessons/large/the-landing.webp")?.clone().text()).toBe("network /lessons/large/the-landing.webp");
    // Kept once, drawn from the phone after: the network is not asked again.
    w.fetched.length = 0;
    expect(await w.get("/lessons/large/the-landing.webp")).toBe("network /lessons/large/the-landing.webp");
    expect(w.fetched).toEqual([]);
  });

  it("costs the install nothing: every lesson's thumbnail is shell, no large or hero cut is", () => {
    for (const l of LESSONS) expect(shell, l.id).toContain(`/lessons/${l.id}.webp`);
    expect(shell.filter((u) => /^\/lessons\/(large|hero)\//.test(u))).toEqual([]);
  });
});
