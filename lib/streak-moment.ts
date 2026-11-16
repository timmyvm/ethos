/**
 * The streak's moment (DECISIONS #480). Timothy, 16 Nov, with Duolingo's
 * streak screens beside him: "after u complete a lesson have a fire icon
 * turn bright orange and add a ticker that increases from day > day after
 * so 3 > 4".
 *
 * One full screen, on the exit that leaves the results of the take that
 * first made today count: the flame starts unlit on yesterday's count,
 * lights, and the count rolls to today's. Pure, so when it shows and what
 * it says can be read and tested apart from the screen
 * (`components/StreakMoment.tsx` draws it, `app/rep/page.tsx` owes it).
 *
 * When, and only then:
 *  - the take made today count: the stored streak has today in it, and
 *    it did not before the take (`celebratesStreak`, #226). A second take
 *    of a day already spoken never shows it; neither does a take whose
 *    row never landed, nor a take too short to count (inside 1.5s, or
 *    unheard: nothing is stored, so the streak never moved, #406).
 *  - once a day on this phone: a day it was shown on never shows it
 *    again, whatever a stale read says (`ethos.streak.moment`).
 *
 * What it says is the stored count and nothing else. Yesterday's number is
 * the streak as it stood before today's take; a freeze bridges a gap and
 * never adds a day (lib/streak.ts), so a run carried over Wednesday by a
 * freeze rolls 3 to 4, with Wednesday drawn as a freeze in the week and
 * named under the line. A first day, or a day after a break, goes 0 to 1.
 * No line here ever mentions losing it.
 */

import { celebratesStreak } from "./rep-screen";
import { weekStart } from "./level";
import { CHIME, MILESTONE_CHIME } from "./sfx";
import { SPRING, springMs } from "./spring";
import { DURATION } from "./motion";
import { computeStreak, type StreakState } from "./streak";

export type DayMark = "spoken" | "frozen" | "open";

export interface MomentDay {
  /** M, T, W, T, F, S, S. */
  label: string;
  /** Spoken (today always is, here), carried by a freeze, or neither. */
  mark: DayMark;
  today: boolean;
}

export interface StreakMomentView {
  /** Yesterday's count: the number the moment opens on, the flame unlit. */
  from: number;
  /** Today's: the number it rolls to as the flame lights. */
  to: number;
  /** This week, Monday first, today spoken. */
  week: MomentDay[];
  /** The days just before today a freeze carried, oldest first: the gap this take crossed. */
  bridged: Date[];
  /** The local day it belongs to (`dayKey`), for once a day. */
  day: string;
  /** 7, 14 and 30 days: the chime is the milestone's (#140). */
  milestone: boolean;
}

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayBefore(now: Date, n: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
}

/**
 * The moment the take that just landed is owed, or null. `streak` is the
 * stored streak read back after the take (freezes counted), `before` what
 * the screen knew before it (null when that read failed), `repDates` and
 * `frozenDays` everything the streak was counted from.
 */
export function streakMoment(p: {
  streak: StreakState;
  before: { didToday: boolean } | null;
  repDates: Date[];
  frozenDays: Date[];
  now: Date;
  /** The day this phone last showed the moment (`momentShownOn`). */
  shownOn: string | null;
}): StreakMomentView | null {
  if (!celebratesStreak(p.streak, p.before)) return null;
  const day = dayKey(p.now);
  if (p.shownOn === day) return null;
  const to = p.streak.current;
  /* Yesterday's count is the streak as it stood before today's take: the
     same count over every stored day but today. Today adds exactly one
     day to a run that reached yesterday, or starts one, so it is always
     one under today's; the clamp keeps a torn read from rolling down. */
  const earlier = p.repDates.filter((d) => dayKey(d) !== day && d.getTime() <= p.now.getTime());
  const before = computeStreak(earlier, p.now, p.frozenDays).current;
  const from = Math.max(0, Math.min(before, to - 1));
  return {
    from,
    to,
    week: momentWeek(p.repDates, p.frozenDays, p.now),
    bridged: from > 0 ? bridgedDays(p.frozenDays, p.now, p.repDates) : [],
    day,
    milestone: to === 7 || to === 14 || to === 30,
  };
}

