import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * lib/db.ts swapMeterState against a profiles table kept in memory, whose
 * update applies its filters the way PostgREST does (#514 review, the
 * scale audit's M6): the meter moves only from the row it was read at.
 */
type Row = Record<string, unknown>;
let rows: Row[] = [];
let failing = false;

function fakeClient() {
  return {
    from: (table: string) => {
      expect(table).toBe("profiles");
      return {
        update: (patch: Row) => {
          const filters: ((r: Row) => boolean)[] = [];
          const q = {
            eq: (col: string, v: unknown) => {
              filters.push((r) => r[col] === v);
              return q;
            },
            is: (col: string, v: null) => {
              filters.push((r) => (r[col] ?? null) === v);
              return q;
            },
            select: async () => {
              if (failing) return { data: null, error: { message: "down" } };
              const hit = rows.filter((r) => filters.every((f) => f(r)));
              for (const r of hit) Object.assign(r, patch);
              return { data: hit.map((r) => ({ user_id: r.user_id })), error: null };
            },
          };
          return q;
        },
        upsert: (row: Row, opts: { onConflict: string; ignoreDuplicates?: boolean }) => ({
          select: async () => {
            expect(opts).toEqual({ onConflict: "user_id", ignoreDuplicates: true });
            if (rows.some((r) => r.user_id === row.user_id)) return { data: [], error: null };
            rows.push({ ...row });
            return { data: [{ user_id: row.user_id }], error: null };
          },
        }),
      };
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeClient() }));
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

const { swapMeterState } = await import("./db");
const { claimRead } = await import("./metering");

const row = (balance: number, accruedOn: string | null) => ({
  user_id: "u-1",
  judged_rollover: balance,
  judged_accrued_on: accruedOn,
  judged_analysis_used_at: null,
});
const state = (balance: number, accruedOn: string | null) => ({ balance, accruedOn, usedAt: null });

beforeEach(() => {
  rows = [];
  failing = false;
});

describe("swapMeterState (#514 review)", () => {
  it("moves the row only from the balance and day it was read at", async () => {
    rows = [row(2, "2026-11-20")];
    expect(await swapMeterState("u-1", state(2, "2026-11-20"), state(1, "2026-11-20"))).toBe("swapped");
    expect(rows[0]).toMatchObject({ judged_rollover: 1, judged_accrued_on: "2026-11-20" });
    // A second take that read the same 2 finds the row moved.
    expect(await swapMeterState("u-1", state(2, "2026-11-20"), state(1, "2026-11-20"))).toBe("moved");
    expect(rows[0]).toMatchObject({ judged_rollover: 1 });
    // So does one that read yesterday's row.
    expect(await swapMeterState("u-1", state(1, "2026-11-19"), state(2, "2026-11-20"))).toBe("moved");
  });

  it("moves an account's first row, which has no day yet", async () => {
    rows = [row(1, null)];
    expect(await swapMeterState("u-1", state(1, null), state(2, "2026-11-20"))).toBe("swapped");
    expect(rows[0]).toMatchObject({ judged_rollover: 2, judged_accrued_on: "2026-11-20" });
  });

  it("puts a row in for an account that has none, once", async () => {
    expect(await swapMeterState("u-1", state(3, null), state(2, "2026-11-20"))).toBe("swapped");
    expect(rows).toEqual([expect.objectContaining({ user_id: "u-1", judged_rollover: 2 })]);
    // Another first take that read "no row" finds one there now.
    expect(await swapMeterState("u-1", state(3, null), state(2, "2026-11-20"))).toBe("moved");
    expect(rows).toHaveLength(1);
  });

  it("answers unavailable when the database does", async () => {
    rows = [row(2, "2026-11-20")];
    failing = true;
    expect(await swapMeterState("u-1", state(2, "2026-11-20"), state(1, "2026-11-20"))).toBe("unavailable");
  });

  it("gives five first takes that read no row exactly 3 between them", async () => {
    const store = {
      read: async () => {
        const r = rows.find((x) => x.user_id === "u-1");
        return r ? state(r.judged_rollover as number, r.judged_accrued_on as string | null) : state(3, null);
      },
      swap: (from: ReturnType<typeof state>, to: ReturnType<typeof state>) => swapMeterState("u-1", from, to),
    };
    const now = new Date(2026, 10, 20, 9);
    const claims = await Promise.all(Array.from({ length: 5 }, () => claimRead({ state: state(3, null), now, store })));
    expect(claims.filter((c) => c.claimed)).toHaveLength(3);
    expect(rows).toEqual([expect.objectContaining({ judged_rollover: 0, judged_accrued_on: "2026-11-20" })]);
  });
});
