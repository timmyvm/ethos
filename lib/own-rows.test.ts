import { describe, expect, it, vi } from "vitest";

/*
 * Every read of the account's own rows names the account (docs/scale/
 * audit.md DB-1 and DB-2). The policy alone gives the same rows, but
 * Postgres then asks it of each row it looks at, and Supabase's auth.uid()
 * parses the request's JWT each time: the lexicon read, which has no
 * index under the policy alone, cost every open a scan of every account's
 * pairs (docs/scale/explain.txt: 162 to 170 ms on 21k pairs, before and
 * after an account had any). Named, the policy is asked once and the
 * account's own index answers. A stand-in client records each read's
 * filters; every table read below must carry user_id = the session's id.
 */

const ME = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  reads: [] as { table: string; eqs: [string, unknown][] }[],
}));

vi.mock("./supabase-browser", () => {
  const query = (table: string) => {
    const read = { table, eqs: [] as [string, unknown][] };
    h.reads.push(read);
    const rows = (): unknown[] =>
      table === "lexicon"
        ? [{ id: "33333333-3333-4333-8333-333333333333", original: "thing", upgrade: "point", rep_id: "r-old", created_at: "2026-11-01T10:00:00Z" }]
        : [];
    const api: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "range", "gte", "lt", "like", "in", "not", "is"]) api[m] = () => api;
    api.eq = (col: string, v: unknown) => {
      read.eqs.push([col, v]);
      return api;
    };
    api.maybeSingle = () => Promise.resolve({ data: null, error: null });
    api.upsert = () => Promise.resolve({ error: null });
    api.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(ok, bad);
    return api;
  };
  const session = { access_token: "t", user: { id: ME } };
  const db = {
    from: query,
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
  return {
    supabaseBrowser: () => db,
    currentSession: async () => ({ userId: ME, token: "t" }),
  };
});

const cd = await import("./client-data");
const say = await import("./say-store");
const { fetchSavedWords } = await import("./saved-words");

/** The reads `run` made, each with whether it named the account. */
async function readsOf(run: () => Promise<unknown>) {
  h.reads.length = 0;
  await run();
  return h.reads.map((r) => ({ table: r.table, named: r.eqs.some(([c, v]) => c === "user_id" && v === ME) }));
}

describe("a read of the account's own rows names the account", () => {
  const cases: [string, () => Promise<unknown>, string[]][] = [
    ["Today's newest recordings", () => cd.fetchReps(90), ["reps"]],
    ["Lessons' newest 200", () => cd.fetchReps(200), ["reps"]],
    ["the game rounds", () => cd.fetchGameRounds(), ["reps"]],
    ["the boss and Hostile takes", () => cd.fetchPracticeTakes(), ["reps", "reps"]],
    ["the spine", () => cd.fetchRepSpine(), ["reps"]],
    ["the export's recordings", () => cd.fetchAllReps(), ["reps"]],
    ["the export's pairs", () => cd.fetchAllLexicon(), ["lexicon"]],
    ["the coach's pairs", () => cd.fetchLexicon(100), ["lexicon"]],
    ["the XP", () => cd.fetchXp(), ["xp_events"]],
    ["the whole ledger", () => cd.fetchWholeLedger(), ["coin_ledger"]],
    ["the newest ledger rows", () => cd.fetchCoinLedger(), ["coin_ledger"]],
    ["the freezes bought", () => cd.purchasedFreezes(), ["coin_ledger"]],
    ["the frozen days", () => cd.fetchFrozenDays(), ["streak_freezes"]],
    ["the saved words", () => fetchSavedWords(), ["saved_words"]],
    ["the timed words of a few recordings", () => say.fetchTakeWords(["r-1"]), ["reps"]],
  ];
  for (const [name, run, tables] of cases) {
    it(name, async () => {
      const reads = await readsOf(run);
      expect(reads.map((r) => r.table)).toEqual(tables);
      expect(reads.filter((r) => !r.named)).toEqual([]);
    });
  }

  it("Say it better: the pairs, the saved words, the test state, the newest recordings and an old one by id", async () => {
    const reads = await readsOf(() => say.fetchSay());
    expect(new Set(reads.map((r) => r.table))).toEqual(new Set(["lexicon", "saved_words", "say_better", "reps"]));
    // The newest-first read and the read of the old source by its id.
    expect(reads.filter((r) => r.table === "reps")).toHaveLength(2);
    expect(reads.filter((r) => !r.named)).toEqual([]);
  });
});
