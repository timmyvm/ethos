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
/** The spine's rows for these times, each a scorable take (syncFreezes reads the spine). */
const takes = (dates: Date[]) => dates.map((d) => ({ created_at: d.toISOString(), scorable: true }));

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
    const out = await syncFreezes(takes(reps), day(11, 8));
    expect(out.rescued).toEqual([]);
    expect(db.frozen).toEqual([]);
  });

  it("does not hold a rescue for another account's waiting recording", async () => {
    const reps = run(0, 9);
    db.row = 1;
    db.pending = [{ createdAt: day(10, 22).getTime(), owner: "someone-else" }];
    const out = await syncFreezes(takes(reps), day(11, 8));
    expect(out.rescued).toHaveLength(1);
  });

  it("still rescues a missed day with nothing waiting for it", async () => {
    const reps = run(0, 9);
    db.row = 1;
    const out = await syncFreezes(takes(reps), day(11, 8));
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
    let out = await syncFreezes(takes(reps.filter((d) => d < day(from, 8))), day(from, 8));
    for (let n = from + 1; n <= to; n++) {
      out = await syncFreezes(takes(reps.filter((d) => d < day(n, 8))), day(n, 8));
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
    const out = await syncFreezes(takes(run(0, 14)), day(15, 8));
    expect(out.equipped).toBe(3);
  });

  it("never asks the database to store more than it allows", async () => {
    db.purchased = 1;
    await syncFreezes(takes(run(0, 27)), day(28, 8));
    expect(db.grants.every((g) => g <= DB_CAP)).toBe(true);
  });
});

describe("syncFreezes and a failed read", () => {
  it("fails out loud and writes nothing, so missing rows never mint or wipe freezes", async () => {
    db.failFrozenRead = true;
    db.row = 2;
    await expect(syncFreezes(takes(run(0, 13)), day(14, 8))).rejects.toBeTruthy();
    expect(db.grants).toEqual([]);
    expect(db.frozen).toEqual([]);
    expect(db.row).toBe(2);
  });
});

/*
 * The reads go together (#508, the speed audit's fix 8): the frozen days,
 * the freezes bought and the mirror's row have no order between them, and
 * one after another they were three round trips before the streak chip
 * settled.
 */
