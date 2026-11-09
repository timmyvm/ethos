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

/**
 * The offset (in Date.getTimezoneOffset() terms, UTC+10 is -600) the IANA
 * zone `tz` has at `now`; null for a zone this runtime does not know.
 * The cron reads this rather than the offset stored at arming, which a
 * daylight-saving change leaves an hour wrong (migration 0019).
 */
export function tzOffsetAt(now: Date, tz: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(now);
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
    const whole = Math.floor(now.getTime() / 1000) * 1000;
    return Math.round((whole - asUtc) / 60_000);
  } catch {
    return null;
  }
}

/** A real IANA zone name, short enough to store; null otherwise. */
export function validZone(tz: unknown): string | null {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return null;
  return tzOffsetAt(new Date(), tz) === null ? null : tz;
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

/**
 * Start of the subscriber's local day in the zone `tz`, as a real UTC
 * instant, taken at the offset in force at that midnight rather than at
 * `now`. On the day a clock goes back (Melbourne 5 Apr, New York 1 Nov)
 * the morning ran an hour ahead of the evening, so the evening's offset
 * put midnight an hour late and missed a take at 00:30; on the day a
 * clock goes forward it put midnight an hour early and counted last
 * night's 23:30 as today. `off` is the offset at `now`; with no zone
 * (rows armed before 0019) it is all there is.
 */
export function localDayStartIn(now: Date, off: number, tz: string | null | undefined): Date {
  const guess = localDayStartUtc(now, off);
  if (!tz) return guess;
  const offMid = tzOffsetAt(guess, tz) ?? off;
  return new Date(guess.getTime() + (offMid - off) * 60_000);
}

/**
 * How long a push service may hold a reminder for a phone that is off or
 * out of signal (#430 review): until the earlier of the next quiet hour
 * and local midnight, never under a minute. web-push's own default is
 * four weeks, so a 6 pm reminder to a phone in flight mode arrived at
 * 2 am, or the next day after the person had practised, with yesterday's
 * topic. Seconds, from the offset at `now`.
 */
export function sendTtl(w: Pick<PushWindow, "tzOffset" | "quietFrom" | "quietTo">, now: Date): number {
  const local = localClock(now, w.tzOffset);
  const hour = local.getUTCHours();
  const intoDay = hour * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds();
  let end = 24;
  for (let h = hour + 1; h < 24; h++) {
    if (inQuietRange(h, w.quietFrom, w.quietTo)) {
      end = h;
      break;
    }
  }
  return Math.max(60, end * 3600 - intoDay);
}

/** Every reminder is one topic at the push service: a newer one replaces a stale one. */
export const PUSH_TOPIC = "ethos-daily";

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
 * How a late or dropped tick is made up (#430). The scheduler that called
 * this hourly ran it about four times a day (GitHub, 25 Oct to 9 Nov: 60
 * runs, gaps up to 10 h 40 m), and a three-hour window served 28 of 60
 * chosen hour-days in Melbourne. The window now runs from the chosen hour
 * until quiet hours begin, the same local day: a tick that comes late
 * still finds a day nobody has practised in, and nothing rings once quiet
 * hours start, nor the next morning about last night. A reliable hourly
 * caller (pg_cron at minute 1, supabase/migrations/0027_push_tick.sql)
 * serves every hour at HH:01; the window is the backstop for when it misses.
 *
 * A reminder that comes late does not name the hour (`onTime`): "Your
 * 12 pm practice" at 6 pm is not the plan the person made.
 */
export const ON_TIME_HOURS = 2;

/**
 * Should this tick send to this subscription?
 * `didToday` is the #143 check, answered by the database.
 */
export function shouldSend(
  w: PushWindow,
  didToday: boolean,
  now: Date
): boolean {
  const hour = localClock(now, w.tzOffset).getUTCHours();
  // The chosen hour or later, the same local day (hour is 0-23, so the
  // window never wraps into tomorrow).
  if (hour < w.reminderHour) return false;
  // Every hour from the chosen one to now is outside quiet hours: a
  // quiet-hours choice never sends, and a catch-up stops at the first
  // quiet hour after the chosen one and never resumes that day.
  for (let h = w.reminderHour; h <= hour; h++) {
    if (inQuietRange(h, w.quietFrom, w.quietTo)) return false;
  }
  if (didToday) return false;
  // One send per local day, whatever the scheduler does (the cron also
  // claims the day in the database before it sends, so two callers in
  // the same minute cannot both ring).
  if (w.lastSentOn === localDayKey(now, w.tzOffset)) return false;
  return true;
}

/** True while a send is close enough to the chosen hour to name it. */
export function onTime(w: Pick<PushWindow, "reminderHour" | "tzOffset">, now: Date): boolean {
  const hour = localClock(now, w.tzOffset).getUTCHours();
  return hour >= w.reminderHour && hour - w.reminderHour < ON_TIME_HOURS;
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
