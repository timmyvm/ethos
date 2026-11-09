import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  ASK_COPY,
  ASKED_KEY,
  askedOn,
  askHour,
  askHours,
  declined,
  deniedLine,
  firstScoredToday,
  markAsked,
  markNotNow,
  markSwitchedOff,
  notificationState,
  reminderAsk,
  restUntil,
} from "./reminder-ask";
import { BANNED_PHRASES, saysGym } from "./register";

/*
 * The reminder ask (#430). It moved from #427's leaving exit to the
 * glance, so the exit's own expectations ("never on an exit that stays")
 * became the glance's ("never on a later take the same day"). One
 * expectation flips, and that is the point: an hour already set no longer
 * silences the ask. It asks while the server holds no reminder for this
 * phone, offering that hour in one tap.
 */
const ask = (over: Partial<Parameters<typeof reminderAsk>[0]> = {}) =>
  reminderAsk({
    scored: true,
    firstToday: true,
    armed: false,
    declined: false,
    notifications: "default",
    push: true,
    ios: true,
    standalone: true,
    askedOn: null,
    today: "2026-11-09",
    restUntil: null,
    installTold: false,
    deniedTold: false,
    ...over,
  });

describe("reminderAsk", () => {
  it("asks on the day's first scored take where a reminder can be armed and is not", () => {
    expect(ask()).toBe("ask");
    expect(ask({ notifications: "granted" })).toBe("ask");
    expect(ask({ ios: false, standalone: false })).toBe("ask");
  });

  it("asks with an hour already set but never armed (the flipped expectation: #427 went quiet once any hour was set)", () => {
    // The hour is not an input at all now; only the server's acknowledgement silences it.
    expect(ask({ armed: false })).toBe("ask");
    expect(ask({ armed: true })).toBeNull();
  });

  it("never on a take too short to score, a later take today, or after an Off", () => {
    expect(ask({ scored: false })).toBeNull();
    expect(ask({ firstToday: false })).toBeNull();
    expect(ask({ declined: true })).toBeNull();
  });

  it("once a day on this phone, and resting a week after two Not nows", () => {
    expect(ask({ askedOn: "2026-11-09" })).toBeNull();
    expect(ask({ askedOn: "2026-11-08" })).toBe("ask");
    expect(ask({ restUntil: "2026-11-16" })).toBeNull();
    expect(ask({ restUntil: "2026-11-09" })).toBe("ask");
  });

  it("in an iPhone's Safari tab, says the Home Screen steps once, and never offers a dead tap", () => {
    const tab = { notifications: "unsupported" as const, push: false, standalone: false };
    expect(ask(tab)).toBe("install");
    expect(ask({ ...tab, installTold: true })).toBeNull();
    // Nowhere else without the API: an app's own browser, a desktop without push.
    expect(ask({ ...tab, ios: false })).toBeNull();
    expect(ask({ notifications: "default", push: false, ios: false, standalone: false })).toBeNull();
  });

  it("where notifications are blocked, says where to turn them on, once, and never asks", () => {
    expect(ask({ notifications: "denied" })).toBe("denied");
    expect(ask({ notifications: "denied", deniedTold: true })).toBeNull();
  });
});

describe("firstScoredToday", () => {
  const now = new Date(2026, 10, 9, 18, 30);
  const at = new Date(2026, 10, 9, 18, 0);
  it("is true with no take today that had an Index", () => {
    expect(firstScoredToday({ reps: [], at }, now)).toBe(true);
    expect(firstScoredToday({ reps: [{ created_at: new Date(2026, 10, 8, 20).toISOString(), ethos_index: 640 }], at }, now)).toBe(true);
    expect(firstScoredToday({ reps: [{ created_at: new Date(2026, 10, 9, 9).toISOString(), ethos_index: null }], at }, now)).toBe(true);
  });
  it("is false once a take earlier today was scored", () => {
    expect(firstScoredToday({ reps: [{ created_at: new Date(2026, 10, 9, 9).toISOString(), ethos_index: 655 }], at }, now)).toBe(false);
  });
  it("reads a baseline it never got, or one from before midnight, as the first", () => {
    expect(firstScoredToday(null, now)).toBe(true);
    const yesterday = new Date(2026, 10, 8, 23, 50);
    expect(firstScoredToday({ reps: [{ created_at: yesterday.toISOString(), ethos_index: 655 }], at: yesterday }, now)).toBe(true);
  });
});

