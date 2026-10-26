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
import { outboxAll } from "./rep-outbox";
import {
  computeStreak,
  freezeBalance,
  rescuableDays,
  type StreakState,
} from "./streak";

/** As far back as the server will date a recording sent late (route.ts). */
const PENDING_WINDOW_MS = 72 * 3_600_000;

/**
 * Days a recording is still on its way to: spoken, held in the outbox,
 * not yet stored. The server will date it the day it was spoken, so a
 * freeze must not be spent on that day in the meantime.
 */
async function pendingDates(now: Date): Promise<Date[]> {
  const held = await outboxAll().catch(() => []);
  return held
    .filter((r) => now.getTime() - r.createdAt < PENDING_WINDOW_MS)
    .map((r) => new Date(r.createdAt));
}

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

  const pending = await pendingDates(now);
  const candidates = rescuableDays(
    [...repDates, ...pending],
    frozenDays,
    equipped,
    now
  );
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
