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
/** A reps insert answered by its row (the check on stars, #504); null: `repInsert`. */
let repAnswer: ((row: Record<string, unknown>) => typeof repInsert) | null = null;
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
              single: async () =>
                table === "reps" ? (repAnswer ? repAnswer(row) : repInsert) : { data: { id: "x" }, error: null },
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
  repAnswer = null;
  existing = null;
});

/*
 * #504: a take can earn no star. Until migration 0035 widens the column's
 * check to 0 to 3, the table refuses a 0, and the take is stored at 1, as
 * every take too thin to score was before, rather than lost.
 */
describe("saveRep, a take of no stars", () => {
  const zero = { ...(metrics as object), stars: 0 } as unknown as Parameters<typeof saveRep>[0]["metrics"];
  const checkSays = (row: Record<string, unknown>) =>
    row.stars === 0
      ? { data: null, error: { code: "23514", message: 'new row for relation "reps" violates check constraint "reps_stars_check"' } }
      : { data: { id: "rep-0" }, error: null };

  it("stores 0 where the check allows it", async () => {
    const saved = await saveRep(params({ metrics: zero, ethosIndex: null }));
    expect(saved?.id).toBe("rep-1");
    expect(inserts.filter((i) => i.table === "reps").map((i) => i.row.stars)).toEqual([0]);
  });

  it("stores it at 1 on a table whose check still says 1 to 3", async () => {
    repAnswer = checkSays;
    const saved = await saveRep(params({ metrics: zero, ethosIndex: null }));
    expect(saved?.id).toBe("rep-0");
    expect(inserts.filter((i) => i.table === "reps").map((i) => i.row.stars)).toEqual([0, 1]);
  });

  it("never rewrites a take that earned stars, whatever the table says", async () => {
    repAnswer = () => ({ data: null, error: { code: "23514", message: "violates check constraint \"reps_stars_check\"" } });
    const saved = await saveRep(params());
    expect(saved).toBeNull();
    expect(inserts.filter((i) => i.table === "reps").map((i) => i.row.stars)).toEqual([2]);
  });
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

  /*
   * #485, Timothy 16 Nov: "daily shld give xp". It does: Today's practice
   * is a stored recording like a lesson's, and every stored recording
   * pays lib/xp.ts's figure, which is the one You's card promises.
   */
  it("pays Today's practice the XP a lesson's recording pays, the card's own figure", async () => {
    const { XP_PER_RECORDING } = await import("./xp");
    await saveRep(params({ mode: "daily" }));
    const daily = inserts.find((i) => i.table === "xp_events")!.row;
    inserts = [];
    await saveRep(params({ mode: "daily", lessonId: "lesson:the-landing:1" }));
    const lesson = inserts.find((i) => i.table === "xp_events")!.row;
    expect(daily.amount).toBe(XP_PER_RECORDING);
    expect(lesson.amount).toBe(XP_PER_RECORDING);
    expect(daily.source).toBe("rep");
    expect(daily.user_id).toBe("user-1");
    // Harder pays more, never less: ×1.5 for a mod, as before.
    inserts = [];
    await saveRep(params({ mode: "daily", mods: ["tight"], xpMultiplier: 1.5 }));
    expect(inserts.find((i) => i.table === "xp_events")!.row.amount).toBe(15);
  });

  it("pays no XP to a take with no account", async () => {
    const saved = await saveRep(params({ userId: undefined }));
    expect(inserts.some((i) => i.table === "xp_events")).toBe(false);
    expect(saved?.xp).toBe(0);
  });

  it("says what it paid, so the server's answer can say it too", async () => {
    expect((await saveRep(params()))?.xp).toBe(10);
    expect((await saveRep(params({ mods: ["tight"], xpMultiplier: 1.5 })))?.xp).toBe(15);
  });
});

/*
 * #510, Timothy 18 Nov, on "a recording with no stars still earns 10 XP":
 * "drop it". Every way a recording is stored goes through saveRep, so
 * this is every path: the daily, a lesson, the boss, a game round,
 * Hostile Q&A, an upload. Each, with no star, writes no XP row.
 */
