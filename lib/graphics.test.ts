import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALIVE_KEY,
  CRASHED_KEY,
  LITE_WHY_KEY,
  autoLite,
  graphicsBootScript,
  liteDevice,
  liteGraphics,
  liteWhy,
  markAlive,
  markGone,
  takeCrash,
} from "./graphics";
import { prefersReducedMotion } from "./prefs";

/** A localStorage and a <html> that keeps its attributes, as the boot script sees them. */
function fakeWindow(opts: { ua?: string; dpr?: number; memory?: number; hidden?: boolean; path?: string } = {}) {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };
  const attrs = new Map<string, string>();
  const html = {
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    getAttribute: (k: string) => attrs.get(k) ?? null,
  };
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("document", { documentElement: html, visibilityState: opts.hidden ? "hidden" : "visible" });
  vi.stubGlobal("navigator", { userAgent: opts.ua ?? "Mozilla/5.0 (Macintosh)", deviceMemory: opts.memory });
  vi.stubGlobal("window", { devicePixelRatio: opts.dpr ?? 2, matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("location", { pathname: opts.path ?? "/" });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  return { store, attrs, boot: () => new Function(graphicsBootScript)() };
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1";

describe("lite graphics (#412)", () => {
  beforeEach(() => fakeWindow());
  afterEach(() => vi.unstubAllGlobals());

  it("guesses lite for a small phone and not for a big one", () => {
    expect(liteDevice({ ua: IPHONE, dpr: 2 })).toBe(true); // SE, XR, 11
    expect(liteDevice({ ua: IPHONE, dpr: 3 })).toBe(false); // Nick's 3x iPhone draws full until it shows otherwise
    expect(liteDevice({ ua: "Mozilla/5.0 (iPad; CPU OS 18_7)", dpr: 2 })).toBe(false);
    expect(liteDevice({ ua: "Mozilla/5.0 (Linux; Android 14)", dpr: 2.6, memoryGb: 2 })).toBe(true);
    expect(liteDevice({ ua: "Mozilla/5.0 (Linux; Android 14)", dpr: 2.6, memoryGb: 8 })).toBe(false);
  });

  it("reads a page that died on screen as a crash, and draws the reload lite", () => {
    const w = fakeWindow({ ua: IPHONE, dpr: 3, path: "/rep" });
    w.store.set(ALIVE_KEY, JSON.stringify({ path: "/rep", at: 1_700_000_000_000 }));
    w.boot();
    expect(w.store.get(LITE_WHY_KEY)).toBe("crash");
    expect(JSON.parse(w.store.get(CRASHED_KEY)!)).toEqual({ path: "/rep", at: 1_700_000_000_000 });
    expect(w.attrs.get("data-graphics")).toBe("lite");
    expect(w.attrs.get("data-motion")).toBe("reduce");
    // And this page is the one on screen now.
    expect(JSON.parse(w.store.get(ALIVE_KEY)!).path).toBe("/rep");
  });

  it("draws full on a phone that never crashed", () => {
    const w = fakeWindow({ ua: IPHONE, dpr: 3 });
    w.boot();
    expect(w.store.has(LITE_WHY_KEY)).toBe(false);
    expect(w.store.has(CRASHED_KEY)).toBe(false);
    expect(w.attrs.get("data-graphics")).toBe("full");
    expect(w.attrs.has("data-motion")).toBe(false); // the theme's script answers motion
  });

  it("an end the app saw (hidden, pagehide) is not a crash", () => {
    const w = fakeWindow({ ua: IPHONE, dpr: 3 });
    markAlive("/rep");
    markGone();
    w.boot();
    expect(w.store.has(CRASHED_KEY)).toBe(false);
    expect(w.attrs.get("data-graphics")).toBe("full");
  });

  it("guesses lite on a 2x iPhone from its first open", () => {
    const w = fakeWindow({ ua: IPHONE, dpr: 2 });
    w.boot();
    expect(w.store.get(LITE_WHY_KEY)).toBe("device");
    expect(w.attrs.get("data-graphics")).toBe("lite");
  });

  it("keeps the person's choice over every guess, both ways", () => {
    const off = fakeWindow({ ua: IPHONE, dpr: 2 });
    off.store.set("ethos.prefs", JSON.stringify({ liteGraphics: false }));
    off.store.set(ALIVE_KEY, JSON.stringify({ path: "/rep", at: 1 }));
    off.boot();
    expect(off.attrs.get("data-graphics")).toBe("full");
    // The crash is still reported to tester collection.
    expect(off.store.has(CRASHED_KEY)).toBe(true);

    const on = fakeWindow({ ua: IPHONE, dpr: 3 });
    on.store.set("ethos.prefs", JSON.stringify({ liteGraphics: true }));
    on.boot();
    expect(on.attrs.get("data-graphics")).toBe("lite");
  });

  it("does not mark a page opened hidden as on screen", () => {
    const w = fakeWindow({ hidden: true });
    w.boot();
    expect(w.store.has(ALIVE_KEY)).toBe(false);
  });

  it("survives a corrupt store", () => {
    const w = fakeWindow({ ua: IPHONE, dpr: 3 });
    w.store.set("ethos.prefs", "{not json");
    w.store.set(ALIVE_KEY, "{not json");
    expect(() => w.boot()).not.toThrow();
    expect(w.attrs.get("data-graphics")).toBe("lite");
    expect(JSON.parse(w.store.get(CRASHED_KEY)!).path).toBe("/");
  });

  it("goes lite at runtime when the graphics are lost, unless the person chose", () => {
    const w = fakeWindow();
    expect(liteGraphics()).toBe(false);
    autoLite("gpu");
    expect(liteWhy()).toBe("gpu");
    expect(liteGraphics()).toBe(true);
    expect(w.attrs.get("data-graphics")).toBe("lite");

    const chosen = fakeWindow();
    chosen.store.set("ethos.prefs", JSON.stringify({ liteGraphics: false }));
    autoLite("gpu");
    expect(liteWhy()).toBeNull();
    expect(liteGraphics()).toBe(false);
  });

  it("is the reduced-motion app, so Demos's clip and the flourishes stand down", () => {
    const w = fakeWindow();
    expect(prefersReducedMotion()).toBe(false);
    w.store.set(LITE_WHY_KEY, "crash");
    expect(prefersReducedMotion()).toBe(true);
  });

  it("hands a crash to tester collection once", () => {
    const w = fakeWindow();
    w.store.set(CRASHED_KEY, JSON.stringify({ path: "/rep", at: 5 }));
    expect(takeCrash()).toEqual({ path: "/rep", at: 5 });
    expect(takeCrash()).toBeNull();
  });
});
