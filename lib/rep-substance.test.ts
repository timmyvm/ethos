import { describe, expect, it } from "vitest";
import { computeMetrics, isScorable, substance } from "./metrics";
import {
  SUBSTANCE_COLUMNS,
  distinctRatioOf,
  hasSubstanceColumns,
  missingSubstanceColumn,
  needsTranscript,
  rowScorable,
  rowSubstance,
  substanceColumns,
  withTranscripts,
} from "./rep-substance";
import { measured, readTraitsFromRow } from "./trait-readings";
import { repTraitXp } from "./traits";

/*
 * #511, the speed audit's fix 10: a stored recording's substance from
 * 0037's columns, or from its transcript where a row has none, and the
 * two always the same answer.
 */

const said = (n: number, distinct: number) =>
  Array.from({ length: n }, (_, i) => `w${i % distinct}`).join(" ");

/** The row the server stores for a transcript: its columns as saveRep writes them. */
const stored = (transcript: string) => ({ transcript, ...substanceColumns(substance(transcript))! });

const TEXTS = [
  "",
  said(19, 19),
  said(20, 20),
  said(20, 6),
  said(20, 5),
  said(2000, 599),
  said(2000, 598),
  "I don't know. I don't know. I don't know. I don't know. I don't know. I don't know. I don't know.",
  "So the thing about habits is they compound. You do the small version every day and the big version arrives on its own.",
];

describe("what the server writes", () => {
  it("is a substance's verdict, its words, its different words", () => {
    const s = substance(said(30, 12));
    expect(substanceColumns(s)).toEqual({ scorable: true, word_count: 30, distinct_words: 12 });
    expect(substanceColumns(substance(said(10, 10)))).toEqual({ scorable: false, word_count: 10, distinct_words: 10 });
    expect(substanceColumns(substance(""))).toEqual({ scorable: false, word_count: 0, distinct_words: 0 });
  });

  it("reads a substance counted from Whisper's timed words as it reads any other", () => {
    const words = said(25, 25).split(" ").map((word, i) => ({ word, start: i, end: i + 0.8 }));
    const m = computeMetrics(words, 30);
    expect(m.stars).toBeGreaterThan(0);
    expect(substanceColumns(m.substance)).toMatchObject({ scorable: true, word_count: 25, distinct_words: 25 });
  });

  it("writes nothing it cannot vouch for: no substance, or a count that does not fit", () => {
    expect(substanceColumns(null)).toBeNull();
    expect(substanceColumns(undefined)).toBeNull();
    // A Substance built elsewhere, without its distinct count: the readers read that row's transcript.
    expect(substanceColumns({ wordCount: 30, distinctRatio: 0.4, repeatShare: 0 })).toEqual({ scorable: true, word_count: 30, distinct_words: null });
    expect(substanceColumns({ wordCount: 3, distinctRatio: 1, repeatShare: 0, distinctWords: 9 })?.distinct_words).toBeNull();
  });

  it("names the three columns 0037 adds", () => {
    expect([...SUBSTANCE_COLUMNS]).toEqual(["scorable", "word_count", "distinct_words"]);
  });
});

describe("what a reader reads", () => {
  it("answers from the columns exactly what it answered from the transcript", () => {
    for (const t of TEXTS) {
      const s = substance(t);
      const withCols = { ...stored(t), transcript: undefined };
      expect(hasSubstanceColumns(withCols)).toBe(true);
      expect(rowSubstance(withCols)).toEqual({ wordCount: s.wordCount, distinctRatio: s.distinctRatio });
      expect(rowScorable(withCols)).toBe(isScorable(s));
      // And a row without them, as before 0037.
      expect(rowSubstance({ transcript: t })).toEqual({ wordCount: s.wordCount, distinctRatio: s.distinctRatio });
      expect(rowScorable({ transcript: t })).toBe(isScorable(s));
    }
  });

  it("rounds Variety's ratio as substance rounds it", () => {
    expect(distinctRatioOf(2000, 599)).toBe(0.3);
    expect(distinctRatioOf(2000, 598)).toBe(0.299);
    expect(distinctRatioOf(3, 1)).toBe(0.333);
    expect(distinctRatioOf(0, 0)).toBe(0);
  });

  it("takes the row's own verdict over its text", () => {
    // The server writes it from the same text (lib/db.ts saveRep); a row whose two disagree reads its column.
    expect(rowScorable({ scorable: true, word_count: 22, distinct_words: 20, transcript: "too short" })).toBe(true);
    expect(rowScorable({ scorable: false, transcript: said(40, 40) })).toBe(false);
  });

  it("reads a half-filled row's missing half from its transcript", () => {
    const t = said(30, 9);
    expect(rowSubstance({ scorable: true, word_count: 30, distinct_words: null, transcript: t })).toEqual({ wordCount: 30, distinctRatio: 0.3 });
    expect(rowScorable({ scorable: null, word_count: 30, distinct_words: 9, transcript: t })).toBe(true);
  });

  it("feeds the trait readings, the gate and the trait XP the same numbers", () => {
    const t = TEXTS[8];
    const base = {
      duration_s: 60,
      wpm: 140,
      filler_count: 2,
      fillers: [{ word: "um" }, { word: "like" }],
      pauses: [{ kind: "pre" }],
      dimensions: { tier1: { pause: 70, fillers: 60, repairs: 80, pace: 90, range: 55 }, anchors: { hedgeCount: 0, restartCount: 0 }, tier2: null },
    };
    const fromText = { ...base, transcript: t };
    const fromCols = { ...base, ...substanceColumns(substance(t))! };
    expect(readTraitsFromRow(fromCols)).toEqual(readTraitsFromRow(fromText));
    expect(measured(fromCols)).toBe(measured(fromText));
    expect(repTraitXp(fromCols)).toEqual(repTraitXp(fromText));
    expect(Object.keys(repTraitXp(fromCols)).length).toBeGreaterThan(0);
  });
});

