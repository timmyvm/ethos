import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * armInTap (#430) in a browser stand-in: the iPhone's rule is that the
 * tap's right to raise the Allow prompt ends at the first await, so the
 * subscribe that raises it must be called before anything is awaited;
 * and the reminder is said to be on only once the server answered 200.
 */
vi.mock("./supabase-browser", () => ({ ensureSession: async () => (session ? "token" : null) }));

const store = new Map<string, string>();
let session = true;
let postStatus = 200;
let permission: NotificationPermission = "default";
/** What the iPhone's prompt answers. */
let answer: NotificationPermission = "granted";
const posted: unknown[] = [];
const sub = { endpoint: "https://push.test/new", toJSON: () => ({ endpoint: "https://push.test/new", keys: {} }) };
let subscribe: ReturnType<typeof vi.fn>;
let requestPermission: ReturnType<typeof vi.fn>;
let ready: Promise<unknown>;

function registration() {
  return {
    pushManager: { subscribe, getSubscription: async () => null },
    getNotifications: async () => [],
    showNotification: async () => {},
  } as unknown as ServiceWorkerRegistration;
}

beforeEach(() => {
  store.clear();
  posted.length = 0;
  session = true;
  postStatus = 200;
  permission = "default";
  answer = "granted";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BAAA";
  // Subscribing raises the prompt while permission is "default".
  subscribe = vi.fn(async () => {
    if (permission === "default") permission = answer;
    if (permission !== "granted") throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
    return sub;
  });
  requestPermission = vi.fn(async () => {
    permission = answer;
    return permission;
  });
  ready = Promise.resolve(registration());
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      get ready() {
        return ready;
      },
    },
  });
  vi.stubGlobal("window", { PushManager: class {} });
  vi.stubGlobal(
    "Notification",
    Object.defineProperties(class {}, {
      permission: { get: () => permission },
      requestPermission: { value: requestPermission },
    })
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      posted.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: postStatus });
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { armInTap, armedHere, readyRegistration, sendTestPush, WORKER_WAIT_MS } = await import("./reminders");
const prefs = () => JSON.parse(store.get("ethos.prefs") ?? "{}") as { reminderHour?: number | null };

