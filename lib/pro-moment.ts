/**
 * The one proactive premium moment (DECISIONS #11, built at last).
 *
 * The paywall's locked placement is "after the day-3 progress card,
 * never a quiz-wall" — and until now no proactive moment existed at
 * all: every sheet in the app was a deny-wall on a locked surface. This
 * module decides the one exception: on the way out of a finished
 * debrief, on the user's third distinct day of speaking or later, the
 * exits route through a progress-card screen (day 1 against today,
 * the ComparisonCard, seen in full first) with the sheet one deliberate
 * tap behind it.
 *
 * Rules, from the monetization map (docs/growth/04 §2):
 *  - never before the third day of speaking, whatever the count of
 *    recordings — a binge of five on day one is enthusiasm, not felt
 *    progress across days;
 *  - shown once per browser, like the save-progress wall, and declining
 *    is quiet and final;
 *  - never for premium accounts, never over the save-progress wall
 *    (the account ask outranks the money ask, and the caller owns that
 *    precedence);
 *  - the streak is never mentioned on it.
 */

export const PRO_MOMENT_DAYS = 3;

const KEY = "ethos.pro.day3";

/** Pure: does this exit earn the moment? The caller reads the flags. */
export function proMomentDue(args: {
  premium: boolean;
  /** Distinct local days containing a recording (lib/days.ts). */
  daysSpoken: number;
  /** How many recordings exist, for the comparison card's two ends. */
  repCount: number;
  shown: boolean;
}): boolean {
  if (args.premium || args.shown) return false;
  if (args.daysSpoken < PRO_MOMENT_DAYS) return false;
  return args.repCount >= 2;
}

export function proMomentShown(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}

export function markProMomentShown(): void {
  try {
    localStorage.setItem(KEY, new Date().toISOString());
  } catch {}
}
