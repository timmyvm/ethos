import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Say it better's store (#507, its review): a merged pair comes off the
 * list whole and comes back whole, its state written under every key; the
 * read the visit holds agrees with a removal at once; and "You said,
 * Monday" names the day the source recording was made, even past the
 * newest recordings the page reads.
 */

const h = vi.hoisted(() => ({
  pairs: [] as { id: string; original: string; upgrade: string; rep_id: string | null; created_at: string }[],
  words: [] as { id: string; word: string; instead: string; sentence: string | null; rep_id: string | null; created_at: string }[],
  reps: [] as { id: string; created_at: string; transcript: string | null }[],
  /** The newest-first window: only these come back from the date-bounded read. */
  window: new Set<string>(),
  upserts: [] as { swap: string; hidden: boolean; step: number }[],
  removed: [] as string[],
  restored: [] as { id: string; sentence: string | null; rep_id: string | null; created_at: string }[],
}));

vi.mock("./supabase-browser", () => {
  const query = (table: string) => {
    let byId: string[] | null = null;
    const api = {
      select: () => api,
      order: () => api,
      limit: () => api,
      gte: () => api,
      // Every read names its account (lib/own-rows.ts); this table has one.
      eq: () => api,
      in: (_c: string, ids: string[]) => {
        byId = ids;
        return api;
      },
      upsert: (rows: { swap: string; hidden: boolean; step: number } | { swap: string; hidden: boolean; step: number }[]) => {
        h.upserts.push(...(Array.isArray(rows) ? rows : [rows]));
        return Promise.resolve({ error: null });
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
        const data =
          table === "lexicon"
            ? h.pairs
            : table === "say_better"
              ? []
              : table === "reps"
                ? byId
                  ? h.reps.filter((r) => byId!.includes(r.id))
                  : h.reps.filter((r) => h.window.has(r.id))
                : [];
        return Promise.resolve({ data, error: null }).then(ok, bad);
      },
    };
    return api;
  };
  const db = { from: query, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  return {
    supabaseBrowser: () => db,
    currentSession: async () => ({ userId: "u1", anonymous: false }),
  };
});

vi.mock("./saved-words", () => ({
  fetchSavedWords: async () => h.words,
  removeSavedWord: async (id: string) => {
    h.removed.push(id);
  },
  restoreSavedWord: async (row: { id: string; sentence: string | null; rep_id: string | null; created_at: string }) => {
    h.restored.push(row);
    return row;
  },
  noteRemoved: () => {},
  noteSaved: () => {},
}));

import { fetchSay, heldSay, removeSwap, restoreSwap, saveSwapState } from "./say-store";
import { resetHeld } from "./held";
import { freshState, sayLists } from "./say";

class Memory {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const C1 = "c:11111111-1111-4111-8111-111111111111";
const W1 = "w:22222222-2222-4222-8222-222222222222";
const g = globalThis as unknown as { localStorage?: Memory };

beforeEach(() => {
  resetHeld();
  g.localStorage = new Memory();
  h.upserts = [];
  h.removed = [];
  h.restored = [];
  h.window = new Set();
  // The word save came first, from an old recording; the coach said the same pair later.
  h.words = [
    { id: W1.slice(2), word: "very cold", instead: "freezing", sentence: "It was very cold out.", rep_id: "old-take", created_at: "2026-11-12T09:00:00.000Z" },
  ];
  h.pairs = [{ id: C1.slice(2), original: "very cold", upgrade: "freezing", rep_id: "new-take", created_at: "2026-11-14T09:00:00.000Z" }];
  h.reps = [
    { id: "old-take", created_at: "2026-10-01T09:00:00.000Z", transcript: "It was very cold out." },
    { id: "new-take", created_at: "2026-11-14T08:59:00.000Z", transcript: "Honestly very cold again." },
    { id: "later", created_at: "2026-11-16T09:00:00.000Z", transcript: "It was freezing." },
  ];
  h.window = new Set(["new-take", "later"]);
});
afterEach(() => {
  delete g.localStorage;
});

describe("a pair saved both ways", () => {
  it("is one swap, counted from the later recording only, dated by its own recording", async () => {
    const read = await fetchSay();
    expect(read.items).toHaveLength(1);
    const [item] = read.items;
    expect(item.swap.key).toBe(W1);
    // "new-take" is where the coach's row came from: never a later use.
    expect(item.uses.map((u) => u.repId)).toEqual(["later"]);
    // The old recording is past the newest-first read; it is read by its id.
    expect(item.saidOn).toBe("2026-10-01T09:00:00.000Z");
    expect(item.swap.sentence).toBe("It was very cold out.");
  });

  it("comes off whole: the word save leaves its table and the coach's row is marked off, and the held read agrees", async () => {
    const [item] = (await fetchSay()).items;
    h.upserts = [];
    await removeSwap(item);
    expect(h.removed).toEqual([W1.slice(2)]);
    expect(h.upserts.filter((r) => r.swap === C1).map((r) => r.hidden)).toEqual([true]);
    // You's card draws from the held read: it already has the swap off.
    expect(sayLists(heldSay()!.items, "2026-11-18").m).toBe(0);

    // The next read, with the word save gone: the coach's row alone stays off.
    h.words = [];
    const after = await fetchSay();
    expect(sayLists(after.items, "2026-11-18").m).toBe(0);
  });

  it("comes back whole on Undo, each row as its own table held it, its place in the test kept", async () => {
    const [item] = (await fetchSay()).items;
    const placed = { ...item, state: { ...freshState(item.swap), step: 2, due: "2026-11-25", at: "2026-11-17T09:00:00.000Z" } };
    await removeSwap(placed);
    h.upserts = [];
    await restoreSwap(placed);
    expect(h.restored).toEqual([
      { id: W1.slice(2), word: "very cold", instead: "freezing", sentence: "It was very cold out.", rep_id: "old-take", created_at: "2026-11-12T09:00:00.000Z" },
    ]);
    expect(h.upserts.filter((r) => r.swap === C1).map((r) => [r.hidden, r.step])).toEqual([[false, 2]]);
    expect(sayLists(heldSay()!.items, "2026-11-18").m).toBe(1);
  });

  it("keeps its test state under both keys, so it holds whichever row is left", async () => {
    const [item] = (await fetchSay()).items;
    h.upserts = [];
    await saveSwapState(item.swap, { ...item.state, step: 1, due: "2026-11-21", last: "said", testedOn: "2026-11-18", at: "2026-11-18T10:00:00.000Z" });
    expect(h.upserts.map((r) => r.swap).sort()).toEqual([C1, W1].sort());
  });
});
