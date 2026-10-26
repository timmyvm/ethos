import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Every read answers the way PostgREST does when a table errors (a 500,
 * an expired JWT's 401): { data: null, error }, never a throw of its own.
 * A fetcher that only reads `data` turns that into zero coins, Level 1,
 * an empty lexicon or a streak without its freezes (DECISIONS #147).
 */
let failing = new Set<string>();

function query(table: string) {
  const answer = () =>
    Promise.resolve(
      failing.has(table)
        ? { data: null, error: { message: "upstream", code: "XX000" } }
        : { data: [], error: null }
    );
  const q: Record<string, unknown> = {};
  for (const k of ["select", "order", "eq", "limit", "range"]) q[k] = () => q;
  q.maybeSingle = () =>
    failing.has(table)
      ? Promise.resolve({ data: null, error: { message: "upstream" } })
      : Promise.resolve({ data: null, error: null });
  q.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => answer().then(ok, bad);
  return q;
}

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "t", user: { id: "u1" } } } }) },
    from: (table: string) => query(table),
  }),
}));

const cd = await import("./client-data");

beforeEach(() => {
  failing = new Set();
});

describe("a read that failed is not an empty one", () => {
  const cases: [string, string, () => Promise<unknown>][] = [
    ["fetchCoinLedger", "coin_ledger", () => cd.fetchCoinLedger()],
    ["fetchXp", "xp_events", () => cd.fetchXp()],
    ["fetchLexicon", "lexicon", () => cd.fetchLexicon()],
    ["fetchFrozenDays", "streak_freezes", () => cd.fetchFrozenDays()],
    ["fetchStreakRow", "streaks", () => cd.fetchStreakRow()],
    ["purchasedFreezes", "coin_ledger", () => cd.purchasedFreezes()],
  ];

  for (const [name, table, read] of cases) {
    it(`${name} throws when ${table} answers an error`, async () => {
      failing.add(table);
      await expect(read()).rejects.toBeTruthy();
    });

    it(`${name} still answers an empty table`, async () => {
      await expect(read()).resolves.not.toBeUndefined();
    });
  }
});
