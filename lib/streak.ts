/**
 * Streak math — pure, computed from rep dates (one source of truth: the
 * reps table) plus any days a freeze rescued. A day counts once; today
 * keeps the streak alive even before today's rep (it shows as "at risk",
 * not broken, until midnight).
 *
 * A freeze BRIDGES a gap, it never adds to the count (DECISIONS #14: no
 * pay-to-win — convenience, never truth). Miss Tuesday with a freeze
 * equipped and Monday–Wednesday reads as a 2-day streak that survived,
 * not a 3-day streak you didn't do.
 */

/** Three equipped, maximum (27 Aug, Timothy's call — raised from #14's
 *  two; the cap exists so infinite freezes can't kill the loss aversion
 *  that makes streaks work, and three still can't bridge a real absence). */
export const MAX_EQUIPPED_FREEZES = 3;

export interface StreakState {
  current: number;
  longest: number;
  /** True when today's rep hasn't happened yet and the streak is alive. */
  atRisk: boolean;
  didToday: boolean;
  /** Days inside the current run that a freeze carried. */
  frozenInRun: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000
  );
}

interface CoveredDay {
  date: Date;
  rep: boolean;
}

/** Unique local days covered by a rep or a freeze, ascending. */
function coveredDays(repDates: Date[], frozenDays: Date[]): CoveredDay[] {
  const map = new Map<string, CoveredDay>();
  for (const d of frozenDays) {
    map.set(dayKey(d), { date: startOfDay(d), rep: false });
  }
  for (const d of repDates) {
    map.set(dayKey(d), { date: startOfDay(d), rep: true });
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function computeStreak(
  repDates: Date[],
  now = new Date(),
  frozenDays: Date[] = []
): StreakState {
  const days = coveredDays(repDates, frozenDays);
  if (days.length === 0 || repDates.length === 0) {
    return {
      current: 0,
      longest: 0,
      atRisk: false,
      didToday: false,
      frozenInRun: 0,
    };
  }

  // Longest run of consecutive covered days, counted in REP days only.
  let longest = days[0].rep ? 1 : 0;
  let run = longest;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1].date, days[i].date) === 1) {
      run += days[i].rep ? 1 : 0;
    } else {
      run = days[i].rep ? 1 : 0;
    }
    if (run > longest) longest = run;
  }

  const last = days[days.length - 1];
  const gap = daysBetween(last.date, now);
  const didToday = repDates.some((d) => daysBetween(d, now) === 0);

  let current = 0;
  let frozenInRun = 0;
  if (gap <= 1) {
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].rep) current++;
      else frozenInRun++;
      if (i === 0 || daysBetween(days[i - 1].date, days[i].date) !== 1) break;
    }
  }

  return {
    current,
    longest,
    atRisk: current > 0 && !didToday,
    didToday,
    frozenInRun,
  };
}

/**
 * Which missed days a freeze could still rescue right now.
 *
 * Only the gap between the last covered day and today is rescuable —
 * you can't reach back and repair a streak you already lost, and today
 * isn't missed until midnight. Returns [] when there's nothing to save
 * or not enough freezes to cover the whole gap: a half-bridged gap is
 * still a broken streak, so spending on it would be theft.
 */
export function rescuableDays(
  repDates: Date[],
  frozenDays: Date[],
  freezesAvailable: number,
  now = new Date()
): Date[] {
  if (freezesAvailable <= 0) return [];
  const days = coveredDays(repDates, frozenDays);
  if (days.length === 0) return [];

  const last = days[days.length - 1].date;
  const gap = daysBetween(last, now);
  // gap 0 = did today, gap 1 = yesterday covered and today still open.
  if (gap <= 1) return [];

  const missed: Date[] = [];
  for (let i = 1; i < gap; i++) {
    const d = startOfDay(last);
    d.setDate(d.getDate() + i);
    missed.push(d);
  }
  return missed.length <= freezesAvailable ? missed : [];
}

/* ---- One missed day, kept by speaking twice (closure.md row 14) -------- */

