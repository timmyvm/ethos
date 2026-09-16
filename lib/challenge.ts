/**
 * The daily challenge (DECISIONS #281).
 *
 * `docs/closure.md` designed this and then never built it: §5 rows 2, 6,
 * 7, 8, 9 and 17 specify it, `components/Ring.tsx` has reserved the
 * `open` tone for it since #252, and no caller ever passed that tone.
 *
 * WHAT IT IS. One number, in the trait's own unit, on the trait the app
 * already says is your weakest: beat 3.4 um or uh per hundred words
 * today. Not a rank, not a comparison with anybody else, and no
 * percentile on the card. The line is always one of YOUR OWN recent
 * numbers.
 *
 * WHERE THE DOCUMENT CONTRADICTS ITSELF, AND WHAT SHIPPED. Row 9 says
 * the target comes from the user's trailing seven days and must be able
 * to go DOWN. Row 8 says it has to be closeable by an ordinary person on
 * an ordinary day, with a 70% floor. The doc's own worked example, "your
 * own last-week median", satisfies the first and breaks the second: a
 * median is missed half the time by construction. §6's reject list is
 * unambiguous about the cost of that. Wang et al., 95,532 loyalty
 * members, randomised: 80% missed a target set to be impressive, and
 * failure depressed their behaviour for EIGHT MONTHS, worst among the
 * most committed.
 *
 * So the line is not the median. It is the value this person already
 * clears on about seven of every ten of their own recordings: the 30th
 * percentile of their own trailing values, by nearest rank. Still
 * self-referential, still moves in both directions, and sized by row 8's
 * floor rather than against it.
 *
 * IT IS FROZEN INSIDE A WEEK. The window is the seven days ENDING at
 * this week's Monday, so today's recording cannot move the line today's
 * recording is being measured against, and the line does not shift under
 * somebody mid-day.
 *
 * NEAREST RANK, NEVER INTERPOLATED. The line is always a number the
 * person actually produced, which is what lets the card say "you were
 * under it on five of your last seven" and have that be a fact. It also
 * means a quantile is defined at every n, where a median of two values
 * is an average of two values.
 *
 * WHAT IT READS. `readTraitsFromRow` and `created_at`, and nothing else.
 * Not the Index, not stars, not presence, not the XP multiplier. §5 row
 * 2 is "two channels, never merged", and this file is where that stops
 * being a promise: the challenge cannot blend with the outcome channel
 * because it cannot see it.
 */

import { NORMS } from "@/content/norms";
import type { TraitId } from "@/content/traits";
import type { RepRow } from "./client-data";
import { weekStart } from "./level";
import { choosePractice, standing } from "./next-practice";
import { fmtRaw, withUnit } from "./trait-readings";
import { readTraitsFromRow } from "./trait-readings";

/** The share of days the line is sized to be cleared on (§5 row 8). */
export const CLOSE_FLOOR = 0.7;
/** The quantile of your own week the line is drawn at. */
export const Q_START = 0.3;
export const Q_STEP = 0.1;
/** Never tighter than "eight in ten", never looser than your own median. */
export const Q_MIN = 0.2;
export const Q_MAX = 0.5;
export const WINDOW_DAYS = 7;
/**
 * Under three readings there is no distribution, and a line drawn from
 * two recordings is a line drawn from noise. No card until then: §6
 * rejects endowed progress, and a mechanic that explains itself before
 * it exists is a string COPY-RULES would cut.
 */
export const MIN_HISTORY = 3;
/** Days of the user's own history the dial reads before it moves. */
export const DIAL_WINDOW = 28;
export const DIAL_MIN_ACTIVE = 14;

