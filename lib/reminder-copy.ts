/**
 * The words a reminder says (#430). One a day, at the hour the person
 * chose, echoing their own plan and one number from their own last take
 * (docs/growth/07-lifecycle.md §1: push echoes the user's plan at their
 * hour, nothing else). No streak to keep, no deadline, no day-two pep:
 * closure.md §4 is against open loops across days, and "keeps it" was a
 * loss frame the measurement does not need. Every line traces to the
 * hour they picked or a number they spoke (CLAUDE.md).
 *
 * Pure, so the cron route, the phone's local tiers and the service
 * worker's fallback say the same thing.
 */

/** The last take worth quoting: long enough to have been a real one. */
export interface LastTake {
  fillers: number;
  seconds: number;
}

/** A take shorter than this is not quoted back (it was a false start). */
export const QUOTE_MIN_SECONDS = 30;

/** The line when there is no take to quote; also sw.js's fallback body. */
export const FIRST_BODY = "It takes about a minute.";
/** The title of a reminder that came late, or has no hour to name. */
export const LATE_TITLE = "Today's practice";

/**
 * "6 pm", "12 pm", "12 am": the hour as Ethos's testers' phones say it.
 * The server cannot know the phone's locale; the app's own screens say it
 * the device's way (lib/time-label.ts).
 */
export function hourWords(h: number): string {
  const hh = ((Math.trunc(h) % 24) + 24) % 24;
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve} ${hh < 12 ? "am" : "pm"}`;
}

/** The newest take long enough to quote, from rows newest first. */
export function lastTake(rows: { filler_count?: number | null; duration_s?: number | string | null }[]): LastTake | null {
  for (const r of rows) {
    if (r.duration_s == null || r.filler_count == null) continue;
    const seconds = Math.round(Number(r.duration_s));
    const fillers = Number(r.filler_count);
    if (!Number.isFinite(seconds) || !Number.isFinite(fillers)) continue;
    if (seconds < QUOTE_MIN_SECONDS) continue;
    return { fillers: Math.max(0, Math.round(fillers)), seconds };
  }
  return null;
}

/** "Last time: 4 fillers in 62 seconds." or the first-time line. */
export function takeLine(last: LastTake | null): string {
  if (!last) return FIRST_BODY;
  const f = last.fillers === 1 ? "1 filler" : `${last.fillers} fillers`;
  return `Last time: ${f} in ${last.seconds} seconds.`;
}

/**
 * The notification: its title names the hour they chose while the send
 * is on time, and the body is their last take's numbers.
 */
export function reminderCopy(p: { hour: number | null; onTime: boolean; last: LastTake | null }): {
  title: string;
  body: string;
} {
  return {
    title: p.hour !== null && p.onTime ? `Your ${hourWords(p.hour)} practice` : LATE_TITLE,
    body: takeLine(p.last),
  };
}
