/**
 * Freeze reconciliation, run once when a screen that shows the streak
 * loads. Deliberately derived from stored rows rather than incremented:
 * balance = earned − spent, so a dropped write or a second device can't
 * double-grant, and re-running is a no-op.
 *
 * Order matters. Spend first (rescue the gap while it's still
 * rescuable), then count, so a freeze earned today can't be eaten by a
 * gap it wasn't around for.
 */

import {
  fetchFrozenDays,
  fetchStreakRow,
  grantFreezes,
  purchasedFreezes,
  spendFreezes,
} from "./client-data";
import { outboxAll, ownedBy } from "./rep-outbox";
import { currentSession } from "./supabase-browser";
import {
  computeStreak,
  freezeBalance,
  rescuableDays,
  type StreakState,
} from "./streak";

/** What streaks.freezes_equipped can store: 0001's check is 0..2. */
const STORED_FREEZE_CAP = 2;

/** As far back as the server will date a recording sent late (route.ts). */
const PENDING_WINDOW_MS = 72 * 3_600_000;

/**
 * Days a recording is still on its way to: spoken, held in the outbox,
 * not yet stored. The server will date it the day it was spoken, so a
 * freeze must not be spent on that day in the meantime.
 */
async function pendingDates(now: Date): Promise<Date[]> {
  const held = await outboxAll().catch(() => []);
  const me = await currentSession();
  return ownedBy(held, me?.userId ?? null)
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
  // A failed read rejects, before anything is written: missing rows must
  // not look like "nothing spent yet" (a rescue paid twice) or "none
  // bought" (a lower count), and the caller draws the failure (#147).
  let frozenDays = await fetchFrozenDays();
  const purchased = await purchasedFreezes();

  // What is held is derived, never read back from streaks.freezes_equipped:
  // production's check stores 0..2 (0001) while three can be held (#174),
  // so the column could never say three. A rescue never moves `longest`
  // (a freeze bridges, it never counts, and rescued days come after the
  // last covered one), so before and after agree.
  const before = computeStreak(repDates, now, frozenDays);
  const held = freezeBalance(before.longest, frozenDays.length, purchased);
  const pending = await pendingDates(now);
  const candidates = rescuableDays(
    [...repDates, ...pending],
    frozenDays,
    held,
    now
  );
  let rescued: Date[] = [];
  if (candidates.length > 0) {
    const spent = await spendFreezes(candidates, held).catch(() => 0);
    if (spent > 0) {
      rescued = candidates.slice(0, spent);
      frozenDays = [...frozenDays, ...rescued];
    }
  }

  const streak = computeStreak(repDates, now, frozenDays);
  const equipped = freezeBalance(streak.longest, frozenDays.length, purchased);

  // The column stays a mirror for anyone reading the table, clamped to
  // what its check accepts, and is never read back. An unread row skips
  // the write rather than guessing.
  const mirror = Math.min(STORED_FREEZE_CAP, equipped);
  const row = await fetchStreakRow().catch(() => undefined);
  if (row !== undefined && row?.freezes_equipped !== mirror) {
    await grantFreezes(mirror).catch(() => 0);
  }

  return { streak, frozenDays, equipped, rescued };
}
