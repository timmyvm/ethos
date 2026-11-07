import { afterEach, describe, expect, it, vi } from "vitest";
import { ASKED_KEY, askedOn, markAsked, notificationState, reminderDue } from "./reminder-ask";

/* The reminder ask on the way out (#427): due only on an exit that
   leaves, with no hour set, where notifications can work, once a day. */
const due = (over: Partial<Parameters<typeof reminderDue>[0]> = {}) =>
  reminderDue({ hour: null, askedOn: null, today: "2026-11-07", leaves: true, notifications: "default", ...over });

describe("reminderDue", () => {
  it("asks on a leaving exit with no hour set, where notifications can work", () => {
    expect(due()).toBe(true);
    expect(due({ notifications: "granted" })).toBe(true);
  });
  it("never on an exit that stays, once an hour is set, or where notifications cannot work", () => {
    expect(due({ leaves: false })).toBe(false);
    expect(due({ hour: 18 })).toBe(false);
    expect(due({ hour: 0 })).toBe(false);
    expect(due({ notifications: "denied" })).toBe(false);
    expect(due({ notifications: "unsupported" })).toBe(false);
  });
  it("once a day on this device", () => {
    expect(due({ askedOn: "2026-11-07" })).toBe(false);
    expect(due({ askedOn: "2026-11-06" })).toBe(true);
  });
});

describe("the ask's storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads what it wrote", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(askedOn()).toBeNull();
    markAsked("2026-11-07");
    expect(store.get(ASKED_KEY)).toBe("2026-11-07");
    expect(askedOn()).toBe("2026-11-07");
  });

  it("reads storage that throws as never asked, and never throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(askedOn()).toBeNull();
    expect(() => markAsked("2026-11-07")).not.toThrow();
    expect(due({ askedOn: askedOn() })).toBe(true);
  });

  it("reads no Notification API as unsupported, and a blocked one as denied", () => {
    expect(notificationState()).toBe("unsupported");
    vi.stubGlobal("Notification", { permission: "denied" });
    expect(notificationState()).toBe("denied");
    vi.stubGlobal("Notification", { permission: "default" });
    expect(notificationState()).toBe("default");
  });
});
