import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READ_AGAIN_MS, readAgainAfter, readAgainWhenBack } from "./tester-retry";
import { TESTER_HINT_KEY } from "./tester-signal";

/*
 * A tester who opened the home-screen app with no connection (a train, a
 * lift) had the open's read of their testers row fail, and nothing read
 * it again: the rest of that page life, which on an iPhone can be days,
 * sent Timothy nothing, the errors held since the open included. The
 * same with a session that could not be refreshed offline, which read
 * as no row at all.
 */

const fake = vi.hoisted(() => ({
  session: { userId: "u-1", token: "tok" } as { userId: string; token: string } | null,
  /** What the testers read answers, in turn. */
  answers: [] as ({ data: unknown; error: unknown } | "throw")[],
  reads: 0,
}));

vi.mock("./supabase-browser", () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => {
      fake.reads++;
      const next = fake.answers.shift() ?? { data: null, error: null };
      if (next === "throw") throw new Error("Failed to fetch");
      return next;
    },
  };
  return {
    supabaseBrowser: () => ({ from: () => query }),
    currentSession: async () => fake.session,
    sessionToken: async () => fake.session?.token ?? null,
    ensureSession: async () => fake.session?.token ?? null,
  };
});

function page(hinted: boolean) {
  const store = new Map<string, string>(hinted ? [[TESTER_HINT_KEY, "1"]] : []);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  const win = Object.assign(new EventTarget(), { location: { pathname: "/", origin: "https://speakethos.com" } });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  return { store, win, doc };
}

const ROW = { consent_version: 3, consented_at: "2026-10-30T09:00:00.000Z", created_at: "2026-10-30T09:00:00.000Z" };

beforeEach(() => {
  fake.session = { userId: "u-1", token: "tok" };
  fake.answers = [];
  fake.reads = 0;
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reading a tester's row again", () => {
  it("waits longer each time, five minutes at most", () => {
    expect(readAgainAfter(1)).toBe(15_000);
    expect(readAgainAfter(2)).toBe(30_000);
    expect(readAgainAfter(99)).toBe(READ_AGAIN_MS.at(-1));
    expect(READ_AGAIN_MS.at(-1)).toBe(300_000);
  });

  it("goes once, at the first of the connection back, the app shown again or the wait", () => {
    vi.useFakeTimers();
    const { win, doc } = page(true);
    let n = 0;
    readAgainWhenBack(1, () => n++);
    win.dispatchEvent(new Event("online"));
    win.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(20_000);
    expect(n).toBe(1);

    readAgainWhenBack(1, () => n++);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(n).toBe(1);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(n).toBe(2);

    readAgainWhenBack(2, () => n++);
    vi.advanceTimersByTime(29_000);
    expect(n).toBe(2);
    vi.advanceTimersByTime(1_000);
    expect(n).toBe(3);
  });

  it("does nothing once cancelled", () => {
    vi.useFakeTimers();
    const { win } = page(true);
    let n = 0;
    const cancel = readAgainWhenBack(1, () => n++);
    cancel();
    win.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(600_000);
    expect(n).toBe(0);
  });
});

describe("the shared read of the row", () => {
  it("asks again after a read that failed", async () => {
    page(true);
    const { testerOnce } = await import("./tester-client");
    fake.answers = ["throw", { data: ROW, error: null }];
    await expect(testerOnce()).rejects.toThrow();
    expect(await testerOnce()).toEqual(ROW);
    expect(fake.reads).toBe(2);
  });

  it("asks again after no session could be read while the hint stands", async () => {
    page(true);
    const { testerOnce } = await import("./tester-client");
    fake.session = null;
    expect(await testerOnce()).toBeNull();
    fake.session = { userId: "u-1", token: "tok" };
    fake.answers = [{ data: ROW, error: null }];
    expect(await testerOnce()).toEqual(ROW);
    expect(fake.reads).toBe(1);
  });

  it("keeps a row, once per page life", async () => {
    page(true);
    const { testerOnce } = await import("./tester-client");
    fake.answers = [{ data: ROW, error: null }];
    await testerOnce();
    await testerOnce();
    expect(fake.reads).toBe(1);
  });
});

describe("the layer", () => {
  const layer = readFileSync("components/tester/TesterLayer.tsx", "utf8");

  it("reads again when the read had no answer, and stops waiting when it goes", () => {
    expect(layer).toMatch(/\.catch\(unknown\)/);
    expect(layer).not.toMatch(/\.catch\(unwatch\)/);
    expect(layer).toMatch(/if \(t === null && readTesterHint\(\)\) return unknown\(\);/);
    expect(layer).toMatch(/readAgainWhenBack\(misses\.current, \(\) => setCheck\(\(n\) => n \+ 1\)\)/);
    const cleanup = layer.slice(layer.indexOf("return () => {\n      live = false;"));
    expect(cleanup).toMatch(/cancelAgain\(\);/);
  });
});
