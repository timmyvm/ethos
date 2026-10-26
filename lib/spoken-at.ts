/**
 * How far back a client may date a recording. The outbox sends a take
 * hours (or a long weekend) after it was spoken, and the streak, the
 * freezes, the coins and the Log all bucket by when it was spoken. The
 * time is the client's word, so it is clamped: never in the future, and
 * never more than three days back.
 *
 * It lives here, not in `app/api/analyze/route.ts`, because a route file
 * may only export its handlers and Next's segment config: any other export
 * fails `next build` (`lib/route-exports.test.ts` holds that).
 */
export const RECORDED_AT_SLACK_MS = 72 * 3_600_000;

export function spokenAt(v: FormDataEntryValue | null, nowMs = Date.now()): Date | null {
  const n = Number(v);
  if (typeof v !== "string" || v === "" || !Number.isFinite(n)) return null;
  return new Date(Math.min(nowMs, Math.max(nowMs - RECORDED_AT_SLACK_MS, n)));
}