describe("armInTap", () => {
  it("subscribes before anything is awaited, so the iPhone's prompt comes from the tap", async () => {
    const reg = registration();
    const done = armInTap(18, reg);
    // Synchronously, inside the tap: the subscribe that raises the prompt.
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0][0]).toMatchObject({ userVisibleOnly: true });
    expect(await done).toEqual({ ok: true, hour: 18 });
  });

  it("says it is on only after the server's 200, then keeps the hour, the acknowledgement and the account", async () => {
    const onAccount = vi.fn(async () => true);
    expect(await armInTap(18, registration(), onAccount)).toEqual({ ok: true, hour: 18 });
    expect(posted[0]).toMatchObject({ reminderHour: 18, quietFrom: 22, quietTo: 7 });
    expect(prefs().reminderHour).toBe(18);
    expect(JSON.parse(store.get("ethos.push.ack")!)).toMatchObject({ endpoint: sub.endpoint, hour: 18 });
    expect(onAccount).toHaveBeenCalledWith(18);
    expect(armedHere()).toBe(true);
  });

  it("a failed save is a failure, with nothing kept that says otherwise", async () => {
    postStatus = 502;
    const onAccount = vi.fn(async () => true);
    expect(await armInTap(18, registration(), onAccount)).toEqual({ ok: false, why: "server", status: 502 });
    expect(prefs().reminderHour ?? null).toBeNull();
    expect(store.has("ethos.push.ack")).toBe(false);
    expect(onAccount).not.toHaveBeenCalled();
    expect(armedHere()).toBe(false);
  });

  it("no session to own it, or no network, is a failure too", async () => {
    session = false;
    expect(await armInTap(18, registration())).toEqual({ ok: false, why: "no-session" });
    session = true;
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await armInTap(18, registration())).toEqual({ ok: false, why: "offline" });
  });

  it("Don't Allow is a denial, and nothing reaches the server", async () => {
    answer = "denied";
    expect(await armInTap(18, registration())).toEqual({ ok: false, why: "denied" });
    expect(posted).toEqual([]);
  });

  it("never prompts where notifications are already blocked, or do not exist", async () => {
    permission = "denied";
    expect(await armInTap(18, registration())).toEqual({ ok: false, why: "denied" });
    expect(subscribe).not.toHaveBeenCalled();
    vi.stubGlobal("Notification", undefined);
    expect(await armInTap(18, registration())).toEqual({ ok: false, why: "unsupported" });
  });

  it("without the registration yet, asks in the tap first, then subscribes", async () => {
    const done = armInTap(21, null);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(await done).toEqual({ ok: true, hour: 21 });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("a worker that never answers fails in seconds, not never", async () => {
    vi.useFakeTimers();
    ready = new Promise(() => {});
    permission = "granted";
    const done = armInTap(21, null);
    await vi.advanceTimersByTimeAsync(WORKER_WAIT_MS + 10);
    expect(await done).toEqual({ ok: false, why: "no-worker" });
  });

  it("replaces a subscription held under another key", async () => {
    permission = "granted";
    let held = true;
    const old = {
      unsubscribe: vi.fn(async () => {
        held = false;
        return true;
      }),
    };
    // The browser refuses a new key while the old subscription stands.
    subscribe = vi.fn(async () => {
      if (held) throw Object.assign(new Error("key"), { name: "InvalidStateError" });
      return sub;
    });
    const reg = {
      pushManager: { subscribe, getSubscription: async () => old },
    } as unknown as ServiceWorkerRegistration;
    expect(await armInTap(8, reg)).toEqual({ ok: true, hour: 8 });
    expect(old.unsubscribe).toHaveBeenCalled();
  });
});

describe("readyRegistration", () => {
  it("answers the registration, or null when there is no push", async () => {
    expect(await readyRegistration()).not.toBeNull();
    vi.stubGlobal("window", {});
    expect(await readyRegistration()).toBeNull();
  });
});

describe("armedHere", () => {
  it("is the server's acknowledgement for this hour, with notifications granted", () => {
    permission = "granted";
    store.set("ethos.prefs", JSON.stringify({ reminderHour: 21 }));
    expect(armedHere()).toBe(false);
    store.set("ethos.push.ack", JSON.stringify({ endpoint: "e", hour: 18 }));
    expect(armedHere()).toBe(false);
    store.set("ethos.push.ack", JSON.stringify({ endpoint: "e", hour: 21 }));
    expect(armedHere()).toBe(true);
    permission = "denied";
    expect(armedHere()).toBe(false);
  });
});

describe("sendTestPush", () => {
  const held = () =>
    ({ pushManager: { subscribe, getSubscription: async () => sub } }) as unknown as ServiceWorkerRegistration;

  it("asks the server to send this phone's own endpoint, and says how it went", async () => {
    let status = 200;
    const sentTo: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        sentTo.push({ url, body: JSON.parse(String(init.body)) });
        return new Response("{}", { status });
      })
    );
    expect(await sendTestPush(held())).toBe("sent");
    expect(sentTo[0]).toEqual({ url: "/api/push/test", body: { endpoint: sub.endpoint } });
    status = 429;
    expect(await sendTestPush(held())).toBe("wait");
    status = 502;
    expect(await sendTestPush(held())).toBe("failed");
  });

  it("a lapsed subscription is no reminder: the acknowledgement goes", async () => {
    store.set("ethos.push.ack", JSON.stringify({ endpoint: sub.endpoint, hour: 18 }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 410 })));
    expect(await sendTestPush(held())).toBe("gone");
    expect(store.has("ethos.push.ack")).toBe(false);
    const none = { pushManager: { getSubscription: async () => null } } as unknown as ServiceWorkerRegistration;
    expect(await sendTestPush(none)).toBe("gone");
  });
});
