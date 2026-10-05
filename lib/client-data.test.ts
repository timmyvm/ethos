import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A PostgREST stand-in that honours order and limit the way the real one
 * does, so the test asks the same question the database answers: which
 * rows does a capped read return, and in what order does the app see them.
 */
type Row = { id: string; created_at: string };
let table: Row[] = [];
let profileError: { message: string } | null = null;

function query(rows: Row[]) {
  let out = [...rows];
  const q = {
    select: () => q,
    order: (col: keyof Row, { ascending }: { ascending: boolean }) => {
      out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1));
      return q;
    },
    limit: (n: number) => {
      out = out.slice(0, n);
      return Promise.resolve({ data: out, error: null });
    },
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

const { fetchReps, fetchProfile } = await import("./client-data");

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString();

describe("fetchReps", () => {
  beforeEach(() => {
    // 120 recordings, one a day, stored in no particular order.
    table = Array.from({ length: 120 }, (_, i) => ({ id: `r${i}`, created_at: day(i) })).reverse();
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