describe("saveRep, the XP of a take of no stars (#510)", () => {
  const zero = { ...(metrics as object), stars: 0 } as unknown as Parameters<typeof saveRep>[0]["metrics"];
  const paths: [string, Partial<Parameters<typeof saveRep>[0]>][] = [
    ["Today's practice", { mode: "daily", lessonId: "topic:t12:pause" }],
    ["a lesson", { mode: "daily", lessonId: "lesson:the-landing:1" }],
    ["the weekly boss", { mode: "boss", lessonId: "boss:crispr", xpMultiplier: 1, bossTopicId: "crispr" }],
    ["a game round", { mode: "daily", lessonId: "game:qa:qa3", mods: ["interrupt"], xpMultiplier: 2 }],
    ["Hostile Q&A", { mode: "daily", lessonId: "hostile-take" }],
    ["an upload", { mode: "daily" }],
  ];

  for (const [name, extra] of paths) {
    it(`pays nothing on ${name}, and stores the recording as before`, async () => {
      const saved = await saveRep(params({ ...extra, metrics: zero, ethosIndex: null }));
      expect(saved?.id).toBe("rep-1");
      expect(saved?.xp).toBe(0);
      expect(inserts.some((i) => i.table === "xp_events")).toBe(false);
      expect(inserts.filter((i) => i.table === "reps")).toHaveLength(1);
    });

    it(`pays ${name} as before once it earns a star`, async () => {
      const one = { ...(metrics as object), stars: 1 } as unknown as Parameters<typeof saveRep>[0]["metrics"];
      const saved = await saveRep(params({ ...extra, metrics: one }));
      const row = inserts.find((i) => i.table === "xp_events")!.row;
      expect(row.amount).toBe(Math.round(10 * (extra.xpMultiplier ?? 1)));
      expect(saved?.xp).toBe(row.amount);
    });
  }

  it("reads the measured stars, not the 1 a table before 0035 stores for a 0", async () => {
    repAnswer = (row) =>
      row.stars === 0
        ? { data: null, error: { code: "23514", message: 'new row for relation "reps" violates check constraint "reps_stars_check"' } }
        : { data: { id: "rep-0" }, error: null };
    const saved = await saveRep(params({ metrics: zero, ethosIndex: null }));
    expect(inserts.filter((i) => i.table === "reps").map((i) => i.row.stars)).toEqual([0, 1]);
    expect(saved?.xp).toBe(0);
    expect(inserts.some((i) => i.table === "xp_events")).toBe(false);
  });

  it("leaves created_at to the database when no time is given", async () => {
    await saveRep(params());
    const rep = inserts.find((i) => i.table === "reps")!.row;
    expect("created_at" in rep).toBe(false);
  });

  /*
   * #491: a take stored from here on says which pause rules scored it, so
   * the first take after #476 can tell a stored take scored before them.
   * The mark goes beside the scores it describes, in the jsonb the row
   * already has: no migration, and nothing stored is touched.
   */
  it("keeps the pause rules that scored the take beside its scores", async () => {
    const { PAUSE_RULES, pauseRulesOf } = await import("./pause-rules");
    await saveRep(params({ pauseRules: PAUSE_RULES }));
    const dims = inserts.find((i) => i.table === "reps")!.row.dimensions as Record<string, unknown>;
    expect(dims.pauseRules).toBe(476);
    expect(pauseRulesOf(dims)).toBe(PAUSE_RULES);
    expect(Object.keys(dims)).toEqual(["tier1", "anchors", "tier2", "pauseRules"]);
    inserts = [];
    await saveRep(params());
    const bare = inserts.find((i) => i.table === "reps")!.row.dimensions as Record<string, unknown>;
    expect("pauseRules" in bare).toBe(false);
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
 * #429: the coach may say none. The take is stored with its coach, its
 * XP is paid, and no lexicon row is written for an upgrade that is not
 * there.
 */
describe("saveRep and the coach's upgrade", () => {
  const coach = (supply: unknown) =>
    ({
      focus: "Hold a pause.",
      strength: "0 fillers.",
      supply,
      coachLine: "0 fillers.",
      dimensions: {},
    }) as never;

  it("stores a coached take with no upgrade, pays its XP and writes no lexicon row", async () => {
    const saved = await saveRep(params({ coach: coach(null) }));
    expect(saved).toEqual({ id: "rep-1", audioPath: expect.any(String), xp: 10 });
    const rep = inserts.find((i) => i.table === "reps")!.row;
    expect(rep.supply).toBeNull();
    expect(rep.focus).toBe("Hold a pause.");
    expect(inserts.some((i) => i.table === "xp_events")).toBe(true);
    expect(inserts.some((i) => i.table === "lexicon")).toBe(false);
  });

  it("adds an upgrade to the lexicon, as before", async () => {
    await saveRep(params({ coach: coach({ original: "making the thing small", upgrade: "making the habit small", note: "It says exactly what you meant." }) }));
    const row = inserts.find((i) => i.table === "lexicon")!.row;
    expect(row).toMatchObject({ user_id: "user-1", original: "making the thing small", upgrade: "making the habit small", rep_id: "rep-1" });
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

describe("saveRep and a game round (0026)", () => {
  const round = { v: 1, game: "rush", level: 2, cap: 30, counted: true } as unknown as NonNullable<
    Parameters<typeof saveRep>[0]["round"]
  >;

  it("stores the round on a game, and nothing on anything else", async () => {
    await saveRep(params({ round }));
    expect(inserts.find((i) => i.table === "reps")!.row.round).toEqual(round);
    inserts = [];
    await saveRep(params());
    expect("round" in inserts.find((i) => i.table === "reps")!.row).toBe(false);
  });

  /** The reps insert refuses each named column it does not have yet. */
  function tableWithout(columns: string[]) {
    const realPush = inserts.push.bind(inserts);
    inserts.push = (...items: Insert[]) => {
      for (const i of items) {
        if (i.table !== "reps") continue;
        const missing = columns.find((c) => c in i.row);
        repInsert = missing
          ? { data: null, error: { code: "PGRST204", message: `Could not find the '${missing}' column of 'reps' in the schema cache` } }
          : { data: { id: "rep-1" }, error: null };
      }
      return realPush(...items);
    };
  }

  it("stores the recording without its round before migration 0026 is applied", async () => {
    tableWithout(["round"]);
    const saved = await saveRep(params({ round, clientId: "k1" }));
    expect(saved?.id).toBe("rep-1");
    const reps = inserts.filter((i) => i.table === "reps");
    expect(reps).toHaveLength(2);
    expect("round" in reps[1].row).toBe(false);
    expect(reps[1].row.client_id).toBe("k1");
    // The XP is still paid, at the multiplier the route worked out.
    expect(inserts.find((i) => i.table === "xp_events")).toBeTruthy();
  });

  it("drops both columns, one at a time, on a table that has neither", async () => {
    tableWithout(["client_id", "round"]);
    const saved = await saveRep(params({ round, clientId: "k1" }));
    expect(saved?.id).toBe("rep-1");
    const reps = inserts.filter((i) => i.table === "reps");
    expect(reps).toHaveLength(3);
    expect(Object.keys(reps[2].row)).not.toContain("round");
    expect(Object.keys(reps[2].row)).not.toContain("client_id");
  });

  it("never retries a taken key as a missing column", async () => {
    repInsert = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint reps_user_client_id_uniq on round" } };
    existing = { id: "rep-0" };
    const saved = await saveRep(params({ round, clientId: "k1" }));
    expect(saved).toEqual({ id: "rep-0", audioPath: null, duplicate: true });
    expect(inserts.filter((i) => i.table === "reps")).toHaveLength(1);
  });
});
