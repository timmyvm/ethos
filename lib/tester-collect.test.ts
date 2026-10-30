import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSENT_VERSION } from "@/content/tester";
import { Collector, ERRORS_PER_OPEN, tapOf, type CollectorEnv, type TapTarget } from "./tester-collect";
import { askedFrom, asksAgain, collects } from "./tester";
import { EVENT_CAPS } from "./tester-events";
import { setTesterSink, testerBoundary, testerListening, testerRecord } from "./tester-signal";

/**
 * Tester collection on the phone (consent version 3, lib/tester-collect.ts),
 * against a fake page: a clock, a path, a network that answers what the
 * test says, and a beacon that records what it was handed.
 */

function fakeEnv(opts: { status?: number; online?: boolean; token?: string | null; beacon?: boolean } = {}) {
  const env = {
    t: 1_761_900_000_000,
    path: "/",
    online: opts.online ?? true,
    status: opts.status ?? 200,
    token: opts.token === undefined ? "tok" : opts.token,
    beaconTakes: opts.beacon ?? true,
    sent: [] as { body: { events: { name: string; kind: string; screen?: string; ms?: number; label?: string; data?: Record<string, unknown> }[] }; token: string }[],
    beacons: [] as { events: unknown[]; token: string }[],
  };
  const api: CollectorEnv = {
    now: () => env.t,
    path: () => env.path,
    online: () => env.online,
    token: async () => env.token,
    send: async (body, token) => {
      env.sent.push({ body: JSON.parse(body), token });
      return env.status;
    },
    beacon: (body) => {
      if (!env.beaconTakes) return false;
      env.beacons.push(JSON.parse(body));
      return true;
    },
  };
  return { env, api };
}

describe("who collects", () => {
  const at = "2026-10-30T09:00:00.000Z";
  it("a tester on consent version 3, and nobody else, ever", () => {
    expect(collects({ consent_version: CONSENT_VERSION, consented_at: at })).toBe(true);
    expect(collects({ consent_version: 2, consented_at: at })).toBe(false);
    expect(collects({ consent_version: 1, consented_at: at })).toBe(false);
    expect(collects(null)).toBe(false);
    expect(collects(undefined)).toBe(false);
  });

  /* The layer reads the row only on a device that last saw a tester, and
     the collector's file is imported only after the row says version 3:
     a non-tester's phone never loads it. */
  it("loads the collector only after the row says so, and nothing imports it otherwise", () => {
    const layer = readFileSync("components/tester/TesterLayer.tsx", "utf8");
    const hint = layer.indexOf("if (!readTesterHint())");
    const read = layer.indexOf("fetchTester()");
    const gate = layer.indexOf("if (!collects(t))");
    const load = layer.indexOf('await import("@/lib/tester-collect")');
    expect(hint).toBeGreaterThan(0);
    expect(read).toBeGreaterThan(hint);
    expect(gate).toBeGreaterThan(read);
    expect(load).toBeGreaterThan(gate);
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return sources(full);
        return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
      });
    const importers = ["app", "components", "lib"]
      .flatMap(sources)
      .filter((f) => /^import (?!type )[^;]*from "@\/lib\/tester-collect"/m.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([]);
    expect(readFileSync("app/layout.tsx", "utf8")).toMatch(/<TesterLayer \/>/);
  });

  it("the recording screen and the error boundary speak to nothing until a collector listens", () => {
    let heard = 0;
    expect(testerListening()).toBe(false);
    testerRecord("record_start");
    testerBoundary(new Error("x"));
    setTesterSink({ record: () => heard++, boundary: () => heard++ });
    testerRecord("record_stop", { seconds: 4 });
    testerBoundary(new Error("y"));
    setTesterSink(null);
    testerRecord("record_start");
    expect(heard).toBe(2);
  });
});

describe("asking a tester on an older consent again", () => {
  const old = { consent_version: CONSENT_VERSION - 1, consented_at: "2026-10-29T09:00:00.000Z" };
  it("asks once, over a tab or Settings, never mid-recording or mid-introduction", () => {
    expect(asksAgain({ tester: old, asked: 0, pathname: "/" })).toBe(true);
    expect(asksAgain({ tester: old, asked: CONSENT_VERSION - 1, pathname: "/history" })).toBe(true);
    expect(asksAgain({ tester: old, asked: CONSENT_VERSION, pathname: "/" })).toBe(false);
    for (const path of ["/rep", "/welcome", "/tester", "/privacy", "/rep/abc"]) {
      expect(asksAgain({ tester: old, asked: 0, pathname: path }), path).toBe(false);
    }
    expect(asksAgain({ tester: { ...old, consent_version: CONSENT_VERSION }, asked: 0, pathname: "/" })).toBe(false);
    expect(asksAgain({ tester: null, asked: 0, pathname: "/" })).toBe(false);
  });

  it("goes back to the screen it opened over, or Today", () => {
    expect(askedFrom("/history")).toBe("/history");
    expect(askedFrom("https://evil.example")).toBe("/");
    expect(askedFrom("//evil.example")).toBe("/");
    expect(askedFrom(null)).toBe("/");
  });
});

