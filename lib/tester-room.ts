/**
 * The ceiling on public.tester_events as a whole (review P4, migration
 * 0022 `tester_events_bytes`).
 *
 * The tester code is the first one anyone guesses, so anyone can become
 * a tester, and each tester's phone may send a few thousand rows. The
 * route caps each account (lib/tester-events.ts EVENT_CAPS); this caps
 * the table, so collection can never fill the database and stop writes
 * for the whole app, the outage 0021 was written to prevent. Past the
 * budget the route takes each batch and keeps nothing; recording,
 * scoring and the answers are untouched.
 *
 * The size is the table's own on disk (pg_total_relation_size, indexes
 * included), read once a minute per server instance. A size that cannot
 * be read (0022 not applied yet, a hiccup) never stops a tester: the
 * per-account cap still holds.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** The table's budget: TESTER_EVENTS_MB, or 150 MB (twenty testers over two weeks use well under 50). */
export function eventsBudgetBytes(): number {
  const mb = Number(process.env.TESTER_EVENTS_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 150) * 1024 * 1024;
}

const EVERY_MS = 60_000;
let read: { at: number; full: boolean } | null = null;

/** Whether the events table has used its budget. Fails open. */
export async function eventsTableFull(db: SupabaseClient, now = Date.now()): Promise<boolean> {
  if (read && now - read.at < EVERY_MS) return read.full;
  try {
    const { data, error } = await db.rpc("tester_events_bytes");
    const bytes = Number(data);
    if (error || data === null || !Number.isFinite(bytes)) return false;
    read = { at: now, full: bytes >= eventsBudgetBytes() };
    return read.full;
  } catch {
    return false;
  }
}

/** The tests start each case with no reading held. */
export function resetRoomForTests(): void {
  read = null;
}
