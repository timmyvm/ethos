import { describe, expect, it } from "vitest";
import {
  capText,
  cleanEvent,
  cleanEvents,
  cleanStack,
  describeDevice,
  EVENT_CAPS,
  fitted,
  screenOf,
} from "./tester-events";

/**
 * What a tester's phone may send (consent version 3, migration 0022),
 * as the server cleans it before a row is written. Every field is
 * picked by name and capped; the things the consent never lists (typed
 * text, the tester code, anything outside Ethos) have no slot to land in.
 */

const NOW = new Date("2026-11-03T09:00:00.000Z");
const T = NOW.getTime();

describe("a screen's name", () => {
  it("is the path alone: never a query or a hash, so never a code or a token", () => {
    expect(screenOf("/tester?from=welcome&code=1234")).toBe("/tester");
    expect(screenOf("/auth/callback?code=abc#access_token=xyz")).toBe("/auth/callback");
    expect(screenOf("https://speakethos.com/history?x=1")).toBe("/history");
  });

  it("counts every recording's page as one screen, and keeps the rest as written", () => {
    expect(screenOf("/rep/8a3e2a8c-0b8e-4b52-9f39-8a1c4f0a1b2c")).toBe("/rep/[id]");
    expect(screenOf("/lessons/the-landing")).toBe("/lessons/the-landing");
    expect(screenOf("/")).toBe("/");
    expect(screenOf("history/")).toBe("/history");
  });

  it("is capped, and nothing for something that is not a path", () => {
    expect(screenOf("/" + "a".repeat(500))!.length).toBe(EVENT_CAPS.screen);
    expect(screenOf(42)).toBeNull();
    expect(screenOf(null)).toBeNull();
  });
});

describe("one event", () => {
  it("is one Ethos sends, by kind and name, or nothing", () => {
    expect(cleanEvent({ kind: "usage", name: "tap", at: T }, NOW)).not.toBeNull();
    expect(cleanEvent({ kind: "usage", name: "open", at: T }, NOW)).toBeNull();
    expect(cleanEvent({ kind: "keys", name: "press", at: T }, NOW)).toBeNull();
    expect(cleanEvent({ kind: "__proto__", name: "tap" }, NOW)).toBeNull();
    expect(cleanEvent("tap", NOW)).toBeNull();
    expect(cleanEvent(null, NOW)).toBeNull();
  });

  it("keeps a tap's label (capped) and a screen's time (clamped to a day), and nothing else's", () => {
    const tap = cleanEvent({ kind: "usage", name: "tap", label: `  Start \n ${"x".repeat(200)}`, ms: 5, screen: "/" }, NOW)!;
    expect(tap.label!.startsWith("Start x")).toBe(true);
    expect(Array.from(tap.label!).length).toBeLessThanOrEqual(EVENT_CAPS.label);
    expect(tap.ms).toBeNull();
    const screen = cleanEvent({ kind: "usage", name: "screen", label: "Start", ms: 9e12, screen: "/" }, NOW)!;
    expect(screen.label).toBeNull();
    expect(screen.ms).toBe(EVENT_CAPS.ms);
    expect(cleanEvent({ kind: "usage", name: "screen", ms: -4 }, NOW)!.ms).toBe(0);
  });

  it("takes the phone's clock within a week back and five minutes ahead, and the server's otherwise", () => {
    expect(cleanEvent({ kind: "usage", name: "shown", at: T - 3600_000 }, NOW)!.at).toBe(new Date(T - 3600_000).toISOString());
    expect(cleanEvent({ kind: "usage", name: "shown", at: T - 8 * 86_400_000 }, NOW)!.at).toBe(NOW.toISOString());
    expect(cleanEvent({ kind: "usage", name: "shown", at: T + 3600_000 }, NOW)!.at).toBe(NOW.toISOString());
    expect(cleanEvent({ kind: "usage", name: "shown", at: "soon" }, NOW)!.at).toBe(NOW.toISOString());
  });

  it("keeps an open's id only in its own shape", () => {
    expect(cleanEvent({ kind: "usage", name: "shown", open: "k3x9-1a2b" }, NOW)!.open_id).toBe("k3x9-1a2b");
    expect(cleanEvent({ kind: "usage", name: "shown", open: "<script>" }, NOW)!.open_id).toBeNull();
  });

  /* The consent names taps, never typing: whatever else a phone puts on
     an event has nowhere to go. */
  it("has no slot for typed text: only the fields named for its kind are kept", () => {
    const tap = cleanEvent(
      { kind: "usage", name: "tap", label: "Continue", data: { role: "button", value: "1234", text: "my secret", typed: "x" } },
      NOW
    )!;
    expect(tap.data).toEqual({ role: "button" });
    const screen = cleanEvent({ kind: "usage", name: "screen", data: { cont: true, query: "code=1234" } }, NOW)!;
    expect(screen.data).toEqual({ cont: true });
    const start = cleanEvent({ kind: "usage", name: "record_start", data: { video: true, transcript: "hello" } }, NOW)!;
    expect(start.data).toEqual({ video: true });
    const stop = cleanEvent({ kind: "usage", name: "record_stop", data: { seconds: 61.2, discarded: false, audio: "…" } }, NOW)!;
    expect(stop.data).toEqual({ seconds: 61.2, discarded: false });
  });
});

