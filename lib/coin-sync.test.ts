import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * syncCoins against a ledger stand-in whose insert behaves like one
 * Postgres statement under row security: if the policy refuses any row,
 * the whole upsert fails and nothing is written.
 */
let ledger: { id: string; kind: string; amount: number; reason: string; earned_on: string | null; created_at: string }[] = [];
let refused = new Set<string>();
let ledgerFails = false;
const grantCalls: string[][] = [];

vi.mock("./client-data", () => ({
  fetchWholeLedger: async () => {
    if (ledgerFails) throw new Error("500");
    return [...ledger];
  },
  grantCoins: async (days: string[], reason = "streak_day") => {
    grantCalls.push([reason, ...days]);
    if (days.some((d) => refused.has(`${reason}:${d}`))) return 0;
    for (const d of days)
      ledger.push({ id: `${reason}-${d}`, kind: "earned", amount: 1, reason, earned_on: d, created_at: d });
    return days.length;
  },
}));

vi.mock("./challenge", () => ({
  // Two weeks with five closes each; which weeks close is the challenge
  // module's business, tested there.
  closesByWeek: () => [
    { week: "2026-10-12", closed: 5 },
    { week: "2026-10-19", closed: 5 },
  ],
}));

const { syncCoins } = await import("./coin-sync");

beforeEach(() => {
  ledgerFails = false;
  ledger = [];
  refused = new Set();
  grantCalls.length = 0;
});

describe("syncCoins and the week's coin", () => {
  it("pays a later week even when the database refuses an earlier one", async () => {
    refused.add("challenge_week:2026-10-12");
    await syncCoins([], [{} as never]);
    const weeks = ledger.filter((r) => r.reason === "challenge_week").map((r) => r.earned_on);
    expect(weeks).toEqual(["2026-10-19"]);
  });

  it("pays both weeks when both are accepted", async () => {
    await syncCoins([], [{} as never]);
    expect(ledger.filter((r) => r.reason === "challenge_week")).toHaveLength(2);
  });
});

describe("syncCoins and a failed ledger read", () => {
  it("fails out loud instead of answering a zero balance", async () => {
    ledger = [{ id: "c1", kind: "earned", amount: 1, reason: "streak_day", earned_on: "2026-10-20", created_at: "x" }];
    ledgerFails = true;
    await expect(syncCoins([], [])).rejects.toBeTruthy();
    expect(grantCalls).toEqual([]);
  });
});
