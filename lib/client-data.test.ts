import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A PostgREST stand-in that honours order and limit the way the real one
 * does, so the test asks the same question the database answers: which
 * rows does a capped read return, and in what order does the app see them.
 */
type Row = { id: string; created_at: string; scorable?: boolean; word_count?: number; distinct_words?: number };
let table: Row[] = [];
let profileError: { message: string } | null = null;
/** A database before migration 0037: a select naming `scorable` is refused with 42703. */
let before0037 = false;
/** The columns the last read asked for. */
let selected = "";

function query(rows: Row[]) {
  let out = [...rows];
  const q = {
    select: (columns: string) => {
      selected = columns;
      return q;
    },
    order: (col: "id" | "created_at", { ascending }: { ascending: boolean }) => {
      out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1));
      return q;
    },
    limit: (n: number) => {
      out = out.slice(0, n);
      return Promise.resolve({ data: out, error: null });
    },
    // PostgREST's max_rows: a response never holds more than 1000 rows,
    // however wide the range asked for.
    range: (from: number, to: number) =>
      Promise.resolve(
        before0037 && /\bscorable\b/.test(selected)
          ? { data: null, error: { code: "42703", message: "column reps.scorable does not exist" } }
          : { data: out.slice(from, Math.min(to + 1, from + 1000)), error: null }
      ),
    maybeSingle: () =>
      Promise.resolve(
        profileError
          ? { data: null, error: profileError }
          : { data: { display_name: "Tim", premium: true, premium_until: null, equipped_pose: null }, error: null }
      ),
  };
  return q;
}

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "t" } } }) },
    from: (name: string) => query(name === "reps" ? table : []),
  }),
}));

const { fetchReps, fetchProfile, fetchRepSpine, fetchAllReps } = await import("./client-data");

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString();

describe("fetchReps", () => {
  beforeEach(() => {
    // 120 recordings, one a day, stored in no particular order, each
    // carrying 0037's columns (#511) so the list needs no transcripts.
    table = Array.from({ length: 120 }, (_, i) => ({ id: `r${i}`, created_at: day(i), scorable: true, word_count: 40, distinct_words: 30 })).reverse();
  });

  it("keeps the newest rows when the log runs past the limit", async () => {
    const rows = await fetchReps(90);
    expect(rows).toHaveLength(90);
    expect(rows.map((r) => r.id)).toContain("r119");
    expect(rows.map((r) => r.id)).not.toContain("r29");
  });

  it("hands them back oldest first", async () => {
    const rows = await fetchReps(90);
    expect(rows[0].id).toBe("r30");
    expect(rows[rows.length - 1].id).toBe("r119");
    const times = rows.map((r) => r.created_at);
    expect([...times].sort()).toEqual(times);
  });

  it("returns every row, oldest first, under the limit", async () => {
    table = table.slice(0, 5);
    const rows = await fetchReps();
    expect(rows.map((r) => r.id)).toEqual(["r115", "r116", "r117", "r118", "r119"]);
  });
});

describe("fetchProfile", () => {
  beforeEach(() => {
    profileError = null;
  });

  it("reads the plan", async () => {
    expect((await fetchProfile())?.premium).toBe(true);
  });

  it("throws on a failed read instead of answering 'not premium'", async () => {
    profileError = { message: "upstream" };
    await expect(fetchProfile()).rejects.toEqual({ message: "upstream" });
  });
});

describe("fetchRepSpine", () => {
  it("reads every recording, past the 1000 rows one response can hold", async () => {
    table = Array.from({ length: 1200 }, (_, i) => ({ id: `r${i}`, created_at: day(i) })).reverse();
    const rows = await fetchRepSpine();
    expect(rows).toHaveLength(1200);
    expect(rows[0].created_at).toBe(day(0));
    expect(rows[rows.length - 1].created_at).toBe(day(1199));
  });

  it("reads a short history in one page", async () => {
    table = Array.from({ length: 120 }, (_, i) => ({ id: `r${i}`, created_at: day(i) }));
    expect(await fetchRepSpine()).toHaveLength(120);
  });

  it("reads each recording's id and kind, so the Log can list and open every one (#506)", async () => {
    table = [{ id: "r0", created_at: day(0) }];
    await fetchRepSpine();
    const columns = selected.split(",").map((c) => c.trim());
    expect(columns).toEqual(expect.arrayContaining(["id", "created_at", "lesson_id", "stars", "ethos_index", "mode"]));
    // A few short columns, never the transcript or the whole judged read.
    expect(columns).not.toContain("transcript");
    expect(columns).not.toContain("dimensions");
  });
});

describe("the spine's scorable column (the streak's repair, closure.md row 14)", () => {
  it("reads whether each recording scored, the one column the repair counts", async () => {
    table = [{ id: "r0", created_at: day(0), scorable: true }];
    const rows = await fetchRepSpine();
    expect(selected.split(",").map((c) => c.trim())).toContain("scorable");
    expect(rows[0].scorable).toBe(true);
  });

  /* Last in the file: the 42703 is heard once a load, and every read after it asks without the column. */
  it("reads the spine without it on a database before 0037, so nothing is kept and nothing fails", async () => {
    before0037 = true;
    table = [{ id: "r0", created_at: day(0) }, { id: "r1", created_at: day(1) }];
    const rows = await fetchRepSpine();
    expect(rows).toHaveLength(2);
    expect(selected).not.toMatch(/scorable/);
    expect(rows.every((r) => r.scorable === undefined)).toBe(true);
    before0037 = false;
  });
});

describe("fetchAllReps (the export)", () => {
  it("holds every recording, past the 1000 rows one response can hold", async () => {
    table = Array.from({ length: 1200 }, (_, i) => ({ id: `r${i}`, created_at: day(i) })).reverse();
    const rows = await fetchAllReps();
    expect(rows).toHaveLength(1200);
    expect(rows[0].id).toBe("r0");
  });
});
