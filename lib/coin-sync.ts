/**
 * Coin reconciliation, run when a screen that shows the balance loads.
 *
 * Same shape as freeze-sync and for the same reason: the ledger is
 * derived from the reps that exist, not incremented on an event, so a
 * dropped write, a second device or a rep that landed while the phone
 * was offline all heal on the next load instead of silently costing
 * someone a coin.
 */

import { closesByWeek } from "./challenge";
import type { RepRow } from "./client-data";
import { fetchCoinLedger, grantCoins } from "./client-data";
import { balance, unpaidChallengeWeeks, unpaidDays, type CoinRow } from "./coins";

export interface CoinSync {
  ledger: CoinRow[];
  balance: number;
  /** Days that just paid out, for the "+1" on the results screen. */
  granted: string[];
}

export async function syncCoins(
  repDates: Date[],
  /* The rows themselves, when the caller has them: the challenge coin
     needs the readings, not just the dates. Omitted, only the day coin
     reconciles, which is what every caller did before #281. */
  reps: RepRow[] = []
): Promise<CoinSync> {
  let ledger = await fetchCoinLedger().catch(() => [] as CoinRow[]);

  const owed = unpaidDays(repDates, ledger);
  let granted: string[] = [];
  if (owed.length > 0) {
    const written = await grantCoins(owed).catch(() => 0);
    if (written > 0) {
      granted = owed.slice(-written);
      ledger = await fetchCoinLedger().catch(() => ledger);
    }
  }

  /* The week's coin, on the same derive-then-reconcile shape: five
     closed days in a week pays one, and asking twice pays nothing. */
  if (reps.length > 0) {
    const weeks = unpaidChallengeWeeks(closesByWeek(reps), ledger);
    if (weeks.length > 0) {
      const written = await grantCoins(weeks, "challenge_week").catch(() => 0);
      if (written > 0) ledger = await fetchCoinLedger().catch(() => ledger);
    }
  }

  return { ledger, balance: balance(ledger), granted };
}