describe("the collector", () => {
  it("counts time on each screen, and a screen shown again as the same view", async () => {
    const { env, api } = fakeEnv();
    const c = new Collector(api, true);
    env.t += 4000;
    c.route("/history?x=1");
    env.t += 2500;
    c.hidden();
    env.t += 60_000;
    c.shown();
    env.t += 1000;
    c.route("/rep/8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c");
    const usage = c.waiting.map((e) => [e.name, e.screen, e.ms ?? null, e.data?.cont ?? false]);
    expect(usage).toEqual([
      ["screen", "/", 4000, false],
      ["hidden", "/history", null, false],
      ["screen", "/history", 2500, false],
      ["shown", "/history", null, false],
      ["screen", "/history", 1000, true],
    ]);
    // Hidden time is never screen time, and a recording's page is one screen.
    c.route("/rep/0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d");
    expect(c.waiting.at(-1)?.name).toBe("screen");
  });

  it("holds at most two hundred events while it cannot send, the oldest let go first", async () => {
    const { env, api } = fakeEnv({ online: false });
    const c = new Collector(api, true);
    for (let i = 0; i < 250; i++) c.tap(`B${i}`, "button");
    expect(c.waiting).toHaveLength(EVENT_CAPS.queue);
    expect(c.waiting[0].label).toBe("B50");
    await c.flush();
    expect(env.sent).toEqual([]);
  });

  it("sends a batch of at most forty with the session's token, and lets it go once taken", async () => {
    const { env, api } = fakeEnv();
    const c = new Collector(api, true);
    for (let i = 0; i < 45; i++) c.tap(`B${i}`, "button");
    await c.flush();
    expect(env.sent).toHaveLength(1);
    expect(env.sent[0].token).toBe("tok");
    expect(env.sent[0].body.events).toHaveLength(EVENT_CAPS.batch);
    expect(c.waiting).toHaveLength(5);
    await c.flush();
    expect(c.waiting).toHaveLength(0);
  });

  it("keeps a batch the server could not take, and drops one it refused as malformed", async () => {
    const { env, api } = fakeEnv({ status: 503 });
    const c = new Collector(api, true);
    c.tap("Start", "button");
    await c.flush();
    expect(c.waiting).toHaveLength(1);
    env.status = 413;
    await c.flush();
    expect(c.waiting).toHaveLength(0);
  });

  it("stops for good when the server says this account is not testing, and lets go of what waits", async () => {
    const { env, api } = fakeEnv({ status: 403 });
    const c = new Collector(api, true);
    c.tap("Start", "button");
    c.tap("Stop", "button");
    await c.flush();
    expect(c.stopped).toBe(true);
    expect(c.waiting).toHaveLength(0);
    c.tap("After", "button");
    c.hidden();
    await c.flush();
    expect(c.waiting).toHaveLength(0);
    expect(env.sent).toHaveLength(1);
  });

  it("sends nothing with no session", async () => {
    const { env, api } = fakeEnv({ token: null });
    const c = new Collector(api, true);
    c.tap("Start", "button");
    await c.flush();
    expect(env.sent).toEqual([]);
    expect(c.waiting).toHaveLength(1);
  });

  it("hands what waits to the beacon as the page hides, with the last token known", async () => {
    const { env, api } = fakeEnv();
    const c = new Collector(api, true);
    await c.primeToken();
    c.tap("Start", "button");
    env.t += 3000;
    c.hidden();
    expect(env.beacons).toHaveLength(1);
    expect(env.beacons[0].token).toBe("tok");
    expect((env.beacons[0].events as { name: string }[]).map((e) => e.name)).toEqual(["tap", "hidden", "screen"]);
    expect(c.waiting).toHaveLength(0);
  });

  it("keeps the batch when the beacon is refused, for the next send", async () => {
    const { env, api } = fakeEnv({ beacon: false });
    const c = new Collector(api, true);
    await c.primeToken();
    c.tap("Start", "button");
    env.t += 2000;
    c.leaving();
    expect(c.waiting.map((e) => e.name)).toEqual(["tap", "screen"]);
  });

  it("reports an error with the screen and the last five usage events, twenty an open at most", () => {
    const { env, api } = fakeEnv();
    const c = new Collector(api, true);
    c.route("/rep");
    for (let i = 0; i < 7; i++) c.tap(`B${i}`, "button");
    env.t += 900;
    c.error("window", { message: "TypeError: x is undefined", where: "/_next/x.js:1:2", stack: "at f" });
    const err = c.waiting.at(-1)!;
    expect(err).toMatchObject({ kind: "error", name: "window", screen: "/rep" });
    const before = err.data!.before as { label?: string; ago: number }[];
    expect(before.map((b) => b.label)).toEqual(["B2", "B3", "B4", "B5", "B6"]);
    expect(before[4].ago).toBe(900);
    // The same error again at once is the same error.
    c.error("window", { message: "TypeError: x is undefined" });
    expect(c.waiting.filter((e) => e.kind === "error")).toHaveLength(1);
    for (let i = 0; i < 40; i++) c.error("rejection", { message: `E${i}` });
    expect(c.waiting.filter((e) => e.kind === "error")).toHaveLength(ERRORS_PER_OPEN);
  });
});

