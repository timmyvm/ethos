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
import { FREEZES_KEY, SPINE_KEY, held, heldMark, hold, keepBetweenOpens, once } from "./held";
import type { RepSpine } from "./client-data";
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

/**
 * The streak as the last sync left it this visit (lib/held.ts, #433), so
 * a screen that shows it opens on the frozen-aware number rather than
 * the bare count and a correction. A rescue is the news of the load
 * that made it, so what is held never carries one.
 */
export const heldFreezes = (): FreezeSync | null => held<FreezeSync>(FREEZES_KEY) ?? null;

/**
 * The freezes are kept between opens (lib/held.ts, rule 4, #508): the
 * days a freeze covered and how many are held, as numbers and dates. The
 * streak itself is not kept, since it moves with the clock ("did today",
 * "at risk"): it is counted again from the kept spine and these days at
 * the moment they are read back. No spine, nothing read back.
 */
export function keptFreezes(raw: unknown, now: Date = new Date()): FreezeSync | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { frozenDays, equipped } = raw as Record<string, unknown>;
  if (!Array.isArray(frozenDays) || typeof equipped !== "number" || !Number.isFinite(equipped)) return null;
  const days = frozenDays.map((d) => (typeof d === "string" ? new Date(d) : null));
  if (days.some((d) => d === null || Number.isNaN(d.getTime()))) return null;
  const spine = held<RepSpine[]>(SPINE_KEY);
  if (!spine) return null;
  const streak = computeStreak(spine.map((r) => new Date(r.created_at)), now, days as Date[]);
  return { streak, frozenDays: days as Date[], equipped, rescued: [] };
}
keepBetweenOpens<FreezeSync>(FREEZES_KEY, {
  save: (v) => ({ frozenDays: v.frozenDays.map((d) => d.toISOString()), equipped: v.equipped }),
  load: (raw) => keptFreezes(raw),
});

export function syncFreezes(repDates: Date[], now = new Date()): Promise<FreezeSync> {
  return once(FREEZES_KEY, () => runFreezeSync(repDates, now));
}

async function runFreezeSync(
  repDates: Date[],
  now: Date
): Promise<FreezeSync> {
  const mark = heldMark();
  // A failed read rejects, before anything is written: missing rows must
  // not look like "nothing spent yet" (a rescue paid twice) or "none
  // bought" (a lower count), and the caller draws the failure (#147).
  // The reads have no order between them, so they go together (#508):
  // three round trips one after another were the streak chip's wait.
  // The mirror's row is read beside them, and again only if a rescue
  // below writes it.
  const [frozenRead, purchased, pending, rowBefore] = await Promise.all([
    fetchFrozenDays(),
    purchasedFreezes(),
    pendingDates(now),
    fetchStreakRow().catch(() => undefined),
  ]);
  let frozenDays = frozenRead;

  // What is held is derived, never read back from streaks.freezes_equipped:
  // production's check stores 0..2 (0001) while three can be held (#174),
  // so the column could never say three. A rescue never moves `longest`
  // (a freeze bridges, it never counts, and rescued days come after the
  // last covered one), so before and after agree.
  const before = computeStreak(repDates, now, frozenDays);
  const held = freezeBalance(before.longest, frozenDays.length, purchased);
  const candidates = rescuableDays(
    [...repDates, ...pending],
    frozenDays,
    held,
    now
  );
  let rescued: Date[] = [];
  let spent = 0;
  if (candidates.length > 0) {
    spent = await spendFreezes(candidates, held).catch(() => 0);
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
  // A rescue wrote the row (spendFreezes): read what it left.
  const row = spent > 0 ? await fetchStreakRow().catch(() => undefined) : rowBefore;
  if (row !== undefined && row?.freezes_equipped !== mirror) {
    await grantFreezes(mirror).catch(() => 0);
  }

  hold(FREEZES_KEY, { streak, frozenDays, equipped, rescued: [] }, mark);
  return { streak, frozenDays, equipped, rescued };
}
