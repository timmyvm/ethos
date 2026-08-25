"use client";

import { useEffect } from "react";
import { ensureSession } from "@/lib/supabase-browser";
import {
  clearInFlight,
  isInFlight,
  markInFlight,
  outboxAll,
  outboxDelete,
  replayForm,
  sendWithRetry,
} from "@/lib/rep-outbox";

/**
 * Quiet half of the outbox (lib/rep-outbox.ts): on app load and on
 * every return to the network, re-send any recording the server never
 * confirmed. No UI — the recording screen already told the user their
 * recording was safe, and this is that promise being kept. Results
 * land in the account (stored rep, streak, coins), not on screen.
 *
 * A recording younger than 20s is skipped: it belongs to a live upload
 * on the recording screen, not to the resume path.
 */
const MIN_AGE_MS = 20_000;

async function flush(): Promise<void> {
  const reps = await outboxAll();
  const due = reps.filter(
    (r) => !isInFlight(r.id) && Date.now() - r.createdAt > MIN_AGE_MS
  );
  if (due.length === 0) return;
  const token = await ensureSession();
  for (const rep of due) {
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

/** One tab flushes at a time; the others simply skip their turn. */
function flushLocked(): void {
  const locks = (
    navigator as Navigator & {
      locks?: {
        request: (
          name: string,
          opts: { ifAvailable: boolean },
          cb: (lock: unknown) => Promise<void>
        ) => Promise<void>;
      };
    }
  ).locks;
  if (locks) {
    void locks
      .request("ethos-outbox-flush", { ifAvailable: true }, async (lock) => {
        if (lock) await flush();
      })
      .catch(() => {});
  } else {
    void flush().catch(() => {});
  }
}

export function OutboxRetry() {
  useEffect(() => {
    // Let the page settle first; an unsent recording has already waited
    // hours, three more seconds cost nothing.
    const t = setTimeout(flushLocked, 3_000);
    const onOnline = () => flushLocked();
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  return null;
}
