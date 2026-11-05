/**
 * The open's read of a tester's row could not be answered: no
 * connection (a train, a lift), or no session it could refresh without
 * one. Nothing else reads it again in that page life, which on a
 * home-screen iPhone can last days, so components/tester/TesterLayer.tsx
 * reads it again once the phone is likely back: the connection returns,
 * the app is shown again, or a wait passes, whichever comes first.
 */

/** The waits between reads, the last one repeating. */
export const READ_AGAIN_MS = [15_000, 30_000, 60_000, 120_000, 300_000] as const;

/** The wait after the `misses`th read in a row that could not be answered (1 for the first). */
export function readAgainAfter(misses: number): number {
  return READ_AGAIN_MS[Math.min(Math.max(misses, 1), READ_AGAIN_MS.length) - 1];
}

/** Calls `again` once, at the first sign the phone is back. Returns the cancel. */
export function readAgainWhenBack(misses: number, again: () => void): () => void {
  let done = false;
  const visible = () => {
    if (document.visibilityState === "visible") fire();
  };
  const timer = setTimeout(fire, readAgainAfter(misses));
  window.addEventListener("online", fire);
  document.addEventListener("visibilitychange", visible);
  function cancel() {
    done = true;
    clearTimeout(timer);
    window.removeEventListener("online", fire);
    document.removeEventListener("visibilitychange", visible);
  }
  function fire() {
    if (done) return;
    cancel();
    again();
  }
  return cancel;
}
