"use client";

import { useEffect } from "react";
import { flushOutbox as flush } from "@/lib/outbox-flush";

/**
 * Mounts the quiet half of the outbox (lib/outbox-flush.ts): on app load
 * and on every return to the network, re-send any recording the server
 * never confirmed.
 */

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
