import { beforeEach, describe, expect, it, vi } from "vitest";
import { substance } from "./metrics";
import { substanceColumns } from "./rep-substance";
import { measured, readTraitsFromRow } from "./trait-readings";

/*
 * The lists' read (fetchReps) and migration 0037 (#511), against a
 * PostgREST stand-in that answers only the columns asked for and refuses
 * a column the table does not have, as the real one does (42703).
 */
type Read = { select: string; in: unknown[] | null };
let reads: Read[] = [];
let rows: Record<string, unknown>[] = [];
let has0037 = true;
let hasRound = true;
let transcriptsFail = false;

function query() {
  const r: Read = { select: "", in: null };
  reads.push(r);
  const answer = () => {
    const cols = r.select.split(",").map((c) => c.trim());
    const missing = cols.find((c) => (!has0037 && ["scorable", "word_count", "distinct_words"].includes(c)) || (!hasRound && c === "round"));
    if (missing) return Promise.resolve({ data: null, error: { code: "42703", message: `column reps.${missing} does not exist` } });
    if (r.in && transcriptsFail) return Promise.resolve({ data: null, error: { code: "XX000", message: "upstream" } });
    let out = [...rows];
    if (r.in) out = out.filter((x) => r.in!.includes(x.id));
    out.sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1));
    const picked = out.map((x) => Object.fromEntries(cols.filter((c) => c in x).map((c) => [c, x[c]])));
    return Promise.resolve({ data: picked, error: null });
  };
  const q: Record<string, unknown> = {
    select: (cols: string) => ((r.select = cols), q),
    order: () => q,
    limit: () => q,
    in: (_col: string, ids: unknown[]) => ((r.in = ids), q),
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

const { fetchReps, LIST_COLUMNS } = await import("./client-data");
const { forget } = await import("./held");

const said = (n: number, distinct: number) => Array.from({ length: n }, (_, i) => `w${i % distinct}`).join(" ");
const day = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 86_400_000).toISOString();

/** A whole stored row, as the table holds it after 0037 (`filled`) or before it. */
function row(id: string, n: number, transcript: string, filled: boolean) {
  return {
    id,
    lesson_id: "topic:t1",
    created_at: day(n),
    duration_s: 60,
    transcript,
    wpm: 140,
    filler_count: 2,
    fillers: [{ word: "um", t: 3 }],
    pauses: [{ t: 2, len: 1.2, kind: "pre" }],
    stars: 2,
    focus: "Kill um.",
    strength: "Held the pause.",
    supply: { original: "a", upgrade: "b", note: "c" },
    ethos_index: 600,
    dimensions: { tier1: { pause: 70, fillers: 60, repairs: 80, pace: 90, range: 55 }, anchors: { hedgeCount: 0, restartCount: 0 }, tier2: null },
    audio_path: "reps/x.webm",
    mode: "daily",
    mods: [],
    xp_multiplier: 1,
    boss_topic_id: null,
    accuracy: null,
    capture_mode: "voice",
    delivery_metrics: null,
    presence_score: null,
    delivery_moments: null,
    client_id: `k-${id}`,
    round: null,
    ...(filled ? substanceColumns(substance(transcript)) : { scorable: null, word_count: null, distinct_words: null }),
  };
}

beforeEach(() => {
  reads = [];
  has0037 = true;
  hasRound = true;
  transcriptsFail = false;
  forget();
  rows = [row("a", 1, said(40, 30), true), row("b", 2, "too short", true), row("c", 3, said(60, 50), true)];
});

let limit = 10;
/* Each test reads its own size, so no read is shared with another test's. */
const read = () => fetchReps(++limit);

describe("the lists' read after 0037", () => {
  it("names the three columns, never the transcript or a column no list draws, and reads nothing more", async () => {
    const got = await read();
    expect(reads).toHaveLength(1);
    expect(reads[0].select).toBe(LIST_COLUMNS);
    for (const col of ["transcript", "focus", "strength", "supply", "audio_path", "accuracy", "delivery_metrics", "delivery_moments", "presence_score", "capture_mode", "xp_multiplier", "boss_topic_id"]) {
      expect(reads[0].select.split(", ")).not.toContain(col);
    }
    expect(got.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(got.every((r) => r.transcript === undefined)).toBe(true);
    expect(got.map((r) => measured(r))).toEqual([true, false, true]);
  });

  it("reads each stored row exactly as it read it from the transcript", async () => {
    const got = await read();
    for (const r of got) {
      const whole = rows.find((x) => x.id === r.id)!;
      const fromText = { ...r, scorable: undefined, word_count: undefined, distinct_words: undefined, transcript: whole.transcript as string };
      expect(readTraitsFromRow(r)).toEqual(readTraitsFromRow(fromText));
      expect(measured(r)).toBe(measured(fromText));
    }
  });

  it("reads the transcripts of only the rows 0037 has not filled, in one more read", async () => {
    rows.push(row("d", 4, said(30, 30), false), row("e", 5, "hello there", false));
    const got = await read();
    expect(reads).toHaveLength(2);
    expect(reads[1].select).toBe("id, transcript");
    expect([...(reads[1].in ?? [])].sort()).toEqual(["d", "e"]);
    const by = Object.fromEntries(got.map((r) => [r.id, r]));
    expect(by.d.transcript).toBe(said(30, 30));
    expect(by.a.transcript).toBeUndefined();
    expect([measured(by.d), measured(by.e)]).toEqual([true, false]);
  });

  it("throws when those transcripts do not come: unknown is not unscored", async () => {
    rows.push(row("d", 4, said(30, 30), false));
    transcriptsFail = true;
    await expect(read()).rejects.toBeTruthy();
  });
});

describe("the lists' read before 0037", () => {
  it("answers 42703 for the new columns, and the read goes back to the select it made before", async () => {
    has0037 = false;
    const got = await read();
    expect(reads).toHaveLength(2);
    expect(reads[0].select).toBe(LIST_COLUMNS);
    expect(reads[1].select).toMatch(/^id, lesson_id, created_at, duration_s, transcript, /);
    expect(reads[1].select).toMatch(/, round$/);
    // Every row came with its transcript, so no third read.
    expect(got.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(got.map((r) => measured(r))).toEqual([true, false, true]);
    expect(got.every((r) => typeof r.transcript === "string" && r.scorable === undefined)).toBe(true);
  });

  it("goes back past 0026 too: no 0037 columns and no round", async () => {
    has0037 = false;
    hasRound = false;
    const got = await read();
    // Whichever column Postgres names first, each step is taken once, and the
    // read lands on the select from before 0026: the transcript, no round.
    expect(reads).toHaveLength(3);
    const last = reads[2].select;
    expect(last).toMatch(/\btranscript\b/);
    expect(last).not.toMatch(/\b(round|scorable|word_count|distinct_words)\b/);
    expect(got).toHaveLength(3);
    expect(got.map((r) => measured(r))).toEqual([true, false, true]);
  });
});
