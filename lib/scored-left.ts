/**
 * Today's scored recordings, as this phone last heard them (the reel's
 * honest wins, build 5). A free account gets DAILY_GRANT scored
 * recordings a day (#514); a fourth take is measured in full and has no
 * Ethos score, and until now the recorder only said so afterwards. Once a
 * reply has said that none are left today, the line under Record says it
 * before the next take (lib/allowance-copy.ts SCORED_USED), the way
 * Hostile Q&A says "3 free today" before its take (#478).
 *
 * It is said only when this phone is sure: a reply from the meter itself
 * (a read that came off the stored allowance and stayed spent, or a take
 * the cap held back), for this account, on this local day. A reply that
 * says nothing sure (no session, a take too short to score, a meter that
 * could not be read, a coach that failed and handed its read back, a
 * reply from before `counted`) keeps nothing, and the line stays away.
 * Premium is never metered and never told. Every read and write is
 * wrapped: a phone that will not store says nothing.
 */

/** This phone's copy: `{ uid, day, left }`. Signing out forgets it (lib/auth.ts). */
export const SCORED_LEFT_KEY = "ethos.scored.left";

export interface ScoredLeft {
  /** The account the reply was for. */
  uid: string;
  /** The local day the take was spoken, YYYY-MM-DD. */
  day: string;
  /** Scored recordings left that day, as the meter said. */
  left: number;
}

/** The reply's word on the allowance (app/api/analyze/route.ts `judged`). */
export interface JudgedReply {
  ran: boolean;
  unlimited: boolean;
  remaining: number;
  capped: boolean;
  counted?: boolean;
}

/** The phone's own calendar day, as the meter's offset makes it (lib/metering.ts `dateKey`). */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * What a reply says is left today, or null when it says nothing sure: a
 * take the cap held back leaves 0; a read that came off the stored
 * allowance and stayed spent leaves its `remaining`. Anything else (and
 * Premium) is null.
 */
export function leftFromReply(judged: JudgedReply | null | undefined): number | null {
  if (!judged || judged.unlimited !== false) return null;
  if (judged.capped === true) return 0;
  if (judged.ran === true && judged.counted === true && Number.isInteger(judged.remaining) && judged.remaining >= 0) {
    return judged.remaining;
  }
  return null;
}

/**
 * Keeps what a reply said for the account and the day the take was
 * spoken, and hands it back for the screen to hold; null when the reply
 * said nothing sure or there is no account to keep it for.
 */
export function keepScoredLeft(p: { uid: string | null | undefined; at: Date; judged: JudgedReply | null | undefined }): ScoredLeft | null {
  const left = leftFromReply(p.judged);
  if (!p.uid || left === null || Number.isNaN(p.at.getTime())) return null;
  const entry: ScoredLeft = { uid: p.uid, day: localDayKey(p.at), left };
  try {
    localStorage.setItem(SCORED_LEFT_KEY, JSON.stringify(entry));
  } catch {}
  return entry;
}

/** This phone's copy, or null when there is none or it cannot be read. */
export function readScoredLeft(): ScoredLeft | null {
  try {
    const raw = localStorage.getItem(SCORED_LEFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ScoredLeft>;
    if (typeof p.uid !== "string" || !p.uid) return null;
    if (typeof p.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.day)) return null;
    if (typeof p.left !== "number" || !Number.isInteger(p.left) || p.left < 0) return null;
    return { uid: p.uid, day: p.day, left: p.left };
  } catch {
    return null;
  }
}

/**
 * Whether the line under Record says today's scored recordings are used:
 * the copy is this account's, from this local day, with none left, and
 * the plan was read as free. Anything unknown says nothing.
 */
export function scoredUsed(
  entry: ScoredLeft | null,
  p: { uid: string | null | undefined; now: Date; free: boolean }
): boolean {
  return !!entry && p.free && !!p.uid && entry.uid === p.uid && entry.day === localDayKey(p.now) && entry.left === 0;
}

/** Signing out: the next account on this phone is someone else's. */
export function forgetScoredLeft() {
  try {
    localStorage.removeItem(SCORED_LEFT_KEY);
  } catch {}
}
