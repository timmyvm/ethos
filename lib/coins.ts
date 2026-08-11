/**
 * Coins — the currency, without a shop (decisions 11 Aug, §4).
 *
 * Coins ship now and there is deliberately nothing to spend them on yet.
 * That creates one specific hazard: by the time a sink exists, everyone
 * has a huge balance and whatever it sells is instantly affordable. The
 * fix is to price the first shop item BEFORE building it and set the earn
 * rate backwards from that — a first item worth about two weeks of
 * practice, at one coin per streak day, prices at 14.
 *
 * What earns a coin is a DAY YOU SPOKE. Not opening the app (§5 kills
 * sign-in gifts for exactly this reason: it rewards the easy part), not a
 * day a freeze rescued (a freeze protected you, it didn't train you), and
 * not per rep — three reps on Sunday is one coin, the same as one.
 *
 * The store is an append-only ledger rather than a mutable integer, so
 * the rate can be re-tuned or retro-adjusted later without corrupting
 * history. Everything in this file is pure; the writes live in
 * `coin-sync.ts`.
 */

/** One coin per day you actually spoke. */
export const COIN_PER_STREAK_DAY = 1;

/**
 * The anchor. Not built, not decided as a feature — decided as a PRICE,
 * which is the only part the earn rate needs today. Two weeks of practice
 * for the first thing worth buying.
 */
export const FIRST_SHOP_ITEM_PRICE = 14;

export interface CoinRow {
  id: string;
  kind: "earned" | "spent";
  amount: number;
  reason: string;
  earned_on: string | null;
  created_at: string;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Earned minus spent. Never derived from a counter someone can drift. */
export function balance(ledger: CoinRow[]): number {
  return ledger.reduce(
    (n, r) => n + (r.kind === "earned" ? r.amount : -r.amount),
    0
  );
}

export function totalEarned(ledger: CoinRow[]): number {
  return ledger
    .filter((r) => r.kind === "earned")
    .reduce((n, r) => n + r.amount, 0);
}

/**
 * Local days with a rep in them that haven't been paid yet, oldest
 * first. Re-running is a no-op, which is the property that lets this be
 * called on every screen load without bookkeeping.
 */
export function unpaidDays(repDates: Date[], ledger: CoinRow[]): string[] {
  const paid = new Set(
    ledger
      .filter((r) => r.reason === "streak_day" && r.earned_on)
      .map((r) => r.earned_on as string)
  );
  const days = new Set(repDates.map(dayKey));
  return [...days].filter((d) => !paid.has(d)).sort();
}

/**
 * Progress toward the first thing worth buying. Written when the shop
 * was still deferred, to keep the balance from being a pile with no
 * meaning; it survives the shop opening because the framing was never
 * about the shop's absence — a number going somewhere named beats a
 * number going nowhere either way.
 */
export function towardFirstItem(current: number): {
  price: number;
  toGo: number;
  fraction: number;
} {
  const toGo = Math.max(0, FIRST_SHOP_ITEM_PRICE - current);
  return {
    price: FIRST_SHOP_ITEM_PRICE,
    toGo,
    fraction: Math.min(1, current / FIRST_SHOP_ITEM_PRICE),
  };
}

/** Did today already pay out? Drives the "+1" on the results screen. */
export function earnedToday(ledger: CoinRow[], now = new Date()): boolean {
  const today = dayKey(now);
  return ledger.some((r) => r.reason === "streak_day" && r.earned_on === today);
}
