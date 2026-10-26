import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * syncFreezes against a stand-in for the account's rows that enforces
 * production's own check on streaks.freezes_equipped (0001: 0..2), so a
 * write the database would refuse is refused here too.
 */
const db = {
  frozen: [] as Date[],
  row: 0,
  purchased: 0,
  pending: [] as { createdAt: number; owner?: string | null }[],
  failFrozenRead: false,
};
const DB_CAP = 2;

vi.mock("./client-data", () => ({
  fetchFrozenDays: async () => {
    if (db.failFrozenRead) throw new Error("500");
    return [...db.frozen];
  },
  fetchStreakRow: async () => ({ freezes_equipped: db.row }),
  purchasedFreezes: async () => db.purchased,
  spendFreezes: async (days: Date[], held: number) => {
    db.frozen.push(...days);
    const next = Math.max(0, held - days.length);
    if (next <= DB_CAP) db.row = next;
    return days.length;
  },
  grantFreezes: async (target: number) => {
    if (target < 0 || target > DB_CAP) return 0; // the check refuses it
    db.row = target;
    return target;
  },
}));

vi.mock("./rep-outbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./rep-outbox")>()),
  outboxAll: async () => db.pending,
}));

vi.mock("./supabase-browser", () => ({
  currentSession: async () => ({ userId: "user-1", token: "t" }),
}));

const { syncFreezes } = await import("./freeze-sync");

/** Local noon on day n after 1 Sep 2026. */
const day = (n: number, h = 12) => new Date(2026, 8, 1 + n, h);
const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => day(from + i));

beforeEach(() => {
  db.frozen = [];
  db.row = 0;
  db.purchased = 0;
  db.pending = [];
  db.failFrozenRead = false;
});

describe("syncFreezes", () => {
  it("never spends a freeze on a day whose recording is still waiting in the outbox", async () => {
    // Ten days spoken, then last night's recording failed to upload and
    // is still on the device when this morning's screen loads.
    const reps = run(0, 9);
    db.row = 1;
    db.pending = [{ createdAt: day(10, 22).getTime(), owner: "user-1" }];
    const out = await syncFreezes(reps, day(11, 8));
    expect(out.rescued).toEqual([]);
    expect(db.frozen).toEqual([]);
  });

  it("does not hold a rescue for another account's waiting recording", async () => {
    const reps = run(0, 9);
    db.row = 1;
    db.pending = [{ createdAt: day(10, 22).getTime(), owner: "someone-else" }];
    const out = await syncFreezes(reps, day(11, 8));
    expect(out.rescued).toHaveLength(1);
  });

  it("still rescues a missed day with nothing waiting for it", async () => {
    const reps = run(0, 9);
    db.row = 1;
    const out = await syncFreezes(reps, day(11, 8));
    expect(out.rescued.map((d) => d.getDate())).toEqual([day(10).getDate()]);
  });
});
