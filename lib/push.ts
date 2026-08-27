/**
 * Web push — the pure half (DECISIONS #186).
 *
 * The browser-scheduled reminder tiers (lib/reminders.ts) die outside
 * Chromium; a server-sent push is the reminder that actually rings on a
 * phone. The server can't read localStorage, so each subscription row
 * carries what the decision needs: the chosen hour, the device's UTC
 * offset, and its quiet hours. Everything here is pure and tested; the
 * cron route is arithmetic over these plus one DB read (#143: a day
 * whose practice is done is never nagged about).
 */

/** What the cron knows about one subscription. */
export interface PushWindow {
  /** Local hour 0–23 the user chose. */
  reminderHour: number;
  /** Minutes, as Date.getTimezoneOffset() reports (UTC+10 → -600). */
  tzOffset: number;
  quietFrom: number;
  quietTo: number;
  /** Their local calendar date a send last happened, "YYYY-MM-DD". */
  lastSentOn: string | null;
}

/** The instant shifted into the subscriber's local clock. */
export function localClock(now: Date, tzOffset: number): Date {
  return new Date(now.getTime() - tzOffset * 60_000);
}

/** The subscriber's local calendar date, keyed "YYYY-MM-DD". */
export function localDayKey(now: Date, tzOffset: number): string {
  return localClock(now, tzOffset).toISOString().slice(0, 10);
}

/** Start of the subscriber's local day, as a real UTC instant. */
export function localDayStartUtc(now: Date, tzOffset: number): Date {
  const local = localClock(now, tzOffset);
  const dayStart = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  );
  return new Date(dayStart + tzOffset * 60_000);
}

/** mechanics.md quiet hours, on a bare range instead of device prefs. */
export function inQuietRange(
  hour: number,
  quietFrom: number,
  quietTo: number
): boolean {
  if (quietFrom === quietTo) return false;
  return quietFrom < quietTo
    ? hour >= quietFrom && hour < quietTo
    : hour >= quietFrom || hour < quietTo;
}

/**
 * Should this hourly cron tick send to this subscription?
 * `didToday` is the #143 check, answered by the database.
 */
export function shouldSend(
  w: PushWindow,
  didToday: boolean,
  now: Date
): boolean {
  const hour = localClock(now, w.tzOffset).getUTCHours();
  if (hour !== w.reminderHour) return false;
  if (inQuietRange(w.reminderHour, w.quietFrom, w.quietTo)) return false;
  if (didToday) return false;
  // One send per local day, whatever the scheduler does.
  if (w.lastSentOn === localDayKey(now, w.tzOffset)) return false;
  return true;
}

/**
 * Current streak in the subscriber's local calendar, from rep instants.
 * Enough for the notification body; the app's own streak math stays the
 * authority everywhere a screen shows a number.
 */
export function localStreak(repDates: Date[], tzOffset: number, now: Date): number {
  const days = new Set(repDates.map((d) => localDayKey(d, tzOffset)));
  let streak = 0;
  // Today counts if practiced; an unpracticed today doesn't break yet.
  const cursor = localClock(now, tzOffset);
  if (days.has(cursor.toISOString().slice(0, 10))) streak++;
  for (;;) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) break;
    streak++;
  }
  return streak;
}
