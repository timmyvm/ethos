import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * saveRep against a Supabase stand-in that records every write, so the
 * test sees the rows the server would store.
 */
type Insert = { table: string; row: Record<string, unknown> };
let inserts: Insert[] = [];
let removed: string[] = [];
/** The reps insert's answer: a stored row, or the unique index refusing it. */
let repInsert: { data: { id: string } | null; error: { code: string; message: string } | null } = {
  data: { id: "rep-1" },
  error: null,
};
/** What a lookup by (user, client_id) finds. */
let existing: { id: string } | null = null;

function fakeClient() {
  return {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table: string) => {
      const lookup = {
        select: () => lookup,
        eq: () => lookup,
        maybeSingle: async () => ({ data: existing, error: null }),
      };
      return {
        ...lookup,
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return {
            select: () => ({
              single: async () => (table === "reps" ? repInsert : { data: { id: "x" }, error: null }),
            }),
            then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok),
          };
        },
      };
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeClient() }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

const { saveRep } = await import("./db");

const metrics = {
  durationS: 60,
  wpm: 140,
  fillerCount: 1,
  fillers: [],
  pauses: [],
  stars: 2,
} as unknown as Parameters<typeof saveRep>[0]["metrics"];

function params(extra: Partial<Parameters<typeof saveRep>[0]> = {}) {
  return {
    audio: new Blob(["a"], { type: "audio/webm" }),
    filename: "rep.webm",
    transcript: "hello",
    metrics,
    tier1: {} as Parameters<typeof saveRep>[0]["tier1"],
    anchors: { hedgeCount: 0, restartCount: 0 },
    coach: null,
    ethosIndex: 500,
    userId: "user-1",
    ...extra,
  };
}

beforeEach(() => {
  inserts = [];
  removed = [];
  repInsert = { data: { id: "rep-1" }, error: null };
  existing = null;
});

describe("saveRep", () => {
  it("dates the recording and its XP at the time it was spoken", async () => {
    const at = "2026-10-20T12:50:00.000Z";
    await saveRep(params({ createdAt: at }));
    const rep = inserts.find((i) => i.table === "reps")!.row;
    const xp = inserts.find((i) => i.table === "xp_events")!.row;
    expect(rep.created_at).toBe(at);
    expect(xp.created_at).toBe(at);
  });

  it("leaves created_at to the database when no time is given", async () => {
    await saveRep(params());
    const rep = inserts.find((i) => i.table === "reps")!.row;
    expect("created_at" in rep).toBe(false);
  });
});

describe("saveRep and a recording sent twice", () => {
  it("stores the recording's key", async () => {
    await saveRep(params({ clientId: "k1" }));
    expect(inserts.find((i) => i.table === "reps")!.row.client_id).toBe("k1");
  });

  it("answers the stored recording when the key is already taken, and pays nothing twice", async () => {
    repInsert = { data: null, error: { code: "23505", message: "duplicate key" } };
    existing = { id: "rep-first" };
    const saved = await saveRep(
      params({ clientId: "k1", coach: { supply: { original: "a", upgrade: "b", note: "" } } as never })
    );
    expect(saved).toEqual({ id: "rep-first", audioPath: null, duplicate: true });
    expect(inserts.some((i) => i.table === "xp_events")).toBe(false);
    expect(inserts.some((i) => i.table === "lexicon")).toBe(false);
    expect(removed).toHaveLength(1);
  });
});