/** A fake element: enough of the DOM for a tap to be read. */
type FakeEl = TapTarget & { parent: TapTarget | null };
function el(tag: string, attrs: Record<string, string> = {}, text = "", parent: FakeEl | null = null): FakeEl {
  const self: FakeEl = {
    tagName: tag.toUpperCase(),
    parent,
    textContent: text,
    getAttribute: (n) => attrs[n] ?? null,
    closest(selector: string) {
      const matches = (e: TapTarget): boolean =>
        selector.split(",").some((raw) => {
          const s = raw.trim();
          const tagOnly = s.match(/^([a-z]+)$/);
          if (tagOnly) return e.tagName.toLowerCase() === tagOnly[1];
          const tagAttr = s.match(/^([a-z]+)\[([a-z-]+)\]$/);
          if (tagAttr) return e.tagName.toLowerCase() === tagAttr[1] && e.getAttribute(tagAttr[2]) !== null;
          const attrEq = s.match(/^\[([a-z-]+)="([^"]*)"\]$/);
          if (attrEq) return e.getAttribute(attrEq[1]) === attrEq[2];
          const attr = s.match(/^\[([a-z-]+)\]$/);
          if (attr) return e.getAttribute(attr[1]) !== null;
          return false;
        });
      let at: (TapTarget & { parent?: TapTarget | null }) | null = self;
      while (at) {
        if (matches(at)) return at;
        at = (at as { parent?: TapTarget | null }).parent ?? null;
      }
      return null;
    },
  };
  return self;
}

describe("a tap", () => {
  it("is a control's accessible name or visible label, with its role", () => {
    expect(tapOf(el("button", {}, "  The numbers "))).toEqual({ label: "The numbers", role: "button" });
    expect(tapOf(el("button", { "aria-label": "Stop and score this recording" }, ""))).toEqual({
      label: "Stop and score this recording",
      role: "button",
    });
    expect(tapOf(el("a", { href: "/history" }, "Log"))).toEqual({ label: "Log", role: "link" });
    expect(tapOf(el("button", { role: "radio" }, "Too low"))).toEqual({ label: "Too low", role: "radio" });
    // A tap on the words inside a button is a tap on the button.
    const button = el("button", {}, "Continue");
    expect(tapOf(el("span", {}, "Continue", button))).toEqual({ label: "Continue", role: "button" });
  });

  it("is nothing on a field, so what is typed is never read, nor on text that is no control", () => {
    expect(tapOf(el("input", { name: "tester-code" }, ""))).toBeNull();
    expect(tapOf(el("textarea", {}, "What felt off: my note"))).toBeNull();
    expect(tapOf(el("div", { contenteditable: "true" }, "typed"))).toBeNull();
    expect(tapOf(el("p", {}, "Some words"))).toBeNull();
    expect(tapOf(null)).toBeNull();
  });

  it("keeps a private control's role and leaves its name out", () => {
    const box = el("div", { "data-tester-private": "" }, "");
    expect(tapOf(el("button", {}, "Tim's name", box))).toEqual({ label: null, role: "button" });
  });
});