describe("the freeze sync's reads", () => {
  it("leave together, before any of them has answered", async () => {
    const started: string[] = [];
    let answered = 0;
    const slow = <T,>(name: string, value: () => T) => async () => {
      started.push(`${name}@${answered}`);
      await new Promise((r) => setTimeout(r, 5));
      answered += 1;
      return value();
    };
    const cd = await import("./client-data");
    const spies = [
      vi.spyOn(cd, "fetchFrozenDays").mockImplementation(slow("frozen", () => [] as Date[])),
      vi.spyOn(cd, "purchasedFreezes").mockImplementation(slow("purchased", () => 0)),
      vi.spyOn(cd, "fetchStreakRow").mockImplementation(slow("row", () => ({ freezes_equipped: 0 }))),
    ];
    try {
      await syncFreezes(takes(run(0, 3)), day(3, 20));
      expect(started.sort()).toEqual(["frozen@0", "purchased@0", "row@0"]);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it("read the mirror's row again only after a rescue wrote it", async () => {
    // Ten days spoken, yesterday missed: this morning's open rescues it.
    const reps = run(0, 9);
    db.row = 1;
    const cd = await import("./client-data");
    const rowReads = vi.spyOn(cd, "fetchStreakRow");
    try {
      const out = await syncFreezes(takes(reps), day(11, 8));
      expect(out.rescued).toHaveLength(1);
      expect(rowReads).toHaveBeenCalledTimes(2);
      rowReads.mockClear();
      // The next open has nothing to rescue: one read of the row.
      await syncFreezes(takes(reps), day(11, 9));
      expect(rowReads).toHaveBeenCalledTimes(1);
    } finally {
      rowReads.mockRestore();
    }
  });

  it("a failed read still writes nothing", async () => {
    db.failFrozenRead = true;
    db.row = 1;
    await expect(syncFreezes(takes(run(0, 3)), day(3, 20))).rejects.toThrow();
    expect(db.grants).toEqual([]);
  });
});

/*
 * One missed day, kept by two recordings (lib/streak.ts keptDays,
 * closure.md row 14): built narrow so #174 stands. A freeze held is spent
 * on the day first, and a kept day is never a freeze spent. It bridges
 * the run the streak shows, as a freeze does, and the freezes are earned
 * from that run, the one the line under Record counts from (the review,
 * 26 Nov). The week after REPAIR_FROM: spoke Thursday
 * 26 November to Monday 30, missed Tuesday 1 December.
 */
describe("syncFreezes and a missed day two recordings keep", () => {
  const at = (m: number, d: number, h = 18) => new Date(2026, m - 1, d, h);
  const five = [at(11, 26), at(11, 27), at(11, 28), at(11, 29), at(11, 30)];
  const TUE = at(12, 1, 12).toDateString();

  it("spends a held freeze before any repair is considered", async () => {
    db.purchased = 1;
    // Wednesday morning, nothing said yet: the freeze covers Tuesday.
    const open = await syncFreezes(takes(five), at(12, 2, 8));
    expect(open.rescued.map((d) => d.toDateString())).toEqual([TUE]);
    const { repairState } = await import("./streak");
    expect(repairState(takes(five), open.frozenDays, at(12, 2, 8))).toBeNull();
    // Two takes later that day keep nothing: the freeze already did.
    const night = await syncFreezes(takes([...five, at(12, 2, 9), at(12, 2, 19)]), at(12, 2, 21));
    expect(night.keptDays).toEqual([]);
    expect(night.frozenDays.map((d) => d.toDateString())).toEqual([TUE]);
    expect(night.streak.current).toBe(6);
  });

  it("counts a kept day in the streak as a bridge, and never as a freeze spent", async () => {
    // Five days, Tuesday missed, two takes on Wednesday and one on each
    // day to Saturday: nine days spoken around the kept one.
    const reps = [...five, at(12, 2, 9), at(12, 2, 19), at(12, 3), at(12, 4), at(12, 5)];
    const out = await syncFreezes(takes(reps), at(12, 5, 21));
    expect(out.keptDays.map((d) => d.toDateString())).toEqual([TUE]);
    expect(out.streak.current).toBe(9);
    expect(out.frozenDays).toEqual([]);
    expect(db.frozen).toEqual([]);
    // The 9 the streak shows is the run the freezes are earned from: a
    // full week of it earns one, as it does over a freeze.
    expect(out.equipped).toBe(1);
  });

  /*
   * The review's case: the streak shown and the line under Record count a
   * kept day as a bridge, so the freezes must be earned from that same
   * run, or "A 7-day streak earns a streak freeze" promises one the
   * person never gets. An old clean best of 6, then three days, Monday
   * 30 November missed, two takes on Tuesday, and on to Friday.
   */
  it("earns the freeze the line under Record promised, from the run the streak shows", async () => {
    const { nextMilestones } = await import("./progress");
    const freezeLineOf = (streak: Awaited<ReturnType<typeof syncFreezes>>["streak"]) =>
      nextMilestones({ reps: [], starMap: {}, streak, xp: 0, freezesEquipped: 0, achievements: [] }).find(
        (m) => m.kind === "freeze"
      )!;
    const old = [1, 2, 3, 4, 5, 6].map((d) => at(11, d));
    const spoke = [at(11, 27), at(11, 28), at(11, 29), at(12, 1, 9), at(12, 1, 19)];
    const tuesday = await syncFreezes(takes([...old, ...spoke]), at(12, 1, 21));
    expect(tuesday.streak.current).toBe(4);
    expect(freezeLineOf(tuesday.streak).line).toBe("A 7-day streak earns a streak freeze");
    expect(tuesday.equipped).toBe(0);
    const friday = await syncFreezes(takes([...old, ...spoke, at(12, 2), at(12, 3), at(12, 4)]), at(12, 4, 21));
    expect(friday.streak.current).toBe(7);
    // The line said 7 earns one, and the streak shows 7: one is held.
    expect(friday.equipped).toBe(1);
    expect(freezeLineOf(friday.streak).target).toBe(14);
    // One rule for both: what is held is earned from the longest the line counts from.
    expect(friday.equipped).toBe(Math.floor(freezeLineOf(friday.streak).current / 7));
  });

  it("a run of 6 kept on its seventh spoken day earns its freeze that day", async () => {
    const six = [25, 26, 27, 28, 29, 30].map((d) => at(11, d));
    const out = await syncFreezes(takes([...six, at(12, 2, 9), at(12, 2, 19)]), at(12, 2, 21));
    expect(out.keptDays.map((d) => d.toDateString())).toEqual([at(12, 1).toDateString()]);
    expect(out.streak.current).toBe(7);
    expect(out.equipped).toBe(1);
    expect(db.frozen).toEqual([]);
  });

  it("a freeze a kept run earned is held to spend on the next gap", async () => {
    // Five days, Tuesday kept by two takes on Wednesday, Thursday spoken
    // (7 days running), Friday missed: Saturday morning the freeze covers it.
    const reps = [...five, at(12, 2, 9), at(12, 2, 19), at(12, 3)];
    const out = await syncFreezes(takes(reps), at(12, 5, 8));
    expect(out.rescued.map((d) => d.toDateString())).toEqual([at(12, 4).toDateString()]);
    expect(out.keptDays.map((d) => d.toDateString())).toEqual([TUE]);
    expect(out.streak.current).toBe(7);
    expect(out.equipped).toBe(0);
  });

  it("keeps nothing from a spine read before 0037, which has no scorable column", async () => {
    const reps = [...five, at(12, 2, 9), at(12, 2, 19)];
    const out = await syncFreezes(
      reps.map((d) => ({ created_at: d.toISOString() })),
      at(12, 2, 21)
    );
    expect(out.keptDays).toEqual([]);
    expect(out.streak.current).toBe(1);
  });
});