describe("the rows a read must fetch a transcript for", () => {
  it("are the rows with a column still empty and no transcript", () => {
    expect(needsTranscript({ scorable: true, word_count: 30, distinct_words: 12 })).toBe(false);
    expect(needsTranscript({ scorable: null, word_count: null, distinct_words: null })).toBe(true);
    expect(needsTranscript({ scorable: true, word_count: 30, distinct_words: null })).toBe(true);
    expect(needsTranscript({ scorable: null, transcript: "hello" })).toBe(false);
    expect(needsTranscript({})).toBe(true);
  });

  it("costs no read at all once every row carries its columns", async () => {
    let calls = 0;
    const rows = [{ id: "a", ...stored(said(30, 20)) }, { id: "b", ...stored("hi") }].map(({ transcript: _t, ...r }) => r);
    const out = await withTranscripts(rows, async () => {
      calls++;
      return [];
    });
    expect(calls).toBe(0);
    expect(out).toBe(rows);
  });

  it("reads only the empty rows' transcripts, a hundred at a time, and leaves the rest as they came", async () => {
    const full = Array.from({ length: 150 }, (_, i) => ({ id: `f${i}`, ...stored(said(30, 20)) })).map(({ transcript: _t, ...r }) => r);
    const empty = Array.from({ length: 130 }, (_, i) => ({ id: `e${i}`, scorable: null, word_count: null, distinct_words: null }));
    const asked: string[][] = [];
    const out = await withTranscripts([...full, ...empty], async (ids) => {
      asked.push(ids);
      return ids.map((id) => ({ id, transcript: id === "e0" ? null : said(25, 25) }));
    });
    expect(asked.map((a) => a.length)).toEqual([100, 30]);
    expect(asked.flat().every((id) => id.startsWith("e"))).toBe(true);
    expect(out.slice(0, 150)).toEqual(full);
    expect((out.find((r) => r.id === "e1") as { transcript?: string }).transcript).toBe(said(25, 25));
    expect(rowScorable(out.find((r) => r.id === "e1")!)).toBe(true);
    // A row the read did not answer for reads as nothing said, never as a guess.
    expect((out.find((r) => r.id === "e0") as { transcript?: string }).transcript).toBe("");
  });

  it("throws when the transcripts' read fails: unknown is not unscored", async () => {
    await expect(
      withTranscripts([{ id: "e", scorable: null }], async () => {
        throw new Error("upstream");
      })
    ).rejects.toThrow("upstream");
  });
});

describe("a database before 0037", () => {
  it("is told by the column it names, as Postgres and PostgREST say it", () => {
    expect(missingSubstanceColumn({ code: "42703", message: "column reps.scorable does not exist" })).toBe(true);
    expect(missingSubstanceColumn({ code: "42703", message: "column reps.word_count does not exist" })).toBe(true);
    expect(missingSubstanceColumn({ code: "PGRST204", message: "Could not find the 'distinct_words' column of 'reps' in the schema cache" })).toBe(true);
    expect(missingSubstanceColumn({ code: "42703", message: "column reps.round does not exist" })).toBe(false);
    expect(missingSubstanceColumn({ code: "XX000", message: "upstream" })).toBe(false);
    expect(missingSubstanceColumn(null)).toBe(false);
  });
});
