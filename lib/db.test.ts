import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * saveRep against a Supabase stand-in that records every write, so the
 * test sees the rows the server would store.
 */
type Insert = { table: string; row: Record<string, unknown> };
let inserts: Insert[] = [];

function fakeClient() {
  return {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return {
          select: () => ({
            single: async () => ({ data: { id: "rep-1" }, error: null }),
          }),
          then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok),
        };
      },
    }),
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
