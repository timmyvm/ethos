/**
 * The test's days, the pure half of tester presence (#402,
 * docs/testers.md): which day of the test it is, which days a tester
 * spoke on since joining, what today still needs, and when the test is
 * over. Today's eyebrow, its test tile and Settings' row read these.
 *
 * Every day here is a calendar day in the test's own zone
 * (content/tester.ts `TEST.zone`, Melbourne), the calendar the window
 * was announced on and the report counts `days_spoken` on (0022). A
 * recording at 23:50 on 30 October in Melbourne is day 1 whatever zone
 * the phone or the server is in, and the one ten minutes later is day 2.
 * Days are "YYYY-MM-DD" keys and arithmetic on them is by date parts, so
 * a daylight saving change never moves a day.
 */

import { TEST } from "@/content/tester";
import { pausedTester, type TesterRow } from "./tester";

/** Before the first day, the fourteen days, the week after (the tile stays), and gone. */
export type TestPhase = "before" | "on" | "after" | "gone";

/**
 * One day on the road. `before`: before the tester joined, nothing was
 * asked yet. `spoken`: a recording counted. `open`: today, not yet.
 * `missed`: a day gone by with none (drawn as an empty trough, never an
 * X). `ahead`: still to come. `unknown`: the history read failed.
 */
export type SlotState = "spoken" | "open" | "missed" | "ahead" | "before" | "unknown";

export interface TestSlot {
  key: string;
  state: SlotState;
  today: boolean;
}

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function utcOf(key: string): number {
  const m = KEY.exec(key);
  if (!m) throw new Error(`not a day key: ${key}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Calendar days from day key a to day key b, by date parts. */
export function keyDiff(a: string, b: string): number {
  return Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
}

/** The key n days after `key`. */
export function addDays(key: string, n: number): string {
  const d = new Date(utcOf(key) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** The calendar day an instant falls on in a zone ("YYYY-MM-DD"), the test's zone by default. */
export function zoneDayKey(at: Date | number | string, zone: string = TEST.zone): string {
  let f = formats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    formats.set(zone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The test's day for a day key: 1 on the first day, `TEST.days` on the last, 0 or less before it. */
export function testDay(today: string): number {
  return keyDiff(TEST.first, today) + 1;
}

/** before: day under 1 · on: 1 to TEST.days · after: the week that follows · gone: from then on. */
export function testPhase(day: number): TestPhase {
  if (day < 1) return "before";
  if (day <= TEST.days) return "on";
  if (day <= TEST.days + TEST.shownAfter) return "after";
  return "gone";
}

/** The window's days, first to last. */
export function testKeys(): string[] {
  return Array.from({ length: TEST.days }, (_, i) => addDays(TEST.first, i));
}

/**
 * The road: the test's days, each with its state, and the count of days
 * spoken. A recording counts from the moment the tester joined (the
 * report's rule in 0022: recordings since joining, by day); with no join
 * time (the row failed, or has none) every recording in the window
 * counts. `spoken` null is a failed history read: every day unknown and
 * no count, never a zero.
 */
export function testRoad({
  today,
  joined,
  spoken,
}: {
  /** Today's key, in the test's zone. */
  today: string;
  /** testers.created_at; null counts from the first day. */
  joined: string | null;
  /** Every recording's created_at; null when the history read failed. */
  spoken: readonly string[] | null;
}): { slots: TestSlot[]; spoken: number | null; spokenToday: boolean | null } {
  const keys = testKeys();
  const joinedAt = joined ? Date.parse(joined) : NaN;
  const joinedKey = Number.isFinite(joinedAt) ? zoneDayKey(joinedAt) : null;
  const days = new Set<string>();
  for (const at of spoken ?? []) {
    const t = Date.parse(at);
    if (!Number.isFinite(t)) continue;
    if (Number.isFinite(joinedAt) && t < joinedAt) continue;
    days.add(zoneDayKey(t));
  }
  const slots = keys.map((key): TestSlot => {
    const isToday = key === today;
    let state: SlotState;
    if (spoken === null) state = "unknown";
    else if (joinedKey !== null && key < joinedKey) state = "before";
    else if (days.has(key)) state = "spoken";
    else if (isToday) state = "open";
    else if (key < today) state = "missed";
    else state = "ahead";
    return { key, state, today: isToday };
  });
  if (spoken === null) return { slots, spoken: null, spokenToday: null };
  return {
    slots,
    spoken: slots.filter((s) => s.state === "spoken").length,
    spokenToday: slots.some((s) => s.today && s.state === "spoken"),
  };
}

/** The tile's one ask, in the order it is chased (§7 of the presence spec). */
export type TestAsk =
  | { kind: "wait" }
  | { kind: "none" }
  | { kind: "paused" }
  | { kind: "send" }
  | { kind: "record" }
  | { kind: "answer"; repId: string; index: number | null }
  | { kind: "done"; day: number }
  | { kind: "last" }
  | { kind: "over" };

/** Today's question after the score, as the tile knows it. */
export type TodayAnswer =
  | { state: "none" }
  | { state: "loading" }
  | { state: "answered" }
  | { state: "open"; repId: string; index: number | null }
  | { state: "failed" };

/**
 * What the tile asks for, first match wins. During the test: wait for the
 * row; a paused tester agrees again (nothing is kept until they do); an
 * unsent tester number is sent (it is how Timothy pays them); a failed
 * history asks nothing it cannot back; then speak today, answer today's
 * question, or the day is done. In the week after: send the number while
 * it is unsent, else the test is over.
 */
export function testAsk(a: {
  phase: "on" | "after";
  day: number;
  tester: "loading" | "failed" | TesterRow;
  number: string | null;
  sent: boolean;
  spokenToday: boolean | null;
  answer: TodayAnswer;
}): TestAsk {
  const unsent = !!a.number && !a.sent;
  if (a.phase === "after") return unsent ? { kind: "send" } : { kind: "over" };
  if (a.tester === "loading") return { kind: "wait" };
  if (a.tester !== "failed" && pausedTester(a.tester)) return { kind: "paused" };
  if (unsent) return { kind: "send" };
  if (a.spokenToday === null) return { kind: "none" };
  if (!a.spokenToday) return { kind: "record" };
  if (a.answer.state === "loading") return { kind: "wait" };
  if (a.answer.state === "open") return { kind: "answer", repId: a.answer.repId, index: a.answer.index };
  return a.day >= TEST.days ? { kind: "last" } : { kind: "done", day: a.day };
}
