/**
 * Is the reminder clock alive (#430 review)? GitHub ran an hourly schedule
 * every 3 to 7 hours and nobody could see it, so a chosen hour went
 * unserved for days in silence. Every tick the sender lets in is noted
 * (app/api/push/cron `noteTick`: a rate_limits row under
 * `push-tick:<secret>:<caller>`), and /active draws what this module
 * makes of the last day: each caller's last tick and how many of the
 * last 24 hours it reached, and whether any tick came in the last hour.
 *
 * Pure: the route reads the rows, the tests feed them.
 */

import type { TickCaller, TickSecretName } from "./cron-auth";

export const TICK_PREFIX = "push-tick:";
/** How long a tick's note is kept. */
export const TICK_KEEP_HOURS = 48;
/** A clock that ticks at minute 1 is late after this many minutes. */
export const TICK_LATE_MINUTES = 65;

export function tickSubject(secret: TickSecretName, caller: TickCaller): string {
  return `${TICK_PREFIX}${secret}:${caller}`;
}

export interface ClockSource {
  secret: TickSecretName;
  caller: TickCaller;
  /** ISO time of its newest tick. */
  last: string;
  /** Of the last 24 whole hours (UTC), how many it ticked in. */
  hours: number;
}

export interface ClockView {
  /** Newest first; empty when nothing ticked in the last two days. */
  sources: ClockSource[];
  /** True when some tick came within the last 65 minutes. */
  alive: boolean;
}

const SECRETS: readonly string[] = ["CRON_SECRET", "PUSH_TICK_SECRET"];
const CALLERS: readonly string[] = ["database", "cron-job.org", "github", "other"];

export function clockView(rows: { subject: string; at: string }[], now: Date): ClockView {
  const dayAgo = now.getTime() - 24 * 3_600_000;
  const by = new Map<string, { secret: TickSecretName; caller: TickCaller; last: number; hours: Set<number> }>();
  for (const r of rows) {
    if (!r.subject.startsWith(TICK_PREFIX)) continue;
    const [secret, caller] = r.subject.slice(TICK_PREFIX.length).split(":");
    if (!SECRETS.includes(secret) || !CALLERS.includes(caller)) continue;
    const at = Date.parse(r.at);
    if (!Number.isFinite(at) || at > now.getTime() + 60_000) continue;
    const key = `${secret}:${caller}`;
    const s = by.get(key) ?? { secret: secret as TickSecretName, caller: caller as TickCaller, last: -Infinity, hours: new Set<number>() };
    s.last = Math.max(s.last, at);
    if (at > dayAgo) s.hours.add(Math.floor(at / 3_600_000));
    by.set(key, s);
  }
  const sources = [...by.values()]
    .sort((a, b) => b.last - a.last)
    .map((s) => ({ secret: s.secret, caller: s.caller, last: new Date(s.last).toISOString(), hours: Math.min(24, s.hours.size) }));
  const newest = sources.length ? Date.parse(sources[0].last) : -Infinity;
  return { sources, alive: now.getTime() - newest <= TICK_LATE_MINUTES * 60_000 };
}
