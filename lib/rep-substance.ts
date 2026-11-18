/**
 * What a stored recording's words came to (DECISIONS #511, the speed
 * audit's fix 10). Every reader that judged a stored row ran
 * lib/metrics.ts `substance` over its whole transcript to learn three
 * things: whether it was a real answer (`isScorable`), how many words it
 * had (the unit of "um or uh in 100 words") and how many of them were
 * different (Variety). Migration 0037 keeps those three on the row:
 * `scorable`, `word_count` and `distinct_words`, written by the server
 * with every recording it stores (lib/db.ts saveRep) and filled once for
 * the rows before it, from their transcripts, by the same rule.
 *
 * A reader takes the columns when the row has them and, for a row where
 * any is still null, runs `substance` over the transcript exactly as it
 * did before 0037 (the reads fetch that row's transcript for it, and
 * only that row's). Until 0037 is applied a select naming a column the
 * table lacks fails with 42703, and the reads go back to the select they
 * made before it (`missingSubstanceColumn`).
 *
 * Pure: no network, no React.
 */

import { isScorable, substance, type Substance } from "./metrics";

/** The three columns, in the order the reads name them. */
export const SUBSTANCE_COLUMNS = ["scorable", "word_count", "distinct_words"] as const;

/** As a select list: "scorable, word_count, distinct_words". */
export const SUBSTANCE_SELECT = SUBSTANCE_COLUMNS.join(", ");

/** The columns as a stored row carries them: absent before 0037, null on a row it has not filled. */
export interface SubstanceColumns {
  scorable?: boolean | null;
  word_count?: number | null;
  distinct_words?: number | null;
}

/** As much of a stored row as its substance reads. */
export type SubstanceRow = SubstanceColumns & { transcript?: string | null };

/** What a stored row's substance gives its readers: the count and the ratio. */
export type StoredSubstance = Pick<Substance, "wordCount" | "distinctRatio">;

const count = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/**
 * What the server writes with a recording, from the substance it was
 * scored on (`metrics.substance`): the same verdict its stars were given
 * on. Null without one, and a null `distinct_words` for a Substance that
 * did not count them, which a reader then reads from the transcript.
 */
export function substanceColumns(
  s: Substance | null | undefined
): { scorable: boolean; word_count: number; distinct_words: number | null } | null {
  if (!s || !count(s.wordCount)) return null;
  return {
    scorable: isScorable(s),
    word_count: s.wordCount,
    distinct_words: count(s.distinctWords) && s.distinctWords <= s.wordCount ? s.distinctWords : null,
  };
}

/** The row carries all three, so nothing about it needs the transcript. */
export function hasSubstanceColumns(row: SubstanceColumns): boolean {
  return (
    typeof row.scorable === "boolean" &&
    count(row.word_count) &&
    count(row.distinct_words) &&
    row.distinct_words <= row.word_count
  );
}

/**
 * The rows a read must fetch the transcript of: a column still null (a
 * row stored by an older server after 0037 was applied, or one 0037 has
 * not filled) and no transcript came with the row.
 */
export function needsTranscript(row: SubstanceRow): boolean {
  return !hasSubstanceColumns(row) && typeof row.transcript !== "string";
}

/**
 * Variety's ratio from the two counts, rounded as `substance` rounds it
 * (Math.round of the ratio times 1000, over 1000), so a row's columns and
 * its transcript give the same number to the last digit.
 */
export function distinctRatioOf(wordCount: number, distinctWords: number): number {
  if (!(wordCount > 0)) return 0;
  return Math.round((distinctWords / wordCount) * 1000) / 1000;
}

/** The row's word count and Variety ratio: from the columns, else from the transcript as before 0037. */
export function rowSubstance(row: SubstanceRow): StoredSubstance {
  if (count(row.word_count) && count(row.distinct_words) && row.distinct_words <= row.word_count) {
    return { wordCount: row.word_count, distinctRatio: distinctRatioOf(row.word_count, row.distinct_words) };
  }
  const s = substance(row.transcript ?? "");
  return { wordCount: s.wordCount, distinctRatio: s.distinctRatio };
}

/** Whether the row had a real answer: the stored verdict, else `isScorable` on the transcript as before 0037. */
export function rowScorable(row: SubstanceRow): boolean {
  if (typeof row.scorable === "boolean") return row.scorable;
  return isScorable(substance(row.transcript ?? ""));
}

/**
 * PostgREST's and Postgres's answer for a select naming a 0037 column the
 * table does not have yet: 42703 ("column reps.scorable does not exist")
 * or PGRST204, naming one of the three.
 */
export function missingSubstanceColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    (error.code === "42703" || error.code === "PGRST204" || /column/i.test(message)) &&
    /\b(scorable|word_count|distinct_words)\b/.test(message)
  );
}

/**
 * Hands each row that `needsTranscript` its transcript, read by `read`
 * (the ids, at most 100 a call), and leaves every other row as it is.
 * No row needs one once 0037 has filled the table, so this is no read
 * at all; for a row an older server stored after 0037 it is one read of
 * those rows' transcripts. A read that fails throws, as every read does
 * (#147): a row whose substance cannot be known is not "not scored".
 */
export async function withTranscripts<T extends { id: string } & SubstanceRow>(
  rows: T[],
  read: (ids: string[]) => Promise<{ id: string; transcript: string | null }[]>
): Promise<T[]> {
  const ids = rows.filter(needsTranscript).map((r) => r.id);
  if (ids.length === 0) return rows;
  const got = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    for (const r of await read(ids.slice(i, i + 100))) got.set(r.id, r.transcript ?? "");
  }
  return rows.map((r) => (needsTranscript(r) ? { ...r, transcript: got.get(r.id) ?? "" } : r));
}
