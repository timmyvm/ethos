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
import { fetchWholeLedger as fetchCoinLedger, grantCoins } from "./client-data";
import { balance, unpaidChallengeWeeks, unpaidDays, type CoinRow } from "./coins";
import { COINS_KEY, held, heldMark, hold } from "./held";

export interface CoinSync {
  ledger: CoinRow[];
  balance: number;
  /** Days that just paid out, for the "+1" on the results screen. */
  granted: string[];
}

/**
 * The ledger and its balance as the last sync left them this visit
 * (lib/held.ts, #433): what You's count and its stage's pose open on.
 * The Shop never opens on it: a balance something is bought against is
 * read, not remembered. A payout is its own load's news, never held.
 */
export const heldCoins = (): CoinSync | null => held<CoinSync>(COINS_KEY) ?? null;

export async function syncCoins(
  repDates: Date[],
  /* The rows themselves, when the caller has them: the challenge coin
     needs the readings, not just the dates. Omitted, only the day coin
     reconciles, which is what every caller did before #281. */
  reps: RepRow[] = []
): Promise<CoinSync> {
  const mark = heldMark();
  // A failed first read rejects, so the caller draws the balance as
  // unread (a dash and a retry), never as zero.
  let ledger = await fetchCoinLedger();

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
    // One week per grant. The insert is one statement under row
    // security, so a single week the policy refuses used to fail the
    // whole batch, and every later week stayed unpaid with it.
    let written = 0;
    for (const week of weeks) {
      written += await grantCoins([week], "challenge_week").catch(() => 0);
    }
    if (written > 0) ledger = await fetchCoinLedger().catch(() => ledger);
  }

  hold(COINS_KEY, { ledger, balance: balance(ledger), granted: [] }, mark);
  return { ledger, balance: balance(ledger), granted };
}
