/**
 * The throttle in front of the AI spend (migration 0006).
 *
 * /api/analyze calls Whisper on every upload and Claude on scorable
 * ones; this is the server-side check that runs BEFORE either. Subjects
 * are user ids when a session exists (anonymous-first sessions count),
 * the caller's IP otherwise. Real accounts get room to practise hard;
 * sessionless callers get enough to try the product and no more.
 *
 * Fail-open by design: if the limiter's own query breaks, scoring still
 * works. An outage that also bricked practice would cost more than the
 * requests it let through, and the Claude call has the per-day meter
 * (lib/metering.ts) as a second wall behind this one.
 */

import { supabaseAdmin } from "./db";

export const LIMITS = {
  user: { hour: 10, day: 30 },
  anon: { hour: 3, day: 5 },
  /**
   * A tester's phone sending what it collected (app/api/tester/collect):
   * a batch every 20 seconds while something happens, and one as the app
   * hides. Four hours of steady use an hour, a long day's worth a day.
   */
  collect: { hour: 240, day: 1200 },
  /**
   * Every guest session on one address, together (#416). A guest gets an
   * account's room (#409), and Supabase mints guest sessions for free,
   * so without this one address could buy about 300 Whisper calls an
   * hour by minting sessions. Thirty an hour is a room of friends on
   * one Wi-Fi; accounts never count against it.
   */
  guestip: { hour: 30, day: 90 },
  /**
   * The word sheet's thesaurus (app/api/words, #411): a word the curated
   * map does not hold. A tap is a second of curiosity, so the room is
   * wide: sixty words an hour, three hundred a day. Answers the server
   * or the phone already holds cost nothing.
   */
  words: { hour: 60, day: 300 },
  /**
   * Slots given back after Whisper was paid for (/api/analyze, security
   * audit 11 Nov): a take the mic barely heard, a resend, a failed save.
   * Six an hour covers a bad microphone; past it the slot stays spent.
   */
  refund: { hour: 6, day: 12 },
} as const;

export type LimitTier = keyof typeof LIMITS;

/**
 * Which allowance a scoring call gets (#408, #409). Any session, a guest
 * or an account, gets the account's 10 an hour and 30 a day: 11 of the
 * 18 testers are guests, and a guest's 5 a day locked them out of the
 * test. Only a caller with no session at all keeps the visitor's.
 */
export function analyzeTier(auth: { anonymous: boolean } | null): LimitTier {
  return auth ? "user" : "anon";
}

export interface RateVerdict {
  allowed: boolean;
  window: "hour" | "day" | null;
  retryAfterS: number;
}

const OPEN: RateVerdict = { allowed: true, window: null, retryAfterS: 0 };
/** What a check that could not run answers when it guards a secret. */
const SHUT: RateVerdict = { allowed: false, window: "hour", retryAfterS: 300 };

/**
 * `failClosed` is for the checks in front of a guessable secret (a
 * redeem code, security audit 11 Nov): there a limiter that cannot
 * answer must refuse, or its outage is unlimited guesses. Practice
 * stays fail-open, as the note at the top says.
 */
export async function consumeRateLimit(
  subject: string,
  tier: LimitTier,
  opts: { failClosed?: boolean } = {}
): Promise<RateVerdict> {
  const broken = opts.failClosed ? SHUT : OPEN;
  try {
    const db = supabaseAdmin();
    if (!db) return broken;
    const { data, error } = await db.rpc("consume_rate_limit", {
      p_subject: subject,
      p_hour_limit: LIMITS[tier].hour,
      p_day_limit: LIMITS[tier].day,
    });
    if (error || !data) {
      console.error("rate-limit check failed", error?.message);
      return broken;
    }
    const v = data as {
      allowed?: boolean;
      window?: "hour" | "day" | null;
      retry_after_s?: number;
    };
    return {
      allowed: v.allowed !== false,
      window: v.window ?? null,
      retryAfterS: Math.max(0, Math.round(v.retry_after_s ?? 0)),
    };
  } catch (e) {
    console.error("rate-limit check threw", e);
    return broken;
  }
}

/**
 * Give back the subject's newest slot (migration 0017), for an upload
 * that failed on our side: Whisper down or unreachable. Best effort and
 * fail-open, like the check: a refund that fails costs one slot, never
 * the request.
 *
 * Where 0017 is not applied yet (production, STATE.md), the function is
 * missing and the same refund is made by hand with the service role:
 * the subject's newest row, by id. Without 0017's lock a refund can race
 * a check on the same subject; either way one of its rows goes, which
 * is the refund.
 */
export async function refundRateLimit(subject: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    if (!db) return;
    const { error } = await db.rpc("refund_rate_limit", { p_subject: subject });
    if (!error) return;
    const { data: newest, error: readError } = await db
      .from("rate_limits")
      .select("id")
      .eq("subject", subject)
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = (newest as { id?: number } | null)?.id;
    if (readError || id == null) {
      console.error("rate-limit refund failed", error.message);
      return;
    }
    const { error: gone } = await db.from("rate_limits").delete().eq("id", id);
    if (gone) console.error("rate-limit refund failed", gone.message);
  } catch (e) {
    console.error("rate-limit refund threw", e);
  }
}

/** First hop of x-forwarded-for; Vercel sets it on every request. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** The sentence the recording screen shows on a 429. */
export function limitMessage(v: RateVerdict): string {
  const mins = Math.max(1, Math.ceil(v.retryAfterS / 60));
  const when =
    mins >= 90
      ? `about ${Math.ceil(mins / 60)} hours`
      : mins > 1
        ? `about ${mins} minutes`
        : "a minute";
  return v.window === "day"
    ? `That's the practice limit for today. It resets in ${when}.`
    : `That's a lot of practice in one hour. The floor reopens in ${when}.`;
}
