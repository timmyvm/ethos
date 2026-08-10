/**
 * Streak math — pure, computed from rep dates (one source of truth: the
 * reps table) plus any days a freeze rescued. A day counts once; today
 * keeps the streak alive even before today's rep (it shows as "at risk",
 * not broken, until midnight).
 *
 * A freeze BRIDGES a gap, it never adds to the count (DECISIONS #14: no
 * pay-to-win — convenience, never truth). Miss Tuesday with a freeze
 * equipped and Monday–Wednesday reads as a 2-day streak that survived,
 * not a 3-day streak you didn't do.
 */

/** DECISIONS #14 — two equipped, maximum. */
export const MAX_EQUIPPED_FREEZES = 2;

export interface StreakState {
  current: number;
  longest: number;
  /** True when today's rep hasn't happened yet and the streak is alive. */
  atRisk: boolean;
  didToday: boolean;
  /** Days inside the current run that a freeze carried. */
  frozenInRun: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000
  );
}

interface CoveredDay {
  date: Date;
  rep: boolean;
}

/** Unique local days covered by a rep or a freeze, ascending. */
function coveredDays(repDates: Date[], frozenDays: Date[]): CoveredDay[] {
  const map = new Map<string, CoveredDay>();
  for (const d of frozenDays) {
    map.set(dayKey(d), { date: startOfDay(d), rep: false });
  }
  for (const d of repDates) {
    map.set(dayKey(d), { date: startOfDay(d), rep: true });
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function computeStreak(
  repDates: Date[],
  now = new Date(),
  frozenDays: Date[] = []
): StreakState {
  const days = coveredDays(repDates, frozenDays);
  if (days.length === 0 || repDates.length === 0) {
    return {
      current: 0,
      longest: 0,
      atRisk: false,
      didToday: false,
      frozenInRun: 0,
    };
  }

  // Longest run of consecutive covered days, counted in REP days only.
  let longest = days[0].rep ? 1 : 0;
  let run = longest;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1].date, days[i].date) === 1) {
      run += days[i].rep ? 1 : 0;
    } else {
      run = days[i].rep ? 1 : 0;
    }
    if (run > longest) longest = run;
  }

  const last = days[days.length - 1];
  const gap = daysBetween(last.date, now);
  const didToday = repDates.some((d) => daysBetween(d, now) === 0);

  let current = 0;
  let frozenInRun = 0;
  if (gap <= 1) {
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].rep) current++;
      else frozenInRun++;
      if (i === 0 || daysBetween(days[i - 1].date, days[i].date) !== 1) break;
    }
  }

  return {
    current,
    longest,
    atRisk: current > 0 && !didToday,
    didToday,
    frozenInRun,
  };
}

/**
 * Which missed days a freeze could still rescue right now.
 *
 * Only the gap between the last covered day and today is rescuable —
 * you can't reach back and repair a streak you already lost, and today
 * isn't missed until midnight. Returns [] when there's nothing to save
 * or not enough freezes to cover the whole gap: a half-bridged gap is
 * still a broken streak, so spending on it would be theft.
 */
export function rescuableDays(
  repDates: Date[],
  frozenDays: Date[],
  freezesAvailable: number,
  now = new Date()
): Date[] {
  if (freezesAvailable <= 0) return [];
  const days = coveredDays(repDates, frozenDays);
  if (days.length === 0) return [];

  const last = days[days.length - 1].date;
  const gap = daysBetween(last, now);
  // gap 0 = did today, gap 1 = yesterday covered and today still open.
  if (gap <= 1) return [];

  const missed: Date[] = [];
  for (let i = 1; i < gap; i++) {
    const d = startOfDay(last);
    d.setDate(d.getDate() + i);
    missed.push(d);
  }
  return missed.length <= freezesAvailable ? missed : [];
}

/**
 * Freezes are EARNED, not bought (non-negotiable: money never buys
 * streaks). One per completed week of the longest streak, capped at the
 * two you're allowed to equip.
 */
export function freezesEarned(longestStreak: number): number {
  return Math.min(MAX_EQUIPPED_FREEZES, Math.floor(longestStreak / 7));
}

/**
 * What should be sitting equipped right now: everything earned, minus
 * everything already spent, clamped to the cap. Derived rather than
 * incremented so a lost write or a second device can't double-grant.
 */
export function freezeBalance(longestStreak: number, spent: number): number {
  const earned = Math.floor(longestStreak / 7);
  return Math.max(0, Math.min(MAX_EQUIPPED_FREEZES, earned - spent));
}
