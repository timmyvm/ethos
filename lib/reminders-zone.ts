/**
 * The zone this phone's reminders follow on the server, read without a
 * request. lib/reminders.ts keeps, under `PUSH_ACK_KEY`, what the server
 * last acknowledged holding for this device (its push endpoint and hour,
 * and the zone it was sent with); the report on testers counts a
 * tester's days in that zone (tester_admin.zones, 0020), so Today's test
 * tile counts them there too (#402, lib/tester-days.ts `testZone`).
 *
 * A plain module, with no browser import at the top, so the head's boot
 * script (lib/tester-boot.ts) can be built from the same key.
 */

export const PUSH_ACK_KEY = "ethos.push.ack";

/** The phone's own zone, as lib/reminders.ts sends it with a subscription. */
export function deviceZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The zone the server holds this phone's reminders in, or null when it
 * holds none for this phone. An acknowledgement written before it kept
 * the zone stands for the phone's own, which is what was sent.
 */
export function remindersZone(): string | null {
  try {
    const ack = JSON.parse(localStorage.getItem(PUSH_ACK_KEY) ?? "null") as { tz?: unknown } | null;
    if (!ack) return null;
    return (typeof ack.tz === "string" && ack.tz) || deviceZone() || null;
  } catch {
    return null;
  }
}
