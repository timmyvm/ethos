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
/** What GoTrue answers for a token. */
let getUser: () => Promise<unknown> = async () => ({ data: { user: null }, error: null });

function fakeClient() {
  return {
    auth: { getUser: () => getUser() },
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

const { saveRep, resolveAuthHeader } = await import("./db");
const { neutralAudioName } = await import("./audio-name");

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

/*
 * Review P3: an upload kept its camera-roll name in the stored path
 * ("reps/<time>-John_Smith_interview.mp4") and sent it to the
 * transcription service. A name can be a person's; the extension is all
 * either needs.
 */
describe("a stored recording's name", () => {
  it("is rep and its extension, never the name it was picked with", () => {
    expect(neutralAudioName("John Smith interview.MP4")).toBe("rep.mp4");
    expect(neutralAudioName("rep.webm")).toBe("rep.webm");
    expect(neutralAudioName("voice memo")).toBe("rep.webm");
    expect(neutralAudioName("../../evil.m4a")).toBe("rep.m4a");
    expect(neutralAudioName("x.reallylongext")).toBe("rep.webm");
    expect(neutralAudioName(null)).toBe("rep.webm");
  });

  it("is stored under that name, a time and a random part", async () => {
    await saveRep(params({ filename: "Jane Doe pitch.mp4" }));
    const rep = inserts.find((i) => i.table === "reps")!.row;
    expect(rep.audio_path).toMatch(/^reps\/\d+-[0-9a-f]{8}-rep\.mp4$/);
    expect(JSON.stringify(rep)).not.toMatch(/Jane|Doe|pitch/);
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

/*
 * A token that does not resolve used to look like no token at all, and
 * the recording was stored with no owner while the client deleted its
 * only copy. The route needs to tell four answers apart.
 */
describe("resolveAuthHeader", () => {
  const user = { id: "u1", is_anonymous: false, email: "t@x.co" };

  it("knows a missing header from a session", async () => {
    expect(await resolveAuthHeader(null)).toEqual({ kind: "none" });
    getUser = async () => ({ data: { user }, error: null });
    expect(await resolveAuthHeader("Bearer t")).toEqual({
      kind: "user",
      user: { id: "u1", anonymous: false, email: "t@x.co" },
    });
  });

  it("calls an expired or forged token rejected", async () => {
    getUser = async () => ({
      data: { user: null },
      error: { name: "AuthApiError", status: 401, message: "invalid JWT: token is expired" },
    });
    expect(await resolveAuthHeader("Bearer t")).toEqual({ kind: "rejected" });
  });

  it("calls GoTrue's own failure unavailable, never sessionless", async () => {
    getUser = async () => ({
      data: { user: null },
      error: { name: "AuthApiError", status: 503, message: "upstream" },
    });
    expect(await resolveAuthHeader("Bearer t")).toEqual({ kind: "unavailable" });
    getUser = async () => ({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    });
    expect(await resolveAuthHeader("Bearer t")).toEqual({ kind: "unavailable" });
    getUser = async () => {
      throw new Error("network");
    };
    expect(await resolveAuthHeader("Bearer t")).toEqual({ kind: "unavailable" });
  });
});

describe("saveRep before migration 0016 is applied", () => {
  it("stores the recording without its key rather than not at all", async () => {
    let first = true;
    repInsert = { data: { id: "rep-1" }, error: null };
    const realPush = inserts.push.bind(inserts);
    // The first reps insert names client_id and the table has no such column yet.
    inserts.push = (...items: Insert[]) => {
      for (const i of items) {
        if (i.table === "reps" && first && "client_id" in i.row) {
          first = false;
          repInsert = { data: null, error: { code: "PGRST204", message: "Could not find the 'client_id' column of 'reps' in the schema cache" } };
        } else if (i.table === "reps") {
          repInsert = { data: { id: "rep-1" }, error: null };
        }
      }
      return realPush(...items);
    };
    const saved = await saveRep(params({ clientId: "k1" }));
    expect(saved?.id).toBe("rep-1");
    const reps = inserts.filter((i) => i.table === "reps");
    expect(reps).toHaveLength(2);
    expect("client_id" in reps[1].row).toBe(false);
  });
});
