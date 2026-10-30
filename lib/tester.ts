/**
 * Tester mode, the pure half (migration 0020, docs/testers.md).
 *
 * A tester is an account the server has flagged after a four-digit code
 * and one agree tap. The flag buys nothing: no Premium, no stars, no
 * coins. What it changes is two questions on results: "How did that
 * feel?" before the score shows, and "Did the score feel right?" after
 * it, whose answers, stored beside the numbers the screen showed, are
 * how the thresholds get tuned (0020, 0022).
 *
 * Everything here is pure and runs in the browser, so the code is not
 * here: it lives in the route (app/api/tester) and nowhere else.
 */

import { CONSENT_VERSION } from "@/content/tester";

/** Which way the score was off, if it was (0022). */
export type MatchAnswer = "too_low" | "about_right" | "too_high";

export const MATCH_ANSWERS: readonly MatchAnswer[] = ["too_low", "about_right", "too_high"];

/**
 * 0020's answers ("Did this score match how it felt?"). Still in the
 * table and in the report, never written again: an old one reopens as
 * no answer, since it answered a different question.
 */
export type OldMatchAnswer = "yes" | "roughly" | "no";

export function isMatchAnswer(v: unknown): v is MatchAnswer {
  return typeof v === "string" && (MATCH_ANSWERS as readonly string[]).includes(v);
}

/** How the recording felt, the one tap before the score shows (0022). */
export type Felt = "rough" | "okay" | "strong";

export const FELT_ANSWERS: readonly Felt[] = ["rough", "okay", "strong"];

/** The note's cap, the column's too (0020 tester_feedback.note). */
export const NOTE_MAX = 280;

/** The code is four digits, typed on the number pad. */
export const CODE_LENGTH = 4;