/**
 * The first day the repair can keep. It must equal the day this ships to
 * main: no day before it is ever kept, so the deploy moves nobody's
 * current, longest, freezes or badges. The integrator and Timothy's push
 * move it to the day it lands.
 */
export const REPAIR_FROM = "2026-11-28";

/** Recordings of 20+ words the day after the miss asks for. */
export const REPAIR_TAKES = 2;
/** The runs it keeps: 2 to 6 spoken days. From 7 a run earns freezes (#174). */
export const REPAIR_RUN = { min: 2, max: 6 } as const;
/** Kept at most once in this many days. */
export const REPAIR_SPACING_DAYS = 7;

/**
 * A recording as the repair reads it: its time, and whether its words
 * made a real answer (`reps.scorable`, migration 0037, written by the
 * server from the stored transcript: 20 words or more). Absent when the
 * database has no column, which keeps nothing; null on a row the server
 * never filled, which counts for nothing. Never `stars`: before 0035 a
 * 0-star take was stored as 1.
 */
export interface RepairTake {
  created_at: string;
  scorable?: boolean | null;
}

/** The repair still open today: the run it would keep, the day missed, and the takes of 20+ words so far. */
export interface RepairState {
  run: number;
  missed: Date;
  counted: 0 | 1;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** "2026-11-28" as the phone's own midnight that day. */
function localDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whether the reads carried the column at all: a database before 0037 keeps nothing. */
function readsScorable(takes: RepairTake[]): boolean {
  return takes.some((t) => t.scorable !== undefined);
}

/** The phone's days spoken, and how many takes of 20+ words each holds. */
function spokenDays(takes: RepairTake[]): { spoken: Map<string, Date>; scored: Map<string, number> } {
  const spoken = new Map<string, Date>();
  const scored = new Map<string, number>();
  for (const t of takes) {
    const at = new Date(t.created_at);
    if (Number.isNaN(at.getTime())) continue;
    const k = dayKey(at);
    spoken.set(k, startOfDay(at));
    if (t.scorable === true) scored.set(k, (scored.get(k) ?? 0) + 1);
  }
  return { spoken, scored };
}

/**
 * The run that ended on `day`, counted as computeStreak counts it: spoken
 * days only, a frozen or kept day bridging and adding nothing. Stops once
 * it is past the longest run the repair keeps.
 */
function runEnding(day: Date, spoken: Map<string, Date>, bridges: Set<string>): number {
  let count = 0;
  for (let d = day; ; d = addDays(d, -1)) {
    const k = dayKey(d);
    if (spoken.has(k)) count++;
    else if (!bridges.has(k)) return count;
    if (count > REPAIR_RUN.max) return count;
  }
}

/**
 * The missed days two recordings kept (closure.md row 14, built narrow so
 * #174 stands). A day D with no recording and no freeze is kept when the
 * day before it and the day after it were both spoken (a one-day gap),
 * the run ending the day before was 2 to 6 spoken days, the day after
 * holds two takes stored as scorable (20+ words; a capped fourth take is
 * one), no other day was kept in the 7 days before D, and D is on or
 * after `from`, the day this shipped. Days are the phone's, as
 * computeStreak counts them. Derived on every read and never stored, like
 * freezeBalance; a kept day bridges as a freeze does (#14, #38): it adds
 * nothing to current or longest and pays no coin and no XP. The run it
 * bridges earns freezes as any run does (lib/freeze-sync.ts), since the
 * line under Record counts the freeze from the streak it shows; a kept
 * day is never a freeze spent.
 */
export function keptDays(
  takes: RepairTake[],
  frozenDays: Date[],
  now: Date = new Date(),
  from: string = REPAIR_FROM
): Date[] {
  if (!readsScorable(takes)) return [];
  const floor = localDay(from);
  const today = startOfDay(now);
  const { spoken, scored } = spokenDays(takes);
  const frozen = new Set(frozenDays.map(dayKey));
  const bridges = new Set(frozen);
  const days = [...spoken.values()].sort((a, b) => a.getTime() - b.getTime());
  const kept: Date[] = [];
  for (let i = 1; i < days.length; i++) {
    const before = days[i - 1];
    const after = days[i];
    if (daysBetween(before, after) !== 2 || after.getTime() > today.getTime()) continue;
    const missed = addDays(before, 1);
    if (missed.getTime() < floor.getTime() || frozen.has(dayKey(missed))) continue;
    if ((scored.get(dayKey(after)) ?? 0) < REPAIR_TAKES) continue;
    const last = kept[kept.length - 1];
    if (last && daysBetween(last, missed) <= REPAIR_SPACING_DAYS) continue;
    const run = runEnding(before, spoken, bridges);
    if (run < REPAIR_RUN.min || run > REPAIR_RUN.max) continue;
    kept.push(missed);
    bridges.add(dayKey(missed));
  }
  return kept;
}

/**
 * Today, the day after a miss the repair could still keep: the run it
 * keeps (the number the line under Record names), the missed day, and the
 * takes of 20+ words so far (0 or 1). Null on any other day, once the
 * second take has kept it, or when the reads carry no `scorable`.
 * `frozenDays` is the freeze sync's answer, so a held freeze has already
 * covered the day (#39) and there is nothing to repair.
 */
export function repairState(
  takes: RepairTake[],
  frozenDays: Date[],
  now: Date = new Date(),
  from: string = REPAIR_FROM
): RepairState | null {
  if (!readsScorable(takes)) return null;
  const today = startOfDay(now);
  const missed = addDays(today, -1);
  const before = addDays(today, -2);
  if (missed.getTime() < localDay(from).getTime()) return null;
  const { spoken, scored } = spokenDays(takes.filter((t) => new Date(t.created_at).getTime() <= now.getTime()));
  const frozen = new Set(frozenDays.map(dayKey));
  if (spoken.has(dayKey(missed)) || frozen.has(dayKey(missed)) || !spoken.has(dayKey(before))) return null;
  const counted = scored.get(dayKey(today)) ?? 0;
  if (counted >= REPAIR_TAKES) return null;
  const kept = keptDays(takes, frozenDays, now, from);
  const last = kept[kept.length - 1];
  if (last && daysBetween(last, missed) <= REPAIR_SPACING_DAYS) return null;
  const run = runEnding(before, spoken, new Set([...frozen, ...kept.map(dayKey)]));
  if (run < REPAIR_RUN.min || run > REPAIR_RUN.max) return null;
  return { run, missed, counted: counted === 0 ? 0 : 1 };
}

/**
 * The repair as the glance draws it the moment a take lands, before the
 * stored rows are read back (DESIGN principle 8: the tap is live and
 * final from the first frame). The take counts when it is stored and
 * scorable, as the server stores it; the read that follows is the truth
 * every later screen uses. Null once the take closes it, and for a take
 * that landed past midnight, when the repair's day is over.
 */
export function repairAfterTake(
  before: RepairState | null,
  take: { scorable: boolean; stored: boolean; at: Date }
): RepairState | null {
  if (!before || daysBetween(before.missed, take.at) !== 1) return null;
  if (!take.scorable || !take.stored) return before;
  return before.counted === 0 ? { ...before, counted: 1 } : null;
}

/**
 * Freezes are EARNED, not bought (non-negotiable: money never buys
 * streaks). One per completed week of the longest streak, capped at the
 * two you're allowed to equip.
 */
export function freezesEarned(longestStreak: number): number {
  return Math.min(MAX_EQUIPPED_FREEZES, Math.floor(longestStreak / 7));
}

/**
 * What should be sitting equipped right now: everything earned, minus
 * everything already spent, clamped to the cap. Derived rather than
 * incremented so a lost write or a second device can't double-grant.
 */
export function freezeBalance(
  longestStreak: number,
  spent: number,
  purchased = 0
): number {
  // Purchased freezes join the derivation rather than incrementing a
  // counter, for the same reason the earned ones do: re-running has to
  // be a no-op, and a bought freeze would otherwise be wiped by the very
  // next sync.
  const earned = Math.floor(longestStreak / 7) + purchased;
  return Math.max(0, Math.min(MAX_EQUIPPED_FREEZES, earned - spent));
}
