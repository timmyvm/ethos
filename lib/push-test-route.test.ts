import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/* POST /api/push/test (#430): Settings' "Send a test", to the caller's own endpoint only. */
type Row = { endpoint: string; user_id: string; p256dh: string; auth: string };
let rows: Row[] = [];
let sendFails: number | null = null;
const sent: { endpoint: string; body: string; options?: unknown }[] = [];

vi.mock("@/lib/db", () => ({
  getUserFromAuthHeader: async (h: string | null) => (h === "Bearer t" ? { id: "u1", anonymous: false } : null),
  supabaseAdmin: () => ({
    from: () => {
      const filters: [keyof Row, string][] = [];
      const q = {
        select: () => q,
        eq: (c: keyof Row, v: string) => {
          filters.push([c, v]);
          return q;
        },
        maybeSingle: async () => ({ data: rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null }),
        delete: () => q,
        then: (ok: (v: unknown) => unknown) => {
          rows = rows.filter((r) => !filters.every(([c, v]) => r[c] === v));
          return Promise.resolve({ error: null }).then(ok);
        },
      };
      return q;
    },
  }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (s: { endpoint: string }, body: string, options?: unknown) => {
      if (sendFails !== null) throw Object.assign(new Error("push"), { statusCode: sendFails });
      sent.push({ endpoint: s.endpoint, body, options });
    },
  },
}));

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const { POST } = await import("@/app/api/push/test/route");

let n = 0;
function post(endpoint: string, auth = "Bearer t") {
  const req = new Request("http://test.local/api/push/test", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return POST(req as unknown as NextRequest);
}
/** A fresh endpoint per test: the once-a-minute guard is per endpoint. */
const mine = () => `https://web.push.apple.com/mine-${++n}`;

beforeEach(() => {
  rows = [];
  sendFails = null;
  sent.length = 0;
});

describe("POST /api/push/test", () => {
  it("sends the test to the caller's own endpoint, now", async () => {
    const e = mine();
    rows = [{ endpoint: e, user_id: "u1", p256dh: "k", auth: "a" }];
    expect((await post(e)).status).toBe(200);
    expect(sent[0].endpoint).toBe(e);
    expect(JSON.parse(sent[0].body)).toMatchObject({ title: "Your reminder" });
  });

  it("lives a minute at the push service, so a phone that was off never gets it later", async () => {
    const e = mine();
    rows = [{ endpoint: e, user_id: "u1", p256dh: "k", auth: "a" }];
    expect((await post(e)).status).toBe(200);
    expect(sent[0].options).toMatchObject({ TTL: 60 });
  });

  it("never to someone else's, and never without a session", async () => {
    const e = mine();
    rows = [{ endpoint: e, user_id: "u2", p256dh: "k", auth: "a" }];
    expect((await post(e)).status).toBe(404);
    expect((await post(e, "Bearer nope")).status).toBe(401);
    expect(sent).toEqual([]);
  });

  it("once a minute per phone", async () => {
    const e = mine();
    rows = [{ endpoint: e, user_id: "u1", p256dh: "k", auth: "a" }];
    expect((await post(e)).status).toBe(200);
    expect((await post(e)).status).toBe(429);
    expect(sent.length).toBe(1);
  });

  it("says an expired subscription is gone, and lets the row go", async () => {
    const e = mine();
    rows = [{ endpoint: e, user_id: "u1", p256dh: "k", auth: "a" }];
    sendFails = 410;
    const res = await post(e);
    expect(res.status).toBe(410);
    expect((await res.json()).gone).toBe(true);
    expect(rows).toEqual([]);
  });
});