/** What a typed code becomes: digits only, four at most. */
export function codeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** Four digits: Continue lights. */
export function codeReady(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

/** Too low and Too high open the note; About right needs nothing more. */
export function asksForNote(answer: MatchAnswer | null): boolean {
  return answer === "too_low" || answer === "too_high";
}

/** A note as stored: trimmed, capped, and nothing for an empty one. */
export function cleanNote(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return Array.from(t).slice(0, NOTE_MAX).join("").trim() || null;
}

/** The account's row in `testers`, as the browser may read it (own row only). */
export interface TesterRow {
  consent_version: number;
  consented_at: string;
}

/**
 * A tester on the consent this app shows. One who agreed to an older
 * consent reads the new one before anything more is kept: the question
 * waits, Settings offers the code again, and 0021 refuses their answers.
 */
export function isCurrentTester(row: TesterRow | null | undefined): row is TesterRow {
  return !!row && row.consent_version >= CONSENT_VERSION;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tester number: the account id's first eight characters, in
 * capitals, in two fours ("3F9A 1C2E"). A friend sends it to Timothy,
 * and the report reads it the same way (docs/testers.md), so a row in
 * tester_admin.testers is never a guess at who it is.
 */
export function testerNumber(userId: string): string | null {
  if (!UUID.test(userId)) return null;
  const head = userId.slice(0, 8).toUpperCase();
  return `${head.slice(0, 4)} ${head.slice(4)}`;
}

/** The outbox key's shape, the one /api/analyze accepts (0016). */
const CLIENT_ID = /^[\w-]{1,200}$/;

/**
 * Who sees the match check: a tester, on a recording that was scored,
 * whose results know the key the recording travelled under. A
 * non-tester, an unknown tester state (still loading, or a failed
 * read), a take too short to score and a recording with no key all see
 * nothing new.
 */
export function showsMatchCheck({
  tester,
  scorable,
  clientId,
}: {
  tester: TesterRow | null | undefined;
  scorable: boolean;
  clientId: string | null | undefined;
}): boolean {
  return isCurrentTester(tester) && scorable && typeof clientId === "string" && CLIENT_ID.test(clientId);
}

/** What the results screen hands over: AnalyzeResponse, structurally. */
export interface SnapshotInput {
  ethosIndex: number | null;
  previousIndex: number | null;
  metrics: {
    stars: number;
    wpm: number;
    fillerCount: number;
    durationS: number;
    pauses: readonly unknown[];
    heldPauses?: number;
  };
  tier1: Partial<Record<"pause" | "fillers" | "repairs" | "pace" | "range", number>>;
  coach: { dimensions?: Partial<Record<string, { score: number } | null>> | null } | null;
  captureMode: string;
  judged: { ran: boolean };
}

/**
 * The numbers the tester had been shown when they answered: the Index,
 * the stars, each measured score, the judged ones when the coach ran,
 * and the camera's when it scored. Numbers only and flat, so the row
 * stays small (0020 caps it at 4000 bytes) and a later change to the
 * engine cannot rewrite what the tester was looking at. The question is
 * asked on the debrief's last step, after the score and the numbers, so
 * every number here was on screen; `seen` says whether the answer came
 * on results or later from the Log.
 */
export function scoreSnapshot(
  result: SnapshotInput,
  presence: number | null = null,
  seen: "results" | "log" = "results"
) {
  const n = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  const judged = result.coach?.dimensions ?? null;
  const tier2 = judged
    ? Object.fromEntries(
        (["structure", "credibility", "engagement", "confidence"] as const).map((k) => [
          k,
          n(judged[k]?.score),
        ])
      )
    : null;
  return {
    v: 1,
    seen,
    index: n(result.ethosIndex),
    previous: n(result.previousIndex),
    stars: n(result.metrics.stars),
    tier1: Object.fromEntries(
      (["pause", "fillers", "repairs", "pace", "range"] as const).map((k) => [k, n(result.tier1[k])])
    ),
    tier2,
    presence: n(presence),
    wpm: n(result.metrics.wpm),
    fillers: n(result.metrics.fillerCount),
    pauses: result.metrics.pauses.length,
    held: n(result.metrics.heldPauses),
    seconds: n(result.metrics.durationS),
    capture: result.captureMode,
    judged: result.judged.ran,
  };
}

export type ScoreSnapshot = ReturnType<typeof scoreSnapshot>;

/** The stored recording's columns a snapshot reads (lib/client-data.ts RepRow). */
export interface StoredForSnapshot {
  ethos_index: number | null;
  stars: number;
  wpm: number;
  filler_count: number;
  duration_s: number;
  pauses: readonly { kind?: string }[] | null;
  dimensions: {
    tier1?: SnapshotInput["tier1"] | null;
    tier2?: Partial<Record<string, { score: number } | null>> | null;
  } | null;
  capture_mode: string;
}

/**
 * A stored recording as the snapshot reads it: the numbers the Log's
 * page shows, from the row. No previous Index (the Log shows none), and
 * the judged scores only when the coach's read was stored.
 */
export function storedSnapshotInput(stored: StoredForSnapshot): SnapshotInput {
  const pauses = stored.pauses ?? [];
  const tier2 = stored.dimensions?.tier2 ?? null;
  return {
    ethosIndex: stored.ethos_index,
    previousIndex: null,
    metrics: {
      stars: stored.stars,
      wpm: stored.wpm,
      fillerCount: stored.filler_count,
      durationS: stored.duration_s,
      pauses,
      heldPauses: pauses.filter((p) => p.kind !== "beat").length,
    },
    tier1: stored.dimensions?.tier1 ?? {},
    coach: tier2 ? { dimensions: tier2 } : null,
    captureMode: stored.capture_mode,
    judged: { ran: tier2 !== null },
  };
}

/**
 * One row of `tester_feedback` as the browser upserts it on
 * (user_id, client_id), the owner added by the write itself
 * (lib/tester-client.ts saveMatch) from the session. A key that is not
 * here is left as the table has it: how it felt is saved before the
 * score and the answer after it, as two saves of one row, and neither
 * clears the other. The recording's id goes only once it is known.
 */
export interface FeedbackRow {
  client_id: string;
  rep_id?: string;
  answer?: MatchAnswer;
  note?: string | null;
  scores?: ScoreSnapshot;
  felt?: Felt;
  updated_at: string;
}

/** A uuid or nothing: the column is uuid, and anything else would refuse the whole row. */
function repIdOf(repId: string | null): { rep_id?: string } {
  return repId && UUID.test(repId) ? { rep_id: repId } : {};
}

/**
 * The answer after the score. The note goes only with an answer that
 * asks for one: About right after Too low clears it.
 */
export function feedbackRow({
  clientId,
  repId,
  answer,
  note,
  scores,
  now = new Date(),
}: {
  clientId: string;
  repId: string | null;
  answer: MatchAnswer;
  note: string | null;
  scores: ScoreSnapshot;
  now?: Date;
}): FeedbackRow {
  return {
    client_id: clientId,
    ...repIdOf(repId),
    answer,
    note: asksForNote(answer) ? cleanNote(note) : null,
    scores,
    updated_at: now.toISOString(),
  };
}

/** How it felt, saved the moment it is tapped, before the score shows. */
export function feltRow({
  clientId,
  repId,
  felt,
  now = new Date(),
}: {
  clientId: string;
  repId: string | null;
  felt: Felt;
  now?: Date;
}): FeedbackRow {
  return { client_id: clientId, ...repIdOf(repId), felt, updated_at: now.toISOString() };
}

/** Two saves of one row as one: the newer's keys over the older's. */
function merged<R extends FeedbackRow>(older: R, newer: R): R {
  return { ...older, ...newer, updated_at: newer.updated_at > older.updated_at ? newer.updated_at : older.updated_at };
}

/**
 * Answers that have not landed yet, kept on the phone by recording
 * (lib/tester-client.ts): one row per recording, so a later save, on
 * this screen or the next results screen, lands what the tester last
 * said. Saves of one recording merge: how it felt, waiting, rides with
 * the answer after the score. An older value never replaces a newer one.
 */
export type PendingMatches<R extends FeedbackRow = FeedbackRow> = Record<string, R>;

export function withPending<R extends FeedbackRow>(map: PendingMatches<R>, row: R): PendingMatches<R> {
  const had = map[row.client_id];
  if (!had) return { ...map, [row.client_id]: row };
  const next = had.updated_at > row.updated_at ? merged(row, had) : merged(had, row);
  return { ...map, [row.client_id]: next };
}

/** A save landed: its answer stops waiting, unless a newer one took its place. */
export function withoutPending<R extends FeedbackRow>(map: PendingMatches<R>, row: R): PendingMatches<R> {
  const had = map[row.client_id];
  if (!had || had.updated_at !== row.updated_at) return map;
  const next = { ...map };
  delete next[row.client_id];
  return next;
}

/**
 * Whether a save would store what the last one stored: the same answer,
 * and the same note as the row keeps it (none after About right). Leaving the
 * note's field saves it, so the Save note tap that left it is the same
 * save and sends nothing more.
 */
export function sameSave(
  prev: { answer: MatchAnswer; note: string } | null,
  next: { answer: MatchAnswer; note: string }
): boolean {
  if (!prev || prev.answer !== next.answer) return false;
  return !asksForNote(next.answer) || cleanNote(prev.note) === cleanNote(next.note);
}

/**
 * A tester who agreed to an older consent reads the new one once, on
 * their next open (components/tester/TesterLayer.tsx), and agrees again
 * or not. Asked over a tab or Settings only: never mid-recording, never
 * mid-introduction, never over a page they came to read.
 */
const ASK_AGAIN_ON = ["/", "/lessons", "/games", "/history", "/you", "/settings", "/shop"];

export function asksAgain({
  tester,
  asked,
  pathname,
}: {
  tester: TesterRow | null | undefined;
  /** The consent version this device last asked about (0 for never). */
  asked: number;
  pathname: string;
}): boolean {
  return (
    !!tester &&
    tester.consent_version < CONSENT_VERSION &&
    asked < CONSENT_VERSION &&
    ASK_AGAIN_ON.includes(pathname)
  );
}

/** A recording's page in the Log: where its paused line sends a tester to agree from. */
const LOG_PAGE = /^\/rep\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where the ask goes back to: the screen it opened over, a recording's page it was opened from, or Today. */
export function askedFrom(raw: string | null | undefined): string {
  return raw && (ASK_AGAIN_ON.includes(raw) || LOG_PAGE.test(raw)) ? raw : "/";
}

/**
 * A tester on an older consent: nothing is asked or kept until they
 * agree to the one this app shows, and where the questions would be
 * they read that testing is paused, with the way back (review D1: the
 * ask on the way in comes once per device, and one reflex tap past it
 * otherwise lost a paid tester's answers for the rest of the test).
 */
export function pausedTester(row: TesterRow | null | undefined): row is TesterRow {
  return !!row && row.consent_version < CONSENT_VERSION;
}

/**
 * Whether this account's phone collects device, usage and problems
 * (lib/tester-collect.ts): a tester on the consent that named them
 * (version 3) and on the one this app shows. Nobody else, ever.
 */
export function collects(row: TesterRow | null | undefined): boolean {
  return isCurrentTester(row) && row.consent_version >= 3;
}