describe("askHour", () => {
  const quiet = { quietFrom: 22, quietTo: 7 };
  it("offers the hour this take started, rounded down", () => {
    expect(askHour(new Date(2026, 10, 9, 18, 47), null, quiet)).toBe(18);
    expect(askHour(new Date(2026, 10, 9, 7, 5), null, quiet)).toBe(7);
  });
  it("offers the hour already chosen first", () => {
    expect(askHour(new Date(2026, 10, 9, 8, 0), 21, quiet)).toBe(21);
  });
  it("moves a quiet-hours take to the nearer edge: 9 pm late at night, 7 am early", () => {
    expect(askHour(new Date(2026, 10, 9, 22, 30), null, quiet)).toBe(21);
    expect(askHour(new Date(2026, 10, 9, 23, 59), null, quiet)).toBe(21);
    expect(askHour(new Date(2026, 10, 10, 1, 0), null, quiet)).toBe(21);
    expect(askHour(new Date(2026, 10, 10, 3, 0), null, quiet)).toBe(7);
    expect(askHour(new Date(2026, 10, 10, 6, 40), null, quiet)).toBe(7);
  });
  it("never offers a quiet hour, chosen or picked", () => {
    expect(askHour(new Date(2026, 10, 9, 12, 0), 23, quiet)).toBe(12);
    expect(askHours(quiet)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  });
});

describe("the ask's words", () => {
  it("are short, calm, plain, and never a dash", () => {
    const all = [
      ASK_COPY.fresh,
      ASK_COPY.chosen("9 pm"),
      ASK_COPY.button("6 pm"),
      ASK_COPY.notNow,
      ASK_COPY.saved("6 pm"),
      ASK_COPY.failed,
      ASK_COPY.install,
      ASK_COPY.installSteps,
      deniedLine(true),
      deniedLine(false),
    ];
    for (const s of all) {
      expect(s).not.toMatch(/—|–/);
      expect(saysGym(s)).toBe(false);
      for (const p of BANNED_PHRASES) expect(s.toLowerCase()).not.toContain(p);
      expect(s).not.toMatch(/streak|don't lose|before it's gone|tonight/i);
    }
    expect(ASK_COPY.install).toBe("Add Ethos to your Home Screen to get reminders.");
    expect(deniedLine(true)).toMatch(/Settings, Notifications, Ethos/);
  });
});

describe("the ask's storage", () => {
  afterEach(() => vi.unstubAllGlobals());
  const memory = () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    return store;
  };

  it("reads what it wrote", () => {
    const store = memory();
    expect(askedOn()).toBeNull();
    markAsked("2026-11-07");
    expect(store.get(ASKED_KEY)).toBe("2026-11-07");
    expect(askedOn()).toBe("2026-11-07");
  });

  it("rests a week after the second Not now, then starts the count again", () => {
    memory();
    markNotNow("2026-11-09");
    expect(restUntil()).toBeNull();
    markNotNow("2026-11-10");
    expect(restUntil()).toBe("2026-11-17");
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
    markNotNow("2026-11-17");
    expect(restUntil()).toBeNull();
  });

  it("treats Off in Settings or in the introduction as an answer", () => {
    const store = memory();
    expect(declined()).toBe(false);
    markSwitchedOff(true);
    expect(declined()).toBe(true);
    markSwitchedOff(false);
    expect(declined()).toBe(false);
    store.set("ethos.onboarding", JSON.stringify({ answers: { time: "off" }, done: true }));
    expect(declined()).toBe(true);
  });

  it("reads storage that throws as never asked, and never throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(askedOn()).toBeNull();
    expect(() => markAsked("2026-11-07")).not.toThrow();
    expect(() => markNotNow("2026-11-07")).not.toThrow();
    expect(declined()).toBe(false);
    expect(ask({ askedOn: askedOn() })).toBe("ask");
  });

  it("reads no Notification API as unsupported, and a blocked one as denied", () => {
    expect(notificationState()).toBe("unsupported");
    vi.stubGlobal("Notification", { permission: "denied" });
    expect(notificationState()).toBe("denied");
    vi.stubGlobal("Notification", { permission: "default" });
    expect(notificationState()).toBe("default");
  });
});
