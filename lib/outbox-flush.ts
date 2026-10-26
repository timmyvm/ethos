/**
 * The quiet half of the outbox (lib/rep-outbox.ts): on app load and on
 * every return to the network, re-send any recording the server never
 * confirmed. No UI: the recording screen already told the user their
 * recording was safe, and this is that promise being kept. Results land
 * in the account (stored rep, streak, coins), not on screen. Mounted by
 * components/OutboxRetry.tsx.
 *
 * A recording younger than 20s is skipped: it belongs to a live upload
 * on the recording screen, not to the resume path.
 */

import { currentSession, ensureSession } from "./supabase-browser";
import {
  clearInFlight,
  isInFlight,
  markInFlight,
  outboxAll,
  outboxDelete,
  isFinalReject,
  outboxPut,
  ownedBy,
  replayForm,
  sendWithRetry,
} from "./rep-outbox";

const MIN_AGE_MS = 20_000;
/** A recording that failed waits this long before its next try. */
const RETRY_AFTER_MS = 3_600_000;
/** A recording still failing after this many tries and this long is let go. */
const GIVE_UP_ATTEMPTS = 5;
const GIVE_UP_AGE_MS = 7 * 86_400_000;

export async function flushOutbox(): Promise<void> {
  const reps = await outboxAll();
  const due = reps.filter(
    (r) => !isInFlight(r.id) && Date.now() - r.createdAt > MIN_AGE_MS
  );
  if (due.length === 0) return;
  // A flush is never a reason to create a user: after a sign-out it
  // would mint a throwaway and file the account's recording under it.
  const me = await currentSession();
  const mine = ownedBy(due, me?.userId ?? null);
  if (mine.length === 0) return;
  // Without a session, only recordings made with no session at all are
  // here; this device's session, made now, is the only owner they had.
  const token = me ? me.token : await ensureSession();
  for (const rep of mine) {
    if (isInFlight(rep.id)) continue;
    // Tried within the hour and failed: its turn comes on a later visit.
    if (rep.lastTriedAt && Date.now() - rep.lastTriedAt < RETRY_AFTER_MS) continue;
    markInFlight(rep.id);
    try {
      // One send. The ladder of four belongs to the recording screen,
      // where someone is waiting; here every try spends a rate-limit
      // slot, and the next visit is the retry.
      const outcome = await sendWithRetry(replayForm(rep), token, undefined, 1);
      if (outcome.ok && outcome.settled) {
        await outboxDelete(rep.id);
        continue;
      }
      // The server will never take this file: let it go, and move on.
      if (isFinalReject(outcome.status)) {
        await outboxDelete(rep.id);
        continue;
      }
      // Offline, rate-limited or scoring switched off: every recording
      // behind this one would get the same answer. Stop for now.
      if (outcome.status === 0 || outcome.status === 429 || outcome.status === 503) break;
      // Anything else (a 5xx, or stored-but-unconfirmed) is this
      // recording's own trouble: note the try and move on to the next,
      // so one bad recording never holds the rest back.
      const attempts = (rep.attempts ?? 0) + 1;
      if (attempts >= GIVE_UP_ATTEMPTS && Date.now() - rep.createdAt > GIVE_UP_AGE_MS) {
        await outboxDelete(rep.id);
      } else {
        await outboxPut({ ...rep, attempts, lastTriedAt: Date.now() });
      }
    } finally {
      clearInFlight(rep.id);
    }
  }
}
