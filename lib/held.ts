/**
 * What this visit last read (#433): stale-while-revalidate for the tabs.
 *
 * Every tab used to open on its skeleton and read the same rows again,
 * so moving along the tab bar was five waits for five things the phone
 * already had. A read that lands is now held here, in memory, and a
 * screen that opens draws from it in its first frame while the same
 * read runs again behind it; the fresh answer replaces what was held.
 *
 * Three rules keep that honest:
 *
 * 1. **Held is one account's.** The store belongs to the session it was
 *    read under and is dropped whole the moment that session changes: a
 *    sign-out, a sign-in, a guest becoming someone else.
 * 2. **A write that changes the answer drops it.** A recording stored
 *    (`forgetRecordings`, called where the send lands) empties everything
 *    counted from recordings, so no screen shows yesterday's numbers for
 *    a beat after today's take. A read still in flight across either
 *    drop is not kept (`heldMark`).
 * 3. **Memory only.** Nothing is written to the phone: a transcript
 *    stays where Privacy says it is, and a cold open reads as it always
 *    did. Coins in the Shop and the plan are never held (a balance is
 *    read, not remembered).
 */

import { supabaseBrowser } from "./supabase-browser";

const store = new Map<string, unknown>();
/** Bumped by every drop: a read begun before it must not be kept after. */
let epoch = 0;
/** The account the store belongs to; undefined until the session is known. */
let owner: string | null | undefined;
let watching = false;

/** The session answered: a different account than the store's empties it. */
export function heldFor(id: string | null): void {
  if (owner !== undefined && owner !== id) forget();
  owner = id;
}

function watch(): void {
  if (watching) return;
  watching = true;
  try {
    supabaseBrowser()?.auth.onAuthStateChange((_event, session) => {
      heldFor(session?.user.id ?? null);
    });
  } catch {
    /* No auth client: one visitor, nothing to mix up. */
  }
}

/** Taken when a read starts and handed to `hold` when it lands. */
export function heldMark(): number {
  watch();
  return epoch;
}

/** Keep a read's answer, unless the store was dropped while it was out. */
export function hold<T>(key: string, value: T, mark: number = epoch): T {
  watch();
  if (mark === epoch) store.set(key, value);
  return value;
}

/** What was last read under this key this visit, or undefined. */
export function held<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

/** Drop everything, or every key the test names. */
export function forget(only?: (key: string) => boolean): void {
  epoch += 1;
  if (!only) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) if (only(key)) store.delete(key);
}

/** The account's own row: a recording does not change it. */
export const PROFILE_KEY = "profile";
/** The coin sync's answer (lib/coin-sync.ts) and the freeze sync's (lib/freeze-sync.ts). */
export const COINS_KEY = "coins";
export const FREEZES_KEY = "freezes";

/** A recording was stored: everything counted from recordings is read again. */
export function forgetRecordings(): void {
  forget((key) => key !== PROFILE_KEY);
}

/** The name, the pose worn or the plan changed: the profile is read again. */
export function forgetProfile(): void {
  forget((key) => key === PROFILE_KEY);
}

/** Coins were spent: the balance, and the freezes it may have bought, are read again. */
export function forgetBalance(): void {
  forget((key) => key === COINS_KEY || key === FREEZES_KEY);
}

/** Tests only: an empty store that belongs to nobody yet. */
export function resetHeld(): void {
  store.clear();
  epoch = 0;
  owner = undefined;
}
