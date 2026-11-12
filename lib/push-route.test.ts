import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/* POST /api/push, against a table that may not have the tz column yet
   (migration 0019 is applied by hand). */
let upserts: Record<string, unknown>[] = [];
let hasTzColumn = true;
/** The row already stored for the endpoint, as the route reads it first. */
let stored: { reminder_hour: number | null } | null = null;

vi.mock("@/lib/db", () => ({
  getUserFromAuthHeader: async () => ({ id: "u1", anonymous: false }),
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored, error: null }) }) }),
      upsert: async (row: Record<string, unknown>) => {
        if (!hasTzColumn && "tz" in row) {
          return { error: { code: "PGRST204", message: "Could not find the 'tz' column of 'push_subscriptions' in the schema cache" } };
        }
        upserts.push(row);
        return { error: null };
      },
    }),
  }),
}));

const { POST } = await import("@/app/api/push/route");

function post(body: unknown) {
  const req = new Request("http://test.local/api/push", {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as unknown as NextRequest);
}

const base = {
  subscription: { endpoint: "https://web.push.apple.com/a", keys: { p256dh: "B" + "k".repeat(86), auth: "a".repeat(22) } },
  reminderHour: 18,
  tzOffset: 240,
};

beforeEach(() => {
  upserts = [];
  hasTzColumn = true;
  stored = null;
});

describe("POST /api/push and the device's zone", () => {
  it("stores the zone the device names", async () => {
    expect((await post({ ...base, tz: "America/New_York" })).status).toBe(200);
    expect(upserts[0]).toMatchObject({ tz: "America/New_York", tz_offset: 240 });
  });

  it("drops a zone that is not a real one", async () => {
    await post({ ...base, tz: "Mars/Olympus_Mons" });
    expect(upserts[0].tz).toBeNull();
  });

  it("still saves the reminder before the zone's column exists", async () => {
    hasTzColumn = false;
    expect((await post({ ...base, tz: "America/New_York" })).status).toBe(200);
    expect(upserts[0]).toMatchObject({ tz_offset: 240, reminder_hour: 18 });
  });
});

/* Security audit, 11 Nov: the server sends to this address later, so it
   is only ever a browser maker's push service. */
describe("POST /api/push and whose address it is", () => {
  it("refuses an endpoint that is not a push service's, and saves nothing", async () => {
    for (const endpoint of ["https://a.attacker.tld/n", "http://web.push.apple.com/a", "https://169.254.169.254/x"]) {
      const res = await post({ ...base, subscription: { ...base.subscription, endpoint } });
      expect(res.status, endpoint).toBe(400);
    }
    expect(upserts).toEqual([]);
  });

  it("refuses keys that are not a subscription's", async () => {
    const res = await post({ ...base, subscription: { ...base.subscription, keys: { p256dh: "k", auth: "a" } } });
    expect(res.status).toBe(400);
    expect(upserts).toEqual([]);
  });
});

/*
 * Settings and the glance say the first reminder is tomorrow when the hour
 * has passed today; the sender serves from the hour until quiet hours, so
 * the save stamps today and the two agree (#430 review).
 */
describe("POST /api/push and the first ring", () => {
  const mel = { ...base, tz: "Australia/Melbourne", tzOffset: -660 };
  async function postAt(iso: string, body: unknown) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
    try {
      return await post(body);
    } finally {
      vi.useRealTimers();
    }
  }

  it("12 pm picked at 3:30 pm rings first tomorrow", async () => {
    await postAt("2026-11-09T04:30:00Z", { ...mel, reminderHour: 12 }); // 15:30 AEDT
    expect(upserts[0]).toMatchObject({ reminder_hour: 12, last_sent_on: "2026-11-09" });
  });

  it("8 pm switched on at 8:30 pm rings first tomorrow", async () => {
    await postAt("2026-11-09T09:30:00Z", { ...mel, reminderHour: 20 }); // 20:30 AEDT
    expect(upserts[0]).toMatchObject({ last_sent_on: "2026-11-09" });
  });

  it("6 pm picked at 3:30 pm still rings today", async () => {
    await postAt("2026-11-09T04:30:00Z", { ...mel, reminderHour: 18 });
    expect(upserts[0]).not.toHaveProperty("last_sent_on");
  });

  it("the re-arm on every open, with the same hour, leaves the day's stamp alone", async () => {
    stored = { reminder_hour: 12 };
    await postAt("2026-11-09T04:30:00Z", { ...mel, reminderHour: 12 });
    expect(upserts[0]).not.toHaveProperty("last_sent_on");
  });

  it("a changed hour that has passed is tomorrow's", async () => {
    stored = { reminder_hour: 18 };
    await postAt("2026-11-09T04:30:00Z", { ...mel, reminderHour: 12 });
    expect(upserts[0]).toMatchObject({ last_sent_on: "2026-11-09" });
  });
});
