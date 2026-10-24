/**
 * The price ladder (DECISIONS #377). One plan, billed monthly, whose
 * price drops a dollar for every month in a row it is paid: A$12.99 in
 * month 1, down to a floor of A$6.99 from month 7 on.
 *
 * Months count on one unbroken plan. A declined card that Stripe is
 * still retrying keeps its place; only a plan that ends (a cancel taking
 * effect, or the retries running out) sends the next one back to month 1.
 *
 * Cents throughout, so the arithmetic never meets a float. Stripe holds
 * one Price per rung, found by its lookup key, and the server steps the
 * subscription onto the next rung after each paid month (lib/billing.ts).
 */

export const CURRENCY = "aud";

/** Month 1 first; the last entry is the floor and repeats forever. */
export const LADDER_CENTS = [1299, 1199, 1099, 999, 899, 799, 699] as const;

/** The month the floor starts, 7. */
export const FLOOR_MONTH = LADDER_CENTS.length;

export const FIRST_PRICE_CENTS = LADDER_CENTS[0];
export const FLOOR_PRICE_CENTS = LADDER_CENTS[FLOOR_MONTH - 1];

/** Stripe lookup keys, one per rung: `ethos_ladder_m1` to `ethos_ladder_m7`. */
export const LOOKUP_KEYS = LADDER_CENTS.map((_, i) => `ethos_ladder_m${i + 1}`);

/**
 * Month n of an unbroken plan (1 is the first paid month) to its rung,
 * 0 to 6. Anything below 1, or not a number, is month 1: a plan that
 * cannot say how long it has run starts at the start, never the floor.
 */
export function rungIndex(month: number): number {
  if (!Number.isFinite(month) || month < 1) return 0;
  return Math.min(Math.floor(month), FLOOR_MONTH) - 1;
}

/** What month n costs, in cents. */
export function priceForMonth(month: number): number {
  return LADDER_CENTS[rungIndex(month)];
}

/** The Stripe lookup key for month n's price. */
export function lookupKeyForMonth(month: number): string {
  return LOOKUP_KEYS[rungIndex(month)];
}

/** Which rung a lookup key names, as a month 1 to 7; null if it is not ours. */
export function monthForLookupKey(key: string | null | undefined): number | null {
  const i = key ? LOOKUP_KEYS.indexOf(key) : -1;
  return i < 0 ? null : i + 1;
}

/** The sum of months 1 to n of an unbroken plan, in cents. */
export function totalForMonths(n: number): number {
  let total = 0;
  for (let m = 1; m <= Math.floor(n); m++) total += priceForMonth(m);
  return total;
}

/** A$12.99, A$6.99, A$104.88. Always two decimals, never a thousands comma. */
export function formatAud(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const part = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}A$${whole}.${part}`;
}

/** 12.99, for the ladder's columns where the currency is said once above them. */
export function formatBare(cents: number): string {
  return formatAud(cents).replace("A$", "");
}
