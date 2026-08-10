/**
 * Streak math — pure, computed from rep dates (one source of truth: the
 * reps table). A day counts once; today keeps the streak alive even
 * before today's rep (it shows as "at risk", not broken, until midnight).
 */

export interface StreakState {
  current: number;
  longest: number;
  /** True when today's rep hasn't happened yet and the streak is alive. */
  atRisk: boolean;
  didToday: boolean;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function daysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function computeStreak(repDates: Date[], now = new Date()): StreakState {
  if (repDates.length === 0) {
    return { current: 0, longest: 0, atRisk: false, didToday: false };
  }

  // Unique local days, ascending
  const seen = new Map<string, Date>();
  for (const d of repDates) {
    const key = dayKey(d);
    if (!seen.has(key)) seen.set(key, new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const days = [...seen.values()].sort((a, b) => a.getTime() - b.getTime());

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const last = days[days.length - 1];
  const gap = daysBetween(last, now);
  const didToday = gap === 0;

  let current = 0;
  if (gap <= 1) {
    // Walk back from the last day
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (daysBetween(days[i - 1], days[i]) === 1) current++;
      else break;
    }
  }

  return { current, longest, atRisk: current > 0 && !didToday, didToday };
}