/** This week, Monday first: each day spoken, frozen or open, today spoken. */
export function momentWeek(repDates: Date[], frozenDays: Date[], now: Date): MomentDay[] {
  const start = weekStart(now);
  const today = dayKey(now);
  const spoken = new Set(repDates.filter((d) => d.getTime() <= now.getTime()).map(dayKey));
  spoken.add(today);
  const frozen = new Set(frozenDays.map(dayKey));
  return LABELS.map((label, i) => {
    const k = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    return { label, mark: spoken.has(k) ? "spoken" : frozen.has(k) ? "frozen" : "open", today: k === today };
  });
}

/**
 * The frozen days running back from yesterday, oldest first: the gap
 * today's take crossed. A day with a recording on it was spoken, whatever
 * freeze was also filed for it (the week row draws it spoken), so it is
 * never named as a freeze and the gap ends there.
 */
export function bridgedDays(frozenDays: Date[], now: Date, repDates: Date[] = []): Date[] {
  const frozen = new Set(frozenDays.map(dayKey));
  const spoken = new Set(repDates.map(dayKey));
  const out: Date[] = [];
  for (let n = 1; n <= 7; n++) {
    const k = dayKey(dayBefore(now, n));
    if (!frozen.has(k) || spoken.has(k)) break;
    out.unshift(dayBefore(now, n));
  }
  return out;
}

/**
 * The moment's one line, "4 days running": the count, drawn large where
 * it rolls, over the words that finish it (`streakLabel`). It stands as
 * the screen's title, so it takes no full stop (COPY-RULES, #454). One
 * grammar for every count, a first day included: "1 day running".
 */
export function streakLine(to: number): string {
  return `${to} ${streakLabel(to)}`;
}

/** The words under the count: "days running", "day running". */
export function streakLabel(to: number): string {
  return to === 1 ? "day running" : "days running";
}

/**
 * Under it, only when a freeze carried the run to today, said where the
 * freeze is spent (COPY-RULES, placement): "A freeze covered Wednesday."
 */
export function freezeLine(bridged: Date[]): string | null {
  if (bridged.length === 0) return null;
  const names = bridged.map((d) => WEEKDAY[d.getDay()]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.length === 1 ? "A freeze" : "Freezes"} covered ${list}.`;
}

/**
 * The moment's clock, in ms from its first frame. The screen arrives,
 * the flame lights as the chime starts, and the count rolls on the
 * chime's landing note (#226), with today's day filling under it; the
 * line comes in once the count has turned. Reduced motion draws the end.
 */
export function momentTimeline(milestone: boolean): {
  lightAt: number;
  rollAt: number;
  rollMs: number;
  lineAt: number;
  end: number;
} {
  const notes = milestone ? MILESTONE_CHIME : CHIME;
  const lightAt = DURATION.max;
  const rollAt = lightAt + Math.round(notes[notes.length - 1].at * 1000);
  const rollMs = springMs(SPRING.base);
  const lineAt = rollAt + DURATION.base;
  return { lightAt, rollAt, rollMs, lineAt, end: Math.max(rollAt + rollMs, lineAt + DURATION.base) };
}

/**
 * The odometer: each place of today's count against yesterday's, from
 * the right, with whether it turns. 9 to 10 turns both places, the tens
 * arriving from nothing; 3 to 4 turns one. Tabular figures keep every
 * place one width.
 */
export function odometer(from: number, to: number): { was: string; now: string; turns: boolean }[] {
  const a = String(from);
  const b = String(to);
  const width = Math.max(a.length, b.length);
  const pa = a.padStart(width, " ");
  const pb = b.padStart(width, " ");
  return [...pb].map((ch, i) => {
    const was = pa[i] === " " ? "" : pa[i];
    const now = ch === " " ? "" : ch;
    return { was, now, turns: was !== now };
  });
}

const KEY = "ethos.streak.moment";

/** The local day this phone last showed the moment, or null. */
export function momentShownOn(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markMomentShown(day: string): void {
  try {
    localStorage.setItem(KEY, day);
  } catch {}
}
