import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * fetchGameRounds and the reads before migration 0026, against a
 * PostgREST stand-in that records what each read asked for and answers
 * the way the real one does when a column is missing.
 */
type Read = {
  select: string;
  like: [string, string] | null;
  eq: [string, unknown] | null;
  limit: number | null;
};
let reads: Read[] = [];
let rows: Record<string, unknown>[] = [];
let hasRound = true;
let failing = false;

function query() {
  const r: Read = { select: "", like: null, eq: null, limit: null };
  reads.push(r);
  const answer = () => {
    if (failing) return Promise.resolve({ data: null, error: { code: "XX000", message: "upstream" } });
    if (!hasRound && /\bround\b/.test(r.select)) {
      return Promise.resolve({ data: null, error: { code: "42703", message: 'column reps.round does not exist' } });
    }
    let out = [...rows];
    if (r.like) out = out.filter((x) => String(x[r.like![0]] ?? "").startsWith(r.like![1].replace(/%$/, "")));
    if (r.eq) out = out.filter((x) => x[r.eq![0]] === r.eq![1]);
    out.sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1));
    if (r.limit) out = out.slice(0, r.limit);
    // Only the columns asked for, as PostgREST answers.
    const cols = r.select.split(",").map((c) => c.trim()).filter((c) => /^\w+$/.test(c));
    const picked = out.map((x) => Object.fromEntries(cols.filter((c) => c in x).map((c) => [c, x[c]])));
    return Promise.resolve({ data: picked, error: null });
  };
  const q: Record<string, unknown> = {
    select: (cols: string) => ((r.select = cols), q),
    like: (col: string, pattern: string) => ((r.like = [col, pattern]), q),
    order: () => q,
    eq: (col: string, v: unknown) => ((r.eq = [col, v]), q),
    limit: (n: number) => ((r.limit = n), q),
    maybeSingle: () => answer().then((a) => ({ ...a, data: Array.isArray(a.data) ? (a.data[0] ?? null) : a.data })),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => answer().then(ok, bad),
  };
  return q;
}

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "t" } } }) },
    from: () => query(),
  }),
}));

const { fetchGameRounds, fetchReps, fetchRep, GAME_ROUNDS_LIMIT } = await import("./client-data");

const day = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 86_400_000).toISOString();

beforeEach(() => {
  reads = [];
  hasRound = true;
  failing = false;
  rows = [
    { id: "a", lesson_id: "game:qa:qa1", created_at: day(1), stars: 3, ethos_index: 600, round: { game: "qa" } },
    { id: "b", lesson_id: "topic:t1", created_at: day(2), stars: 2, ethos_index: 500, round: null },
    { id: "c", lesson_id: "game:rush:ru1", created_at: day(3), stars: 2, ethos_index: null },
  ];
});

describe("fetchGameRounds", () => {
  it("reads the newest game recordings, a few columns each, and hands them back oldest first", async () => {
    const got = await fetchGameRounds();
    expect(reads[0]).toEqual({
      select: "id, lesson_id, created_at, stars, ethos_index, round",
      like: ["lesson_id", "game:%"],
      eq: null,
      limit: GAME_ROUNDS_LIMIT,
    });
    expect(GAME_ROUNDS_LIMIT).toBe(500);
    expect(got.map((r) => r.id)).toEqual(["a", "c"]);
    expect(got[1].round).toBeNull();
  });

  it("reads them without the round before migration 0026", async () => {
    hasRound = false;
    const got = await fetchGameRounds();
    expect(reads).toHaveLength(2);
    expect(got.map((r) => [r.id, r.round])).toEqual([
      ["a", null],
      ["c", null],
    ]);
  });

  it("throws on a failed read, which is not an empty ladder", async () => {
    failing = true;
    await expect(fetchGameRounds()).rejects.toBeTruthy();
  });
});

describe("the recording reads before migration 0026", () => {
  it("name the round when the table has it", async () => {
    await fetchReps(10);
    expect(reads).toHaveLength(1);
    expect(reads[0].select).toMatch(/, round$/);
  });

  it("read everything else when it does not, rather than failing whole", async () => {
    hasRound = false;
    const got = await fetchReps(10);
    expect(got.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(reads[1].select).not.toMatch(/\bround\b/);
    const one = await fetchRep("a");
    expect(one?.id).toBe("a");
  });

  it("still throws on any other failure", async () => {
    failing = true;
    await expect(fetchReps(10)).rejects.toBeTruthy();
  });
});
