import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/* POST /api/push, against a table that may not have the tz column yet
   (migration 0019 is applied by hand). */
let upserts: Record<string, unknown>[] = [];
let hasTzColumn = true;

vi.mock("@/lib/db", () => ({
  getUserFromAuthHeader: async () => ({ id: "u1", anonymous: false }),
  supabaseAdmin: () => ({
    from: () => ({
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
  subscription: { endpoint: "https://push.test/a", keys: { p256dh: "k", auth: "a" } },
  reminderHour: 18,
  tzOffset: 240,
};

beforeEach(() => {
  upserts = [];
  hasTzColumn = true;
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