describe("the device snapshot", () => {
  const iphone = {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    platform: "iPhone",
    screen_w: 390,
    screen_h: 844,
    viewport_w: 390,
    viewport_h: 664,
    dpr: 3,
    lang: "en-AU",
    langs: ["en-AU", "en"],
    tz: "Australia/Melbourne",
    tz_offset: -660,
    display: "standalone",
    home_screen: true,
    email: "someone@example.com",
    name: "Tim",
  };

  it("keeps only the fields the consent names, and reads the system and browser from them", () => {
    const row = cleanEvent({ kind: "device", name: "open", data: iphone, screen: "/" }, NOW)!;
    expect(row.data).toMatchObject({
      os: "iOS 18.1",
      browser: "Safari (home screen)",
      model: "iPhone",
      screen_w: 390,
      screen_h: 844,
      dpr: 3,
      lang: "en-AU",
      tz: "Australia/Melbourne",
      display: "standalone",
      home_screen: true,
    });
    expect(row.data).not.toHaveProperty("email");
    expect(row.data).not.toHaveProperty("name");
  });

  it("drops a value out of its range or of the wrong type, rather than keeping a guess", () => {
    const row = cleanEvent(
      { kind: "device", name: "open", data: { screen_w: -1, dpr: 400, rtt: "fast", display: "theatre", save_data: "yes", downlink: 10 } },
      NOW
    )!;
    expect(row.data).toEqual({ downlink: 10 });
  });

  it("names an Android phone by its model and real version when Chrome's hints give them", () => {
    expect(
      describeDevice({
        ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
        platform: "Android",
        platform_version: "15.0.0",
        model: "Pixel 9",
      })
    ).toEqual({ os: "Android 15", browser: "Chrome 131", model: "Pixel 9" });
    expect(
      describeDevice({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" })
    ).toEqual({ os: "iOS 17.5", browser: "Safari 17.5", model: "iPhone" });
    expect(describeDevice({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1" }).browser).toBe("Chrome 131");
    expect(describeDevice({})).toEqual({ os: null, browser: null, model: null });
  });
});

describe("an error", () => {
  it("keeps its message, Ethos's own file and stack lines, and the usage just before it", () => {
    const row = cleanEvent(
      {
        kind: "error",
        name: "window",
        screen: "/rep?lesson=h4",
        data: {
          message: "TypeError: x is undefined at https://speakethos.com/_next/static/chunks/app.js",
          where: "https://speakethos.com/_next/static/chunks/app/rep/page.js:1:200",
          stack:
            "TypeError: x is undefined\n    at f (https://speakethos.com/_next/static/chunks/app.js:1:2)\n    at g (chrome-extension://abc/inject.js:3:4)",
          before: [
            { name: "tap", screen: "/rep?code=1", label: "Stop and score this recording", ago: 1200 },
            { name: "keypress", label: "a" },
            { name: "screen", screen: "/", ms: 4000 },
          ],
          cookie: "sb=…",
        },
      },
      NOW
    )!;
    expect(row.screen).toBe("/rep");
    expect(row.data.message).toBe("TypeError: x is undefined at /_next/static/chunks/app.js");
    expect(row.data.where).toBe("/_next/static/chunks/app/rep/page.js:1:200");
    expect(row.data.stack).toBe("TypeError: x is undefined\n    at f (/_next/static/chunks/app.js:1:2)");
    expect(row.data.before).toEqual([
      { name: "tap", screen: "/rep", label: "Stop and score this recording", ago: 1200 },
      { name: "screen", screen: "/", ms: 4000 },
    ]);
    expect(row.data).not.toHaveProperty("cookie");
  });

  it("carries at most the last five usage events, and a capped stack", () => {
    const before = Array.from({ length: 12 }, (_, i) => ({ name: "tap", label: `B${i}` }));
    const row = cleanEvent({ kind: "error", name: "rejection", data: { before, stack: "x\n".repeat(5000) } }, NOW)!;
    expect((row.data.before as unknown[]).length).toBe(EVENT_CAPS.recent);
    expect((row.data.before as { label: string }[])[0].label).toBe("B7");
    expect((row.data.stack as string).length).toBeLessThanOrEqual(EVENT_CAPS.stack);
  });

  it("fits the column even in four-byte characters: the stack goes first, never the row", () => {
    const wide = "𝔁".repeat(EVENT_CAPS.stack);
    const row = cleanEvent({ kind: "error", name: "boundary", data: { message: "𝔁".repeat(400), stack: wide } }, NOW)!;
    expect(new TextEncoder().encode(JSON.stringify(row.data)).length).toBeLessThanOrEqual(5000);
    expect(row.data.message).toBeDefined();
    expect(fitted({ a: "x" })).toEqual({ a: "x" });
  });

  it("lets go of stack lines from other origins", () => {
    expect(cleanStack("a\nat moz-extension://x/y.js:1:1\nat webkit-masked-url://hidden/:1:1")).toBe("a");
    expect(cleanStack(42)).toBeNull();
  });
});

describe("a batch", () => {
  it("is at most forty events, and what is not an event goes", () => {
    const many = Array.from({ length: 100 }, () => ({ kind: "usage", name: "tap", label: "Start" }));
    expect(cleanEvents(many, NOW)).toHaveLength(EVENT_CAPS.batch);
    expect(cleanEvents([{ kind: "usage", name: "tap" }, { kind: "x" }, 7], NOW)).toHaveLength(1);
    expect(cleanEvents({ events: [] }, NOW)).toEqual([]);
    expect(cleanEvents(null, NOW)).toEqual([]);
  });
});

describe("a string kept", () => {
  it("is trimmed, collapsed, capped by character, and nothing when empty", () => {
    expect(capText("  a \n  b ", 10)).toBe("a b");
    expect(capText("🙂".repeat(10), 4)).toBe("🙂🙂🙂🙂");
    expect(capText("   ", 4)).toBeNull();
    expect(capText(5, 4)).toBeNull();
  });
});
