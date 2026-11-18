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
 * 3. **Memory, and three numbers kept (#508).** Almost everything is
 *    held in memory only: a transcript stays where Privacy says it is.
 *    Coins in the Shop are never held (a balance is read, not
 *    remembered). The plan is held for a first frame only (#468): it is
 *    read again on every mount, never handed back by `once`.
 *
 * 4. **Kept between opens** (#508, bending rule 3 for Today's numbers):
 *    the spine (each recording's date, lesson, stars and Index), the
 *    profile row (the name, the plan, the picture) and the freezes are
 *    also written to the phone, so the next open draws them in its first
 *    frame instead of after the reads. Never a transcript, never audio,
 *    never a balance: only the keys that register a codec
 *    (`keepBetweenOpens`) are written, and only through it. The record
 *    names the account it belongs to and is versioned; it is cleared by
 *    every drop above (an account change, a sign-out, a write), and
 *    restored only into an empty store, for the account this phone's
 *    session names (`restoreHeld`). It only ever stands in for a first
 *    frame: a restored answer is never handed back by `once`, so the
 *    reads always run.
 */

import { supabaseBrowser } from "./supabase-browser";

const store = new Map<string, unknown>();
/** When each held answer was kept. */
const at = new Map<string, number>();
/** Reads out now, by key: a second asker shares the first's answer. */
const flying = new Map<string, Promise<unknown>>();
/** Set by components/PageTransition.tsx: this screen came from another tab. */
let tabToTab = false;

/**
 * How long a held answer stands in for a read when moving tab to tab
 * (#467). Swiping along the bar used to read every tab's rows again on
 * each arrival: the whole recording spine and every XP event, paged, a
 * dozen times a minute for numbers that had not moved. Inside this a
 * return draws what it held and asks nothing. Only tab to tab: every
 * screen that writes (a recording, Hostile, the boss, Settings, Your
 * words) is off the bar, so coming back from one reads fresh, and the
 * drops below still empty a key the moment a write lands.
 */
export const REUSE_MS = 60_000;
/** Bumped by every drop: a read begun before it must not be kept after. */
let epoch = 0;
/** The account the store belongs to; undefined until the session is known. */
let owner: string | null | undefined;
let watching = false;

/** The session answered: a different account than the store's empties it. */
export function heldFor(id: string | null): void {
  if (owner !== undefined && owner !== id) forget();
  owner = id;
  if (typeof id === "string") flushKept();
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
  if (mark === epoch) {
    store.set(key, value);
    at.set(key, Date.now());
    if (codecs.has(key)) {
      unsaved.add(key);
      flushKept();
    }
  }
  return value;
}

/** Called as a screen draws: whether it was reached from another tab. */
export function reuseHeld(on: boolean): void {
  tabToTab = on;
}

/**
 * A read, asked once. Moving tab to tab, an answer held under `key` in
 * the last minute is handed back without asking; and a read already out
 * under `key` is shared, so two parts of one screen asking for the same
 * rows make one request.
 */
export function once<T>(key: string, run: () => Promise<T>, now: number = Date.now()): Promise<T> {
  if (tabToTab && store.has(key) && now - (at.get(key) ?? 0) < REUSE_MS) {
    return Promise.resolve(store.get(key) as T);
  }
  const going = flying.get(key);
  if (going) return going as Promise<T>;
  const read = run().finally(() => {
    if (flying.get(key) === read) flying.delete(key);
  });
  flying.set(key, read);
  return read;
}

/** What was last read under this key this visit, or undefined. */
export function held<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

/** Drop everything, or every key the test names; on the phone as in memory. */
export function forget(only?: (key: string) => boolean): void {
  epoch += 1;
  if (!only) {
    store.clear();
    at.clear();
    flying.clear();
    unsaved.clear();
    writeKept(null);
    return;
  }
  for (const key of [...store.keys()]) if (only(key)) store.delete(key);
  for (const key of [...flying.keys()]) if (only(key)) flying.delete(key);
  for (const key of [...unsaved]) if (only(key)) unsaved.delete(key);
  const kept = readKept();
  if (kept && Object.keys(kept.items).some(only)) {
    const items = Object.fromEntries(Object.entries(kept.items).filter(([key]) => !only(key)));
    writeKept(Object.keys(items).length > 0 ? { ...kept, items } : null);
  }
}

/** Every recording's date, lesson, stars and Index (lib/client-data.ts `fetchRepSpine`). */
export const SPINE_KEY = "spine";
/** The account's own row: a recording does not change it. */
export const PROFILE_KEY = "profile";
/** The billing row (lib/client-data.ts `heldBilling`): goes with the profile. */
export const BILLING_KEY = "billing";
/** The coin sync's answer (lib/coin-sync.ts) and the freeze sync's (lib/freeze-sync.ts). */
export const COINS_KEY = "coins";
export const FREEZES_KEY = "freezes";
/** The poses the coin ledger proves (lib/picture-client.ts), which a picture is checked against (#488). */
export const POSES_KEY = "poses";

/** A recording was stored: everything counted from recordings is read again. */
export function forgetRecordings(): void {
  forget((key) => key !== PROFILE_KEY && key !== BILLING_KEY);
}

/** The name, the pose worn or the plan changed: the profile is read again. */
export function forgetProfile(): void {
  forget((key) => key === PROFILE_KEY || key === BILLING_KEY);
}

/** Coins were spent: the balance, and the freezes or the pose it may have bought, are read again. */
export function forgetBalance(): void {
  forget((key) => key === COINS_KEY || key === FREEZES_KEY || key === POSES_KEY);
}

/* ---- Kept between opens (rule 4, #508) ---------------------------------- */

/** How a kept key goes to the phone and comes back: numbers only, or null to drop it. */
export interface KeptCodec<T> {
  save(value: T): unknown;
  load(raw: unknown): T | null;
}

/** The keys that may be kept, in the order they are restored (the freezes read the spine). */
export const KEPT_KEYS = [SPINE_KEY, PROFILE_KEY, FREEZES_KEY] as const;
export type KeptKey = (typeof KEPT_KEYS)[number];

/** Where the record lives on the phone, and its shape's version: a new shape is a new number. */
export const KEPT_STORE = "ethos.held";
export const KEPT_VERSION = 1;

interface KeptRecord {
  v: typeof KEPT_VERSION;
  /** The account the numbers are, by its id. */
  owner: string;
  items: Partial<Record<KeptKey, unknown>>;
}

const codecs = new Map<string, KeptCodec<unknown>>();
/** Kept keys held since the last write, waiting for the account to be known. */
const unsaved = new Set<string>();

/** A key's codec, registered by the module that reads it (lib/client-data.ts, lib/freeze-sync.ts). */
export function keepBetweenOpens<T>(key: KeptKey, codec: KeptCodec<T>): void {
  codecs.set(key, codec as KeptCodec<unknown>);
}

function phone(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readKept(): KeptRecord | null {
  try {
    const raw = phone()?.getItem(KEPT_STORE);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<KeptRecord> | null;
    if (!rec || rec.v !== KEPT_VERSION || typeof rec.owner !== "string" || typeof rec.items !== "object" || !rec.items) {
      phone()?.removeItem(KEPT_STORE);
      return null;
    }
    return rec as KeptRecord;
  } catch {
    return null;
  }
}

function writeKept(rec: KeptRecord | null): void {
  try {
    if (rec) phone()?.setItem(KEPT_STORE, JSON.stringify(rec));
    else phone()?.removeItem(KEPT_STORE);
  } catch {
    /* A full or blocked store: the next open reads, as it always did. */
  }
}

/** Write what was held under kept keys, once the account it belongs to is known. */
function flushKept(): void {
  if (typeof owner !== "string" || unsaved.size === 0) return;
  const was = readKept();
  const items: KeptRecord["items"] = was && was.owner === owner ? { ...was.items } : {};
  for (const key of unsaved) {
    const codec = codecs.get(key);
    if (!codec || !store.has(key)) continue;
    try {
      items[key as KeptKey] = codec.save(store.get(key));
    } catch {
      delete items[key as KeptKey];
    }
  }
  unsaved.clear();
  writeKept({ v: KEPT_VERSION, owner, items });
}

/**
 * The account this phone's session names, read straight from the auth
 * client's own storage (no network, no wait): the key supabase-js keeps
 * the session under for this project. Null without one.
 */
export function phoneAccount(url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!url) return null;
  try {
    const key = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    const raw = phone()?.getItem(key);
    if (!raw) return null;
    const id = (JSON.parse(raw) as { user?: { id?: unknown } } | null)?.user?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Put what the phone kept into an empty store, for the account the
 * session names. Anything else (another account's numbers, no session,
 * an old shape) is dropped from the phone, never drawn. A restored answer
 * stands in for a first frame only: `once` never hands it back, so every
 * screen still reads. Returns whether anything was restored.
 */
export function restoreHeld(account: string | null = phoneAccount()): boolean {
  const kept = readKept();
  if (!kept) return false;
  if (account === null || kept.owner !== account || (owner !== undefined && owner !== account)) {
    writeKept(null);
    return false;
  }
  let any = false;
  for (const key of KEPT_KEYS) {
    if (store.has(key) || !(key in kept.items)) continue;
    const codec = codecs.get(key);
    if (!codec) continue;
    let value: unknown;
    try {
      value = codec.load(kept.items[key]);
    } catch {
      value = null;
    }
    if (value === null || value === undefined) continue;
    store.set(key, value);
    at.set(key, 0);
    any = true;
  }
  if (owner === undefined) owner = account;
  return any;
}

/** Tests only: an empty store that belongs to nobody yet. */
export function resetHeld(): void {
  store.clear();
  at.clear();
  flying.clear();
  unsaved.clear();
  tabToTab = false;
  epoch = 0;
  owner = undefined;
}
