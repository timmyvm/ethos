/**
 * The monthly price drop's memory (docs/ladder-spec.md, surface 5): the
 * last ladder month this device celebrated, under `ethos.ladder.seen`.
 *
 * lib/plan-view.ts `dropDecision` says whether a month is a drop and
 * what to remember; this file is the remembering. Storage can be
 * missing, full, or blocked (a private window), so every read and write
 * sits in try/catch, and a store that cannot be read reads as first
 * sight: stored silently, never celebrated. Today and You both ask, and
 * the stored month keeps the moment to once per new month.
 */
import { CHECKOUT_SEEN_MONTH, LADDER_SEEN_KEY, dropDecision, parseSeen, type PlanView } from "./plan-view";

/** The two calls this file makes on storage, so a test can stand in for it. */
export interface SeenStore {
  get(): string | null;
  set(value: string): void;
}

/** This device's localStorage, every touch guarded. */
export const browserSeenStore: SeenStore = {
  get() {
    try {
      return window.localStorage.getItem(LADDER_SEEN_KEY);
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      window.localStorage.setItem(LADDER_SEEN_KEY, value);
    } catch {
      // Full or blocked: the moment may come again, which is the lesser fault.
    }
  },
};

/** The last month seen, or null for first sight (or a store that cannot be read). */
export function readSeen(store: SeenStore = browserSeenStore): number | null {
  try {
    return parseSeen(store.get());
  } catch {
    return null;
  }
}

export function writeSeen(month: number, store: SeenStore = browserSeenStore): void {
  if (!Number.isInteger(month) || month < 0) return;
  try {
    store.set(String(month));
  } catch {
    // As above.
  }
}

/**
 * Decide once and remember: when this view is a new month whose price
 * fell since this device last looked, the month it last saw (the sheet
 * rolls from that month's price, read here before the new month is
 * written over it); otherwise null. First sight, a month that went down
 * (a new plan) and a month past the floor are stored without a word.
 * Call it once per landed view; a second call for the same month
 * answers null, because the first one stored it.
 */
export function takeDrop(view: PlanView, store: SeenStore = browserSeenStore): number | null {
  const d = dropDecision(view, readSeen(store));
  if (d.store !== null) writeSeen(d.store, store);
  return d.show ? d.from : null;
}

/** The checkout return's first step is never a drop: remember month 1. */
export function markCheckoutSeen(store: SeenStore = browserSeenStore): void {
  writeSeen(CHECKOUT_SEEN_MONTH, store);
}