export interface Challenge {
  trait: TraitId;
  /** The number to beat, in the trait's own unit. Always one of theirs. */
  line: number;
  direction: "lower" | "higher" | "band";
  /** 0 to 1, for the ring. Today against the line. */
  value: number;
  closed: boolean;
  /** Today's best reading on that trait, or null before today's recording. */
  today: number | null;
  /** Of the recordings the line was drawn from, how many cleared it. */
  cleared: { n: number; of: number };
  /** The Monday this line belongs to. It does not move inside a week. */
  week: string;
  /** The quantile that produced it. It moves, and it is instrumented. */
  q: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** The trait's raw value on one recording, or null if it has none. */
function rawFor(row: RepRow, trait: TraitId): number | null {
  const hit = readTraitsFromRow(row).find((r) => r.id === trait);
  return hit ? hit.raw : null;
}

/**
 * Today's BEST reading on a trait. Best-of rather than last, so a second
 * recording can only help, which is the only shape that never makes
 * speaking again a risk.
 */
export function readingToday(
  reps: RepRow[],
  trait: TraitId,
  now: Date
): number | null {
  const key = dayKey(now);
  let best: { raw: number; s: number } | null = null;
  for (const r of reps) {
    if (dayKey(new Date(r.created_at)) !== key) continue;
    const raw = rawFor(r, trait);
    if (raw === null) continue;
    const s = standing(trait, raw);
    if (!best || s > best.s) best = { raw, s };
  }
  return best ? best.raw : null;
}

/** The comparable values in the window, worst first. */
function windowValues(
  reps: RepRow[],
  trait: TraitId,
  week: Date
): { raw: number; s: number }[] {
  const from = new Date(week);
  from.setDate(from.getDate() - WINDOW_DAYS);
  return reps
    .filter((r) => {
      const t = new Date(r.created_at);
      return t >= from && t < week;
    })
    .map((r) => {
      const raw = rawFor(r, trait);
      return raw === null ? null : { raw, s: standing(trait, raw) };
    })
    .filter((v): v is { raw: number; s: number } => v !== null)
    .sort((a, b) => a.s - b.s);
}

/**
 * Whether a day closed, for the dial and for nothing the user sees.
 * Recomputed rather than logged: the decision is a pure function of the
 * stored recordings, so there is no counter to drift and the answer can
 * be asked about a day that happened before this file existed.
 */
function closedOn(reps: RepRow[], day: Date, q: number): boolean | null {
  const c = buildChallenge(reps, day, q);
  if (!c) return null;
  return c.today === null ? false : c.closed;
}

/** The user's own close rate, and how many days it had to look at. */
export function closeRate(
  reps: RepRow[],
  now: Date,
  days = DIAL_WINDOW,
  q = Q_START
): { closed: number; active: number; rate: number | null } {
  const seen = new Set<string>();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  for (const r of reps) {
    const t = new Date(r.created_at);
    if (t >= from && t <= now) seen.add(dayKey(t));
  }
  let closed = 0;
  for (const key of seen) {
    const [y, m, d] = key.split("-").map(Number);
    if (closedOn(reps, new Date(y, m - 1, d, 23, 59), q)) closed += 1;
  }
  const active = seen.size;
  return { closed, active, rate: active > 0 ? closed / active : null };
}

/**
 * The dial (§5 row 8's floor, in the only form that is buildable
 * without a server).
 *
 * Row 8 asks for a population close rate with an automatic lowering.
 * There is no dashboard, so this is the per-user half: a fortnight of
 * their own days under the floor loosens the line a step, a run well
 * above it tightens one, and it is clamped at both ends so a long bad
 * patch cannot loosen the line into meaninglessness. The population
 * half is a script and a commit, not a runtime.
 *
 * Evaluated at the same Monday boundary as the line, so it cannot
 * oscillate mid-week.
 */
export function openQuantile(reps: RepRow[], now: Date): number {
  const { rate, active } = closeRate(reps, now);
  if (active < DIAL_MIN_ACTIVE || rate === null) return Q_START;
  if (rate < CLOSE_FLOOR) return Math.min(Q_MAX, Q_START + Q_STEP);
  if (rate > 0.9) return Math.max(Q_MIN, Q_START - Q_STEP);
  return Q_START;
}

/**
 * The challenge, or null when there is not enough of the person's own
 * history to draw a line from honestly.
 */
export function buildChallenge(
  reps: RepRow[],
  now: Date = new Date(),
  q?: number
): Challenge | null {
  const last = reps[reps.length - 1];
  if (!last) return null;

  /* ONE SELECTOR. The same function the floor card reads, off the same
     row, so the card and the challenge can never name two traits
     (#268). */
  const chosen = choosePractice(readTraitsFromRow(last), now);
  if (!chosen) return null;
  const trait = chosen.trait;

  const week = weekStart(now);
  const rows = windowValues(reps, trait, week);
  if (rows.length < MIN_HISTORY) return null;

  const quantile = q ?? openQuantile(reps, now);
  const idx = Math.min(
    rows.length - 1,
    Math.max(0, Math.ceil(quantile * rows.length) - 1)
  );
  const line = rows[idx].raw;
  const lineS = rows[idx].s;

  const today = readingToday(reps, trait, now);
  const todayS = today === null ? null : standing(trait, today);

  return {
    trait,
    line,
    direction: NORMS[trait].direction,
    value: todayS === null ? 0 : clamp01(todayS / Math.max(lineS, 0.05)),
    closed: todayS !== null && todayS >= lineS,
    today,
    cleared: { n: rows.filter((r) => r.s >= lineS).length, of: rows.length },
    week: dayKey(week),
    q: quantile,
  };
}

/**
 * The card's two lines, here rather than in the component so they are
 * pure and the copy test can read them.
 *
 * The verb comes from the direction, because "under 3.2 fillers" and
 * "over 2.1 held pauses" are the same sentence about two traits and
 * getting one of them backwards is the kind of error nobody sees in
 * review.
 *
 * The caption is THE SAME on a day that closed and a day that did not.
 * On a miss that number is doing the attributing (§5 row 12): it says
 * "this is the kind of day you usually have" without saying it, and
 * without a second person anywhere in the sentence.
 */
const VERB: Record<Challenge["direction"], string> = {
  lower: "Under",
  higher: "Over",
  band: "Inside",
};

export function challengeLine(c: Challenge): string {
  const line = withUnit(c.trait, c.line);
  if (c.today === null) return `${VERB[c.direction]} ${line}.`;
  if (c.closed) {
    const today = fmtRaw(c.today);
    const target = fmtRaw(c.line);
    /*
     * A day that closes ON the line, or near enough that both numbers
     * print the same, cannot read "1.8 today, over 1.8": four words
     * that contradict each other (#287). Equality IS a close, because
     * `closed` is `todayS >= lineS`, so it is said as one.
     */
    if (today === target) return `${today} today, on the line.`;
    return `${today} today, ${VERB[c.direction].toLowerCase()} ${target}.`;
  }
  return `${fmtRaw(c.today)} today. The line is ${fmtRaw(c.line)}.`;
}

export function challengeFoot(c: Challenge): string {
  const { n, of } = c.cleared;
  return `You were ${VERB[c.direction].toLowerCase()} it on ${n} of your last ${of}.`;
}

/**
 * How many days closed, per week, for the ledger (#281).
 *
 * Derived from the recordings rather than logged, which is the same
 * property `lib/coin-sync.ts` and `lib/streak.ts` already rely on: a
 * dropped write, a second device or a rep that landed offline all heal
 * on the next load, and the question can be asked about a week that
 * happened before this code existed.
 */
export function closesByWeek(
  reps: RepRow[],
  now: Date = new Date()
): { week: string; closed: number }[] {
  const days = new Map<string, Date>();
  for (const r of reps) {
    const t = new Date(r.created_at);
    if (t > now) continue;
    days.set(dayKey(t), t);
  }
  const byWeek = new Map<string, number>();
  for (const [, t] of days) {
    const end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59);
    const c = buildChallenge(reps, end);
    if (!c) continue;
    byWeek.set(c.week, (byWeek.get(c.week) ?? 0) + (c.closed ? 1 : 0));
  }
  return [...byWeek.entries()]
    .map(([week, closed]) => ({ week, closed }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
