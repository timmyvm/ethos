/**
 * Direction B's fixed, fictional data (identical across the three
 * directions, so what differs between them is the design, never the
 * luck of the numbers). Today is Saturday 24 October 2026.
 */
import {
  FLOOR_MONTH,
  LADDER_CENTS,
  formatAud,
  formatBare,
  priceForMonth,
  rungIndex,
} from "@/lib/pricing";

export const TODAY = new Date(2026, 9, 24);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The same day n months on (every date here is the 24th, so no clamping). */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

/** "24 Nov": an absolute date, never "in 31 days", so nothing ticks. */
export function dayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "24 November", for VoiceOver. */
export function dayMonthLong(d: Date): string {
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** "9 dollars 99", the way a screen reader should say a price. */
export function spokenPrice(cents: number): string {
  return `${Math.floor(cents / 100)} dollars ${String(cents % 100).padStart(2, "0")}`;
}

export { FLOOR_MONTH, LADDER_CENTS, formatAud, formatBare, priceForMonth, rungIndex };

/** The seven rungs as the stair draws them: month 1 to 7, the last one "7+". */
export const RUNGS = LADDER_CENTS.map((cents, i) => ({
  month: i + 1,
  cents,
  label: i + 1 === FLOOR_MONTH ? `${FLOOR_MONTH}+` : String(i + 1),
}));

/**
 * A subscriber, as You and the manage sheet read them. `month` is the
 * month of the unbroken plan being paid now (1 = first), `start` the
 * day month 1 began; the next charge is `start` plus `month` months.
 */
export interface PlanState {
  kind: "active" | "ending" | "pastDue";
  month: number;
  start: Date;
}

export const PLANS = {
  /** (a) Month 3, started 24 Aug: A$10.99 now, A$9.99 from 24 Nov. */
  active: { kind: "active", month: 3, start: new Date(2026, 7, 24) },
  /** (b) Month 9: the floor, A$6.99. */
  floor: { kind: "active", month: 9, start: new Date(2026, 1, 24) },
  /** (c) Cancelled at month 3: Premium runs to 24 Nov, then ends. */
  ending: { kind: "ending", month: 3, start: new Date(2026, 7, 24) },
  /** (d) Month 3's renewal was declined today; Stripe is retrying. */
  pastDue: { kind: "pastDue", month: 3, start: new Date(2026, 7, 24) },
} satisfies Record<string, PlanState>;

/** Everything a surface says about a plan, worked out once. */
export function readPlan(p: PlanState) {
  const now = priceForMonth(p.month);
  const next = priceForMonth(p.month + 1);
  const renews = addMonths(p.start, p.month);
  const atFloor = p.month >= FLOOR_MONTH;
  const floorDate = addMonths(p.start, FLOOR_MONTH - 1);
  const dropsLeft = Math.max(0, FLOOR_MONTH - p.month);
  return { now, next, renews, atFloor, floorDate, dropsLeft, rung: rungIndex(p.month) + 1 };
}
