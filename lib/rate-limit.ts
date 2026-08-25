/**
 * The throttle in front of the AI spend (migration 0006).
 *
 * /api/analyze calls Whisper on every upload and Claude on scorable
 * ones; this is the server-side check that runs BEFORE either. Subjects
 * are user ids when a session exists (anonymous-first sessions count),
 * the caller's IP otherwise. Real accounts get room to train hard;
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
} as const;

export type LimitTier = keyof typeof LIMITS;

export interface RateVerdict {
  allowed: boolean;
  window: "hour" | "day" | null;
  retryAfterS: number;
}

const OPEN: RateVerdict = { allowed: true, window: null, retryAfterS: 0 };

export async function consumeRateLimit(
  subject: string,
  tier: LimitTier
): Promise<RateVerdict> {
  try {
    const db = supabaseAdmin();
    if (!db) return OPEN;
    const { data, error } = await db.rpc("consume_rate_limit", {
      p_subject: subject,
      p_hour_limit: LIMITS[tier].hour,
      p_day_limit: LIMITS[tier].day,
    });
    if (error || !data) {
      console.error("rate-limit check failed", error?.message);
      return OPEN;
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
    return OPEN;
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
