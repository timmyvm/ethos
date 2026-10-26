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
  ownedBy,
  replayForm,
  sendWithRetry,
} from "./rep-outbox";

const MIN_AGE_MS = 20_000;

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
    markInFlight(rep.id);
    try {
      const outcome = await sendWithRetry(replayForm(rep), token);
      if (outcome.ok && outcome.settled) await outboxDelete(rep.id);
      // A 4xx verdict other than "stored" means this recording will
      // never be accepted (too large, rate-limited for now…). Keep it:
      // rate limits pass, and keeping is the whole point of the outbox.
      if (!outcome.ok) break;
    } finally {
      clearInFlight(rep.id);
    }
  }
}
