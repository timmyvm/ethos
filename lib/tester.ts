/**
 * Tester mode, the pure half (migration 0020, docs/testers.md).
 *
 * A tester is an account the server has flagged after a four-digit code
 * and one agree tap. The flag buys nothing: no Premium, no stars, no
 * coins. What it changes is one question on results, "Did this score
 * match how it felt?", whose answers, stored beside the numbers the
 * screen showed, are how the thresholds get tuned.
 *
 * Everything here is pure and runs in the browser, so the code is not
 * here: it lives in the route (app/api/tester) and nowhere else.
 */

export type MatchAnswer = "yes" | "roughly" | "no";

export const MATCH_ANSWERS: readonly MatchAnswer[] = ["yes", "roughly", "no"];

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

/** Roughly and No open the note; Yes needs nothing more. */
export function asksForNote(answer: MatchAnswer | null): boolean {
  return answer === "roughly" || answer === "no";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return !!tester && scorable && typeof clientId === "string" && CLIENT_ID.test(clientId);
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
 * The numbers on screen when the answer was given: the Index, the
 * stars, each measured score, the judged ones when the coach ran, and
 * the camera's when it scored. Numbers only and flat, so the row stays
 * small (0020 caps it at 4000 bytes) and a later change to the engine
 * cannot rewrite what the tester was looking at.
 */
export function scoreSnapshot(result: SnapshotInput, presence: number | null = null) {
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

/**
 * One row of `tester_feedback`, as the browser upserts it on
 * (user_id, client_id). The note goes only with an answer that asks
 * for one: Yes after No clears it.
 */
export function feedbackRow({
  userId,
  clientId,
  repId,
  answer,
  note,
  scores,
  now = new Date(),
}: {
  userId: string;
  clientId: string;
  repId: string | null;
  answer: MatchAnswer;
  note: string | null;
  scores: ScoreSnapshot;
  now?: Date;
}) {
  return {
    user_id: userId,
    client_id: clientId,
    // A uuid or nothing: the column is uuid, and anything else would
    // refuse the whole row.
    rep_id: repId && UUID.test(repId) ? repId : null,
    answer,
    note: asksForNote(answer) ? cleanNote(note) : null,
    scores,
    updated_at: now.toISOString(),
  };
}

export type FeedbackRow = ReturnType<typeof feedbackRow>;
