import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * armReminder in a browser stand-in: notifications granted, a push
 * subscription already on the device, and POST /api/push answering as
 * the test says. A re-arm that fails leaves the server's row (from the
 * last arm that worked) in place, and that row still rings at the hour.
 */
vi.mock("./supabase-browser", () => ({ ensureSession: async () => "token" }));

const store = new Map<string, string>();
let notified = 0;
let postStatus = 200;
const sub = { endpoint: "https://push.test/abc", toJSON: () => ({ endpoint: "https://push.test/abc" }) };

beforeEach(() => {
  store.clear();
  notified = 0;
  postStatus = 200;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 26, 11, 30));
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BAAA";
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const reg = {
    pushManager: { getSubscription: async () => sub, subscribe: async () => sub },
    getNotifications: async () => [],
    showNotification: async () => {},
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("navigator", { serviceWorker: { ready: Promise.resolve(reg) } });
  vi.stubGlobal("window", { PushManager: class {} });
  vi.stubGlobal(
    "Notification",
    Object.assign(
      class {
        constructor() {
          notified++;
        }
      },
      { permission: "granted" }
    )
  );
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: postStatus })));
  store.set("ethos.prefs", JSON.stringify({ reminderHour: 12, quietFrom: 22, quietTo: 7 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { armReminder } = await import("./reminders");

describe("armReminder and a re-arm that fails", () => {
  it("does not add a local reminder over the server's, which still rings", async () => {
    expect(await armReminder({ streak: 3, didToday: false })).toBe("push");
    postStatus = 502;
    expect(await armReminder({ streak: 3, didToday: false })).toBe("push");
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(notified).toBe(0);
  });

  it("falls back to a local reminder when the server never took the subscription", async () => {
    postStatus = 502;
    expect(await armReminder({ streak: 3, didToday: false })).toBe("open-tab");
  });

  it("falls back when the hour changed and the server still holds the old one", async () => {
    expect(await armReminder({ streak: 3, didToday: false })).toBe("push");
    store.set("ethos.prefs", JSON.stringify({ reminderHour: 13, quietFrom: 22, quietTo: 7 }));
    postStatus = 502;
    expect(await armReminder({ streak: 3, didToday: false })).toBe("open-tab");
  });
});
