import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST } from "@/content/tester";
import { remindersZone, PUSH_ACK_KEY } from "./reminders-zone";
import { testerBootScript, TEST_SHOWN_UNTIL } from "./tester-boot";
import { TESTER_HINT_KEY } from "./tester-signal";

/**
 * The head's boot script for tester presence (#402): it marks the page
 * before paint on a tester's device during the test and the week after,
 * so Today's server paint holds the tile's place and a reload moves
 * nothing. Run here against a stubbed page, at fixed instants.
 */

function run(at: string, store: Record<string, string>): boolean {
  const attrs = new Map<string, string>();
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null) };
  const document = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(at) });
  try {
    new Function("localStorage", "document", testerBootScript)(localStorage, document);
  } finally {
    vi.useRealTimers();
  }
  return attrs.has("data-test-tile");
}

const HINT = { [TESTER_HINT_KEY]: "1" };

afterEach(() => {
  vi.useRealTimers();
});

describe("the tester boot script", () => {
  it("marks a tester's device from the test's first day to a week after its last, on Melbourne's calendar", () => {
    expect(TEST_SHOWN_UNTIL).toBe("2026-11-19");
    expect(run("2026-10-29T12:59:00Z", HINT)).toBe(false); // 23:59 on 29 Oct in Melbourne
    expect(run("2026-10-29T13:00:00Z", HINT)).toBe(true); // 00:00 on 30 Oct
    expect(run("2026-10-31T08:00:00Z", HINT)).toBe(true);
    expect(run("2026-11-19T12:59:00Z", HINT)).toBe(true); // 23:59 on 19 Nov
    expect(run("2026-11-19T13:00:00Z", HINT)).toBe(false); // 00:00 on 20 Nov
  });

  it("marks nobody else's", () => {
    expect(run("2026-10-31T08:00:00Z", {})).toBe(false);
    expect(run("2026-10-31T08:00:00Z", { [TESTER_HINT_KEY]: "0" })).toBe(false);
  });

  it("counts in the reminders' zone on a phone with reminders, as Today's tile does", () => {
    // 23:30 on 29 Oct in Perth (UTC+8) is already 02:30 on the 30th in Melbourne.
    const at = "2026-10-29T15:30:00Z";
    expect(run(at, HINT)).toBe(true);
    const ack = JSON.stringify({ endpoint: "https://push.example/1", hour: 19, tz: "Australia/Perth" });
    expect(run(at, { ...HINT, [PUSH_ACK_KEY]: ack })).toBe(false);
  });

  it("falls back to Melbourne's calendar on a zone it cannot read", () => {
    const ack = JSON.stringify({ endpoint: "https://push.example/1", hour: 19, tz: "Mars/Olympus_Mons" });
    expect(run("2026-10-29T13:30:00Z", { ...HINT, [PUSH_ACK_KEY]: ack })).toBe(true);
    expect(TEST.zone).toBe("Australia/Melbourne");
  });
});

describe("the reminders' zone", () => {
  const stub = (value: string | null) => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === PUSH_ACK_KEY ? value : null) });
  };
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is none without reminders on this phone", () => {
    stub(null);
    expect(remindersZone()).toBeNull();
    stub("not json");
    expect(remindersZone()).toBeNull();
  });

  it("is the zone the reminders were sent with", () => {
    stub(JSON.stringify({ endpoint: "e", hour: 19, tz: "Australia/Brisbane" }));
    expect(remindersZone()).toBe("Australia/Brisbane");
  });

  it("is the phone's own for reminders armed before the zone was kept", () => {
    stub(JSON.stringify({ endpoint: "e", hour: 19 }));
    expect(remindersZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
