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
  grants: [] as number[],
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
    db.grants.push(target);
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
  db.grants = [];
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

/*
 * Production's check caps streaks.freezes_equipped at 2 while the app
 * allows 3 (#174). The held count is derived, earned minus spent plus
 * bought, so it never depends on a column that cannot store it.
 */
describe("syncFreezes and the database's cap of two", () => {
  /** Every morning's sync, from `from` to `to`, over the spoken days. */
  async function mornings(reps: Date[], from: number, to: number) {
    let out = await syncFreezes(reps.filter((d) => d < day(from, 8)), day(from, 8));
    for (let n = from + 1; n <= to; n++) {
      out = await syncFreezes(reps.filter((d) => d < day(n, 8)), day(n, 8));
    }
    return out;
  }

  it("holds three after a 28-day run and one rescue, and bridges a later two-day gap", async () => {
    // 28 days spoken, day 28 missed, three spoken, days 32 and 33 missed.
    const reps = [...run(0, 27), ...run(29, 31)];
    const afterFirst = await mornings(reps, 7, 30);
    expect(afterFirst.equipped).toBe(3);
    const out = await mornings(reps, 31, 34);
    const bridged = db.frozen.map((d) => d.toDateString());
    expect(bridged).toContain(day(32).toDateString());
    expect(bridged).toContain(day(33).toDateString());
    expect(out.streak.current).toBeGreaterThan(0);
  });

  it("counts a freeze bought at two held", async () => {
    db.purchased = 1;
    const out = await syncFreezes(run(0, 14), day(15, 8));
    expect(out.equipped).toBe(3);
  });

  it("never asks the database to store more than it allows", async () => {
    db.purchased = 1;
    await syncFreezes(run(0, 27), day(28, 8));
    expect(db.grants.every((g) => g <= DB_CAP)).toBe(true);
  });
});
