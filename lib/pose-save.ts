/**
 * Wearing a pose, from this device to the account.
 *
 * The account's `equipped_pose` is the truth, because it follows you to
 * a new phone (#175), and every screen that reads it lets it win over
 * the device's copy. That is right only once this device's own save has
 * landed. The Shop saves in the background, two trips, and You read the
 * account on open: wear a pose and go straight to You, and the account's
 * old answer drew hello over the new pose and wrote it over the device's
 * copy. So a save marks itself pending on the device (`ethos.pose.pending`:
 * the pose and when), and until it lands or the mark runs out, a screen
 * that reads the account keeps the device's pose.
 *
 * The mark runs out after 30s, longer than both tries of a save can take,
 * so a page closed mid-save never holds the account's answer off for
 * longer than that.
 */

import { readPrefs, writePrefs } from "./prefs";

export const PENDING_KEY = "ethos.pose.pending";
/** How long a pending save holds the account's answer off. */
export const PENDING_MS = 30_000;
/** One try's ceiling: two tries and the pause between fit inside the mark. */
const TRY_MS = 12_000;
const RETRY_MS = 1_500;

export interface PendingPose {
  pose: string | null;
  at: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function forget(): void {
  try {
    storage()?.removeItem(PENDING_KEY);
  } catch {}
}

/** This device's save still in flight, or null when none is (or its mark ran out). */
export function readPendingPose(now = Date.now()): PendingPose | null {
  let mark: unknown;
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    if (!raw) return null;
    mark = JSON.parse(raw);
  } catch {
    forget();
    return null;
  }
  const { pose, at } = (mark ?? {}) as Partial<PendingPose>;
  const age = now - (at ?? NaN);
  if ((pose !== null && typeof pose !== "string") || !(age >= 0 && age < PENDING_MS)) {
    forget();
    return null;
  }
  return { pose, at: at! };
}

/** Clears the mark only if it is still this save's: a later pose has its own. */
function settle(mark: PendingPose): void {
  try {
    if (storage()?.getItem(PENDING_KEY) === JSON.stringify(mark)) forget();
  } catch {}
}

/**
 * The pose to draw once the account answers. Its answer wins, and the
 * device's copy follows so the next first paint is right, unless a save
 * from this device has not landed yet: then the device's pose stands.
 */
export function adoptAccountPose(account: string | null, now = Date.now()): string | null {
  const pending = readPendingPose(now);
  if (pending) return pending.pose;
  if (readPrefs().pose !== account) writePrefs({ pose: account });
  return account;
}

function within<T>(work: Promise<T>, ms: number): Promise<T | false> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bell = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([work, bell]).finally(() => clearTimeout(timer));
}

/* One save at a time, in the order they were worn, so a pose taken off
   and put back on never lands as off. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Wear a pose: on this device at once, marked pending, then saved to the
 * account. A failed save tries once more; if that fails too the mark goes,
 * and the account's answer wins on the next read. Resolves true when the
 * account has it.
 */
export function wearPose(
  pose: string | null,
  save: (pose: string | null) => Promise<boolean>,
  {
    now = Date.now,
    retryMs = RETRY_MS,
    timeoutMs = TRY_MS,
  }: { now?: () => number; retryMs?: number; timeoutMs?: number } = {}
): Promise<boolean> {
  writePrefs({ pose });
  const mark: PendingPose = { pose, at: now() };
  try {
    storage()?.setItem(PENDING_KEY, JSON.stringify(mark));
  } catch {}
  const run = queue.then(async () => {
    for (let tries = 0; tries < 2; tries++) {
      if (tries > 0) await new Promise((r) => setTimeout(r, retryMs));
      const ok = await within(save(pose).catch(() => false), timeoutMs);
      if (ok) {
        settle(mark);
        return true;
      }
    }
    settle(mark);
    return false;
  });
  queue = run.catch(() => {});
  return run;
}
