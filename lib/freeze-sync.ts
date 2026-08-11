/**
 * Freeze reconciliation, run once when a screen that shows the streak
 * loads. Deliberately derived from stored rows rather than incremented:
 * balance = earned − spent, so a dropped write or a second device can't
 * double-grant, and re-running is a no-op.
 *
 * Order matters. Spend first (rescue the gap while it's still
 * rescuable), then grant, so a freeze earned today can't be eaten by a
 * gap it wasn't around for.
 */

import {
  fetchFrozenDays,
  fetchStreakRow,
  grantFreezes,
  purchasedFreezes,
  spendFreezes,
} from "./client-data";
import {
  computeStreak,
  freezeBalance,
  rescuableDays,
  type StreakState,
} from "./streak";

export interface FreezeSync {
  streak: StreakState;
  frozenDays: Date[];
  equipped: number;
  /** Days a freeze just rescued, for the "your streak survived" note. */
  rescued: Date[];
}

export async function syncFreezes(
  repDates: Date[],
  now = new Date()
): Promise<FreezeSync> {
  let frozenDays = await fetchFrozenDays().catch(() => [] as Date[]);
  const row = await fetchStreakRow().catch(() => null);
  let equipped = row?.freezes_equipped ?? 0;

  const candidates = rescuableDays(repDates, frozenDays, equipped, now);
  let rescued: Date[] = [];
  if (candidates.length > 0) {
    const spent = await spendFreezes(candidates, equipped).catch(() => 0);
    if (spent > 0) {
      rescued = candidates.slice(0, spent);
      frozenDays = [...frozenDays, ...rescued];
      equipped = Math.max(0, equipped - spent);
    }
  }

  const streak = computeStreak(repDates, now, frozenDays);

  const target = freezeBalance(
    streak.longest,
    frozenDays.length,
    await purchasedFreezes().catch(() => 0)
  );
  if (target !== equipped) {
    const granted = await grantFreezes(target).catch(() => equipped);
    equipped = granted || equipped;
  }

  return { streak, frozenDays, equipped, rescued };
}
