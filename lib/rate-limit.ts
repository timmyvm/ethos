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
  /**
   * Every guest and every visitor with no session, everywhere, together
   * (security audit, 11 Nov, second pass). The rooms above are per
   * account and per address, and both are cheap to change: a script
   * with many addresses had no end to what it could spend on Whisper
   * and the coach. Accounts never count against this, so a full ceiling
   * asks a guest to create an account and stops nobody who has one. The
   * busiest day so far held 6 guest recordings (37 in all); raise these
   * when a real day passes 100.
   */
  guestall: { hour: 60, day: 300 },
  /** The same ceiling for guests' word lookups, which cost far less each. */
  guestwords: { hour: 600, day: 3000 },
} as const;

/** The one subject every guest's paid call counts against (`guestall`). */
export const GUEST_CEILING = "guest:all";
/** And every guest's word lookup (`guestwords`). */
export const GUEST_WORDS_CEILING = "words:guest:all";

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

/**
 * An IPv6 caller is known by its /64, the block one connection is given.
 * Every address in it is theirs to use, so a limit on the whole address
 * was a limit on nobody: the next request simply came from the next one.
 * An IPv4 address, or anything that does not read as IPv6, is null.
 */
export function ipv6Block(ip: string): string | null {
  let s = ip.trim().toLowerCase();
  if (s.startsWith("[")) s = s.slice(1).split("]")[0];
  s = s.split("%")[0];
  if (!s.includes(":")) return null;
  // An IPv4 address written as IPv6 is that IPv4 address.
  const mapped = s.match(/^(?:0{0,4}:){2,5}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/) ?? s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves[1] ? halves[1].split(":") : [];
  const gap = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (gap < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array<string>(gap).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * First hop of x-forwarded-for; Vercel sets it on every request. This is
 * the key a per-address limit counts under, so IPv6 is cut to its block.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  if (!first) return "unknown";
  return ipv6Block(first) ?? first;
}

/**
 * What a guest reads when the ceiling every guest shares is reached
 * (`guestall`). Their own practice did nothing to cause it, so it names
 * the way on, which the ceiling never closes.
 */
export const GUEST_FULL_COPY =
  "Recording without an account is full for now. Create an account to keep going.";

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
