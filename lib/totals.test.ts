import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Lifetime totals over tables that only grow: the coin balance and what
 * was bought (coin_ledger), and total XP (xp_events). Reads capped at the
 * newest 400 and 1000 rows drifted from the server's own sum once an
 * account passed them: fewer coins than spend_coins counts, a pose bought
 * in month one shown as unbought, and a Level that stopped rising.
 * PostgREST answers at most 1000 rows a response, as here.
 */
type Row = Record<string, unknown> & { created_at: string };
let tables: Record<string, Row[]> = {};

function query(table: string) {
  let out = [...(tables[table] ?? [])];
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (col: string, v: unknown) => {
      out = out.filter((r) => r[col] === v);
      return q;
    },
    order: (col: string, { ascending }: { ascending: boolean }) => {
      out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (ascending ? 1 : -1));
      return q;
    },
    limit: (n: number) => Promise.resolve({ data: out.slice(0, Math.min(n, 1000)), error: null }),
    range: (from: number, to: number) =>
      Promise.resolve({ data: out.slice(from, Math.min(to + 1, from + 1000)), error: null }),
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: out.slice(0, 1000), error: null }).then(ok),
  };
  return q;
}

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "t", user: { id: "u1" } } } }) },
    from: (t: string) => query(t),
  }),
}));

const cd = await import("./client-data");
const { balance } = await import("./coins");
const { ownedFrom } = await import("./shop");
const { syncCoins } = await import("./coin-sync");

const at = (n: number) => new Date(Date.UTC(2025, 0, 1) + n * 3_600_000).toISOString();

/** 13 months of practice: 395 day coins, 40 week coins, 3 poses bought in month one, 12 freezes. */
function longLedger(): Row[] {
  const rows: Row[] = [];
  let n = 0;
  const earn = (reason: string) => rows.push({ id: `e${n}`, kind: "earned", amount: 1, reason, earned_on: at(n).slice(0, 10), created_at: at(n++) });
  const spend = (reason: string, amount: number) => rows.push({ id: `s${n}`, kind: "spent", amount, reason, earned_on: null, created_at: at(n++) });
  for (let i = 0; i < 30; i++) earn("streak_day");
  spend("shop:pose_speaking", 8);
  spend("shop:pose_workout", 8);
  spend("shop:pose_celebrate", 12);
  for (let i = 0; i < 365; i++) earn("streak_day");
  for (let i = 0; i < 40; i++) earn("challenge_week");
  for (let i = 0; i < 12; i++) spend("shop:streak_freeze", 14);
  return rows;
}

beforeEach(() => {
  tables = {};
});

describe("lifetime totals", () => {
  it("counts the coin balance over the whole ledger", async () => {
    tables.coin_ledger = longLedger();
    const whole = await cd.fetchWholeLedger();
    expect(whole).toHaveLength(450);
    expect(balance(whole)).toBe(435 - 28 - 168);
  });

  it("keeps a pose bought in month one owned", async () => {
    tables.coin_ledger = longLedger();
    const owned = ownedFrom(await cd.fetchWholeLedger());
    expect(owned.ids.has("pose_speaking")).toBe(true);
    expect(owned.ids.has("pose_celebrate")).toBe(true);
  });

  it("answers the sync's balance from the whole ledger", async () => {
    tables.coin_ledger = longLedger();
    expect((await syncCoins([])).balance).toBe(239);
  });

  it("totals XP over every event, past 1000", async () => {
    tables.xp_events = Array.from({ length: 1100 }, (_, i) => ({ amount: 10, created_at: at(i) }));
    expect((await cd.fetchXp()).total).toBe(11000);
  });
});
