/**
 * Direction A, the timeline: the ladder as real calendar months.
 *
 * lib/pricing.ts counts months of an unbroken plan (1, 2, 3...). This file
 * turns those counts into dates, because a person does not think "month
 * 4", they think "from 24 January". Every date here is the day a price
 * starts, and every string is built from Intl in en-AU so "24 Nov" and
 * "Friday" read the way an Australian phone writes them.
 *
 * Stripe bills a monthly plan on its anchor day; a month without that
 * day (the 31st in a 30-day month, or February) bills on its last day,
 * and the next month returns to the anchor. `addMonths` is that rule.
 */
import {
  FLOOR_MONTH,
  LADDER_CENTS,
  formatAud,
  priceForMonth,
} from "@/lib/pricing";

/** The month a rung starts, on a plan whose month 1 began on `start`. */
export function addMonths(start: Date, n: number): Date {
  const y = start.getFullYear();
  const m = start.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(start.getDate(), last));
}

/** The day month `month` of the plan begins (month 1 is `start` itself). */
export function monthStarts(start: Date, month: number): Date {
  return addMonths(start, Math.max(1, Math.floor(month)) - 1);
}

const DAY_MONTH = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
const DAY_MONTH_LONG = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long" });
const MONTH = new Intl.DateTimeFormat("en-AU", { month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-AU", { weekday: "long" });

/** "24 Nov". */
export const dayMonth = (d: Date) => DAY_MONTH.format(d);
/** "24 November", for a screen reader, which reads "Nov" as a word. */
export const dayMonthLong = (d: Date) => DAY_MONTH_LONG.format(d);
/** "Nov". en-AU writes September "Sept". */
export const monthName = (d: Date) => MONTH.format(d);

const MS_DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days from `today` to `d`, by calendar date. */
export function daysUntil(d: Date, today: Date): number {
  return Math.round((midnight(d) - midnight(today)) / MS_DAY);
}

/**
 * When a date is, the way Flighty says a departure: "today", "tomorrow",
 * a weekday inside the week, the date after that. Nobody counts days.
 */
export function when(d: Date, today: Date): string {
  const n = daysUntil(d, today);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1 && n < 7) return WEEKDAY.format(d);
  return dayMonth(d);
}

/** The same, said aloud: "24 November" rather than "24 Nov". */
export function whenSpoken(d: Date, today: Date): string {
  const n = daysUntil(d, today);
  return n >= 0 && n < 7 ? when(d, today) : dayMonthLong(d);
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One column of the timeline: a rung, its price and the day it starts. */
export type Rung = {
  /** 1 to 7; 7 is the floor and every month after it. */
  month: number;
  cents: number;
  starts: Date;
};

/** The seven rungs of a plan whose month 1 began (or begins) on `start`. */
export function rungs(start: Date): Rung[] {
  return LADDER_CENTS.map((cents, i) => ({
    month: i + 1,
    cents,
    starts: monthStarts(start, i + 1),
  }));
}

/** The rung a plan in month `month` stands on, 1 to 7. */
export const rungOf = (month: number) => Math.min(Math.max(1, Math.floor(month)), FLOOR_MONTH);

/** "Month 3", "Month 7 and after". */
export function monthLabel(month: number): string {
  return month >= FLOOR_MONTH ? `Month ${FLOOR_MONTH} and after` : `Month ${month}`;
}

/** What VoiceOver hears for one rung: "Month 2, from 24 November, A$11.99". */
export function rungSpoken(r: Rung, today: Date, current?: number): string {
  const day = whenSpoken(r.starts, today);
  const date =
    current === r.month ? "this month" : daysUntil(r.starts, today) < 0 ? `from ${day}, paid` : `from ${day}`;
  const label =
    r.month >= FLOOR_MONTH ? `Month ${FLOOR_MONTH} and every month after` : `Month ${r.month}`;
  return `${label}, ${date}, ${formatAud(r.cents)}`;
}

/**
 * The state a subscriber's plan is in, as the surfaces draw it. Built
 * from a BillingRow on the real page; fixed and fictional here.
 */
export type PlanState =
  | { kind: "active"; start: Date; month: number }
  | { kind: "ending"; start: Date; month: number; endsOn: Date }
  | { kind: "past_due"; start: Date; month: number; declinedOn: Date; retryUntil: Date }
  | { kind: "code" }
  | { kind: "free" };

/** What this month cost and what the next renewal charges. */
export function pricesFor(month: number) {
  const now = priceForMonth(month);
  const next = priceForMonth(month + 1);
  return { now, next, drops: next < now };
}
