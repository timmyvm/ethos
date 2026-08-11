/**
 * Judged-analysis metering — the chess.com model (decisions 11 Aug, §3).
 *
 * The split is the one already in the Index spec: the MEASURED tier
 * (fillers, WPM, pause ratio, repetition, transcript, and the live
 * camera ring) is free and unlimited forever, because reps cost nothing
 * to serve and the free tier still has to build a habit. The JUDGED tier
 * — cited moments, credibility/engagement, the supply-layer upgrade,
 * Demos's actual read — is one Claude call per rep, so that is what is
 * metered.
 *
 * Two guardrails are non-negotiable and both are enforced here:
 *
 *  1. **Streaks count reps, not analyses.** Nothing in this file can
 *     break a streak — the streak is derived from the reps table and a
 *     metered rep is still a rep. Punishing the behaviour you want is
 *     rage-inducing.
 *  2. **Unused analyses roll over, to a maximum of 3.** Someone who
 *     practises hard on Saturday must never end up worse off than
 *     someone who logs in daily.
 *
 * The balance is a single number rather than "today's one plus a
 * separate bank": a new day tops it up by one, capped at MAX_BALANCE.
 * Premium skips all of it.
 */

/** One free judged analysis accrues per day. */
export const DAILY_GRANT = 1;

/** Ceiling on the balance — "roll over, up to 3". */
export const MAX_BALANCE = 3;

export interface MeterState {
  /** Judged analyses available right now. */
  balance: number;
  /** Local calendar date (YYYY-MM-DD) the balance was last topped up. */
  accruedOn: string | null;
  /** When the last judged analysis was spent, for "back tomorrow" copy. */
  usedAt: string | null;
}

export interface MeterDecision {
  /** Whether the LLM layer runs for this rep. */
  allowed: boolean;
  /** Balance after this rep. */
  state: MeterState;
  /** Balance remaining after this rep, for the UI. */
  remaining: number;
  /** True when the tier is unmetered (premium). */
  unlimited: boolean;
}

/** Local calendar date as YYYY-MM-DD. Never UTC — see `localDate`. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * The user's local date, derived from a UTC-offset the client sends in
 * minutes (`Date.prototype.getTimezoneOffset`, so west of Greenwich is
 * positive).
 *
 * Server-side UTC would reset the allowance mid-morning in Sydney, which
 * is a worse product than a boundary someone can nudge. Nudging it is
 * also not an exploit: claiming an offset that moves you BACKWARDS
 * produces an earlier date, which grants nothing (see `accrue` — days
 * elapsed is floored at zero), and claiming one that moves you forwards
 * pulls tomorrow's single coin-flip of an analysis a few hours early,
 * once. The rate is unchanged either way.
 */
export function localDate(now: Date, offsetMinutes: number | null): Date {
  if (offsetMinutes === null || !Number.isFinite(offsetMinutes)) return now;
  const clamped = Math.max(-14 * 60, Math.min(14 * 60, Math.trunc(offsetMinutes)));
  return new Date(now.getTime() - clamped * 60_000);
}

function daysBetweenKeys(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Top the balance up for however many days have passed. A user coming
 * back after a week gets 3, not 7 — the cap is the whole point of "up to
 * 3" — and a user coming back the same day gets nothing new.
 */
export function accrue(state: MeterState, today: string): MeterState {
  if (!state.accruedOn) {
    // First ever rep: today's grant, nothing banked.
    return { ...state, balance: Math.min(MAX_BALANCE, DAILY_GRANT), accruedOn: today };
  }
  const elapsed = Math.max(0, daysBetweenKeys(state.accruedOn, today));
  if (elapsed === 0) return state;
  return {
    ...state,
    balance: Math.min(MAX_BALANCE, state.balance + elapsed * DAILY_GRANT),
    accruedOn: today,
  };
}

/**
 * Accrue, then spend one if there is one. Premium is never metered, and
 * never has its balance touched — cancelling shouldn't hand someone a
 * bill of three unspent analyses or, worse, zero.
 */
export function meter(params: {
  state: MeterState;
  now: Date;
  premium: boolean;
}): MeterDecision {
  const { state, now, premium } = params;
  if (premium) {
    return { allowed: true, state, remaining: Infinity, unlimited: true };
  }

  const today = dateKey(now);
  const accrued = accrue(state, today);
  if (accrued.balance <= 0) {
    return { allowed: false, state: accrued, remaining: 0, unlimited: false };
  }

  const spent: MeterState = {
    ...accrued,
    balance: accrued.balance - 1,
    usedAt: now.toISOString(),
  };
  return { allowed: true, state: spent, remaining: spent.balance, unlimited: false };
}

/**
 * What the UI says about the tier without spending anything. Used before
 * the rep (so the record screen can be honest about what's coming back)
 * and after a metered rep.
 */
export function meterStatus(params: {
  state: MeterState;
  now: Date;
  premium: boolean;
}): { available: number; unlimited: boolean; nextGrantInHours: number } {
  const { state, now, premium } = params;
  if (premium) {
    return { available: Infinity, unlimited: true, nextGrantInHours: 0 };
  }
  const available = accrue(state, dateKey(now)).balance;
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  return {
    available,
    unlimited: false,
    nextGrantInHours: Math.max(
      1,
      Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000)
    ),
  };
}
